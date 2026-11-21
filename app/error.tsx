"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DocMate] page error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[100svh] max-w-lg flex-col justify-center px-4">
      <h1 className="font-display text-3xl font-bold text-slate-900">發生錯誤</h1>
      <p className="mt-3 text-slate-600">頁面載入失敗，請稍後再試。</p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          再試一次
        </button>
        <Link
          href="/"
          className="rounded-xl border border-brand-200 px-5 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50"
        >
          回首頁
        </Link>
      </div>
    </main>
  );
}
