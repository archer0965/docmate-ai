# DocMate AI

AI 文件智慧助理（繁體中文）。技術：Next.js App Router、Supabase、Google Gemini。

## 目前進度

- [x] SaaS 首頁
- [x] Email / Google 登入頁
- [x] PDF 上傳（Supabase Storage）
- [x] PDF 文字解析與分段
- [x] Gemini 繁中摘要
- [x] 文件問答（含來源頁碼與對話紀錄）
- [x] 額度檢查（未登入 / 檔案過大 / 額度不足等錯誤處理）
- [ ] 會員升級與金流測試頁（下一階段）
- [ ] Vercel 正式部署檢查

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

## 重要安全規則

1. `GEMINI_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 不可出現在前端
2. 所有文件／對話都用 `user_id = auth.uid()` 的 RLS 隔離
3. 會員 `plan` 與使用次數只能由伺服器 service role 更新
