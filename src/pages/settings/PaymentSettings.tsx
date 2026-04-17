/**
 * 決済設定画面（BYOK）⭐
 * - Stripe: Secret/Publishable/Webhook Secret 入力 → 接続テスト → webhook_url 取得
 * - PayPal: Phase 1.5（UI無効）
 * - 銀行振込: 銀行情報入力 + 有効化フラグ
 */
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  CreditCard, Key, CheckCircle2, AlertCircle, Copy, Loader2, Building2, DollarSign,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { FbStripeConnection } from '../../types'
import { getStripeConnection, upsertStripeConnection } from '../../lib/data'
import { verifyStripe } from '../../lib/edgeFunctions'

interface Ctx { user: User }

export function PaymentSettings() {
  const { user } = useOutletContext<Ctx>()
  const [conn, setConn] = useState<FbStripeConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    getStripeConnection(user.id).then((c) => {
      setConn(c)
      setLoading(false)
    })
  }, [user.id])

  const showFlash = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg })
    setTimeout(() => setFlash(null), 4000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-500" />
          決済設定
        </h2>
        <p className="text-sm text-gray-500">
          ご自身のStripe・銀行口座でダイレクトに受け取り（BYOK・運営手数料なし）
        </p>
      </div>

      {flash && (
        <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
          flash.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {flash.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {flash.msg}
        </div>
      )}

      <StripeSection user={user} conn={conn} onUpdate={setConn} showFlash={showFlash} />
      <PayPalSection />
      <BankTransferSection user={user} conn={conn} onUpdate={setConn} showFlash={showFlash} />
    </div>
  )
}

/* ──────────── Stripe セクション ──────────── */

function StripeSection({
  conn, onUpdate, showFlash, user,
}: {
  user: User
  conn: FbStripeConnection | null
  onUpdate: (c: FbStripeConnection) => void
  showFlash: (type: 'success' | 'error', msg: string) => void
}) {
  const [secretKey, setSecretKey] = useState('')
  const [publishableKey, setPublishableKey] = useState(conn?.stripe_publishable_key ?? '')
  const [webhookSecret, setWebhookSecret] = useState(conn?.stripe_webhook_secret ?? '')
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)

  const isConnected = conn?.stripe_enabled && conn?.stripe_verified_at

  const webhookUrl = conn?.webhook_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fb-stripe-webhook?t=${conn.webhook_token}`
    : null

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secretKey || !publishableKey) {
      showFlash('error', 'Secret Key と Publishable Key は必須です')
      return
    }
    setTesting(true)
    const res = await verifyStripe({
      stripe_secret_key: secretKey,
      stripe_publishable_key: publishableKey,
      stripe_webhook_secret: webhookSecret || undefined,
    })
    setTesting(false)
    if (res.success && res.account) {
      showFlash('success', `Stripeに接続しました: ${res.account.display_name}`)
      // 画面を最新化
      const latest = await getStripeConnection(user.id)
      if (latest) onUpdate(latest)
      setSecretKey('')
    } else {
      showFlash('error', res.error || 'Stripe接続に失敗しました')
    }
  }

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Stripe</h3>
              <p className="text-xs text-gray-500">クレジットカード決済</p>
            </div>
          </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              接続済み
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {isConnected && (
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">
              {conn?.stripe_account_name}
            </p>
            <p className="text-xs text-green-700 mt-1">
              検証日時: {new Date(conn!.stripe_verified_at!).toLocaleString('ja-JP')}
            </p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Key className="w-4 h-4" />
              Secret Key {isConnected && <span className="text-xs text-gray-400">（再設定する場合のみ）</span>}
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_live_... または sk_test_..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-gray-400 mt-1">
              Stripe ダッシュボード → 開発者 → APIキー で取得。平文で保存されます（MVP。将来pgsodium暗号化予定）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publishable Key</label>
            <input
              type="text"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_... または pk_test_..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook Signing Secret（任意・後で設定可）
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={testing}
            className="w-full bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            接続テスト & 保存
          </button>
        </form>

        {webhookUrl && (
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Webhook URL（Stripe管理画面に登録してください）
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <code className="text-xs text-gray-700 flex-1 truncate">{webhookUrl}</code>
              <button
                onClick={copyWebhookUrl}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'コピー済' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Stripe ダッシュボード → 開発者 → Webhook → エンドポイントを追加 に貼り付けて下さい。<br />
              イベント: <code className="bg-gray-100 px-1 rounded">checkout.session.completed</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">payment_intent.succeeded</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">charge.refunded</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">checkout.session.expired</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────── PayPal セクション（Phase 1.5 待ち） ──────────── */

function PayPalSection() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">PayPal</h3>
              <p className="text-xs text-gray-500">Phase 1.5 で対応予定</p>
            </div>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">現在無効</span>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pointer-events-none">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Client ID</label>
            <input type="text" disabled placeholder="(Phase 1.5)" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Secret</label>
            <input type="password" disabled placeholder="(Phase 1.5)" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────── 銀行振込 セクション ──────────── */

function BankTransferSection({
  user, conn, onUpdate, showFlash,
}: {
  user: User
  conn: FbStripeConnection | null
  onUpdate: (c: FbStripeConnection) => void
  showFlash: (type: 'success' | 'error', msg: string) => void
}) {
  const [bankName, setBankName] = useState(conn?.bank_info?.bank_name ?? '')
  const [branch, setBranch] = useState(conn?.bank_info?.branch ?? '')
  const [accountType, setAccountType] = useState(conn?.bank_info?.type ?? '普通')
  const [accountNumber, setAccountNumber] = useState(conn?.bank_info?.number ?? '')
  const [accountHolder, setAccountHolder] = useState(conn?.bank_info?.holder ?? '')
  const [enabled, setEnabled] = useState(conn?.bank_transfer_enabled ?? false)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const result = await upsertStripeConnection(user.id, {
      bank_info: {
        bank_name: bankName,
        branch,
        type: accountType,
        number: accountNumber,
        holder: accountHolder,
      },
      bank_transfer_enabled: enabled,
    })
    setSaving(false)
    if (result) {
      onUpdate(result)
      showFlash('success', '銀行振込情報を保存しました')
    } else {
      showFlash('error', '保存に失敗しました')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">銀行振込</h3>
              <p className="text-xs text-gray-500">購入者に振込先を案内</p>
            </div>
          </div>
          {conn?.bank_transfer_enabled && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              有効
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">銀行名</label>
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="例: ゆうちょ銀行" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">支店名</label>
          <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="例: 〇〇支店" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">口座種類</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm">
              <option value="普通">普通</option>
              <option value="当座">当座</option>
              <option value="貯蓄">貯蓄</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">口座番号</label>
            <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="1234567" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">口座名義（カナ）</label>
          <input type="text" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="ヤマダ タロウ" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 text-brand-500 rounded focus:ring-brand-500" />
          <span className="text-sm text-gray-700">銀行振込を有効化する</span>
        </label>
        <button type="submit" disabled={saving} className="w-full bg-brand-500 text-white py-3 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          保存
        </button>
      </form>
    </div>
  )
}
