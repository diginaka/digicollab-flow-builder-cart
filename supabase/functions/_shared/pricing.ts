/**
 * 価格計算ロジック（ベース価格・セール・クーポン適用）
 */
import type { FbProduct, FbCoupon } from './types.ts'

export interface PriceCalculation {
  base_price: number
  discount_amount: number
  amount_subtotal: number
  amount_total: number
  coupon_applied: boolean
}

/** セール価格が有効期間内か判定 */
export function isSaleActive(product: FbProduct): boolean {
  if (!product.sale_price) return false
  if (!product.sale_end_date) return true // 期限なし
  return new Date(product.sale_end_date) > new Date()
}

/** クーポンが使用可能か判定 */
export function isCouponValid(
  coupon: FbCoupon,
  productId: string,
): { valid: boolean; reason?: string } {
  if (coupon.is_active === false) return { valid: false, reason: 'クーポンは無効です' }

  // 商品紐付きクーポンのチェック
  if (coupon.product_id && coupon.product_id !== productId) {
    return { valid: false, reason: 'このクーポンは対象商品で使用できません' }
  }

  // 有効期間チェック
  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, reason: 'クーポンはまだ有効ではありません' }
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, reason: 'クーポンの有効期限が切れています' }
  }

  // 使用回数チェック
  if (
    coupon.max_uses !== null &&
    (coupon.current_uses ?? 0) >= coupon.max_uses
  ) {
    return { valid: false, reason: 'クーポンの使用上限に達しています' }
  }

  return { valid: true }
}

/**
 * 最終価格を計算
 * @param basePrice - 基本価格（セール適用後）
 * @param coupon - クーポン（未使用ならnull）
 */
export function calculatePrice(
  basePrice: number,
  coupon: FbCoupon | null,
): PriceCalculation {
  let discountAmount = 0

  if (coupon) {
    if (coupon.discount_type === 'percent') {
      discountAmount = Math.floor(
        (basePrice * coupon.discount_value) / 100,
      )
    } else {
      discountAmount = coupon.discount_value
    }
    // 割引額が基本価格を超えないように
    discountAmount = Math.min(discountAmount, basePrice)
  }

  const amountTotal = Math.max(0, basePrice - discountAmount)

  return {
    base_price: basePrice,
    discount_amount: discountAmount,
    amount_subtotal: basePrice,
    amount_total: amountTotal,
    coupon_applied: coupon !== null && discountAmount > 0,
  }
}
