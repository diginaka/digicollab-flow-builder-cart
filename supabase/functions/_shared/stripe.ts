/**
 * Stripe SDKユーティリティ
 * BYOK原則 — ユーザーごとのstripe_secret_keyを都度渡して初期化
 */
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

/** Stripeクライアントを生成（ユーザーのsecret keyを使用） */
export function getStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

/** Stripe Account 情報の取得（キー検証用） */
export async function verifyStripeKey(secretKey: string): Promise<{
  valid: boolean
  account?: {
    id: string
    display_name: string
    country: string | null
    default_currency: string
  }
  error?: string
}> {
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    })

    if (!res.ok) {
      if (res.status === 401) {
        return { valid: false, error: '無効なStripeキーです' }
      }
      return { valid: false, error: `Stripe API error: ${res.status}` }
    }

    const account = await res.json()
    const displayName =
      account.business_profile?.name ||
      account.display_name ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      account.id
    return {
      valid: true,
      account: {
        id: account.id,
        display_name: displayName,
        country: account.country ?? null,
        default_currency: account.default_currency || 'jpy',
      },
    }
  } catch (err) {
    return { valid: false, error: (err as Error).message }
  }
}

export type { Stripe }
