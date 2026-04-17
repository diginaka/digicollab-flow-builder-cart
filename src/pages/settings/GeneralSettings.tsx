/**
 * 一般設定画面
 * - ユーザーのサブドメイン表示（page.digicollabo.com/{subdomain}/）
 * - アプリURL表示
 */
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Settings as SettingsIcon, Globe, ExternalLink, CheckCircle2, Copy } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { UserSubdomain } from '../../types'
import { getUserSubdomain } from '../../lib/data'

interface Ctx { user: User }

const PAGE_RENDERER_URL = import.meta.env.VITE_PAGE_RENDERER_URL || 'https://page.digicollabo.com'

export function GeneralSettings() {
  const { user } = useOutletContext<Ctx>()
  const [subdomain, setSubdomain] = useState<UserSubdomain | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    getUserSubdomain(user.id).then((s) => {
      setSubdomain(s)
      setLoading(false)
    })
  }, [user.id])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const publicUrl = subdomain ? `${PAGE_RENDERER_URL}/${subdomain.subdomain}/` : null

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
          <SettingsIcon className="w-5 h-5 text-brand-500" />
          一般設定
        </h2>
        <p className="text-sm text-gray-500">アカウント情報とフロービルダーURL</p>
      </div>

      {/* アカウント情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">アカウント</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">メールアドレス</span>
            <span className="text-gray-900 font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <span className="text-gray-500">ユーザーID</span>
            <span className="text-gray-500 font-mono text-xs">{user.id}</span>
          </div>
        </div>
      </div>

      {/* フロービルダーURL */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          あなたのフロービルダーURL
        </h3>

        {subdomain ? (
          <>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">サブドメイン</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-gray-900 bg-white px-3 py-2 rounded border border-gray-200">
                    {subdomain.subdomain}
                  </code>
                </div>
              </div>

              {publicUrl && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">公開URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-brand-600 bg-white px-3 py-2 rounded border border-gray-200 truncate">
                      {publicUrl}
                    </code>
                    <button
                      onClick={() => copy(publicUrl, 'url')}
                      className="px-3 py-2 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                    >
                      {copiedKey === 'url' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'url' ? 'コピー済' : 'コピー'}
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {subdomain.custom_domain && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">カスタムドメイン</p>
                  <code className="text-sm text-gray-900 bg-white px-3 py-2 rounded border border-gray-200 inline-block">
                    {subdomain.custom_domain}
                  </code>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-3">
              商品を登録すると、自動的に <code className="bg-gray-100 px-1 rounded">{PAGE_RENDERER_URL}/{subdomain.subdomain}/&#123;商品スラグ&#125;</code> の形で購入ページが公開されます。
            </p>
          </>
        ) : (
          <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-700">
            サブドメインが未発行です。デジコラボ運営にお問い合わせください。
          </div>
        )}
      </div>
    </div>
  )
}
