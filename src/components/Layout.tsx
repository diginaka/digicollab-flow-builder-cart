import { Outlet } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { Sidebar } from './Sidebar'
import type { FeatureFlags } from '../lib/featureFlags'

interface LayoutProps {
  user: User
  flags: FeatureFlags
  isReseller: boolean
}

/** 認証後のメインレイアウト */
export function Layout({ user, flags, isReseller }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} flags={flags} isReseller={isReseller} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 lg:p-8 pt-16 lg:pt-8">
          <Outlet context={{ user, flags, isReseller }} />
        </div>
      </main>
    </div>
  )
}
