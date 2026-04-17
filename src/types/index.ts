/** フロービルダー カート 型定義 */

export const CATEGORIES = [
  '効率化', '学習', 'デザイン', 'マーケティング', 'テンプレート', 'その他',
] as const
export type Category = (typeof CATEGORIES)[number]

export const PRODUCT_TYPES = ['digital', 'course', 'event', 'service'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital: 'デジタル商品',
  course: 'オンライン講座',
  event: 'イベント',
  service: 'サービス',
}

export type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer'
export type PaymentStatus =
  | 'pending' | 'awaiting_payment' | 'paid' | 'cancelled' | 'refunded'

/** 商品（fb_products） */
export interface FbProduct {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  product_type: ProductType
  slug: string
  price: number
  sale_price: number | null
  sale_end_date: string | null
  currency: string | null
  stock_limit: number | null
  stock_remaining: number | null
  thumbnail_url: string | null
  theme_color: string | null
  badge_text: string | null
  stripe_product_id: string | null
  stripe_price_id: string | null
  paypal_plan_id: string | null
  fulfillment_type: string | null
  fulfillment_config: Record<string, unknown> | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

/** 注文（fb_orders） */
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
  created_at: string | null
  updated_at: string | null
  /** JOIN結果 */
  product_title?: string
  product_thumbnail_url?: string | null
}

/** クーポン（fb_coupons） */
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
  stripe_coupon_id: string | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

/** アップセル（fb_upsells） */
export interface FbUpsell {
  id: string
  user_id: string
  main_product_id: string
  upsell_product_id: string
  upsell_price: number | null
  display_order: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  /** JOIN結果 */
  main_title?: string
  upsell_title?: string
}

/** Stripe接続情報（fb_stripe_connections） */
export interface BankInfo {
  bank_name?: string
  branch?: string
  type?: string
  number?: string
  holder?: string
}

export interface FbStripeConnection {
  id: string
  user_id: string
  stripe_secret_key: string | null
  stripe_publishable_key: string | null
  stripe_webhook_secret: string | null
  stripe_account_name: string | null
  stripe_verified_at: string | null
  stripe_enabled: boolean | null
  paypal_client_id: string | null
  paypal_secret: string | null
  paypal_verified_at: string | null
  paypal_enabled: boolean | null
  bank_info: BankInfo | null
  bank_transfer_enabled: boolean | null
  webhook_token: string | null
  created_at: string | null
  updated_at: string | null
}

/** user_subdomains */
export interface UserSubdomain {
  id: string
  user_id: string | null
  user_email: string
  subdomain: string
  custom_domain: string | null
  is_active: boolean | null
}

/** reseller（リセラー本人） */
export interface Reseller {
  id: string
  auth_user_id: string | null
  email: string | null
  display_name: string | null
  company_name: string | null
  status: string | null
  plan: string | null
  settings: Record<string, unknown> | null
}

/** end_user（リセラー配下の利用者） */
export interface EndUser {
  id: string
  auth_user_id: string | null
  reseller_id: string | null
  email: string | null
  display_name: string | null
  status: string | null
  settings: Record<string, unknown> | null
}
