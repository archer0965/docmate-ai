"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/constants";
import { safeInternalPath } from "@/lib/security/safe-redirect";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeInternalPath(searchParams.get("next"), "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authError = useMemo(() => {
    if (searchParams.get("error") === "auth") {
      return "登入驗證失敗，請再試一次。";
    }
    return null;
  }, [searchParams]);

  async function handleEmailAuth(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (error) throw error;
        setMessage("註冊成功。若專案啟用 Email 確認，請先到信箱完成驗證。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(nextPath);
        router.refresh();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "登入失敗";
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Google 登入失敗";
      setMessage(text);
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-4 py-16">
        <Link href="/" className="font-display text-sm font-semibold tracking-[0.16em] text-brand-600">
          {SITE_NAME}
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">
          {mode === "login" ? "登入帳號" : "建立帳號"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          登入後即可上傳 PDF、產生摘要，並對文件提問。
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-8 flex w-full items-center justify-center rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-brand-50 disabled:opacity-60"
        >
          使用 Google 登入
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-brand-100" />
          或使用 Email
          <div className="h-px flex-1 bg-brand-100" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
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
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">密碼</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
              placeholder="至少 6 碼"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "處理中…" : mode === "login" ? "登入" : "註冊"}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm text-brand-700 hover:underline"
          onClick={() => {
            setMode((m) => (m === "login" ? "signup" : "login"));
            setMessage(null);
          }}
        >
          {mode === "login" ? "還沒有帳號？改為註冊" : "已有帳號？改為登入"}
        </button>

        {(authError || message) && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {authError || message}
          </p>
        )}

        <p className="mt-8 text-xs leading-relaxed text-slate-500">
          請先在專案根目錄建立 `.env.local`，並到 Supabase 執行
          `supabase/migrations/001_init_docmate.sql`。
        </p>
      </div>
    </main>
  );
}
