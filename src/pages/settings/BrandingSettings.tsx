/**
 * ブランディング設定画面（reseller本人のみ表示）⭐
 */
import { useEffect, useState } from 'react'
import { useOutletContext, Navigate } from 'react-router-dom'
import { Palette, Loader2, CheckCircle2 } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { DIGICOLLAB_DEFAULT_BRANDING } from '../../lib/branding'

interface Ctx { user: User; isReseller: boolean }

export function BrandingSettings() {
  const { user, isReseller } = useOutletContext<Ctx>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resellerId, setResellerId] = useState<string | null>(null)

  const [appName, setAppName] = useState(DIGICOLLAB_DEFAULT_BRANDING.app_name)
  const [logoUrl, setLogoUrl] = useState(DIGICOLLAB_DEFAULT_BRANDING.logo_url)
  const [faviconUrl, setFaviconUrl] = useState(DIGICOLLAB_DEFAULT_BRANDING.favicon_url)
  const [primary, setPrimary] = useState(DIGICOLLAB_DEFAULT_BRANDING.primary_color)
  const [accent, setAccent] = useState(DIGICOLLAB_DEFAULT_BRANDING.accent_color)

  useEffect(() => {
    if (!isReseller) return
    const load = async () => {
      const { data } = await supabase
        .from('resellers')
        .select('id, settings')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (data) {
        setResellerId(data.id)
        const branding = (data.settings as { branding?: Record<string, string> } | null)?.branding
        if (branding) {
          setAppName(branding.app_name || DIGICOLLAB_DEFAULT_BRANDING.app_name)
          setLogoUrl(branding.logo_url || DIGICOLLAB_DEFAULT_BRANDING.logo_url)
          setFaviconUrl(branding.favicon_url || DIGICOLLAB_DEFAULT_BRANDING.favicon_url)
          setPrimary(branding.primary_color || DIGICOLLAB_DEFAULT_BRANDING.primary_color)
          setAccent(branding.accent_color || DIGICOLLAB_DEFAULT_BRANDING.accent_color)
        }
      }
      setLoading(false)
    }
    load()
  }, [user.id, isReseller])

  if (!isReseller) {
    return <Navigate to="/settings/general" replace />
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resellerId) return
    setSaving(true)
    const { data: current } = await supabase
      .from('resellers')
      .select('settings')
      .eq('id', resellerId)
      .single()
    const nextSettings = {
      ...(current?.settings || {}),
      branding: {
        app_name: appName,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        primary_color: primary,
        accent_color: accent,
      },
    }
    const { error } = await supabase
      .from('resellers')
      .update({ settings: nextSettings })
      .eq('id', resellerId)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // ページ再読込でブランディング即反映
      setTimeout(() => window.location.reload(), 1500)
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
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5 text-brand-500" />
          ブランディング設定
        </h2>
        <p className="text-sm text-gray-500">
          リセラー向け: アプリ名・ロゴ・カラーを自社ブランドに変更できます
        </p>
      </div>

      {saved && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          ブランディングを保存しました（リロード中...）
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">アプリ名</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ロゴ URL（SVG/PNG）</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
          />
          {logoUrl && (
            <div
              className="mt-2 inline-flex items-center justify-center w-16 h-16 rounded-xl p-2"
              style={{ backgroundColor: accent }}
            >
              <img src={logoUrl} alt="プレビュー" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
          <input
            type="url"
            value={faviconUrl}
            onChange={(e) => setFaviconUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">プライマリカラー</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">アクセントカラー（ロゴ背景）</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          保存
        </button>
      </form>
    </div>
  )
}
