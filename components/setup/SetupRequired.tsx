import Link from "next/link";

export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-xl flex-col justify-center px-4">
      <h1 className="font-display text-3xl font-bold text-slate-900">尚需完成環境設定</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        儀表板需要 Supabase 與 Gemini 環境變數。請複製 `.env.example` 為 `.env.local`，
        並執行 `supabase/migrations` 內的 SQL 後重新啟動。
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>設定 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY</li>
        <li>設定 SUPABASE_SERVICE_ROLE_KEY、GEMINI_API_KEY、BILLING_TEST_SECRET</li>
        <li>執行 001～004 migration</li>
      </ol>
      <Link href="/" className="mt-8 text-sm font-semibold text-brand-700 hover:underline">
        ← 回首頁
      </Link>
    </main>
  );
}
