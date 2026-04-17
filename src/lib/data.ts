/**
 * データアクセス層（fb_* テーブル）
 * すべて auth.uid() = user_id でRLSフィルタリング
 */
import { supabase } from './supabase'
import type {
  FbProduct, FbOrder, FbCoupon, FbUpsell,
  FbStripeConnection, UserSubdomain,
} from '../types'

/* ──────────── 商品 (fb_products) ──────────── */

export async function getProducts(userId: string): Promise<FbProduct[]> {
  const { data } = await supabase
    .from('fb_products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as FbProduct[]) || []
}

export async function getProductById(
  userId: string,
  id: string,
): Promise<FbProduct | null> {
  const { data } = await supabase
    .from('fb_products')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  return data as FbProduct | null
}

export async function createProduct(
  product: Omit<FbProduct, 'id' | 'created_at' | 'updated_at'>,
): Promise<FbProduct | null> {
  const { data, error } = await supabase
    .from('fb_products')
    .insert(product)
    .select()
    .single()
  if (error) {
    console.error('[data] createProduct error:', error)
    return null
  }
  return data as FbProduct
}

export async function updateProduct(
  id: string,
  updates: Partial<FbProduct>,
): Promise<boolean> {
  const { error } = await supabase
    .from('fb_products')
    .update(updates)
    .eq('id', id)
  return !error
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from('fb_products').delete().eq('id', id)
  return !error
}

/* ──────────── 注文 (fb_orders) ──────────── */

export async function getOrders(userId: string): Promise<FbOrder[]> {
  const { data } = await supabase
    .from('fb_orders')
    .select('*, fb_products(title, thumbnail_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return ((data as (FbOrder & { fb_products?: { title: string; thumbnail_url: string | null } })[]) || []).map(
    (o) => ({
      ...o,
      product_title: o.fb_products?.title,
      product_thumbnail_url: o.fb_products?.thumbnail_url,
    }),
  )
}

export async function getOrderById(id: string): Promise<FbOrder | null> {
  const { data } = await supabase
    .from('fb_orders')
    .select('*, fb_products(title, thumbnail_url)')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const o = data as FbOrder & { fb_products?: { title: string; thumbnail_url: string | null } }
  return {
    ...o,
    product_title: o.fb_products?.title,
    product_thumbnail_url: o.fb_products?.thumbnail_url,
  }
}

/* ──────────── クーポン (fb_coupons) ──────────── */

export async function getCoupons(userId: string): Promise<FbCoupon[]> {
  const { data } = await supabase
    .from('fb_coupons')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as FbCoupon[]) || []
}

export async function createCoupon(
  coupon: Omit<FbCoupon, 'id' | 'created_at' | 'updated_at' | 'current_uses'>,
): Promise<FbCoupon | null> {
  const { data, error } = await supabase
    .from('fb_coupons')
    .insert({ ...coupon, current_uses: 0 })
    .select()
    .single()
  if (error) {
    console.error('[data] createCoupon error:', error)
    return null
  }
  return data as FbCoupon
}

export async function deleteCoupon(id: string): Promise<boolean> {
  const { error } = await supabase.from('fb_coupons').delete().eq('id', id)
  return !error
}

/* ──────────── アップセル (fb_upsells) ──────────── */

export async function getUpsells(userId: string): Promise<FbUpsell[]> {
  const { data } = await supabase
    .from('fb_upsells')
    .select(
      '*, main:fb_products!main_product_id(title), upsell:fb_products!upsell_product_id(title)',
    )
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
  return (
    (
      data as (FbUpsell & {
        main?: { title: string }
        upsell?: { title: string }
      })[]
    )?.map((u) => ({
      ...u,
      main_title: u.main?.title,
      upsell_title: u.upsell?.title,
    })) || []
  )
}

export async function createUpsell(
  upsell: Omit<FbUpsell, 'id' | 'created_at' | 'updated_at' | 'main_title' | 'upsell_title'>,
): Promise<FbUpsell | null> {
  const { data, error } = await supabase
    .from('fb_upsells')
    .insert(upsell)
    .select()
    .single()
  if (error) return null
  return data as FbUpsell
}

export async function updateUpsell(
  id: string,
  updates: Partial<FbUpsell>,
): Promise<boolean> {
  const { error } = await supabase
    .from('fb_upsells')
    .update(updates)
    .eq('id', id)
  return !error
}

export async function deleteUpsell(id: string): Promise<boolean> {
  const { error } = await supabase.from('fb_upsells').delete().eq('id', id)
  return !error
}

/* ──────────── Stripe接続 (fb_stripe_connections) ──────────── */

export async function getStripeConnection(
  userId: string,
): Promise<FbStripeConnection | null> {
  const { data } = await supabase
    .from('fb_stripe_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as FbStripeConnection | null
}

export async function upsertStripeConnection(
  userId: string,
  updates: Partial<FbStripeConnection>,
): Promise<FbStripeConnection | null> {
  const { data, error } = await supabase
    .from('fb_stripe_connections')
    .upsert(
      { user_id: userId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single()
  if (error) {
    console.error('[data] upsertStripeConnection error:', error)
    return null
  }
  return data as FbStripeConnection
}

/* ──────────── サブドメイン (user_subdomains) ──────────── */

export async function getUserSubdomain(
  userId: string,
): Promise<UserSubdomain | null> {
  const { data } = await supabase
    .from('user_subdomains')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data as UserSubdomain | null
}

/* ──────────── 売上サマリー ──────────── */

export interface SalesSummary {
  totalRevenue: number
  totalOrders: number
  paidOrders: number
  pendingOrders: number
}

export async function getSalesSummary(
  userId: string,
  from?: string,
  to?: string,
): Promise<SalesSummary> {
  const orders = await getOrders(userId)
  const filtered = orders.filter((o) => {
    if (!from && !to) return true
    const d = new Date(o.created_at ?? '')
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })
  const paid = filtered.filter((o) => o.payment_status === 'paid')
  return {
    totalRevenue: paid.reduce((s, o) => s + o.amount_total, 0),
    totalOrders: filtered.length,
    paidOrders: paid.length,
    pendingOrders: filtered.filter(
      (o) => o.payment_status === 'pending' || o.payment_status === 'awaiting_payment',
    ).length,
  }
}

/** 日別売上（グラフ用） */
export async function getDailySales(
  userId: string,
  from: string,
  to: string,
): Promise<{ date: string; revenue: number; count: number }[]> {
  const orders = await getOrders(userId)
  const map = new Map<string, { revenue: number; count: number }>()

  const start = new Date(from)
  const end = new Date(to)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    map.set(key, { revenue: 0, count: 0 })
  }

  orders.forEach((o) => {
    if (o.payment_status !== 'paid' || !o.created_at) return
    const key = o.created_at.slice(0, 10)
    if (map.has(key)) {
      const cur = map.get(key)!
      cur.revenue += o.amount_total
      cur.count += 1
    }
  })
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }))
}

/** 商品別ランキング */
export async function getProductRanking(
  userId: string,
  from?: string,
  to?: string,
): Promise<{ title: string; revenue: number; count: number }[]> {
  const orders = await getOrders(userId)
  const filtered = orders.filter((o) => {
    if (o.payment_status !== 'paid') return false
    if (!from && !to) return true
    const d = new Date(o.created_at ?? '')
    if (from && d < new Date(from)) return false
    if (to && d > new Date(to + 'T23:59:59')) return false
    return true
  })

  const map = new Map<string, { revenue: number; count: number }>()
  filtered.forEach((o) => {
    const title = o.product_title || '不明'
    const cur = map.get(title) || { revenue: 0, count: 0 }
    cur.revenue += o.amount_total
    cur.count += 1
    map.set(title, cur)
  })
  return Array.from(map.entries())
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
}
