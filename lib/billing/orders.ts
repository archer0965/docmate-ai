import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
import { getPlan, type PlanId } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentOrder, SubscriptionRow } from "@/lib/billing/types";

function billingSecret() {
  const dedicated = process.env.BILLING_TEST_SECRET;
  if (dedicated) return dedicated;

  // 正式環境必須獨立密鑰，避免與 service role 共用
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new AppError(
      "internal_error",
      "正式環境請設定 BILLING_TEST_SECRET。",
      500,
    );
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!fallback) {
    throw new AppError("internal_error", "伺服器尚未設定金流測試密鑰。", 500);
  }
  return fallback;
}

/** 產生測試結帳簽章（防止竄改 orderId） */
export function signCheckoutToken(orderId: string, userId: string) {
  return createHmac("sha256", billingSecret())
    .update(`${orderId}:${userId}`)
    .digest("hex");
}

export function verifyCheckoutToken(orderId: string, userId: string, token: string) {
  const expected = signCheckoutToken(orderId, userId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token || "");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertPaidPlan(plan: string): Exclude<PlanId, "free"> {
  if (plan === "pro" || plan === "business") return plan;
  throw new AppError("validation_error", "只能升級到 Pro 或 Business。", 400);
}

/**
 * 建立測試付款訂單（金額以伺服器 PLANS 為準，不信任前端金額）
 */
export async function createTestCheckoutOrder(userId: string, targetPlan: string) {
  const planId = assertPaidPlan(targetPlan);
  const plan = getPlan(planId);
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("payment_orders")
    .insert({
      user_id: userId,
      target_plan: planId,
      amount_twd: plan.priceTwd,
      currency: "TWD",
      status: "pending",
      provider: "test",
    })
    .select("*")
    .single();

  if (error || !order) {
    console.error("[Nova AI Doc] create order failed", error);
    throw new AppError("internal_error", "無法建立付款訂單。", 500);
  }

  const token = signCheckoutToken(order.id, userId);
  return { order: order as PaymentOrder, token };
}

/**
 * 伺服器驗證後標記付款成功，並更新 profile.plan + subscriptions
 * 前端不可直接改方案。
 */
export async function confirmTestPayment(options: {
  orderId: string;
  userId: string;
  token: string;
}) {
  const { orderId, userId, token } = options;

  if (!verifyCheckoutToken(orderId, userId, token)) {
    throw new AppError("forbidden", "付款簽章驗證失敗。", 403);
  }

  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("payment_orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("internal_error", "無法讀取付款訂單。", 500);
  }
  if (!order) {
    throw new AppError("not_found", "找不到付款訂單。", 404);
  }

  if (order.status === "paid") {
    return { order: order as PaymentOrder, alreadyPaid: true };
  }

  if (order.status !== "pending") {
    throw new AppError("validation_error", `訂單狀態為 ${order.status}，無法付款。`, 409);
  }

  const expectedAmount = getPlan(order.target_plan).priceTwd;
  if (order.amount_twd !== expectedAmount) {
    throw new AppError("forbidden", "訂單金額與方案不符，已拒絕。", 403);
  }

  const paidAt = new Date().toISOString();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: paidOrder, error: payError } = await admin
    .from("payment_orders")
    .update({
      status: "paid",
      paid_at: paidAt,
      provider_ref: `test_${orderId.slice(0, 8)}`,
    })
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (payError) {
    throw new AppError("internal_error", "更新付款狀態失敗。", 500);
  }
  if (!paidOrder) {
    // 可能被並行請求搶先
    const { data: latest } = await admin
      .from("payment_orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (latest?.status === "paid") {
      return { order: latest as PaymentOrder, alreadyPaid: true };
    }
    throw new AppError("conflict", "付款狀態更新衝突，請重新整理。", 409);
  }

  const { error: profileError } = await admin
    .from("docmate_profiles")
    .update({ plan: order.target_plan })
    .eq("id", userId);

  if (profileError) {
    throw new AppError("internal_error", "付款成功但更新會員方案失敗，請聯絡支援。", 500);
  }

  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: order.target_plan,
      status: "active",
      provider: "test",
      current_period_start: paidAt,
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
    },
    { onConflict: "user_id" },
  );

  if (subError) {
    console.error("[Nova AI Doc] subscription upsert failed", subError);
    throw new AppError("internal_error", "更新訂閱紀錄失敗。", 500);
  }

  return { order: paidOrder as PaymentOrder, alreadyPaid: false };
}

export async function failTestPayment(options: {
  orderId: string;
  userId: string;
  token: string;
  reason?: string;
}) {
  const { orderId, userId, token, reason } = options;
  if (!verifyCheckoutToken(orderId, userId, token)) {
    throw new AppError("forbidden", "付款簽章驗證失敗。", 403);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_orders")
    .update({
      status: "failed",
      failure_reason: reason || "使用者在測試結帳取消／失敗",
    })
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new AppError("internal_error", "無法標記付款失敗。", 500);
  }
  if (!data) {
    throw new AppError("validation_error", "訂單不存在或已不是待付款狀態。", 409);
  }

  return data as PaymentOrder;
}

/** 測試模式：立即降級為 FREE（正式金流可改為期末生效） */
export async function cancelSubscriptionToFree(userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: profileError } = await admin
    .from("docmate_profiles")
    .update({ plan: "free" })
    .eq("id", userId);

  if (profileError) {
    throw new AppError("internal_error", "無法降級會員方案。", 500);
  }

  const { data, error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan: "free",
        status: "canceled",
        provider: "test",
        current_period_end: now,
        cancel_at_period_end: false,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("internal_error", "無法更新訂閱狀態。", 500);
  }

  return data as SubscriptionRow;
}

export async function getSubscription(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("internal_error", "無法讀取訂閱資料。", 500);
  }

  if (data) return data as SubscriptionRow;

  // 舊帳號補一筆 FREE 訂閱
  const { data: created, error: createError } = await admin
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: "free",
      status: "active",
      provider: "test",
    })
    .select("*")
    .single();

  if (createError || !created) {
    // 可能與既有 profile.plan 不一致時，仍回傳最小可用資料
    return null;
  }

  return created as SubscriptionRow;
}

export async function listOrders(userId: string, limit = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError("internal_error", "無法讀取付款紀錄。", 500);
  }

  return (data || []) as PaymentOrder[];
}

export async function getOrderForUser(orderId: string, userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError("internal_error", "無法讀取訂單。", 500);
  }
  if (!data) {
    throw new AppError("not_found", "找不到訂單。", 404);
  }

  return data as PaymentOrder;
}
