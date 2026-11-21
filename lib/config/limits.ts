import { getPlan, type PlanId } from "@/lib/plans";

/** 各方案 AI 成本相關上限 */
export function getAiSafetyLimits(planId: PlanId | string | null | undefined) {
  const plan = getPlan(planId);

  const maxPagesByPlan: Record<string, number> = {
    free: 30,
    pro: 120,
    business: 300,
  };

  return {
    maxPages: maxPagesByPlan[plan.id] ?? 30,
    maxChunksForAsk: plan.id === "free" ? 24 : plan.id === "pro" ? 40 : 60,
    maxQuestionChars: 800,
    // 每分鐘請求上限（單實例）
    askPerMinute: plan.id === "free" ? 6 : 12,
    uploadPerMinute: plan.id === "free" ? 3 : 6,
  };
}
