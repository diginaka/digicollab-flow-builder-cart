/**
 * fb-stripe-webhook
 * 用途: ユーザーごとに独立したStripe Webhookを受信し、注文ステータスを更新
 * 認証: なし（verify_jwt=false）- Stripe署名検証で代替
 *
 * URL: /functions/v1/fb-stripe-webhook?t=<webhook_token>
 * ※ webhook_token は fb_stripe_connections から逆引き
 */
import { handleCors } from '../_shared/cors.ts'
import { rawJsonResponse, errorResponse } from '../_shared/errors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { getStripeClient } from '../_shared/stripe.ts'
import { notifyOrderPaid } from '../_shared/automation.ts'
import type { FbOrder, FbStripeConnection, OrderPaidPayload } from '../_shared/types.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const url = new URL(req.url)
  const webhookToken = url.searchParams.get('t')
  if (!webhookToken) {
    return errorResponse('webhook_token (t) が必要です', 400)
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return errorResponse('stripe-signature ヘッダが必要です', 400)
  }

  const rawBody = await req.text()
  const service = createServiceClient()

  // ───── 1. webhook_token → ユーザーのStripe接続 ─────
  const { data: connection } = await service
    .from('fb_stripe_connections')
    .select('*')
    .eq('webhook_token', webhookToken)
    .maybeSingle()

  const conn = connection as FbStripeConnection | null
  if (!conn?.stripe_secret_key || !conn?.stripe_webhook_secret) {
    return errorResponse('無効なwebhook_tokenまたはwebhook未設定です', 400)
  }

  // ───── 2. Stripe署名検証 ─────
  const stripe = getStripeClient(conn.stripe_secret_key)
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      conn.stripe_webhook_secret,
    )
  } catch (err) {
    console.error('[fb-stripe-webhook] signature verification failed:', err)
    return errorResponse(`署名検証失敗: ${(err as Error).message}`, 400)
  }

  // ───── 3. fb_webhook_events にUPSERT（冪等性） ─────
  const eventId = event.id
  const eventType = event.type

  const { data: existingEvent } = await service
    .from('fb_webhook_events')
    .select('id, status')
    .eq('provider', 'stripe')
    .eq('event_id', eventId)
    .maybeSingle()

  if (existingEvent && existingEvent.status === 'processed') {
    // 既に処理済 → 重複を無視
    console.log(`[fb-stripe-webhook] duplicate event ${eventId}, skipping`)
    return rawJsonResponse({ received: true, duplicate: true })
  }

  // INSERT or UPDATE
  if (!existingEvent) {
    await service.from('fb_webhook_events').insert({
      provider: 'stripe',
      event_id: eventId,
      event_type: eventType,
      payload: event as unknown as Record<string, unknown>,
      status: 'received',
    })
  }

  // ───── 4. イベント処理 ─────
  let orderIdForNotify: string | null = null
  let processingError: string | null = null

  try {
    switch (eventType) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded': {
        const session = event.data.object as {
          id?: string
          payment_intent?: string
          metadata?: { fb_order_id?: string; booking_appointment_id?: string }
        }
        const fbOrderId = session.metadata?.fb_order_id
        const bookingAppointmentId = session.metadata?.booking_appointment_id
        if (!fbOrderId) {
          console.warn(
            `[fb-stripe-webhook] ${eventType} missing fb_order_id metadata`,
          )
          break
        }
        const updates: Record<string, unknown> = {
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
        }
        if (session.payment_intent) {
          updates.stripe_payment_intent_id = session.payment_intent
        }
        await service.from('fb_orders').update(updates).eq('id', fbOrderId)
        orderIdForNotify = fbOrderId

        // ───── Phase 4-B: booking 決済なら fb_booking_appointments も更新 ─────
        if (bookingAppointmentId) {
          const { data: updatedAppt, error: apptErr } = await service
            .from('fb_booking_appointments')
            .update({
              status: 'confirmed',
              payment_status: 'paid',
              ...(session.payment_intent
                ? { stripe_payment_intent_id: session.payment_intent }
                : {}),
            })
            .eq('id', bookingAppointmentId)
            .in('status', ['pending', 'hold']) // 二重 confirmed 防止 + 既に cancelled/expired は触らない
            .select('id')

          if (apptErr) {
            // fb_orders は既に paid 更新済み → アラート相当のログで手動リカバリ
            console.error(
              '[fb-stripe-webhook] booking_appointment update failed',
              {
                kind: 'phase4b_booking_update_failed',
                appointment_id: bookingAppointmentId,
                fb_order_id: fbOrderId,
                error: apptErr.message,
              },
            )
          } else if (!updatedAppt || updatedAppt.length === 0) {
            // 既に cancelled/expired な予約に Stripe 決済が成立したレアケース
            console.warn(
              '[fb-stripe-webhook] appointment not updated (already processed or invalid state)',
              { appointment_id: bookingAppointmentId, fb_order_id: fbOrderId },
            )
          }
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as {
          payment_intent?: string
        }
        if (charge.payment_intent) {
          await service
            .from('fb_orders')
            .update({ payment_status: 'refunded' })
            .eq('stripe_payment_intent_id', charge.payment_intent)
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as { id?: string }
        if (session.id) {
          await service
            .from('fb_orders')
            .update({ payment_status: 'cancelled' })
            .eq('stripe_session_id', session.id)
        }
        break
      }

      default:
        console.log(`[fb-stripe-webhook] unhandled event type: ${eventType}`)
    }

    // ───── 5. fb_webhook_events を processed に ─────
    await service
      .from('fb_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('provider', 'stripe')
      .eq('event_id', eventId)
  } catch (err) {
    processingError = (err as Error).message
    console.error('[fb-stripe-webhook] processing error:', err)
    await service
      .from('fb_webhook_events')
      .update({
        status: 'failed',
        error_message: processingError,
      })
      .eq('provider', 'stripe')
      .eq('event_id', eventId)
  }

  // ───── 6. 後続オートメーション（paid時のみ） ─────
  if (orderIdForNotify) {
    const { data: orderData } = await service
      .from('fb_orders')
      .select('*')
      .eq('id', orderIdForNotify)
      .single()
    const order = orderData as FbOrder | null
    if (order) {
      const payload: OrderPaidPayload = {
        order_id: order.id,
        order_number: order.order_number ?? '',
        user_id: order.user_id,
        product_id: order.product_id,
        booking_appointment_id: order.booking_appointment_id ?? null,
        buyer_email: order.buyer_email,
        buyer_name: order.buyer_name,
        amount_total: order.amount_total,
        payment_method: order.payment_method,
        paid_at: order.paid_at ?? new Date().toISOString(),
      }
      // 非同期で起動（結果を待たない）
      notifyOrderPaid(payload).catch((e) =>
        console.error('[fb-stripe-webhook] notify error:', e),
      )
    }
  }

  // Stripeには常に200を返す（再送回避）
  return rawJsonResponse({ received: true })
})
