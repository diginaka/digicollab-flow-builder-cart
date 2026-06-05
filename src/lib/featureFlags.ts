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
  /**
   * 業務管理クラスタ（ダッシュボード / 注文 / 売上レポート）を cart 標準アドミンに表示するか。
   * SE-3 PR-3（宿題C, 2026-06-05）でこれらをフロービルダー本体のホーム『成果』配下へ移管したため、
   * 既定では false（窓口をホームへ一本化＝重複窓口ゼロ）。standalone ビルドは残しており、
   * true に戻せば従来どおり cart 側でも表示・到達できる（可逆）。
   */
  showBusinessAdmin: boolean
  /**
   * 決済設定（/settings/payment）を cart 標準アドミンに表示するか。
   * SE-3 PR-4（宿題D, 2026-06-05）でフロービルダー本体の /integrations「決済接続」へ
   * 移管したため、既定では false（窓口を /integrations へ一本化＝重複窓口ゼロ）。
   * ページ実体は残しており、true に戻せば従来どおり cart 側でも表示・到達できる（可逆）。
   */
  showPaymentSettings: boolean
}

export const DEFAULT_ALL_ENABLED: FeatureFlags = {
  canRegisterProducts: true,
  canManageCoupons: true,
  canManageUpsells: true,
  canExportCSV: true,
  canAccessSettings: true,
  // SE-3 PR-3: 業務管理はホームへ移管済。cart 側では既定で隠す（再表示は true に変更）。
  showBusinessAdmin: false,
  // SE-3 PR-4: 決済設定は /integrations へ移管済。cart 側では既定で隠す（再表示は true に変更）。
  showPaymentSettings: false,
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
