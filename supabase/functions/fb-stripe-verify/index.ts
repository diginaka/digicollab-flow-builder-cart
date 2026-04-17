/**
 * fb-stripe-verify
 * 用途: ユーザーのStripe Secret Keyを検証し、fb_stripe_connectionsに保存
 * 認証: JWT必須（verify_jwt=true）
 */
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/errors.ts'
import { createServiceClient, getAuthUser } from '../_shared/supabase.ts'
import { verifyStripeKey } from '../_shared/stripe.ts'

interface VerifyRequest {
  stripe_secret_key: string
  stripe_publishable_key: string
  stripe_webhook_secret?: string
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    // 1. ユーザー認証
    const user = await getAuthUser(req)

    // 2. リクエストボディ読み込み
    const body = (await req.json()) as VerifyRequest
    const {
      stripe_secret_key,
      stripe_publishable_key,
      stripe_webhook_secret,
    } = body

    if (!stripe_secret_key || !stripe_publishable_key) {
      return errorResponse(
        'stripe_secret_key と stripe_publishable_key は必須です',
        400,
      )
    }

    // 3. Stripeキー検証
    const verification = await verifyStripeKey(stripe_secret_key)
    if (!verification.valid || !verification.account) {
      return errorResponse(verification.error || '無効なStripeキーです', 400)
    }

    // 4. fb_stripe_connections にUPSERT
    const service = createServiceClient()
    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      stripe_secret_key,
      stripe_publishable_key,
      stripe_account_name: verification.account.display_name,
      stripe_verified_at: new Date().toISOString(),
      stripe_enabled: true,
      updated_at: new Date().toISOString(),
    }
    if (stripe_webhook_secret) {
      upsertData.stripe_webhook_secret = stripe_webhook_secret
    }

    const { data: connection, error: upsertErr } = await service
      .from('fb_stripe_connections')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select('webhook_token')
      .single()

    if (upsertErr) {
      console.error('[fb-stripe-verify] upsert error:', upsertErr)
      return errorResponse('接続情報の保存に失敗しました', 500)
    }

    // 5. Webhook URLを組み立て
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const webhookUrl = connection?.webhook_token
      ? `${supabaseUrl}/functions/v1/fb-stripe-webhook?t=${connection.webhook_token}`
      : null

    return successResponse({
      account: verification.account,
      webhook_url: webhookUrl,
    })
  } catch (err) {
    const msg = (err as Error).message
    console.error('[fb-stripe-verify] error:', msg)
    if (msg === 'Unauthorized' || msg === 'Missing Authorization header') {
      return errorResponse('認証が必要です', 401)
    }
    return errorResponse(msg, 500)
  }
})

// corsHeadersをビルド時に参照するため（未使用警告抑制）
void corsHeaders
