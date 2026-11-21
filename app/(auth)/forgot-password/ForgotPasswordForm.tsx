"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/constants";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      if (resetError) throw resetError;
      setMessage("若此 Email 已註冊，我們已寄出重設密碼連結，請至信箱查收。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "寄送失敗，請稍後再試");
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
          忘記密碼
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          輸入註冊 Email，我們會寄送重設連結（與拓新雲端 NovaOS 共用帳號）。
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "寄送中…" : "寄送重設連結"}
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
          <Link href="/login" className="text-brand-700 hover:underline">
            回到登入
          </Link>
        </p>
      </div>
    </main>
  );
}
