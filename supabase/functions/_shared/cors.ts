/**
 * CORS設定 - Phase 1は全許可、Phase 2で page.digicollabo.com に絞る
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

/** OPTIONSプリフライトを処理。該当しなければnullを返す */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  return null
}
