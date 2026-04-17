import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart3, Download } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { User } from '@supabase/supabase-js'
import { getSalesSummary, getDailySales, getProductRanking, type SalesSummary } from '../lib/data'
import type { FeatureFlags } from '../lib/featureFlags'

interface Ctx { user: User; flags: FeatureFlags }

type Period = 'today' | 'week' | 'month' | 'custom'

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  switch (period) {
    case 'today': return { from: to, to }
    case 'week': {
      const w = new Date(now)
      w.setDate(w.getDate() - 6)
      return { from: w.toISOString().slice(0, 10), to }
    }
    case 'month': {
      return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to }
    }
    default: return { from: to, to }
  }
}

export function Reports() {
  const { user, flags } = useOutletContext<Ctx>()
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summary, setSummary] = useState<SalesSummary>({
    totalRevenue: 0, totalOrders: 0, paidOrders: 0, pendingOrders: 0,
  })
  const [dailyData, setDailyData] = useState<{ date: string; revenue: number; count: number }[]>([])
  const [ranking, setRanking] = useState<{ title: string; revenue: number; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = useMemo(() => {
    if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
    return getDateRange(period)
  }, [period, customFrom, customTo])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getSalesSummary(user.id, from, to),
      getDailySales(user.id, from, to),
      getProductRanking(user.id, from, to),
    ]).then(([s, d, r]) => {
      setSummary(s)
      setDailyData(d)
      setRanking(r)
      setLoading(false)
    })
  }, [user.id, from, to])

  const handleExportCsv = () => {
    if (!flags.canExportCSV) return
    const header = '日付,売上(¥),件数\n'
    const rows = dailyData.map((d) => `${d.date},${d.revenue},${d.count}`).join('\n')
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatPrice = (yen: number) => `¥${yen.toLocaleString()}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-500" />
          売上レポート
        </h2>
        {flags.canExportCSV && (
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" />
            CSV出力
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${period === p ? 'bg-brand-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {p === 'today' ? '今日' : p === 'week' ? '今週' : p === 'month' ? '今月' : 'カスタム'}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <span className="text-gray-400">〜</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-sm text-gray-500">売上合計（決済完了）</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(summary.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-sm text-gray-500">決済完了件数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.paidOrders}件</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-sm text-gray-500">入金待ち</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary.pendingOrders}件</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">売上推移</h3>
            {dailyData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">データがありません</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [formatPrice(value), '売上']} />
                  <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">商品別ランキング</h3>
            </div>
            {ranking.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">データがありません</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {ranking.map((item, i) => (
                  <div key={item.title} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.count}件販売</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatPrice(item.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
