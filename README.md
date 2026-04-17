# フロービルダー カート（Flow Builder Cart）

デジコラボの BYOK 型統合カート。ユーザーごとの Stripe Secret Key で決済を処理し、デジコラボ運営は手数料を取らないピュアな販売ツール。

**本番URL:** `https://cart.digicollabo.com`（予定）
**ベースプロジェクト:** デジコラボカート本番版から BYOK 向けにフル改造
**GitHub:** `diginaka/digicollab-flow-builder-cart`

## 技術スタック

- React 18 + TypeScript + Vite 6
- Tailwind CSS
- react-router-dom v6（クライアントサイドルーティング）
- @supabase/supabase-js v2（Auth + DB）
- recharts / lucide-react

## プロジェクト構成

```
DIGICOLLAB-FLOW-BUILDER-CART/
├── supabase/
│   └── functions/           # Edge Functions（Phase B で実装済み）
│       ├── _shared/
│       ├── fb-stripe-verify/
│       ├── fb-create-order/
│       ├── fb-stripe-webhook/
│       ├── fb-confirm-bank-transfer/
│       └── fb-get-order-status/
├── src/
│   ├── lib/                 # supabase / auth / data / featureFlags / branding / edgeFunctions
│   ├── hooks/               # useAuth
│   ├── contexts/            # BrandingContext
│   ├── components/          # Layout / Sidebar / LoginForm
│   ├── pages/               # Dashboard / Products / Orders / Coupons / Upsells / Reports
│   │   └── settings/        # PaymentSettings / GeneralSettings / BrandingSettings
│   ├── types/
│   ├── App.tsx              # Router + BrandingContext
│   └── main.tsx
├── public/
│   ├── assets/logo.svg
│   └── _redirects           # SPA向けCloudflare Pagesルーティング
├── .env.example
├── package.json
└── vite.config.ts
```

## ルーティング

| Path | 画面 |
|---|---|
| `/` | ダッシュボード |
| `/login` | ログイン |
| `/products` | 商品一覧 |
| `/products/new` | 商品登録 |
| `/products/:id/edit` | 商品編集 |
| `/orders` | 注文一覧（銀行振込の確認ボタン付き） |
| `/coupons` | クーポン管理 |
| `/upsells` | アップセル管理 |
| `/reports` | 売上レポート |
| `/settings/payment` | 決済設定（BYOK）⭐ |
| `/settings/general` | 一般設定（サブドメイン表示） |
| `/settings/branding` | ブランディング設定（reseller本人のみ） |

## 環境変数

`.env.example` を参照。本番は Cloudflare Pages の環境変数に設定：

```env
VITE_SUPABASE_URL=https://whpqheywobndaeaikchh.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_APP_URL=https://cart.digicollabo.com
VITE_PAGE_RENDERER_URL=https://page.digicollabo.com
VITE_DATA_MODE=supabase
```

## ローカル開発

```bash
cp .env.example .env
npm install
npm run dev   # localhost:5173
```

## ビルド

```bash
npm run build  # → dist/
```

## 主要アーキテクチャ

### BYOK（Bring Your Own Key）
- ユーザーが自分の **Stripe Secret Key** を `/settings/payment` で登録
- `fb-stripe-verify` Edge Function が Stripe Account を検証 + `fb_stripe_connections` に保存 + **Webhook URL を発行**
- 以降の決済は全てユーザーの Stripe アカウント直行。デジコラボは介在せず手数料ゼロ

### ブランディング動的解決（`src/lib/branding.ts`）
1. `end_users.auth_user_id` で end_user を検索 → 親 `resellers.settings.branding` を採用
2. `resellers.auth_user_id` でリセラー本人を検索 → 自分の `settings.branding` を採用
3. どちらもなければ `DIGICOLLAB_DEFAULT_BRANDING`（デジコラボ緑 #059669）

ログイン後に `resolveBranding` を呼び、`BrandingContext` 経由で全画面に配信。`document.title` と favicon も動的に書き換え。

### フィーチャーフラグ（`src/lib/featureFlags.ts`）
Phase 1 は全機能 true 返却。将来的にリセラープランごとの機能制限をここに集約できるよう、UIは `flags.canManageCoupons` などを参照する実装に統一済み。

### データ層（`src/lib/data.ts`）
すべての CRUD は `fb_* テーブル` を参照。`user_id = auth.uid()` のRLSで自分のデータのみアクセス可能。

## 参照テーブル

| テーブル | 用途 |
|---|---|
| `fb_products` | 商品 |
| `fb_orders` | 注文（`order_number` はDBトリガーで自動発行） |
| `fb_coupons` | クーポン |
| `fb_upsells` | アップセル |
| `fb_stripe_connections` | BYOK（Stripe/銀行振込の保存先 + webhook_token） |
| `fb_bank_transfer_confirmations` | 銀行振込の確認履歴 |
| `user_subdomains` | ユーザーのサブドメイン（`page.digicollabo.com/{subdomain}/`） |
| `resellers` / `end_users` | ブランディング・プラン判定 |

## Edge Functions（参考）

| 関数 | 用途 | verify_jwt |
|---|---|---|
| `fb-stripe-verify` | Stripeキー検証・webhook_url取得 | ✅ |
| `fb-create-order` | 注文作成（3決済方式分岐） | ❌ |
| `fb-stripe-webhook` | Stripe webhook受信 | ❌ |
| `fb-confirm-bank-transfer` | 銀行振込の手動確認 | ✅ |
| `fb-get-order-status` | tpl-purchase-complete向け注文取得 | ❌ |

## 削除した機能（本番版からの変更点）

- ❌ アフィリエイト機能全般（`commissions` テーブル参照も含む）
- ❌ AI企画アシスタント（デジコラボ本番版で既に削除済み）
- ❌ プラン別画面制限（member/creator/producer/partner）→ `featureFlags` 経由に統一
- ❌ `digicollabo_members` 認証 → Supabase Auth
- ❌ `owner_id` ベース → `user_id` 統一
- ❌ `create-product` / `create-checkout` / `create-coupon` Edge Function → `fb-*` 全面差し替え
- ❌ standalone モード（常に Supabase）

## Cloudflare Pages デプロイ手順

1. **Cloudflare Pages** → Create Project → GitHub連携 → `diginaka/digicollab-flow-builder-cart` を選択
2. **ビルド設定:**
   - Framework preset: `None`
   - Build command: `npm install && npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
3. **環境変数（Environment variables）:**
   ```
   VITE_SUPABASE_URL = https://whpqheywobndaeaikchh.supabase.co
   VITE_SUPABASE_ANON_KEY = <anon_key>
   VITE_APP_URL = https://cart.digicollabo.com
   VITE_PAGE_RENDERER_URL = https://page.digicollabo.com
   VITE_DATA_MODE = supabase
   NODE_VERSION = 18
   ```
4. **カスタムドメイン設定:**
   - Cloudflare Pages プロジェクト → Custom domains → `cart.digicollabo.com` を追加
   - Cloudflare DNS で自動的に CNAME が設定される（同一アカウント内の場合）
5. **SPA ルーティング:**
   - `public/_redirects` に `/* /index.html 200` 済み。追加設定不要。

## テスト手順（E2E）

1. `/login` で Magic Link またはパスワードでログイン
2. `/settings/payment` で Stripe テストキーを入力 → 接続成功 → **Webhook URL をコピー**
3. Stripe 管理画面で Webhook endpoint として貼り付け
4. `/settings/payment` で銀行振込情報を入力 → 保存
5. `/products/new` で商品登録
6. `/settings/general` で自分の LP URL を確認（`page.digicollabo.com/{subdomain}/`）
7. Phase D 以降で tpl-checkout 連携テスト
