/**
 * Phase 4-B: tpl-checkout（page-renderer 側）用の URL パラメータ解析ヘルパー
 *
 * - `?booking_appointment_id={uuid}` があれば booking モード
 * - それ以外は product モード（既存）
 *
 * NOTE: このカートリポジトリ自体には購入者向け CheckoutPage は存在しない
 * （page.digicollabo.com の page-renderer 側が tpl-checkout を担当）。
 * このユーティリティは page-renderer 側から import して使うためのライブラリとして用意。
 */

const UUID_RE = /^[0-9a-f-]{36}$/i

export type CheckoutMode = 'product' | 'booking'

export interface CheckoutContext {
  mode: CheckoutMode
  funnelId: string
  /** product モードのみ */
  productId?: string
  productSlug?: string
  /** booking モードのみ */
  bookingAppointmentId?: string
}

export function parseCheckoutParams(search: string): CheckoutContext {
  const params = new URLSearchParams(search)
  const bookingAppointmentId = params.get('booking_appointment_id')

  if (bookingAppointmentId && UUID_RE.test(bookingAppointmentId)) {
    return {
      mode: 'booking',
      funnelId: params.get('f') ?? '',
      bookingAppointmentId,
    }
  }

  return {
    mode: 'product',
    funnelId: params.get('f') ?? '',
    productId: params.get('p') ?? undefined,
    productSlug: params.get('slug') ?? undefined,
  }
}
