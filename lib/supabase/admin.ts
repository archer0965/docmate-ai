import { createClient } from "@supabase/supabase-js";

/**
 * Service Role 客戶端（僅伺服器使用，可略過 RLS）
 * 用途：安全更新 plan、必要時修復資料。一般使用者操作請用 server.ts。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
