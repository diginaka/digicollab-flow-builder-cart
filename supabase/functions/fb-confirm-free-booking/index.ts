/**
 * fb-confirm-free-booking (Phase 4-B 新規)
 * 用途: fb_bookings.price === 0 の予約を Stripe を通さず直接確定する
 * 認証: なし（verify_jwt=false、booking_appointment_id の推測困難性で保護）
 *
 * 処理フロー:
 * 1. booking_appointment_id を受け取る
 * 2. fb_booking_appointments + fb_bookings を取得
 * 3. ガード: price !== 0 → use_paid_endpoint / status が pending|hold 以外 → appointment_not_confirmable
 * 4. fb_booking_appointments を UPDATE（status='confirmed', payment_status='paid'）
 * 5. fb_orders を INSERT（¥0 注文として記録、product_id=NULL、booking_appointment_id=...）
 * 6. 成功応答
 *
 * 冪等性:
 * - UPDATE 条件に .in(['pending', 'hold']) を付けて二重 confirmed を防ぐ
 * - 既に confirmed な場合は 409 で弾く
 */
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/errors.ts'
import { createServiceClient } from '../_shared/supabase.ts'

const UUID_RE = /^[0-9a-f-]{36}$/i

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const body = await req.json() as {
      booking_appointment_id?: string
      buyer_email?: string
      buyer_name?: string
      buyer_phone?: string
    }

    const { booking_appointment_id, buyer_email, buyer_name, buyer_phone } = body

    if (!booking_appointment_id || !UUID_RE.test(booking_appointment_id)) {
      return errorResponse('booking_appointment_id が不正です', 400)
    }

    const service = createServiceClient()

    // ───── appointment + booking を取得 ─────
    const { data, error } = await service
      .from('fb_booking_appointments')
      .select(`
        id,
        booking_id,
        guest_email,
        guest_name,
        guest_phone,
        status,
        fb_bookings (
          id,
          user_id,
          title,
          price
        )
      `)
      .eq('id', booking_appointment_id)
      .maybeSingle()

    if (error) {
      console.error('[fb-confirm-free-booking] fetch error:', error)
      return errorResponse(`予約情報の取得に失敗しました: ${error.message}`, 500)
    }
    if (!data || !data.fb_bookings) {
      return new Response(
        JSON.stringify({ success: false, error: 'appointment_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const booking = Array.isArray(data.fb_bookings) ? data.fb_bookings[0] : data.fb_bookings
    const price = booking.price ?? 0

    // ───── ガード: 有料予約は拒否 ─────
    if (price !== 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'use_paid_endpoint' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // ───── ガード: 確定可能な状態か ─────
    if (!['pending', 'hold'].includes(data.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'appointment_not_confirmable',
          status: data.status,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // ───── appointment を confirmed + paid に UPDATE（冪等性ガード付き）─────
    const { data: updatedAppt, error: updErr } = await service
      .from('fb_booking_appointments')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
      })
      .eq('id', booking_appointment_id)
      .in('status', ['pending', 'hold']) // 並行リクエストで二重更新を防ぐ
      .select('id')
      .maybeSingle()

    if (updErr) {
      console.error('[fb-confirm-free-booking] update error:', updErr)
      return errorResponse('予約の更新に失敗しました', 500)
    }
    if (!updatedAppt) {
      // .in() 条件で0件 = 並行で既に確定された
      return new Response(
        JSON.stringify({ success: false, error: 'appointment_already_processed' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // ───── fb_orders に ¥0 注文として記録 ─────
    // product_id は NULL（DBスキーマで NULLABLE に変更済み）
    const email = (buyer_email && isValidEmail(buyer_email)) ? buyer_email : data.guest_email
    const name = buyer_name || data.guest_name || ''
    const phone = buyer_phone || data.guest_phone || null

    const { data: orderData, error: orderErr } = await service
      .from('fb_orders')
      .insert({
        user_id: booking.user_id,
        product_id: null,
        booking_appointment_id: booking_appointment_id,
        buyer_email: email,
        buyer_name: name,
        buyer_phone: phone,
        payment_method: 'stripe', // 無料も便宜上 stripe カテゴリ（CHECK制約上の要件）
        amount_subtotal: 0,
        amount_total: 0,
        coupon_code: null,
        discount_amount: 0,
        parent_order_id: null,
        payment_status: 'paid',
        stripe_session_id: null,
        stripe_payment_intent_id: null,
        paid_at: new Date().toISOString(),
      })
      .select('id, order_number')
      .single()

    if (orderErr) {
      // appointment は既に confirmed 済み → 手動リカバリ用のログのみ
      console.error(
        '[fb-confirm-free-booking] fb_orders insert failed (appointment already confirmed):',
        {
          appointment_id: booking_appointment_id,
          error: orderErr.message,
        },
      )
      // 200 で返す（appointment 更新は成功しているため）
      return successResponse({
        appointment_id: booking_appointment_id,
        order_id: null,
        order_number: null,
        warning: 'order_record_failed_but_appointment_confirmed',
      })
    }

    return successResponse({
      appointment_id: booking_appointment_id,
      order_id: orderData.id,
      order_number: orderData.order_number,
    })
  } catch (err) {
    console.error('[fb-confirm-free-booking] error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
