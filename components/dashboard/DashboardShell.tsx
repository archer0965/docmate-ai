import Link from "next/link";
import { NovaOsAccountBar } from "@/components/dashboard/NovaOsAccountBar";
import { SITE_NAME } from "@/lib/constants";

export function DashboardShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string | null;
}) {
  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-brand-50/80 to-white">
      <header className="border-b border-brand-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link
              href="/dashboard"
              className="shrink-0 font-display text-base font-semibold text-slate-900 sm:text-lg"
            >
              {SITE_NAME}
            </Link>
            <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-brand-700">
                文件
              </Link>
              <Link href="/dashboard/upgrade" className="hover:text-brand-700">
                升級
              </Link>
              <Link href="/dashboard/billing" className="hover:text-brand-700">
                訂閱
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 sm:gap-3">
            <NovaOsAccountBar email={email} />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 hover:bg-brand-50 hover:text-brand-800"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
