import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import { resolveBranding, isResellerOwner, DIGICOLLAB_DEFAULT_BRANDING, type Branding } from './lib/branding'
import { resolveFeatureFlags, DEFAULT_ALL_ENABLED, type FeatureFlags } from './lib/featureFlags'
import { BrandingContext } from './contexts/BrandingContext'
import { Layout } from './components/Layout'
import { LoginForm } from './components/LoginForm'
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
  const { user, loading: authLoading } = useAuth()
  const [branding, setBranding] = useState<Branding>(DIGICOLLAB_DEFAULT_BRANDING)
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_ALL_ENABLED)
  const [isReseller, setIsReseller] = useState(false)
  const [ctxLoading, setCtxLoading] = useState(true)

  // 認証状態に応じてブランディング・フィーチャーフラグ・role を解決
  useEffect(() => {
    const load = async () => {
      const userId = user?.id ?? null
      const [b, f, r] = await Promise.all([
        resolveBranding(supabase, userId),
        userId ? resolveFeatureFlags(userId) : Promise.resolve(DEFAULT_ALL_ENABLED),
        userId ? isResellerOwner(supabase, userId) : Promise.resolve({ isReseller: false, resellerId: null }),
      ])
      setBranding(b)
      setFlags(f)
      setIsReseller(r.isReseller)

      // 動的favicon + タイトル
      document.title = b.app_name
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (favicon) favicon.href = b.favicon_url

      setCtxLoading(false)
    }
    if (!authLoading) load()
  }, [user, authLoading])

  if (authLoading || ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrandingContext.Provider value={branding}>
      <BrowserRouter>
        <Routes>
          {user ? (
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
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          ) : (
            <>
              <Route path="/login" element={<LoginForm />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </BrandingContext.Provider>
  )
}
