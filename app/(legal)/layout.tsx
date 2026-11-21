import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-display text-sm font-semibold">
            {SITE_NAME}
          </Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-slate-900">
              服務條款
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              隱私權
            </Link>
            <a
              href="https://paycheck.com.de/legal"
              className="hover:text-slate-900"
              target="_blank"
              rel="noopener noreferrer"
            >
              NovaOS 法律中心
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">{children}</main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <a href={SITE_URL} className="hover:text-slate-800">
          {SITE_NAME}
        </a>
        {" · "}
        <a
          href="https://paycheck.com.de"
          className="hover:text-slate-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          拓新雲端 NovaOS
        </a>
      </footer>
    </div>
  );
}
