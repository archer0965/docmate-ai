"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TestCheckoutClient({
  orderId,
  token,
  targetPlan,
  amountTwd,
  status,
}: {
  orderId: string;
  token: string;
  targetPlan: string;
  amountTwd: number;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"success" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(result: "success" | "failed") {
    setLoading(result);
    setError(null);
    try {
      const res = await fetch("/api/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token,
          result,
          reason: result === "failed" ? "測試結帳模擬失敗" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "確認失敗");

      if (result === "success") {
        router.replace("/dashboard/billing?upgraded=1");
        router.refresh();
      } else {
        router.replace("/dashboard/upgrade?failed=1");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認失敗");
      setLoading(null);
    }
  }

  if (status === "paid") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-semibold text-emerald-800">此訂單已付款完成。</p>
        <Link href="/dashboard/billing" className="mt-3 inline-block text-sm text-brand-700 hover:underline">
          前往訂閱管理
        </Link>
      </div>
    );
  }

  if (status !== "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-800">訂單狀態：{status}，無法再付款。</p>
        <Link href="/dashboard/upgrade" className="mt-3 inline-block text-sm text-brand-700 hover:underline">
          回到升級頁
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-soft">
      <p className="text-xs font-semibold tracking-[0.16em] text-amber-600">TEST MODE</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">測試結帳</h1>
      <p className="mt-2 text-sm text-slate-600">
        這不是真實金流。按下「模擬付款成功」後，伺服器會驗證簽章與訂單金額，再更新你的會員方案。
      </p>

      <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">方案</dt>
          <dd className="font-semibold uppercase text-slate-900">{targetPlan}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">金額</dt>
          <dd className="font-semibold text-slate-900">NT${amountTwd}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">訂單編號</dt>
          <dd className="truncate font-mono text-xs text-slate-700">{orderId}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => confirm("success")}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading === "success" ? "驗證中…" : "模擬付款成功"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => confirm("failed")}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading === "failed" ? "處理中…" : "模擬付款失敗"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
