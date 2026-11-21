import { createClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/**
 * Service Role 客戶端（僅伺服器使用，可略過 RLS）
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new AppError(
      "internal_error",
      "伺服器尚未設定 SUPABASE_SERVICE_ROLE_KEY。",
      503,
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
