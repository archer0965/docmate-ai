"use client";

import { useEffect } from "react";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";

/** 舊測試結帳 UI 已停用：一律導向拓新雲端綠界升級 */
export function TestCheckoutClient() {
  useEffect(() => {
    window.location.replace(getNovaOsUpgradeUrl());
  }, []);

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6">
      <p className="text-sm text-slate-600">正在導向綠界付款…</p>
    </div>
  );
}
