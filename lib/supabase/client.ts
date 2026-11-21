"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 瀏覽器端 Supabase 客戶端（只用 anon key）
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("網站尚未完成 Supabase 設定，請聯絡管理員。");
  }

  return createBrowserClient(url, anonKey);
}
