import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Ticket, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbCoupon, FbProduct } from '../types'
import { getCoupons, createCoupon, deleteCoupon, getProducts } from '../lib/data'

interface Ctx { user: User }

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function Coupons() {
  const { user } = useOutletContext<Ctx>()
  const [coupons, setCoupons] = useState<FbCoupon[]>([])
  const [products, setProducts] = useState<FbProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [code, setCode] = useState(generateCode())
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('percent')
  const [discountValue, setDiscountValue] = useState<number>(10)
  const [maxUses, setMaxUses] = useState<number | ''>('')
  const [validUntil, setValidUntil] = useState('')
  const [productId, setProductId] = useState<string>('')

  useEffect(() => {
    Promise.all([getCoupons(user.id), getProducts(user.id)]).then(([c, p]) => {
      setCoupons(c)
      setProducts(p)
      setLoading(false)
    })
  }, [user.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !discountValue) return
    setSaving(true)
    const result = await createCoupon({
      user_id: user.id,
      product_id: productId || null,
      code,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      valid_from: null,
      valid_until: validUntil || null,
      stripe_coupon_id: null,
      is_active: true,
    })
    if (result) {
      setCoupons((prev) => [result, ...prev])
      setShowForm(false)
      setCode(generateCode())
      setDiscountValue(10)
      setMaxUses('')
      setValidUntil('')
      setProductId('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このクーポンを削除しますか？')) return
    const ok = await deleteCoupon(id)
    if (ok) setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-brand-500" />
            クーポン管理
          </h2>
          <p className="text-sm text-gray-500">割引クーポンを作成・管理</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          クーポンを作成しました！
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">クーポンコード</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCode(generateCode())}
                  className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                >
                  再生成
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">対象商品（空=全商品）</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              >
                <option value="">全商品で使用可</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">割引タイプ</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percent')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              >
                <option value="percent">パーセント割引</option>
                <option value="fixed">固定額割引（¥）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                割引値 {discountType === 'percent' ? '(%)' : '(¥)'}
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min={1}
                max={discountType === 'percent' ? 100 : undefined}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用上限（空=無制限）</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : '')}
                placeholder="無制限"
                min={1}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">有効期限</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              作成
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {coupons.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">クーポンがありません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {coupons.map((coupon) => {
              const expired = coupon.valid_until && new Date(coupon.valid_until) < new Date()
              return (
                <div key={coupon.id} className={`flex items-center justify-between px-5 py-4 ${expired ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-gray-900">{coupon.code}</span>
                      {expired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">期限切れ</span>}
                      {!coupon.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">無効</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {coupon.discount_type === 'percent' ? `${coupon.discount_value}%OFF` : `¥${coupon.discount_value.toLocaleString()}OFF`}
                      {coupon.max_uses && ` ・ ${coupon.current_uses ?? 0}/${coupon.max_uses}回使用`}
                      {coupon.valid_until && ` ・ 〜${new Date(coupon.valid_until).toLocaleDateString('ja-JP')}`}
                      {coupon.product_id && ` ・ 商品限定`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(coupon.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
