import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { initSSO, startSessionPolling } from './lib/sso'
import {
  resolveBranding, isResellerOwner, DIGICOLLAB_DEFAULT_BRANDING, type Branding,
} from './lib/branding'
import { resolveFeatureFlags, DEFAULT_ALL_ENABLED, type FeatureFlags } from './lib/featureFlags'
import { BrandingContext } from './contexts/BrandingContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Products } from './pages/Products'
import { ProductForm } from './pages/ProductForm'
import { Orders } from './pages/Orders'
import { Coupons } from './pages/Coupons'
import { Upsells } from './pages/Upsells'
import { Reports } from './pages/Reports'
import { PaymentSettings } from './pages/settings/PaymentSettings'
import { GeneralSettings } from './pages/settings/GeneralSettings'
import { BrandingSettings } from './pages/settings/BrandingSettings'

export default function App() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [branding, setBranding] = useState<Branding>(DIGICOLLAB_DEFAULT_BRANDING)
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_ALL_ENABLED)
  const [isReseller, setIsReseller] = useState(false)

  useEffect(() => {
    let cleanupPolling: (() => void) | null = null
    let authSub: { unsubscribe: () => void } | null = null

    const bootstrap = async () => {
      // ── 1. SSO引き継ぎ（URLパラメータ取得・URL掃除・ハブリダイレクト）
      const authenticated = await initSSO()
      if (!authenticated) {
        // initSSO が redirectToHub 済み。何もしない
        return
      }

      // ── 2. ユーザー情報取得
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user ?? null
      setUser(u)
      if (!u) {
        // 理論上ここには来ない（initSSO 成功なのに session なし）
        return
      }

      // ── 3. ブランディング・フィーチャーフラグ・role を解決
      const [b, f, r] = await Promise.all([
        resolveBranding(supabase, u.id),
        resolveFeatureFlags(u.id),
        isResellerOwner(supabase, u.id),
      ])
      setBranding(b)
      setFlags(f)
      setIsReseller(r.isReseller)

      // 動的favicon + タイトル
      document.title = b.app_name
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (favicon) favicon.href = b.favicon_url

      // ── 4. 60秒ごとのセッション再取得（impersonation切替検出）
      cleanupPolling = startSessionPolling(u.id)

      // ── 5. Supabase Auth のセッション変化を監視
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession) {
          // ハブへ戻す（signOut は lib/auth で処理）
          window.location.href = import.meta.env.VITE_AUTH_HUB_URL || 'https://digicollabo.com'
        } else if (newSession.user.id !== u.id) {
          // ユーザー切替（impersonation）→ リロード
          window.location.reload()
        }
      })
      authSub = subscription

      setReady(true)
    }

    bootstrap()

    return () => {
      cleanupPolling?.()
      authSub?.unsubscribe()
    }
  }, [])

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">認証情報を確認中...</p>
        </div>
      </div>
    )
  }

  return (
    <BrandingContext.Provider value={branding}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout user={user} flags={flags} isReseller={isReseller} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/upsells" element={<Upsells />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings/payment" element={<PaymentSettings />} />
            <Route path="/settings/general" element={<GeneralSettings />} />
            <Route path="/settings/branding" element={<BrandingSettings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BrandingContext.Provider>
  )
}
