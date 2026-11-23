# Nova AI Doc 上線前檢查清單

## 必做設定

1. 設定 `.env` / Vercel Environment Variables：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `BILLING_TEST_SECRET`（正式環境必填）
2. 依序執行 SQL：
   - `001_init_docmate.sql`
   - `002_lock_profile_quota.sql`
   - `003_billing_subscriptions.sql`
   - `004_launch_hardening.sql`
   - `005_shared_novaos_auth.sql`
   - `006_workspace_study_rag.sql`（工作區／多型摘要／考題／引用／額度退還）
3. Supabase Auth 設定 Site URL / Redirect URLs（含正式網域 `/auth/callback`）
4. 永久公開網址：`https://docmate-ai-one.vercel.app`（細節見 README「永久公開網址」）

## 檢查結果對照

| 項目 | 狀態 |
| --- | --- |
| 頁面路由 | `/` `/login` `/dashboard*` `/api/*` |
| 響應式 | Header / Hero / Dashboard 可折行 |
| RLS | 文件／對話／Storage 僅本人；方案不可自改 |
| 金鑰 | 僅伺服器環境變數，無前端外洩 |
| 跨使用者讀取 | API 與 RLS 雙重 `user_id` 過濾 |
| 額度 | 原子預扣 + 月重置 |
| PDF 安全 | MIME、副檔名、magic bytes、頁數上限 |
| AI 成本 | 預扣額度、rate limit、context 截斷 |
| 錯誤處理 | API `jsonError` + `app/error.tsx` + `not-found` |
| Vercel | `vercel.json` maxDuration、安全標頭、`/api/health` |
