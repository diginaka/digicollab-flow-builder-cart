import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { TrendingUp, Plus, Trash2, Loader2, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbProduct, FbUpsell } from '../types'
import { getProducts, getUpsells, createUpsell, updateUpsell, deleteUpsell } from '../lib/data'

interface Ctx { user: User }

export function Upsells() {
  const { user } = useOutletContext<Ctx>()
  const [products, setProducts] = useState<FbProduct[]>([])
  const [upsells, setUpsells] = useState<FbUpsell[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [mainId, setMainId] = useState('')
  const [upsellId, setUpsellId] = useState('')
  const [upsellPrice, setUpsellPrice] = useState<number>(0)

  useEffect(() => {
    Promise.all([getProducts(user.id), getUpsells(user.id)]).then(([p, u]) => {
      setProducts(p)
      setUpsells(u)
      setLoading(false)
    })
  }, [user.id])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mainId || !upsellId || !upsellPrice || mainId === upsellId) return
    setSaving(true)
    const result = await createUpsell({
      user_id: user.id,
      main_product_id: mainId,
      upsell_product_id: upsellId,
      upsell_price: upsellPrice,
      display_order: upsells.length,
      is_active: true,
    })
    if (result) {
      result.main_title = products.find((p) => p.id === mainId)?.title
      result.upsell_title = products.find((p) => p.id === upsellId)?.title
      setUpsells((prev) => [...prev, result])
      setShowForm(false)
      setMainId('')
      setUpsellId('')
      setUpsellPrice(0)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const handleToggle = async (id: string, currentActive: boolean) => {
    const ok = await updateUpsell(id, { is_active: !currentActive })
    if (ok) setUpsells((prev) => prev.map((u) => (u.id === id ? { ...u, is_active: !currentActive } : u)))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このアップセル設定を削除しますか？')) return
    const ok = await deleteUpsell(id)
    if (ok) setUpsells((prev) => prev.filter((u) => u.id !== id))
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
            <TrendingUp className="w-5 h-5 text-brand-500" />
            アップセル管理
          </h2>
          <p className="text-sm text-gray-500">購入完了後のアップセルオファーを設定</p>
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
          アップセルを作成しました！
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {products.length < 2 ? (
            <p className="text-sm text-gray-500">アップセルには2つ以上の商品が必要です。先に商品を登録してください。</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メイン商品</label>
                  <select value={mainId} onChange={(e) => setMainId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" required>
                    <option value="">選択...</option>
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">アップセル商品</label>
                  <select value={upsellId} onChange={(e) => setUpsellId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" required>
                    <option value="">選択...</option>
                    {products.filter((p) => p.id !== mainId).map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">特別価格（¥）</label>
                  <input type="number" value={upsellPrice || ''} onChange={(e) => setUpsellPrice(Number(e.target.value))} min={0} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm" required />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                <button type="submit" disabled={saving || mainId === upsellId} className="px-6 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  作成
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {upsells.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">アップセル設定がありません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {upsells.map((u) => (
              <div key={u.id} className={`flex items-center justify-between px-5 py-4 ${!u.is_active ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {u.main_title || 'メイン商品'}
                    <span className="text-gray-400 mx-1">→</span>
                    {u.upsell_title || 'アップセル商品'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">特別価格: ¥{(u.upsell_price ?? 0).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(u.id, !!u.is_active)} className="p-2 text-gray-400 hover:text-brand-500">
                    {u.is_active ? <ToggleRight className="w-5 h-5 text-brand-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
