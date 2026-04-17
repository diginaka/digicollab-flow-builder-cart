import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ShoppingBag, Loader2, CheckCircle2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbOrder } from '../types'
import { getOrders } from '../lib/data'
import { confirmBankTransfer } from '../lib/edgeFunctions'

interface Ctx { user: User }

export function Orders() {
  const { user } = useOutletContext<Ctx>()
  const [orders, setOrders] = useState<FbOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getOrders(user.id).then((o) => {
      setOrders(o)
      setLoading(false)
    })
  }, [user.id])

  const handleConfirm = async (order: FbOrder) => {
    if (!confirm(`${order.order_number} の振込を確認済みにしますか？`)) return
    setConfirming(order.id)
    setError(null)
    const res = await confirmBankTransfer({
      order_id: order.id,
      confirmed_amount: order.amount_total,
      memo: `${new Date().toLocaleDateString('ja-JP')} 確認`,
    })
    setConfirming(null)
    if (res.success) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, payment_status: 'paid', paid_at: res.paid_at ?? null }
            : o,
        ),
      )
    } else {
      setError(res.error || '確認に失敗しました')
    }
  }

  const formatPrice = (yen: number) => `¥${yen.toLocaleString()}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-brand-500" />
          注文一覧
        </h2>
        <p className="text-sm text-gray-500">全ての注文を管理</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            まだ注文がありません
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => {
              const awaitingPayment = order.payment_status === 'awaiting_payment'
              const isBankTransfer = order.payment_method === 'bank_transfer'
              return (
                <div key={order.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.payment_status} />
                        <PaymentMethodBadge method={order.payment_method} />
                      </div>
                      <p className="text-sm text-gray-900 font-medium">
                        {order.product_title || '商品'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {order.buyer_name ? `${order.buyer_name} ・ ` : ''}
                        {order.buyer_email} ・
                        {' '}{new Date(order.created_at ?? '').toLocaleString('ja-JP')}
                      </p>
                      {order.coupon_code && (
                        <p className="text-xs text-brand-600 mt-1">
                          クーポン: {order.coupon_code}
                          {order.discount_amount ? ` (-${formatPrice(order.discount_amount)})` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatPrice(order.amount_total)}</p>
                      {awaitingPayment && isBankTransfer && (
                        <button
                          onClick={() => handleConfirm(order)}
                          disabled={confirming === order.id}
                          className="mt-2 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          {confirming === order.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          振込確認済み
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const style: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-600',
    awaiting_payment: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-600',
    refunded: 'bg-purple-100 text-purple-600',
  }
  const label: Record<string, string> = {
    paid: '決済完了',
    pending: '処理中',
    awaiting_payment: '入金待ち',
    cancelled: 'キャンセル',
    refunded: '返金済',
  }
  const key = status ?? 'pending'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style[key] || style.pending}`}>
      {label[key] || key}
    </span>
  )
}

function PaymentMethodBadge({ method }: { method: string }) {
  const label: Record<string, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    bank_transfer: '銀行振込',
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
      {label[method] || method}
    </span>
  )
}
