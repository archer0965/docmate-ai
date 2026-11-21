import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function requireUser(): Promise<{ user: User; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppError("unauthorized", "請先登入後再使用此功能。", 401);
  }

  return { user, supabase };
}
