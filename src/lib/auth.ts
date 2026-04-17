/**
 * 認証ユーティリティ（Supabase Auth ベース）
 * Magic Link とパスワードの両方をサポート
 */
import { supabase } from './supabase'

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signOut() {
  return supabase.auth.signOut()
}
