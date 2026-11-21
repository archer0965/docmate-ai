import { AppError } from "@/lib/errors";
import { currentUsagePeriod, getPlan, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: PlanId;
  documents_used: number;
  questions_used: number;
  usage_period: string;
};

/**
 * 讀取 profile；若月份不同，用 service role 重置額度
 * （避免使用者透過 RLS 自行竄改計數）
 */
export async function getFreshProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, plan, documents_used, questions_used, usage_period")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("internal_error", "無法讀取會員資料。", 500);
  }

  if (!data) {
    throw new AppError("unauthorized", "找不到會員資料，請重新登入。", 401);
  }

  const period = currentUsagePeriod();
  if (data.usage_period !== period) {
    const admin = createAdminClient();
    const { data: reset, error: resetError } = await admin
      .from("profiles")
      .update({
        usage_period: period,
        documents_used: 0,
        questions_used: 0,
      })
      .eq("id", userId)
      .select("id, email, display_name, plan, documents_used, questions_used, usage_period")
      .single();

    if (resetError || !reset) {
      throw new AppError("internal_error", "無法重置本月額度。", 500);
    }

    return reset as ProfileRow;
  }

  return data as ProfileRow;
}

export function assertCanUpload(profile: ProfileRow, fileSize: number) {
  const plan = getPlan(profile.plan);

  if (fileSize > plan.maxUploadBytes) {
    throw new AppError(
      "file_too_large",
      `檔案超過 ${Math.floor(plan.maxUploadBytes / (1024 * 1024))}MB 上限（目前方案：${plan.name}）。`,
      413,
    );
  }

  if (profile.documents_used >= plan.documentsPerMonth) {
    throw new AppError(
      "quota_exceeded",
      `本月文件上傳額度已用完（${plan.documentsPerMonth} 份）。請升級方案或下個月再試。`,
      429,
    );
  }
}

export function assertCanAsk(profile: ProfileRow) {
  const plan = getPlan(profile.plan);

  if (profile.questions_used >= plan.questionsPerMonth) {
    throw new AppError(
      "quota_exceeded",
      `本月提問額度已用完（${plan.questionsPerMonth} 次）。請升級方案或下個月再試。`,
      429,
    );
  }
}

export async function incrementDocumentsUsed(userId: string, currentUsed: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ documents_used: currentUsed + 1 })
    .eq("id", userId);

  if (error) {
    throw new AppError("internal_error", "無法更新文件使用次數。", 500);
  }
}

export async function incrementQuestionsUsed(userId: string, currentUsed: number) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ questions_used: currentUsed + 1 })
    .eq("id", userId);

  if (error) {
    throw new AppError("internal_error", "無法更新提問使用次數。", 500);
  }
}
