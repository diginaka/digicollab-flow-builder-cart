/**
 * レスポンスユーティリティ
 */
import { corsHeaders } from './cors.ts'

export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}

export function successResponse(data: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
}

/** 通常のJSONレスポンス（successフラグなし、Webhook用） */
export function rawJsonResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
