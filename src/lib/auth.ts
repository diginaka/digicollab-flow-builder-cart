/**
 * 認証ユーティリティ（bound モード）
 *
 * 独自ログインは廃止。認証はハブ（digicollabo.com）のみが行う。
 * このモジュールは「セッション取得」と「ハブへ戻るログアウト」だけを提供する。
 */
import { supabase } from './supabase'

const HUB_URL = import.meta.env.VITE_AUTH_HUB_URL || 'https://digicollabo.com'

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * ログアウト
 * 子アプリではローカルセッションを破棄した上で、ハブへリダイレクトする。
 * （子アプリには再ログイン画面がないため）
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (err) {
    console.warn('[auth] signOut error:', err)
  }
  window.location.href = HUB_URL
}
