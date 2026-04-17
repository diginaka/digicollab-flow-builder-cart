/**
 * 後続オートメーション - n8n Webhook転送
 * 未設定時はスキップ（ベストエフォート）
 */
import type { OrderPaidPayload } from './types.ts'

export async function notifyOrderPaid(
  payload: OrderPaidPayload,
): Promise<void> {
  const webhookUrl = Deno.env.get('N8N_ORDER_PAID_WEBHOOK_URL')
  if (!webhookUrl) {
    console.log('[automation] N8N webhook not configured, skipping')
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[automation] n8n notify failed: ${res.status}`)
    } else {
      console.log(`[automation] n8n notified for order ${payload.order_number}`)
    }
  } catch (err) {
    // 失敗しても決済自体は成功扱い
    console.error('[automation] n8n notify error:', err)
  }
}
