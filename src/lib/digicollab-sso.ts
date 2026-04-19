/**
 * デジコラボ統一SSOクライアント v2 (PKCE Exchange方式)
 *
 * ハブ (digicollabo.com) から渡された sso_code を fb-sso-exchange Edge Function
 * と交換して、独立した新規セッションを取得する。
 *
 * 旧方式(sso_token/sso_refresh)との互換性:
 *   - sso_code があればそれを優先
 *   - sso_code がなく旧方式パラメータがあればフォールバック（Phase B完了前後の互換）
 *
 * 使い方:
 *   const authenticated = await initSSO()
 *   if (!authenticated) redirectToHub()
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const HUB_URL = (import.meta.env.VITE_AUTH_HUB_URL as string | undefined) || 'https://digicollabo.com'

/** ハブへリダイレクト（return_toで元URLを引き継ぐ） */
export function redirectToHub(): void {
  const currentUrl = encodeURIComponent(window.location.href)
  window.location.href = `${HUB_URL}?return_to=${currentUrl}`
}

/** 旧バージョンが残した localStorage キーを掃除（ゴミ除去） */
function cleanupLegacyStorage(): void {
  try {
    const legacyKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith('sb-') && !k.startsWith('sb-digicollab-'),
    )
    legacyKeys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // localStorage未対応環境などでは無視
  }
}

/**
 * アプリ起動時に最優先で実行。
 * @returns 認証成功時 true、リダイレクト発生時 false
 */
export async function initSSO(): Promise<boolean> {
  // 旧キー掃除（Phase A～αの残骸を除去。カートデフォルトの sb-whpqheywobndaeaikchh-* 等）
  cleanupLegacyStorage()

  const client = supabase as SupabaseClient | null
  if (!client) {
    console.warn('[SSO] Supabase未接続')
    return false
  }

  const url = new URL(window.location.href)
  const ssoCode = url.searchParams.get('sso_code')
  const ssoToken = url.searchParams.get('sso_token')
  const ssoRefresh = url.searchParams.get('sso_refresh')
  const ssoReturn = url.searchParams.get('sso_return')

  const cleanUrl = () => {
    url.searchParams.delete('sso_code')
    url.searchParams.delete('sso_token')
    url.searchParams.delete('sso_refresh')
    url.searchParams.delete('sso_return')
    window.history.replaceState({}, '', url.toString())
  }

  // ─ 新方式: sso_code を exchange ─
  if (ssoCode) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(`${supabaseUrl}/functions/v1/fb-sso-exchange`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sso_code: ssoCode }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        console.error('[SSO] exchange failed:', json?.error ?? res.status)
        cleanUrl()
        redirectToHub()
        return false
      }

      const { error: setErr } = await client.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      })
      cleanUrl()

      if (setErr) {
        console.error('[SSO] setSession failed after exchange:', setErr)
        redirectToHub()
        return false
      }

      if (ssoReturn) {
        try {
          window.location.href = decodeURIComponent(ssoReturn)
          return true
        } catch {
          // decode失敗は無視
        }
      }
      return true
    } catch (e) {
      console.error('[SSO] exchange error:', e)
      cleanUrl()
      redirectToHub()
      return false
    }
  }

  // ─ 旧方式: sso_token + sso_refresh をそのまま使う（互換） ─
  if (ssoToken && ssoRefresh) {
    const { error } = await client.auth.setSession({
      access_token: ssoToken,
      refresh_token: ssoRefresh,
    })
    cleanUrl()
    if (error) {
      console.error('[SSO] legacy setSession failed:', error)
      redirectToHub()
      return false
    }
    if (ssoReturn) {
      try {
        window.location.href = decodeURIComponent(ssoReturn)
        return true
      } catch {
        // decode失敗は無視
      }
    }
    return true
  }

  // ─ SSOパラメータなし: 既存セッションを確認 ─
  const { data: { session } } = await client.auth.getSession()
  if (!session) {
    redirectToHub()
    return false
  }
  return true
}

/**
 * 60秒ごとのセッション再取得
 * impersonation切替や意図しないサインアウトを検出してリロード/リダイレクト
 */
export function startSessionPolling(currentUserId: string): () => void {
  const client = supabase as SupabaseClient | null
  if (!client) return () => {}

  const timer = setInterval(async () => {
    try {
      const { data: { session } } = await client.auth.getSession()
      if (!session) {
        redirectToHub()
        return
      }
      if (session.user.id !== currentUserId) {
        console.log('[SSO] user switched, reloading')
        window.location.reload()
      }
    } catch (err) {
      console.warn('[SSO] session polling error:', err)
    }
  }, 60_000)
  return () => clearInterval(timer)
}
