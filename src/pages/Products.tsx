import { useEffect, useState } from 'react'
import { useOutletContext, Link } from 'react-router-dom'
import { Package, Plus, ExternalLink, Trash2, Edit } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbProduct, UserSubdomain } from '../types'
import { getProducts, deleteProduct, getUserSubdomain } from '../lib/data'

interface Ctx { user: User }

const PAGE_RENDERER_URL = import.meta.env.VITE_PAGE_RENDERER_URL || 'https://page.digicollabo.com'

export function Products() {
  const { user } = useOutletContext<Ctx>()
  const [products, setProducts] = useState<FbProduct[]>([])
  const [subdomain, setSubdomain] = useState<UserSubdomain | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getProducts(user.id), getUserSubdomain(user.id)]).then(
      ([p, s]) => {
        setProducts(p)
        setSubdomain(s)
        setLoading(false)
      },
    )
  }, [user.id])

  const handleDelete = async (id: string) => {
    if (!confirm('この商品を削除しますか？\n（関連する注文履歴は残ります）')) return
    const ok = await deleteProduct(id)
    if (ok) setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const formatPrice = (yen: number) => `¥${yen.toLocaleString()}`

  const productUrl = (slug: string) =>
    subdomain ? `${PAGE_RENDERER_URL}/${subdomain.subdomain}/${slug}` : null

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
            <Package className="w-5 h-5 text-brand-500" />
            商品一覧
          </h2>
          <p className="text-sm text-gray-500">登録済み商品の管理</p>
        </div>
        <Link
          to="/products/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600"
        >
          <Plus className="w-4 h-4" />
          新規登録
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">まだ商品がありません</p>
          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600"
          >
            <Plus className="w-4 h-4" />
            最初の商品を登録
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product) => {
            const url = productUrl(product.slug)
            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-start gap-4">
                  {product.thumbnail_url ? (
                    <img
                      src={product.thumbnail_url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (product.theme_color ?? '#059669') + '1a' }}
                    >
                      <Package className="w-6 h-6" style={{ color: product.theme_color ?? '#059669' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{product.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{product.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(product.price)}
                      </span>
                      {product.badge_text && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                          {product.badge_text}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {url && (
                  <div className="mt-3 flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate text-gray-600 flex-1">{url}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(url)}
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                    >
                      コピー
                    </button>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Link
                    to={`/products/${product.id}/edit`}
                    className="flex-1 text-center text-sm text-gray-600 hover:text-gray-900 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    編集
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
