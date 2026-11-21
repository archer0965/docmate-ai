import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100svh] max-w-lg flex-col justify-center px-4">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">找不到頁面</h1>
      <p className="mt-3 text-slate-600">這個網址不存在，或你沒有權限查看。</p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        回首頁
      </Link>
    </main>
  );
}
