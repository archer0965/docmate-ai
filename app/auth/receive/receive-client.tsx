"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applyHandoffSession } from "@/lib/auth-receive";
import { createClient } from "@/lib/supabase/client";
import { NOVAOS_HUB_URL } from "@/lib/novaos-hub";

function sanitizeNext(raw: string | null, fallback = "/dashboard") {
  if (!raw) return fallback;
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function AuthReceiveClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("正在完成登入…");

  useEffect(() => {
    const next = sanitizeNext(searchParams.get("next"));
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const ok = await applyHandoffSession(supabase);
      if (cancelled) return;
      if (ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setMessage("登入狀態未帶入，改導向拓新雲端…");
      const returnTo = `${window.location.origin}/auth/receive?next=${encodeURIComponent(next)}`;
      window.location.replace(
        `${NOVAOS_HUB_URL}/login?next=${encodeURIComponent(returnTo)}`
      );
    })().catch(() => setMessage("登入失敗，請重新嘗試"));

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-slate-600">{message}</p>
    </main>
  );
}
