/**
 * fb-confirm-bank-transfer
 * 用途: 販売者が銀行振込の入金を手動確認
 * 認証: JWT必須（verify_jwt=true）
 *
 * 権限チェック:
 * - fb_orders.user_id = auth.uid() （販売者本人）
 * - payment_method = 'bank_transfer'
 * - payment_status = 'awaiting_payment'
 */
import { handleCors } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/errors.ts'
import { createServiceClient, getAuthUser } from '../_shared/supabase.ts'
import { notifyOrderPaid } from '../_shared/automation.ts'
import type { FbOrder, OrderPaidPayload } from '../_shared/types.ts'

interface ConfirmRequest {
  order_id: string
  confirmed_amount?: number
  memo?: string
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  try {
    const user = await getAuthUser(req)
    const body = (await req.json()) as ConfirmRequest
    const { order_id, confirmed_amount, memo } = body

    if (!order_id) return errorResponse('order_id は必須です', 400)

    const service = createServiceClient()

    // ───── 注文取得 + 権限チェック ─────
    const { data: orderData, error: orderErr } = await service
      .from('fb_orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .eq('payment_method', 'bank_transfer')
      .maybeSingle()

    if (orderErr) {
      console.error('[fb-confirm-bank-transfer] fetch error:', orderErr)
      return errorResponse('注文の取得に失敗しました', 500)
    }

    const order = orderData as FbOrder | null
    if (!order) {
      return errorResponse(
        '対象の注文が見つかりません（権限がないか、該当注文が存在しません）',
        403,
      )
    }

    if (order.payment_status !== 'awaiting_payment') {
      return errorResponse(
        `この注文は確認可能な状態ではありません（現在: ${order.payment_status}）`,
        400,
      )
    }

    // ───── 確認レコード挿入 ─────
    const { error: confErr } = await service
      .from('fb_bank_transfer_confirmations')
      .insert({
        order_id,
        user_id: user.id,
        confirmed_amount: confirmed_amount ?? null,
        memo: memo ?? null,
        confirmed_at: new Date().toISOString(),
      })

    if (confErr) {
      console.error('[fb-confirm-bank-transfer] confirmation insert error:', confErr)
      return errorResponse('確認レコードの保存に失敗しました', 500)
    }

    // ───── 注文を paid に更新 ─────
    const paidAt = new Date().toISOString()
    const { error: updErr } = await service
      .from('fb_orders')
      .update({
        payment_status: 'paid',
        paid_at: paidAt,
      })
      .eq('id', order_id)

    if (updErr) {
      console.error('[fb-confirm-bank-transfer] order update error:', updErr)
      return errorResponse('注文の更新に失敗しました', 500)
    }

    // ───── 後続オートメーション ─────
    const payload: OrderPaidPayload = {
      order_id: order.id,
      order_number: order.order_number ?? '',
      user_id: order.user_id,
      product_id: order.product_id,
      buyer_email: order.buyer_email,
      buyer_name: order.buyer_name,
      amount_total: order.amount_total,
      payment_method: order.payment_method,
      paid_at: paidAt,
    }
    notifyOrderPaid(payload).catch((e) =>
      console.error('[fb-confirm-bank-transfer] notify error:', e),
    )

    return successResponse({
      order_number: order.order_number,
      payment_status: 'paid',
      paid_at: paidAt,
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[fb-confirm-bank-transfer] error:', msg)
    if (msg === 'Unauthorized' || msg === 'Missing Authorization header') {
      return errorResponse('認証が必要です', 401)
    }
    return errorResponse(msg, 500)
  }
})
