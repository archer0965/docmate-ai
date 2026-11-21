import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

/**
 * 登入頁佔位（下一階段接上 Supabase Auth）
 */
export default function LoginPlaceholderPage() {
  return (
    <main className="mx-auto flex min-h-[100svh] max-w-lg flex-col justify-center px-4 py-16">
      <p className="font-display text-sm font-semibold tracking-[0.16em] text-brand-600">
        {SITE_NAME}
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">登入頁建置中</h1>
      <p className="mt-4 text-slate-600">
        下一階段會接上 Google / Email 會員登入（Supabase Auth）。目前請先回到首頁確認整體視覺。
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        回到首頁
      </Link>
    </main>
  );
}
