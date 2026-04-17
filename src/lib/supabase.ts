import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定')
}

/** Supabase クライアント（anon + Auth セッション自動管理） */
export const supabase = createClient(url!, key!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Magic Link リダイレクトを処理
  },
})

export const SUPABASE_URL = url
export const EDGE_BASE = `${url}/functions/v1`
