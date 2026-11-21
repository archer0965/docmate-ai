"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Order = {
  id: string;
  target_plan: string;
  amount_twd: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export function BillingManager({
  planName,
  planId,
  documentsUsed,
  documentsLimit,
  questionsUsed,
  questionsLimit,
  period,
  subscriptionStatus,
  periodEnd,
  orders,
}: {
  planName: string;
  planId: string;
  documentsUsed: number;
  documentsLimit: number;
  questionsUsed: number;
  questionsLimit: number;
  period: string;
  subscriptionStatus: string;
  periodEnd: string | null;
  orders: Order[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelPlan() {
    if (!confirm("確定要取消付費方案並立刻降回免費版？（測試模式）")) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "取消失敗");
      setMessage("已降回免費版。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消失敗");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel: Record<string, string> = {
    pending: "待付款",
    paid: "已付款",
    failed: "失敗",
    canceled: "已取消",
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-slate-900">目前訂閱</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">方案</dt>
            <dd className="mt-1 font-semibold text-slate-900">{planName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">訂閱狀態</dt>
            <dd className="mt-1 font-semibold text-slate-900">{subscriptionStatus}</dd>
          </div>
          <div>
            <dt className="text-slate-500">本月文件</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {documentsUsed} / {documentsLimit}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">本月提問</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {questionsUsed} / {questionsLimit}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">用量週期（台北）</dt>
            <dd className="mt-1 font-semibold text-slate-900">{period}</dd>
          </div>
          <div>
            <dt className="text-slate-500">本期結束</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {periodEnd
                ? new Date(periodEnd).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/upgrade"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            升級方案
          </Link>
          {planId !== "free" && (
            <button
              type="button"
              onClick={cancelPlan}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "處理中…" : "取消訂閱（測試）"}
            </button>
          )}
        </div>

        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-slate-900">付款紀錄</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">尚無付款紀錄。</p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-50">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    升級 {order.target_plan.toUpperCase()} · NT${order.amount_twd}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString("zh-TW", {
                      timeZone: "Asia/Taipei",
                    })}
                  </p>
                </div>
                <span className="text-xs font-semibold text-brand-700">
                  {statusLabel[order.status] || order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
