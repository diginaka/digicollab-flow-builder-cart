import { useState, useEffect } from 'react'
import { useOutletContext, useNavigate, useParams } from 'react-router-dom'
import { PackagePlus, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Category, ProductType } from '../types'
import { CATEGORIES, PRODUCT_TYPES, PRODUCT_TYPE_LABELS } from '../types'
import { createProduct, getProductById, updateProduct } from '../lib/data'

interface Ctx { user: User }

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `product-${Date.now()}`
  )
}

export function ProductForm() {
  const { user } = useOutletContext<Ctx>()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category>('効率化')
  const [price, setPrice] = useState<number>(0)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [themeColor, setThemeColor] = useState('#059669')
  const [productType, setProductType] = useState<ProductType>('digital')
  const [salePrice, setSalePrice] = useState<number | ''>('')
  const [saleEndDate, setSaleEndDate] = useState('')
  const [stockLimit, setStockLimit] = useState<number | ''>('')
  const [badgeText, setBadgeText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!isEdit) return
    getProductById(user.id, id!).then((p) => {
      if (p) {
        setTitle(p.title)
        setDescription(p.description ?? '')
        setCategory((p.category as Category) || '効率化')
        setPrice(p.price)
        setThumbnailUrl(p.thumbnail_url ?? '')
        setThemeColor(p.theme_color ?? '#059669')
        setProductType(p.product_type)
        setSalePrice(p.sale_price ?? '')
        setSaleEndDate(p.sale_end_date?.slice(0, 10) ?? '')
        setStockLimit(p.stock_limit ?? '')
        setBadgeText(p.badge_text ?? '')
      }
      setLoading(false)
    })
  }, [isEdit, id, user.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description || !price) return
    setSaving(true)

    const payload = {
      user_id: user.id,
      title,
      description,
      category,
      product_type: productType,
      slug: generateSlug(title),
      price,
      sale_price: salePrice || null,
      sale_end_date: saleEndDate || null,
      currency: 'jpy',
      stock_limit: stockLimit || null,
      stock_remaining: stockLimit || null,
      thumbnail_url: thumbnailUrl || null,
      theme_color: themeColor,
      badge_text: badgeText || null,
      // Phase 1はStripe Product/Priceは作らず、fb-create-orderで都度作る
      stripe_product_id: null,
      stripe_price_id: null,
      paypal_plan_id: null,
      // Phase 1は fulfillment を未使用
      fulfillment_type: 'none',
      fulfillment_config: null,
      status: 'published',
    }

    const result = isEdit
      ? (await updateProduct(id!, payload)) ? { id: id! } : null
      : await createProduct(payload)

    setSaving(false)

    if (result) {
      setSaved(true)
      setTimeout(() => {
        navigate('/products')
      }, 1000)
    } else {
      alert('保存に失敗しました。入力内容を確認してください。')
    }
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
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/products')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-brand-500" />
            {isEdit ? '商品を編集' : '商品を登録'}
          </h2>
          <p className="text-sm text-gray-500">
            決済はBYOK（ご自身のStripeで処理）。商品登録時点ではStripeリソースは作成されません
          </p>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          {isEdit ? '更新しました' : '登録しました'}！
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: AIライティングテンプレート集"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品説明 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="商品の特徴やメリットを説明してください"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">商品タイプ</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            価格（¥） <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={price || ''}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="3000"
            min={0}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">サムネイルURL（任意）</label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-500">{themeColor}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-4">
          <p className="text-sm font-medium text-gray-500">追加オプション（任意）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">セール価格（¥）</label>
              <input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="任意"
                min={0}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">セール終了日</label>
              <input
                type="date"
                value={saleEndDate}
                onChange={(e) => setSaleEndDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">在庫数（空=無制限）</label>
              <input
                type="number"
                value={stockLimit}
                onChange={(e) => setStockLimit(e.target.value ? Number(e.target.value) : '')}
                placeholder="無制限"
                min={0}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">バッジテキスト</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="例: 人気、期間限定"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !title || !description || !price}
          className="w-full bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isEdit ? '更新する' : '出品する'}
        </button>
      </form>
    </div>
  )
}
