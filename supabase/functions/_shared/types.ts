/**
 * フロービルダー決済モジュール 共通型定義
 */

export type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer'

export type PaymentStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'cancelled'
  | 'refunded'

export interface FbStripeConnection {
  id: string
  user_id: string
  stripe_secret_key: string | null
  stripe_publishable_key: string | null
  stripe_webhook_secret: string | null
  stripe_account_name: string | null
  stripe_verified_at: string | null
  stripe_enabled: boolean | null
  bank_transfer_enabled: boolean | null
  bank_info: BankInfo | null
  webhook_token: string | null
}

export interface BankInfo {
  bank_name?: string
  branch?: string
  type?: string
  number?: string
  holder?: string
}

export interface FbProduct {
  id: string
  user_id: string
  title: string
  description: string | null
  slug: string
  price: number
  sale_price: number | null
  sale_end_date: string | null
  currency: string | null
  stock_limit: number | null
  stock_remaining: number | null
  thumbnail_url: string | null
  fulfillment_type: string | null
  fulfillment_config: Record<string, unknown> | null
  status: string | null
}

export interface FbCoupon {
  id: string
  user_id: string
  product_id: string | null
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_uses: number | null
  current_uses: number | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean | null
}

export interface FbOrder {
  id: string
  order_number: string | null
  user_id: string
  product_id: string
  buyer_email: string
  buyer_name: string | null
  buyer_phone: string | null
  payment_method: PaymentMethod
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  paypal_order_id: string | null
  amount_subtotal: number
  amount_total: number
  coupon_code: string | null
  discount_amount: number | null
  parent_order_id: string | null
  payment_status: PaymentStatus | null
  paid_at: string | null
  metadata: Record<string, unknown> | null
}

export interface CreateOrderRequest {
  subdomain: string
  product_slug: string
  buyer_email: string
  buyer_name: string
  buyer_phone?: string
  payment_method: PaymentMethod
  coupon_code?: string
  upsell_product_id?: string
  parent_order_id?: string
  success_url: string
  cancel_url: string
}

export interface OrderPaidPayload {
  order_id: string
  order_number: string
  user_id: string
  product_id: string
  buyer_email: string
  buyer_name: string | null
  amount_total: number
  payment_method: PaymentMethod
  paid_at: string
}
