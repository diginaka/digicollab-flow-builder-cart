# Cloudflare Pages 設定手順書

**対象リポジトリ:** `diginaka/digicollab-flow-builder-cart`
**デプロイ先URL:** `cart.digicollabo.com`

---

## 1. Cloudflare Pages プロジェクト作成

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Pages** タブ
2. **Connect to Git** を選択
3. GitHub認証 → **`diginaka/digicollab-flow-builder-cart`** を選択 → **Begin setup**

---

## 2. ビルド設定

| 項目 | 値 |
|---|---|
| **Project name** | `digicollab-flow-builder-cart`（任意） |
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `npm install && npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/`（空欄のまま） |

---

## 3. 環境変数（Environment variables）

**Build & deployments → Environment variables** で以下を設定:

| 変数名 | 値 | 環境 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://whpqheywobndaeaikchh.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocHFoZXl3b2JuZGFlYWlrY2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzU4NTksImV4cCI6MjA4NTM1MTg1OX0.t-ZVO9ulPD-rvta7P7Ii2W09BsctJHR_YqmAY03nSsw` | Production |
| `VITE_APP_URL` | `https://cart.digicollabo.com` | Production |
| `VITE_PAGE_RENDERER_URL` | `https://page.digicollabo.com` | Production |
| `VITE_DATA_MODE` | `supabase` | Production |
| `NODE_VERSION` | `18` | Production |

> Preview 環境に同じ値を設定しておくと、プルリクエストプレビューでも動作します。

---

## 4. カスタムドメイン設定（`cart.digicollabo.com`）

1. Cloudflare Pages プロジェクト → **Custom domains** → **Set up a custom domain**
2. `cart.digicollabo.com` を入力 → **Continue**
3. **同一Cloudflareアカウントで`digicollabo.com`を管理している場合:**
   - CNAME が自動で追加されます。そのまま **Activate domain**
4. **別アカウントの場合（または手動DNS）:**
   - DNSゾーンに以下のCNAMEを追加:
     ```
     Type:  CNAME
     Name:  cart
     Target: <Pages プロジェクトURL>.pages.dev
     TTL:   Auto
     Proxy: 有効（オレンジクラウド）
     ```

---

## 5. SPA ルーティング（既に対応済み）

`public/_redirects` に以下が含まれているため追加設定不要:

```
/*    /index.html   200
```

React Router（`BrowserRouter`）のディープリンクが全て正しく動作します。

---

## 6. Supabase Auth リダイレクトURL許可

Magic Link のリダイレクト先を Supabase に許可する必要があります。

1. Supabase ダッシュボード → **Authentication** → **URL Configuration**
2. **Redirect URLs** に以下を追加:
   ```
   https://cart.digicollabo.com
   https://cart.digicollabo.com/**
   https://<プロジェクト名>.pages.dev
   https://<プロジェクト名>.pages.dev/**
   ```
   ※ `<プロジェクト名>` は Cloudflare Pages のデフォルトURL
3. **Site URL** に本番URL `https://cart.digicollabo.com` を設定

---

## 7. デプロイ確認

1. Cloudflare Pages ダッシュボード → **Deployments** タブで最新ビルドが Success か確認
2. `cart.digicollabo.com`（カスタムドメイン適用後）または `<プロジェクト名>.pages.dev` を開く
3. ログイン画面が表示されれば成功
4. Magic Link で動作確認

---

## 8. 再デプロイ

以降は `main` ブランチに push するだけで自動デプロイされます:

```bash
git add -A && git commit -m "update" && git push origin main
```

---

## トラブルシューティング

### ビルドが失敗する
- `NODE_VERSION=18` が設定されているか確認
- Cloudflare Pages の Build logs で詳細確認

### ログイン後に画面が真っ白
- ブラウザのコンソールで Supabase 認証エラーを確認
- Redirect URLs が Supabase に許可されているか確認

### Magic Linkメールが届かない
- Supabase → **Authentication** → **Email Templates** が有効か確認
- 開発中は Supabase の既定SMTP（制限あり）で送信されるため、本番リリース時は Custom SMTP 設定を推奨
