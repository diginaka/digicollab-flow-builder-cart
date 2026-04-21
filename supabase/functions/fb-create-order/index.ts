/**
 * fb-create-order
 * 用途: tpl-checkoutから呼ばれる、3決済方式統合エントリポイント
 * 認証: なし（verify_jwt=false、anon呼出可）
 *
 * Phase 4-B 追加:
 * - `booking_appointment_id` があれば予約決済モード
 *   - fb_booking_appointments + fb_bookings から価格・タイトルを取得
 *   - 価格はクライアント送信値を信頼せずサーバ側で再SELECT
 *   - 有料（price > 0）のみ処理。¥0 は fb-confirm-free-booking へ誘導
 *   - 予約決済は Stripe カード決済のみ（手動振込は予約ホールド切れリスクのため不可）
 *   - metadata に booking_appointment_id を含めて webhook へ伝播
 *   - fb_orders.product_id は NULL、booking_appointment_id にリンク
 */
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/errors.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { getStripeClient } from '../_shared/stripe.ts'
import {
  isSaleActive,
  isCouponValid,
  calculatePrice,
} from '../_shared/pricing.ts'
import type {
  CreateOrderRequest,
  FbProduct,
  FbCoupon,
  FbStripeConnection,
  FbOrder,
  PaymentMethod,
} from '../_shared/types.ts'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const UUID_RE = /^[0-9a-f-]{36}$/i

interface BookingMeta {
  appointmentId: string
  bookingId: string
  userId: string
  title: string
  price: number
  scheduledAt: string
  durationMinutes: number
  status: string
}

/** booking 決済用の情報を取得 + ガード */
async function loadBookingForPayment(
  service: ReturnType<typeof createServiceClient>,
  appointmentId: string,
): Promise<{ ok: true; meta: BookingMeta } | { ok: false; resp: Response }> {
  const { data, error } = await service
    .from('fb_booking_appointments')
    .select(`
      id,
      booking_id,
      scheduled_at,
      duration_minutes,
      status,
      fb_bookings (
        id,
        user_id,
        title,
        price,
        duration_minutes
      )
    `)
    .eq('id', appointmentId)
    .maybeSingle()

  if (error) {
    return { ok: false, resp: errorResponse(`予約情報の取得に失敗しました: ${error.message}`, 500) }
  }
  if (!data || !data.fb_bookings) {
    return { ok: false, resp: errorResponse('予約が見つかりません', 404) }
  }

  const booking = Array.isArray(data.fb_bookings) ? data.fb_bookings[0] : data.fb_bookings
  const price = booking.price ?? 0

  // 有料エンドポイントで ¥0 を弾く
  if (price === 0) {
    return {
      ok: false,
      resp: new Response(
        JSON.stringify({ success: false, error: 'use_free_booking_endpoint' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  // pending/hold 以外は拒否
  if (!['pending', 'hold'].includes(data.status)) {
    return {
      ok: false,
      resp: new Response(
        JSON.stringify({ success: false, error: 'appointment_not_payable', status: data.status }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  return {
    ok: true,
    meta: {
      appointmentId: data.id,
      bookingId: booking.id,
      userId: booking.user_id,
      title: booking.title,
      price,
      scheduledAt: data.scheduled_at,
      durationMinutes: data.duration_minutes ?? booking.duration_minutes ?? 30,
      status: data.status,
    },
  }
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const body = (await req.json()) as CreateOrderRequest & {
      booking_appointment_id?: string
    }

    const {
      subdomain,
      product_slug,
      buyer_email,
      buyer_name,
      buyer_phone,
      payment_method,
      coupon_code,
      upsell_product_id,
      parent_order_id,
      success_url,
      cancel_url,
      booking_appointment_id,
    } = body

    // ───── 共通バリデーション ─────
    if (!buyer_email || !buyer_name) {
      return errorResponse('購入者情報が不足しています', 400)
    }
    if (!isValidEmail(buyer_email)) {
      return errorResponse('メールアドレスの形式が不正です', 400)
    }
    if (!['stripe', 'paypal', 'bank_transfer'].includes(payment_method)) {
      return errorResponse('payment_methodが不正です', 400)
    }
    if (!success_url || !cancel_url) {
      return errorResponse('success_url と cancel_url は必須です', 400)
    }

    const service = createServiceClient()

    /* ═══════════════════════════════════════════════════════════
     * Phase 4-B: 予約決済モード（有料）
     * ═══════════════════════════════════════════════════════════ */
    if (booking_appointment_id) {
      if (!UUID_RE.test(booking_appointment_id)) {
        return errorResponse('booking_appointment_id の形式が不正です', 400)
      }

      // 予約決済はカードのみ（手動振込は予約ホールドが切れるリスクのため不可）
      if (payment_method !== 'stripe') {
        return errorResponse(
          '予約決済はカード決済のみ対応しています（銀行振込・PayPalは非対応）',
          400,
        )
      }

      const loaded = await loadBookingForPayment(service, booking_appointment_id)
      if (!loaded.ok) return loaded.resp
      const { meta } = loaded
      const userId = meta.userId

      // BYOK資格情報取得
      const { data: connection } = await service
        .from('fb_stripe_connections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      const conn = connection as FbStripeConnection | null
      if (!conn?.stripe_secret_key || !conn?.stripe_enabled) {
        return errorResponse('販売者のStripe設定が未完了です', 400)
      }

      // fb_orders INSERT（product_id は NULL）
      const { data: orderData, error: orderErr } = await service
        .from('fb_orders')
        .insert({
          user_id: userId,
          product_id: null,
          booking_appointment_id: meta.appointmentId,
          buyer_email,
          buyer_name,
          buyer_phone: buyer_phone ?? null,
          payment_method: 'stripe' as PaymentMethod,
          amount_subtotal: meta.price,
          amount_total: meta.price,
          coupon_code: null,
          discount_amount: 0,
          parent_order_id: null,
          payment_status: 'pending',
        })
        .select('*')
        .single()

      if (orderErr || !orderData) {
        console.error('[fb-create-order] booking order insert error:', orderErr)
        return errorResponse('注文の作成に失敗しました', 500)
      }
      const order = orderData as FbOrder

      // Stripe Checkout Session 作成
      try {
        const stripe = getStripeClient(conn.stripe_secret_key)
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'jpy',
                unit_amount: meta.price,
                product_data: {
                  name: meta.title,
                  description: `予約日時: ${new Date(meta.scheduledAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（${meta.durationMinutes}分）`,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: buyer_email,
          success_url: `${success_url}${success_url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}&order=${order.order_number}`,
          cancel_url,
          metadata: {
            fb_order_id: order.id,
            fb_user_id: userId,
            fb_order_number: order.order_number ?? '',
            booking_appointment_id: meta.appointmentId,
            booking_id: meta.bookingId,
          },
          payment_intent_data: {
            metadata: {
              fb_order_id: order.id,
              booking_appointment_id: meta.appointmentId,
            },
          },
        })

        await service
          .from('fb_orders')
          .update({ stripe_session_id: session.id })
          .eq('id', order.id)

        // appointment 側にも checkout session id を記録（Phase 4-A 側が参照する場合に備え）
        await service
          .from('fb_booking_appointments')
          .update({ stripe_checkout_session_id: session.id })
          .eq('id', meta.appointmentId)

        return successResponse({
          order_number: order.order_number,
          payment_method: 'stripe' as PaymentMethod,
          checkout_url: session.url,
          booking_appointment_id: meta.appointmentId,
        })
      } catch (stripeErr) {
        console.error('[fb-create-order] Stripe error (booking):', stripeErr)
        await service
          .from('fb_orders')
          .update({ payment_status: 'cancelled' })
          .eq('id', order.id)
        return errorResponse(
          `Stripe決済の初期化に失敗しました: ${(stripeErr as Error).message}`,
          500,
        )
      }
    }

    /* ═══════════════════════════════════════════════════════════
     * 既存フロー: 商品決済モード
     * ═══════════════════════════════════════════════════════════ */
    if (!subdomain || !product_slug) {
      return errorResponse('必須項目が不足しています', 400)
    }

    // ───── 2. subdomain → user_id ─────
    const { data: sub } = await service
      .from('user_subdomains')
      .select('user_id')
      .eq('subdomain', subdomain)
      .eq('is_active', true)
      .single()

    if (!sub?.user_id) return errorResponse('Invalid subdomain', 404)
    const userId: string = sub.user_id

    // ───── 3. 商品読込 ─────
    let product: FbProduct | null = null
    if (upsell_product_id) {
      const { data } = await service
        .from('fb_products')
        .select('*')
        .eq('id', upsell_product_id)
        .eq('user_id', userId)
        .eq('status', 'published')
        .single()
      product = data as FbProduct | null
    } else {
      const { data } = await service
        .from('fb_products')
        .select('*')
        .eq('user_id', userId)
        .eq('slug', product_slug)
        .eq('status', 'published')
        .single()
      product = data as FbProduct | null
    }

    if (!product) return errorResponse('商品が見つかりません', 404)

    // ───── 4. 在庫チェック ─────
    if (
      product.stock_limit !== null &&
      product.stock_remaining !== null &&
      product.stock_remaining <= 0
    ) {
      return errorResponse('在庫切れです', 400)
    }

    // ───── 5. 価格計算 ─────
    let basePrice: number
    if (upsell_product_id && parent_order_id) {
      const { data: upsellCfg } = await service
        .from('fb_upsells')
        .select('upsell_price')
        .eq('upsell_product_id', upsell_product_id)
        .eq('is_active', true)
        .maybeSingle()
      basePrice = upsellCfg?.upsell_price ?? product.price
    } else {
      basePrice = isSaleActive(product)
        ? (product.sale_price ?? product.price)
        : product.price
    }

    let coupon: FbCoupon | null = null
    if (coupon_code) {
      const { data } = await service
        .from('fb_coupons')
        .select('*')
        .eq('user_id', userId)
        .eq('code', coupon_code)
        .maybeSingle()
      if (!data) {
        return errorResponse('クーポンコードが無効です', 400)
      }
      coupon = data as FbCoupon
      const check = isCouponValid(coupon, product.id)
      if (!check.valid) {
        return errorResponse(check.reason || 'クーポンが使用できません', 400)
      }
    }

    const pricing = calculatePrice(basePrice, coupon)

    // ───── 6. BYOK資格情報取得 ─────
    const { data: connection } = await service
      .from('fb_stripe_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    const conn = connection as FbStripeConnection | null

    // ───── 7. payment_method 分岐 ─────
    if (payment_method === 'paypal') {
      return errorResponse('PayPal決済はPhase 1.5で実装予定です', 501)
    }

    if (payment_method === 'stripe') {
      if (!conn?.stripe_secret_key || !conn?.stripe_enabled) {
        return errorResponse('販売者のStripe設定が未完了です', 400)
      }

      const { data: orderData, error: orderErr } = await service
        .from('fb_orders')
        .insert({
          user_id: userId,
          product_id: product.id,
          buyer_email,
          buyer_name,
          buyer_phone: buyer_phone ?? null,
          payment_method,
          amount_subtotal: pricing.amount_subtotal,
          amount_total: pricing.amount_total,
          coupon_code: coupon?.code ?? null,
          discount_amount: pricing.discount_amount,
          parent_order_id: parent_order_id ?? null,
          payment_status: 'pending',
        })
        .select('*')
        .single()

      if (orderErr || !orderData) {
        console.error('[fb-create-order] order insert error:', orderErr)
        return errorResponse('注文の作成に失敗しました', 500)
      }
      const order = orderData as FbOrder

      try {
        const stripe = getStripeClient(conn.stripe_secret_key)
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: (product.currency || 'jpy').toLowerCase(),
                unit_amount: pricing.amount_total,
                product_data: {
                  name: product.title,
                  description: product.description ?? undefined,
                  images: product.thumbnail_url ? [product.thumbnail_url] : undefined,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: buyer_email,
          success_url: `${success_url}${success_url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}&order=${order.order_number}`,
          cancel_url,
          metadata: {
            fb_order_id: order.id,
            fb_user_id: userId,
            fb_product_id: product.id,
            fb_order_number: order.order_number ?? '',
          },
        })

        await service
          .from('fb_orders')
          .update({ stripe_session_id: session.id })
          .eq('id', order.id)

        return successResponse({
          order_number: order.order_number,
          payment_method: 'stripe' as PaymentMethod,
          checkout_url: session.url,
        })
      } catch (stripeErr) {
        console.error('[fb-create-order] Stripe error:', stripeErr)
        await service
          .from('fb_orders')
          .update({ payment_status: 'cancelled' })
          .eq('id', order.id)
        return errorResponse(
          `Stripe決済の初期化に失敗しました: ${(stripeErr as Error).message}`,
          500,
        )
      }
    }

    if (payment_method === 'bank_transfer') {
      if (!conn?.bank_transfer_enabled || !conn?.bank_info) {
        return errorResponse('販売者の銀行振込設定が未完了です', 400)
      }

      const { data: orderData, error: orderErr } = await service
        .from('fb_orders')
        .insert({
          user_id: userId,
          product_id: product.id,
          buyer_email,
          buyer_name,
          buyer_phone: buyer_phone ?? null,
          payment_method,
          amount_subtotal: pricing.amount_subtotal,
          amount_total: pricing.amount_total,
          coupon_code: coupon?.code ?? null,
          discount_amount: pricing.discount_amount,
          parent_order_id: parent_order_id ?? null,
          payment_status: 'awaiting_payment',
        })
        .select('*')
        .single()

      if (orderErr || !orderData) {
        console.error('[fb-create-order] order insert error:', orderErr)
        return errorResponse('注文の作成に失敗しました', 500)
      }
      const order = orderData as FbOrder

      return successResponse({
        order_number: order.order_number,
        payment_method: 'bank_transfer' as PaymentMethod,
        amount_total: pricing.amount_total,
        bank_info: conn.bank_info,
        next_url: `${success_url}${success_url.includes('?') ? '&' : '?'}order=${order.order_number}`,
      })
    }

    return errorResponse('未対応の決済方式です', 400)
  } catch (err) {
    console.error('[fb-create-order] error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
