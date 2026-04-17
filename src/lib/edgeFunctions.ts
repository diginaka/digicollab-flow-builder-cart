/**
 * Edge Functions クライアント
 */
import { supabase, EDGE_BASE } from './supabase'
import { getSession } from './auth'

/* ──────────── fb-stripe-verify ──────────── */

export interface StripeVerifyRequest {
  stripe_secret_key: string
  stripe_publishable_key: string
  stripe_webhook_secret?: string
}

export interface StripeVerifyResponse {
  success: boolean
  account?: {
    id: string
    display_name: string
    country: string | null
    default_currency: string
  }
  webhook_url?: string | null
  error?: string
}

export async function verifyStripe(
  req: StripeVerifyRequest,
): Promise<StripeVerifyResponse> {
  const session = await getSession()
  if (!session) return { success: false, error: '認証セッションが見つかりません' }

  const res = await fetch(`${EDGE_BASE}/fb-stripe-verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(req),
  })
  return res.json()
}

/* ──────────── fb-create-order ──────────── */

export interface CreateOrderRequest {
  subdomain: string
  product_slug: string
  buyer_email: string
  buyer_name: string
  buyer_phone?: string
  payment_method: 'stripe' | 'paypal' | 'bank_transfer'
  coupon_code?: string
  upsell_product_id?: string
  parent_order_id?: string
  success_url: string
  cancel_url: string
}

export interface CreateOrderResponse {
  success: boolean
  order_number?: string
  payment_method?: 'stripe' | 'paypal' | 'bank_transfer'
  checkout_url?: string
  amount_total?: number
  bank_info?: Record<string, string>
  next_url?: string
  error?: string
}

export async function createOrder(
  req: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const res = await fetch(`${EDGE_BASE}/fb-create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(req),
  })
  return res.json()
}

/* ──────────── fb-confirm-bank-transfer ──────────── */

export interface ConfirmBankTransferRequest {
  order_id: string
  confirmed_amount?: number
  memo?: string
}

export async function confirmBankTransfer(
  req: ConfirmBankTransferRequest,
): Promise<{ success: boolean; order_number?: string; payment_status?: string; paid_at?: string; error?: string }> {
  const session = await getSession()
  if (!session) return { success: false, error: '認証セッションが見つかりません' }

  const res = await fetch(`${EDGE_BASE}/fb-confirm-bank-transfer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(req),
  })
  return res.json()
}

export { supabase }
