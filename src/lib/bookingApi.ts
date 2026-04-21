/**
 * Phase 4-B: 予約決済用 API ラッパー
 *
 * tpl-checkout（page-renderer 側）から fb_booking_appointments + fb_bookings を
 * JOIN 取得して決済UIをレンダリングするためのヘルパー。
 *
 * DB実態に合わせた対応:
 * - fb_booking_appointments.scheduled_at（仕様書の start_time は存在しない）
 * - fb_bookings.price は nullable → null/0 は「無料」扱い
 * - fb_bookings.duration_minutes も nullable → appointment 側の duration_minutes を優先
 */
import { supabase } from './supabase'

export interface BookingCheckoutData {
  appointmentId: string
  bookingId: string
  title: string
  /** 税込円、null は無料として扱う（price === null でも 0 と同等） */
  price: number
  /** ISO8601 */
  scheduledAt: string
  durationMinutes: number
  meetingType: string | null
  hostName: string | null
  cancelToken: string
  currentStatus: string
  currentPaymentStatus: string
}

export type BookingFetchError =
  | { kind: 'not_found' }
  | { kind: 'already_confirmed' }
  | { kind: 'invalid_state'; status: string }
  | { kind: 'expired_slot' }
  | { kind: 'query_error'; message: string }

export type BookingFetchResult =
  | { ok: true; data: BookingCheckoutData }
  | { ok: false; error: BookingFetchError }

/**
 * 決済UI表示用に appointment + booking を取得し、状態ガードを適用
 */
export async function fetchBookingForCheckout(
  appointmentId: string,
): Promise<BookingFetchResult> {
  const { data, error } = await supabase
    .from('fb_booking_appointments')
    .select(`
      id,
      booking_id,
      scheduled_at,
      duration_minutes,
      status,
      payment_status,
      cancel_token,
      fb_bookings (
        id,
        title,
        price,
        duration_minutes,
        meeting_type,
        host_name
      )
    `)
    .eq('id', appointmentId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: { kind: 'query_error', message: error.message } }
  }
  if (!data || !data.fb_bookings) {
    return { ok: false, error: { kind: 'not_found' } }
  }

  const booking = Array.isArray(data.fb_bookings) ? data.fb_bookings[0] : data.fb_bookings

  // 既に決済完了
  if (data.status === 'confirmed' && data.payment_status === 'paid') {
    return { ok: false, error: { kind: 'already_confirmed' } }
  }
  // キャンセル/期限切れ
  if (data.status === 'cancelled' || data.status === 'expired') {
    return { ok: false, error: { kind: 'invalid_state', status: data.status } }
  }
  // 予約時刻を過ぎている
  if (new Date(data.scheduled_at) < new Date()) {
    return { ok: false, error: { kind: 'expired_slot' } }
  }

  return {
    ok: true,
    data: {
      appointmentId: data.id,
      bookingId: booking.id,
      title: booking.title,
      price: booking.price ?? 0,
      scheduledAt: data.scheduled_at,
      durationMinutes: data.duration_minutes ?? booking.duration_minutes ?? 30,
      meetingType: booking.meeting_type ?? null,
      hostName: booking.host_name ?? null,
      cancelToken: data.cancel_token,
      currentStatus: data.status,
      currentPaymentStatus: data.payment_status,
    },
  }
}

/** 価格が 0 (または null) なら無料予約扱い */
export function isFreeBooking(price: number | null | undefined): boolean {
  return price == null || price === 0
}

/**
 * 無料予約の確定エンドポイントを呼び出す
 * （tpl-checkout の「無料相談を確定する」ボタンから）
 */
export async function confirmFreeBooking(params: {
  booking_appointment_id: string
  funnel_id?: string
  buyer_email?: string
  buyer_name?: string
}): Promise<{
  success: boolean
  order_id?: string
  order_number?: string
  redirect_to?: string
  error?: string
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${supabaseUrl}/functions/v1/fb-confirm-free-booking`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  return res.json().catch(() => ({ success: false, error: 'parse_error' }))
}
