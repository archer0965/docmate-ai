import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-100 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-base font-semibold text-slate-900">{SITE_NAME}</p>
          <p className="mt-1 text-sm text-slate-500">AI 文件智慧助理 · 繁體中文</p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-slate-600">
          <Link href="/login" className="hover:text-brand-700">
            登入
          </Link>
          <a href="#features" className="hover:text-brand-700">
            功能
          </a>
          <Link href="/terms" className="hover:text-brand-700">
            服務條款
          </Link>
          <Link href="/privacy" className="hover:text-brand-700">
            隱私權
          </Link>
          <Link href="/legal" className="hover:text-brand-700">
            法律資訊
          </Link>
        </div>
      </div>
    </footer>
  );
}
