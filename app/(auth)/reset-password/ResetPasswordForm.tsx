"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/constants";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("密碼至少 6 碼");
      return;
    }
    if (password !== confirm) {
      setError("兩次密碼不一致");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setMessage("密碼已更新，正在帶你回控制台…");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "更新失敗。請從 Email 連結重新進入此頁。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-4 py-16">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.16em] text-brand-600"
        >
          {SITE_NAME}
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">
          重設密碼
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          請輸入新密碼。若連結已過期，請重新申請忘記密碼。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">新密碼</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">再輸入一次</span>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "更新中…" : "更新密碼"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-sm text-slate-600">
          <Link href="/forgot-password" className="text-brand-700 hover:underline">
            重新寄送連結
          </Link>
          {" · "}
          <Link href="/login" className="text-brand-700 hover:underline">
            登入
          </Link>
        </p>
      </div>
    </main>
  );
}
