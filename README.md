# DocMate AI

AI 文件智慧助理網站（繁體中文）。本專案使用 Next.js App Router，適合初學者分階段維護。

## 本階段進度

- [x] 專案架構
- [x] SaaS 首頁
- [ ] Supabase Auth / 資料庫 / Storage
- [ ] 儀表板、PDF 上傳、AI 功能
- [ ] 方案權限與 Vercel 部署

## 建議資料夾結構

```text
docmate-ai/
├── app/
│   ├── page.tsx              # 首頁
│   ├── layout.tsx            # 全站版面與字型
│   ├── (auth)/login/         # 登入（下一階段完整實作）
│   ├── (dashboard)/          # 儀表板（下一階段）
│   └── api/ai/               # AI API（下一階段，金鑰只放伺服器）
├── components/
│   ├── landing/              # 首頁區塊元件
│   └── ui/                   # 共用 UI
├── lib/                      # 常數、之後的 supabase / gemini 工具
├── types/                    # TypeScript 型別
├── supabase/migrations/      # SQL 遷移（下一階段）
├── .env.example              # 環境變數範本
└── README.md
```

## 本機啟動

```bash
cd docmate-ai
npm install
npm run dev
```

瀏覽器打開 [http://localhost:3000](http://localhost:3000)。

## 安全提醒

1. API Key（例如 `GEMINI_API_KEY`）只能寫在伺服器端環境變數。
2. 不要把秘密金鑰 commit 進 Git。
3. 使用者資料之後會用 Supabase RLS 做權限隔離。
