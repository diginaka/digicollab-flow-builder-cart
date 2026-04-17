/**
 * ブランディング解決ロジック
 * end_user → 親reseller / reseller本人 / デフォルト の順で解決
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Branding {
  app_name: string
  logo_url: string
  favicon_url: string
  primary_color: string
  accent_color: string
}

export const DIGICOLLAB_DEFAULT_BRANDING: Branding = {
  app_name: 'デジコラボ カート',
  logo_url: '/assets/logo.svg',
  favicon_url: '/assets/logo.svg',
  primary_color: '#059669',
  accent_color: '#1a2332',
}

interface ResellerSettings {
  branding?: Partial<Branding>
}

/**
 * ユーザーのブランディングを解決
 * @param supabase Supabase クライアント
 * @param userId 認証ユーザーID（nullの場合はデフォルト）
 */
export async function resolveBranding(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<Branding> {
  if (!userId) return DIGICOLLAB_DEFAULT_BRANDING

  // 1. end_user として紐付いているリセラーを確認
  try {
    const { data: endUser } = await supabase
      .from('end_users')
      .select('reseller_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (endUser?.reseller_id) {
      const { data: reseller } = await supabase
        .from('resellers')
        .select('settings, display_name')
        .eq('id', endUser.reseller_id)
        .maybeSingle()

      if (reseller) {
        const settings = reseller.settings as ResellerSettings | null
        const branding = settings?.branding ?? {}
        return {
          ...DIGICOLLAB_DEFAULT_BRANDING,
          ...branding,
          app_name:
            branding.app_name ||
            reseller.display_name ||
            DIGICOLLAB_DEFAULT_BRANDING.app_name,
        }
      }
    }
  } catch (err) {
    console.warn('[branding] end_users lookup failed:', err)
  }

  // 2. reseller 本人として登録されているか
  try {
    const { data: reseller } = await supabase
      .from('resellers')
      .select('settings, display_name')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (reseller) {
      const settings = reseller.settings as ResellerSettings | null
      const branding = settings?.branding ?? {}
      return {
        ...DIGICOLLAB_DEFAULT_BRANDING,
        ...branding,
        app_name:
          branding.app_name ||
          reseller.display_name ||
          DIGICOLLAB_DEFAULT_BRANDING.app_name,
      }
    }
  } catch (err) {
    console.warn('[branding] resellers lookup failed:', err)
  }

  // 3. デフォルト（デジコラボ標準利用者）
  return DIGICOLLAB_DEFAULT_BRANDING
}

/**
 * ユーザーが reseller 本人かどうか判定
 * ブランディング設定画面の表示制御に使用
 */
export async function isResellerOwner(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ isReseller: boolean; resellerId: string | null }> {
  try {
    const { data } = await supabase
      .from('resellers')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle()
    return { isReseller: !!data, resellerId: data?.id ?? null }
  } catch {
    return { isReseller: false, resellerId: null }
  }
}
