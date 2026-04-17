/**
 * ログイン画面
 * Magic Link（デフォルト）とパスワードの2タブ構成
 */
import { useState } from 'react'
import { Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { signInWithMagicLink, signInWithPassword } from '../lib/auth'
import { useBranding } from '../contexts/BrandingContext'

type Tab = 'magic' | 'password'

export function LoginForm() {
  const branding = useBranding()
  const [tab, setTab] = useState<Tab>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await signInWithMagicLink(email.trim())
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError(null)
    const { error } = await signInWithPassword(email.trim(), password)
    setLoading(false)
    if (error) setError('メールアドレスまたはパスワードが違います')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl p-2 mb-4"
            style={{ backgroundColor: branding.accent_color }}
          >
            <img
              src={branding.logo_url}
              alt={branding.app_name}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{branding.app_name}</h1>
          <p className="text-sm text-gray-500 mt-1">販売者ログイン</p>
        </div>

        {magicLinkSent ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-brand-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 mb-2">メールを送信しました</h2>
            <p className="text-sm text-gray-600">
              {email} にログインリンクを送信しました。<br />
              メール内のリンクをクリックしてログインしてください。
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setEmail('') }}
              className="mt-4 text-sm text-brand-600 hover:text-brand-700"
            >
              別のメールアドレスでやり直す
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* タブ */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => { setTab('magic'); setError(null) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === 'magic'
                    ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50/30'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => { setTab('password'); setError(null) }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === 'password'
                    ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50/30'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                パスワード
              </button>
            </div>

            <div className="p-6">
              {tab === 'magic' ? (
                <form onSubmit={handleMagicLink}>
                  <p className="text-xs text-gray-500 mb-3">
                    メールで届くリンクをクリックするだけでログインできます
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    メールアドレス
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      required
                      disabled={loading}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full mt-4 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    ログインリンクを送信
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePassword}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    メールアドレス
                  </label>
                  <div className="relative mb-4">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      required
                      disabled={loading}
                    />
                  </div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    パスワード
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      required
                      disabled={loading}
                    />
                  </div>

                  {error && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !password}
                    className="w-full mt-4 bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    ログイン
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
