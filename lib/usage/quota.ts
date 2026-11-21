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

/**
 * 原子預扣文件額度（呼叫 AI 前先扣，避免失敗重試燒光 API 又不計額度）
 * 回傳更新後的 used；失敗時丟出 quota_exceeded
 */
export async function reserveDocumentSlot(userId: string, limit: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_document_slot", {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    // 若尚未套用 RPC migration，後備：條件更新
    return reserveDocumentSlotFallback(userId, limit);
  }

  if (data === null || data === undefined) {
    throw new AppError(
      "quota_exceeded",
      `本月文件上傳額度已用完（${limit} 份）。請升級方案或下個月再試。`,
      429,
    );
  }

  return Number(data);
}

async function reserveDocumentSlotFallback(userId: string, limit: number): Promise<number> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("documents_used")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new AppError("internal_error", "無法預扣文件額度。", 500);
  }

  if (profile.documents_used >= limit) {
    throw new AppError(
      "quota_exceeded",
      `本月文件上傳額度已用完（${limit} 份）。請升級方案或下個月再試。`,
      429,
    );
  }

  const next = profile.documents_used + 1;
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ documents_used: next })
    .eq("id", userId)
    .eq("documents_used", profile.documents_used)
    .select("documents_used")
    .maybeSingle();

  if (updateError) {
    throw new AppError("internal_error", "無法預扣文件額度。", 500);
  }
  if (!updated) {
    throw new AppError("quota_exceeded", "額度繁忙，請稍後再試。", 429);
  }

  return updated.documents_used;
}

export async function releaseDocumentSlot(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("documents_used")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.documents_used <= 0) return;

  await admin
    .from("profiles")
    .update({ documents_used: profile.documents_used - 1 })
    .eq("id", userId)
    .eq("documents_used", profile.documents_used);
}

/**
 * 原子預扣提問額度（呼叫 AI 前先扣）
 */
export async function reserveQuestionSlot(userId: string, limit: number): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_question_slot", {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    return reserveQuestionSlotFallback(userId, limit);
  }

  if (data === null || data === undefined) {
    throw new AppError(
      "quota_exceeded",
      `本月提問額度已用完（${limit} 次）。請升級方案或下個月再試。`,
      429,
    );
  }

  return Number(data);
}

async function reserveQuestionSlotFallback(userId: string, limit: number): Promise<number> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("questions_used")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    throw new AppError("internal_error", "無法預扣提問額度。", 500);
  }

  if (profile.questions_used >= limit) {
    throw new AppError(
      "quota_exceeded",
      `本月提問額度已用完（${limit} 次）。請升級方案或下個月再試。`,
      429,
    );
  }

  const next = profile.questions_used + 1;
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ questions_used: next })
    .eq("id", userId)
    .eq("questions_used", profile.questions_used)
    .select("questions_used")
    .maybeSingle();

  if (updateError) {
    throw new AppError("internal_error", "無法預扣提問額度。", 500);
  }
  if (!updated) {
    throw new AppError("quota_exceeded", "額度繁忙，請稍後再試。", 429);
  }

  return updated.questions_used;
}

export async function releaseQuestionSlot(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("questions_used")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || profile.questions_used <= 0) return;

  await admin
    .from("profiles")
    .update({ questions_used: profile.questions_used - 1 })
    .eq("id", userId)
    .eq("questions_used", profile.questions_used);
}

/** @deprecated 改用 reserveDocumentSlot */
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

/** @deprecated 改用 reserveQuestionSlot */
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
