"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/plans";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";

type PlanCard = {
  id: PlanId;
  name: string;
  priceTwd: number;
  documentsPerMonth: number;
  questionsPerMonth: number;
  maxUploadMb: number;
  blurb: string;
  isPopular?: boolean;
  popularBadge?: string;
  features: string[];
};

export function UpgradePlans({
  currentPlan,
  plans,
}: {
  currentPlan: PlanId;
  plans: PlanCard[];
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  function goToEcpay(planId: PlanId) {
    if (planId === "free") return;
    setLoadingPlan(planId);
    // 統一導向拓新雲端主站綠界結帳（同一 Supabase 帳號）
    window.location.assign(getNovaOsUpgradeUrl());
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
                plan.isPopular
                  ? "border-brand-300 bg-gradient-to-b from-brand-50 to-white shadow-soft"
                  : "border-brand-100 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  {plan.name}
                </h3>
                {plan.isPopular ? (
                  <span className="rounded-md bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {plan.popularBadge || "主推方案"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
              <p className="mt-3 font-display text-3xl font-bold text-slate-900">
                {plan.priceTwd === 0 ? "免費" : `NT$${plan.priceTwd}`}
                {plan.priceTwd > 0 && (
                  <span className="text-sm font-medium text-slate-500"> / 月</span>
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
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
                  onClick={() => goToEcpay(plan.id)}
                  className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {loadingPlan === plan.id ? "導向綠界…" : "綠界付款升級"}
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

      <p className="mt-4 text-xs text-slate-500">
        付費升級統一走拓新雲端主站綠界 ECPay
        結帳；登入同一組 Email 後選擇 AI
        文件助理方案即可完成付款。早鳥／一般／大使折扣與全站規則相同。
      </p>
    </div>
  );
}
