import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Ticket, TrendingUp,
  ShoppingBag, BarChart3, Settings, LogOut, Menu, X,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useBranding } from '../contexts/BrandingContext'
import { signOut } from '../lib/auth'
import type { FeatureFlags } from '../lib/featureFlags'

interface SidebarProps {
  user: User
  flags: FeatureFlags
  isReseller: boolean
}

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  show: boolean
}

export function Sidebar({ user, flags, isReseller }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const branding = useBranding()
  const location = useLocation()

  const navItems: NavItem[] = [
    { to: '/', label: 'ダッシュボード', icon: <LayoutDashboard className="w-5 h-5" />, show: true },
    { to: '/products', label: '商品', icon: <Package className="w-5 h-5" />, show: flags.canRegisterProducts },
    { to: '/orders', label: '注文', icon: <ShoppingBag className="w-5 h-5" />, show: true },
    { to: '/coupons', label: 'クーポン', icon: <Ticket className="w-5 h-5" />, show: flags.canManageCoupons },
    { to: '/upsells', label: 'アップセル', icon: <TrendingUp className="w-5 h-5" />, show: flags.canManageUpsells },
    { to: '/reports', label: '売上レポート', icon: <BarChart3 className="w-5 h-5" />, show: true },
  ]

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ロゴ */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center p-1"
            style={{ backgroundColor: branding.accent_color }}
          >
            <img src={branding.logo_url} alt={branding.app_name} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 text-sm truncate">{branding.app_name}</h1>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter((i) => i.show).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* 設定サブグループ */}
        {flags.canAccessSettings && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            <p className="px-3 pb-2 text-xs text-gray-400 font-semibold uppercase tracking-wider">
              設定
            </p>
            <NavLink
              to="/settings/payment"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Settings className="w-5 h-5" />
              <span>決済設定</span>
            </NavLink>
            <NavLink
              to="/settings/general"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Settings className="w-5 h-5" />
              <span>一般設定</span>
            </NavLink>
            {isReseller && (
              <NavLink
                to="/settings/branding"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Settings className="w-5 h-5" />
                <span>ブランディング</span>
              </NavLink>
            )}
          </div>
        )}
      </nav>

      {/* ユーザー情報 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">ログイン中</p>
            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* モバイルメニューボタン */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        key={location.pathname}
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
