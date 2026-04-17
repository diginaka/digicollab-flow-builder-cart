import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import {
  DollarSign, ShoppingBag, Clock, PackagePlus, BarChart3, ArrowRight, CheckCircle2,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbOrder } from '../types'
import { getOrders, getSalesSummary, type SalesSummary } from '../lib/data'

interface Ctx {
  user: User
}

export function Dashboard() {
  const { user } = useOutletContext<Ctx>()
  const [summary, setSummary] = useState<SalesSummary>({
    totalRevenue: 0, totalOrders: 0, paidOrders: 0, pendingOrders: 0,
  })
  const [recent, setRecent] = useState<FbOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const now = new Date()
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const to = now.toISOString().slice(0, 10)
      const [s, orders] = await Promise.all([
        getSalesSummary(user.id, from, to),
        getOrders(user.id),
      ])
      setSummary(s)
      setRecent(orders.slice(0, 5))
      setLoading(false)
    }
    load()
  }, [user.id])

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
        <h2 className="text-xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="text-sm text-gray-500">今月の売上概況</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-brand-600" />
            </div>
            <span className="text-sm text-gray-500">今月の売上</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">
            <CheckCircle2 className="inline w-3 h-3" /> 決済完了分のみ
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">注文件数</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}件</p>
          <p className="text-xs text-gray-400 mt-1">完了: {summary.paidOrders}件</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">入金待ち</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.pendingOrders}件</p>
          <p className="text-xs text-gray-400 mt-1">銀行振込・処理中</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/products/new"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center">
            <PackagePlus className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">新しい商品を登録</p>
            <p className="text-sm text-gray-500">商品を作成して販売開始</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>

        <Link
          to="/reports"
          className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
        >
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">売上レポート</p>
            <p className="text-sm text-gray-500">詳細な売上分析を確認</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">直近の注文</h3>
          <Link to="/orders" className="text-sm text-brand-600 hover:text-brand-700">
            すべて見る →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            まだ注文がありません
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recent.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.product_title || '商品'}</p>
                  <p className="text-xs text-gray-500">
                    {order.buyer_email} ・
                    {' '}{new Date(order.created_at ?? '').toLocaleDateString('ja-JP')}
                    {' '}・ {paymentStatusLabel(order.payment_status)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatPrice(order.amount_total)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function paymentStatusLabel(s: string | null): string {
  switch (s) {
    case 'paid': return '決済完了'
    case 'pending': return '処理中'
    case 'awaiting_payment': return '入金待ち'
    case 'cancelled': return 'キャンセル'
    case 'refunded': return '返金済み'
    default: return s || '不明'
  }
}
