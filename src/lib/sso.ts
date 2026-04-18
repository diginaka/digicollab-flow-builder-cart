/**
 * SSO 引き継ぎロジック（bound モード）
 *
 * カートは自身でログインを行わず、ハブ（digicollabo.com）から JWT を受け取る。
 * - URLの `?sso_token=...&sso_refresh=...&sso_return=...` を検出
 * - `supabase.auth.setSession()` で認証状態を復元
 * - URLパラメータは即座に history.replaceState で削除（履歴・共有防止）
 * - トークン未取得 & 既存セッションなしの場合はハブへリダイレクト
 */
import { supabase } from './supabase'

const HUB_URL = import.meta.env.VITE_AUTH_HUB_URL || 'https://digicollabo.com'

/** ハブへリダイレクト（return_toで元URLを引き継ぐ） */
export function redirectToHub(): void {
  const currentUrl = encodeURIComponent(window.location.href)
  window.location.href = `${HUB_URL}?return_to=${currentUrl}`
}

/**
 * アプリ起動時に最優先で実行
 * @returns 認証成功時 true、リダイレクトが発生した場合は false
 */
export async function initSSO(): Promise<boolean> {
  const url = new URL(window.location.href)
  const ssoToken = url.searchParams.get('sso_token')
  const ssoRefresh = url.searchParams.get('sso_refresh')
  const ssoReturn = url.searchParams.get('sso_return')

  // ── SSOパラメータあり：セッション復元 ──
  if (ssoToken && ssoRefresh) {
    const { error } = await supabase.auth.setSession({
      access_token: ssoToken,
      refresh_token: ssoRefresh,
    })

    // URLからSSOパラメータを削除（履歴・共有・リファラ経由漏洩防止）
    url.searchParams.delete('sso_token')
    url.searchParams.delete('sso_refresh')
    url.searchParams.delete('sso_return')
    window.history.replaceState({}, '', url.toString())

    if (error) {
      console.error('[sso] setSession failed:', error)
      redirectToHub()
      return false
    }

    // sso_return が指定されていればそちらへ遷移
    if (ssoReturn) {
      try {
        window.location.href = decodeURIComponent(ssoReturn)
        return true
      } catch {
        // decode失敗は無視して通常フロー継続
      }
    }
    return true
  }

  // ── SSOパラメータなし：既存セッションを確認 ──
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirectToHub()
    return false
  }
  return true
}

/**
 * 60秒ごとのセッション再取得
 * impersonation 切替（ハブ側で発生）を最大60秒以内に検出してリロード
 * @param currentUserId 初回の user.id
 * @returns clear 関数（cleanup 用）
 */
export function startSessionPolling(currentUserId: string): () => void {
  const timer = setInterval(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // 何らかの理由でセッション消失 → ハブへ戻す
        redirectToHub()
        return
      }
      if (session.user.id !== currentUserId) {
        // impersonation等でユーザーが切り替わった
        console.log('[sso] user switched, reloading')
        window.location.reload()
      }
    } catch (err) {
      console.warn('[sso] session polling error:', err)
    }
  }, 60_000)
  return () => clearInterval(timer)
}
