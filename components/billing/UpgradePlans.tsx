"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanId } from "@/lib/plans";

type PlanCard = {
  id: PlanId;
  name: string;
  priceTwd: number;
  documentsPerMonth: number;
  questionsPerMonth: number;
  maxUploadMb: number;
};

export function UpgradePlans({
  currentPlan,
  plans,
}: {
  currentPlan: PlanId;
  plans: PlanCard[];
}) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planId: PlanId) {
    if (planId === "free") return;
    setLoadingPlan(planId);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "無法建立訂單");
      }
      router.push(json.checkoutPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立訂單失敗");
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = plan.id !== "free";

          return (
            <article
              key={plan.id}
              className={`rounded-2xl border p-5 ${
                plan.id === "pro"
                  ? "border-brand-300 bg-gradient-to-b from-brand-50 to-white shadow-soft"
                  : "border-brand-100 bg-white"
              }`}
            >
              <h3 className="font-display text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-3 font-display text-3xl font-bold text-slate-900">
                {plan.priceTwd === 0 ? "免費" : `NT$${plan.priceTwd}`}
                {plan.priceTwd > 0 && (
                  <span className="text-sm font-medium text-slate-500"> / 月</span>
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>每月 {plan.documentsPerMonth} 份文件</li>
                <li>每月 {plan.questionsPerMonth} 次提問</li>
                <li>單檔上限 {plan.maxUploadMb}MB</li>
              </ul>

              {isCurrent ? (
                <p className="mt-6 rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-600">
                  目前方案
                </p>
              ) : isPaid ? (
                <button
                  type="button"
                  disabled={!!loadingPlan}
                  onClick={() => startCheckout(plan.id)}
                  className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {loadingPlan === plan.id ? "建立訂單中…" : "測試升級"}
                </button>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-brand-200 px-3 py-2 text-center text-sm text-slate-500">
                  可在訂閱管理降回免費版
                </p>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-xs text-slate-500">
        目前為測試金流：不會真正扣款。付款成功後由伺服器驗證並更新方案，前端無法自行改等級。
      </p>
    </div>
  );
}
