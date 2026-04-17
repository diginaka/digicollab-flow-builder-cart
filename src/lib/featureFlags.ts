/**
 * フィーチャーフラグ解決
 * Phase 1: 全機能true返却（プラン制限撤廃）
 * 将来: end_user.reseller_id 経由で reseller.plan に応じた制限を返却
 */

export interface FeatureFlags {
  canRegisterProducts: boolean
  canManageCoupons: boolean
  canManageUpsells: boolean
  canExportCSV: boolean
  canAccessSettings: boolean
}

export const DEFAULT_ALL_ENABLED: FeatureFlags = {
  canRegisterProducts: true,
  canManageCoupons: true,
  canManageUpsells: true,
  canExportCSV: true,
  canAccessSettings: true,
}

/**
 * ユーザーのフィーチャーフラグを解決
 * @param _userId - 将来利用。Phase 1は未使用
 */
export async function resolveFeatureFlags(
  _userId: string,
): Promise<FeatureFlags> {
  // Phase 1: 全機能解放
  return DEFAULT_ALL_ENABLED

  // === 将来の実装例 ===
  // const { data: endUser } = await supabase
  //   .from('end_users')
  //   .select('reseller_id, settings')
  //   .eq('auth_user_id', _userId)
  //   .maybeSingle()
  //
  // if (endUser?.reseller_id) {
  //   const { data: reseller } = await supabase
  //     .from('resellers')
  //     .select('plan, settings')
  //     .eq('id', endUser.reseller_id)
  //     .single()
  //   return applyPlanLimits(reseller?.plan ?? 'basic')
  // }
  // return DEFAULT_ALL_ENABLED
}
