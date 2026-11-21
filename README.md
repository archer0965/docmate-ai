# Nova AI Doc

拓新雲端 NovaOS 子品牌 · AI 文件智慧助理（繁體中文）。技術：Next.js App Router、Supabase、Google Gemini。

**正式網址：** https://docmate-ai-one.vercel.app

## 目前進度

- [x] SaaS 首頁
- [x] Email / Google 登入頁
- [x] PDF 上傳（Supabase Storage）
- [x] PDF 文字解析與分段
- [x] Gemini 繁中摘要
- [x] 文件問答（含來源頁碼與對話紀錄）
- [x] 額度檢查（未登入 / 檔案過大 / 額度不足等錯誤處理）
- [x] 會員方案、升級頁、訂閱管理（付費升級統一綠界 ECPay／拓新雲端主站）
- [x] 上線前安全硬化（RLS、額度預扣、PDF 驗證、rate limit、Vercel 設定）

## 快速開始

### 1. 安裝

```bash
cd docmate-ai
npm install
cp .env.example .env.local
```

### 2. 填寫 `.env.local`

到 Supabase Project Settings → API 複製：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（保密）

到 Google AI Studio 建立：

- `GEMINI_API_KEY`（保密，只放伺服器）

### 3. 建立資料庫

在 Supabase → SQL Editor 依序執行：

1. `supabase/migrations/001_init_docmate.sql`
2. `supabase/migrations/002_lock_profile_quota.sql`（若 001 已含鎖定政策可略過）
3. `supabase/migrations/003_billing_subscriptions.sql`
4. `supabase/migrations/004_launch_hardening.sql`

### 4. 啟用登入

Supabase → Authentication：

- 啟用 Email 登入
- （選用）啟用 Google provider，Redirect URL 加：
  `http://localhost:3000/auth/callback`

### 5. 啟動

```bash
npm run dev
```

開啟 http://localhost:3000

## 如何測試本階段（文件系統）

1. 註冊 / 登入 → 進入 `/dashboard`
2. 上傳一份「有可選文字」的 PDF
3. 應看到摘要，並可進入文件頁提問
4. 故意測錯誤：
   - 未登入呼叫 `/api/documents` → 401
   - 上傳非 PDF → 415
   - 上傳超大檔 → 413
   - 空白／純掃描 PDF → 422
   - 超過 FREE 每月 3 份 → 429

## 會員升級（綠界）

1. 登入後開啟 `/dashboard/upgrade`
2. 選擇專業版或商業版 → 導向拓新雲端主站綠界 ECPay 結帳
3. 付款成功後由主站回調更新 `docmate_profiles.plan`
4. 超過額度時上傳／提問會被 API 拒絕（429）

## 永久公開網址（Vercel）

Cursor Apps `publish-app` 在此環境不可用時，以 Vercel 作為固定公開 URL（更新後網址不變）：

1. 開啟 [Vercel → Add New Project](https://vercel.com/new)，匯入 `https://github.com/archer0965/docmate-ai`（branch：`main`）。
2. Vercel project 名稱可為 `docmate-ai`；目前正式公開網址為：
   **https://docmate-ai-one.vercel.app**
3. 在 Vercel → Project → Settings → Environment Variables 設定（Production + Preview）：

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 僅伺服器端 |
| `GEMINI_API_KEY` | 僅伺服器端 |
| `GEMINI_MODEL` | 可選，預設 `gemini-2.0-flash` |
| `NEXT_PUBLIC_NOVAOS_URL` | 可選，拓新雲端主站（預設 https://paycheck.com.de） |

4. Supabase Auth → Redirect URLs 加上：
   `https://docmate-ai-one.vercel.app/auth/callback`
5. Deploy。之後每次 push `main` 會自動重新部署，公開網址不變。

可選：若要用 GitHub Actions 部署，見 `.github/workflows/vercel-deploy.yml`，並在 repo Secrets 設定 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。

## 重要安全規則

1. `GEMINI_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 不可出現在前端
2. 所有文件／對話都用 `user_id = auth.uid()` 的 RLS 隔離
3. 會員 `plan`、使用次數、付款狀態只能由伺服器／綠界回調更新，前端不能直接改方案
