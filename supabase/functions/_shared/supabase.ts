/**
 * Supabaseクライアントファクトリ
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

/** service_roleクライアント（RLSバイパス、サーバーサイド専用） */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

/** 認証済みユーザー取得（Authorizationヘッダから） */
export async function getAuthUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing Authorization header')

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}
