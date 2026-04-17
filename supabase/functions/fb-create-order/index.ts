/**
 * fb-create-order
 * 用途: tpl-checkoutから呼ばれる、3決済方式統合エントリポイント
 * 認証: なし（verify_jwt=false、anon呼出可）
 *
 * 処理フロー:
 * 1. バリデーション
 * 2. subdomain → user_id 解決（user_subdomains）
 * 3. 商品読込（fb_products）
 * 4. 在庫チェック
 * 5. 価格計算（セール/クーポン/アップセル）
 * 6. BYOK資格情報取得（fb_stripe_connections）
 * 7. payment_method で分岐（stripe / bank_transfer / paypal[未実装]）
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

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const body = (await req.json()) as CreateOrderRequest

    // ───── 1. バリデーション ─────
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
    } = body

    if (!subdomain || !product_slug || !buyer_email || !buyer_name) {
      return errorResponse('必須項目が不足しています', 400)
    }
    if (!isValidEmail(buyer_email)) {
      return errorResponse('メールアドレスの形式が不正です', 400)
    }
    if (
      !['stripe', 'paypal', 'bank_transfer'].includes(payment_method)
    ) {
      return errorResponse('payment_methodが不正です', 400)
    }
    if (!success_url || !cancel_url) {
      return errorResponse('success_url と cancel_url は必須です', 400)
    }

    const service = createServiceClient()

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
    // upsell_product_id があればそちらを使用、なければ slug で検索
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
    // base_price: upsellならupsell_price、通常商品はsale_priceまたはprice
    let basePrice: number
    if (upsell_product_id && parent_order_id) {
      // アップセル時は upsell_price を使う
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

    // クーポン適用
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

      // ① 先にfb_ordersへINSERT（order_idをStripeのmetadataに入れるため）
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

      // ② Stripe Checkout Session 作成
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
                  images: product.thumbnail_url
                    ? [product.thumbnail_url]
                    : undefined,
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

        // ③ fb_orders の stripe_session_id を更新
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
        // 注文をcancelled状態に
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

      // 注文作成
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
