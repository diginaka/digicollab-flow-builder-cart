import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定')
}

/**
 * Supabase クライアント（bound モード）
 * - storageKey: アプリごとにユニーク化（localStorage競合・ログアウト問題対策）
 * - detectSessionInUrl: false（SSO引き継ぎは自前で initSSO() が処理するためOFF）
 */
export const supabase = createClient(url!, key!, {
  auth: {
    storageKey: 'sb-digicollab-cart',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export const SUPABASE_URL = url
export const EDGE_BASE = `${url}/functions/v1`
