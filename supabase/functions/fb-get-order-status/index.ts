/**
 * fb-get-order-status
 * 用途: tpl-purchase-complete ページが購入完了情報を取得
 * 認証: なし（verify_jwt=false）
 *
 * 公開可能情報のみ返却（他人の情報は除外）
 *
 * Phase 3-F Pattern A (2026-05-03):
 *   - レスポンスに fb_orders.id (UUID) を含める
 *   - 用途: page-renderer が tpl-purchase-complete で
 *     ?session_id=cs_xxx → fb_orders.id を解決し、
 *     アップセル LP リンク (?parent_order=<UUID>) を組み立てる
 *   - UUID は推測不可、session_id / order_number を知る本人のみ取得可能
 */
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/errors.ts'
import { createServiceClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'GET') return errorResponse('Method not allowed', 405)

  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session_id')
    const orderNumber = url.searchParams.get('order_number')

    if (!sessionId && !orderNumber) {
      return errorResponse('session_id または order_number が必要です', 400)
    }

    const service = createServiceClient()

    // ───── 注文検索 ─────
    let query = service
      .from('fb_orders')
      .select('*, fb_products(title, thumbnail_url, fulfillment_type, fulfillment_config)')
    if (sessionId) query = query.eq('stripe_session_id', sessionId)
    else if (orderNumber) query = query.eq('order_number', orderNumber)

    const { data: orderData, error: orderErr } = await query.maybeSingle()

    if (orderErr) {
      console.error('[fb-get-order-status] fetch error:', orderErr)
      return errorResponse('注文の取得に失敗しました', 500)
    }

    if (!orderData) return errorResponse('注文が見つかりません', 404)

    const order = orderData as {
      id: string
      order_number: string | null
      user_id: string
      payment_method: string
      payment_status: string | null
      amount_total: number
      buyer_email: string
      fb_products?: {
        title: string
        thumbnail_url: string | null
        fulfillment_type: string | null
        fulfillment_config: Record<string, unknown> | null
      }
    }

    // ───── 銀行振込＋入金待ちなら bank_info も同梱 ─────
    let bankInfo: Record<string, unknown> | null = null
    if (
      order.payment_method === 'bank_transfer' &&
      order.payment_status === 'awaiting_payment'
    ) {
      const { data: conn } = await service
        .from('fb_stripe_connections')
        .select('bank_info')
        .eq('user_id', order.user_id)
        .maybeSingle()
      bankInfo = (conn?.bank_info as Record<string, unknown>) ?? null
    }

    // ───── 公開用レスポンス組み立て ─────
    const response: Record<string, unknown> = {
      id: order.id,
      order_number: order.order_number,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      amount_total: order.amount_total,
      buyer_email: order.buyer_email,
      product: order.fb_products
        ? {
            title: order.fb_products.title,
            thumbnail_url: order.fb_products.thumbnail_url,
            fulfillment_type: order.fb_products.fulfillment_type,
            fulfillment_config: order.fb_products.fulfillment_config,
          }
        : null,
    }
    if (bankInfo) response.bank_info = bankInfo

    return successResponse(response)
  } catch (err) {
    console.error('[fb-get-order-status] error:', err)
    return errorResponse((err as Error).message, 500)
  }
})
