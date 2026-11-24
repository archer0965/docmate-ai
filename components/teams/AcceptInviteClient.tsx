"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "接受邀請失敗");
      setDone(true);
      router.push(`/dashboard/teams?joined=${json.teamId || ""}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "接受邀請失敗");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600">缺少邀請 token，請使用完整邀請連結。</p>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-brand-100 bg-white p-6">
      <h1 className="font-display text-2xl font-bold text-slate-900">加入團隊</h1>
      <p className="mt-2 text-sm text-slate-600">
        確認使用受邀信箱登入後，點擊下方按鈕接受邀請。
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {done ? (
        <p className="mt-4 text-sm text-emerald-700">已加入！正在前往團隊頁面…</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "處理中…" : "接受邀請"}
        </button>
      )}
      <Link
        href="/dashboard/teams"
        className="mt-4 block text-center text-sm text-brand-700 hover:underline"
      >
        返回團隊
      </Link>
    </div>
  );
}
