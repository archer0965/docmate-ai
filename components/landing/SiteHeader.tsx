import Link from "next/link";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/ButtonLink";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 animate-fade-in">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-soft"
          >
            D
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-slate-900 transition group-hover:text-brand-700">
            {SITE_NAME}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="主要導覽">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-brand-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">
            登入
          </ButtonLink>
          <ButtonLink href="/signup">開始使用</ButtonLink>
        </div>
      </div>
    </header>
  );
}
