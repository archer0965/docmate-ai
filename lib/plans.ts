/**
 * 會員方案與額度（伺服器端唯一真相來源）
 * 初學者提示：前端只能顯示，不可信任前端傳來的 plan。
 */

export type PlanId = "free" | "pro" | "business";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  documentsPerMonth: number;
  questionsPerMonth: number;
  priceTwd: number;
  maxUploadBytes: number;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "免費版",
    documentsPerMonth: 3,
    questionsPerMonth: 20,
    priceTwd: 0,
    maxUploadBytes: 5 * 1024 * 1024, // 5MB
  },
  pro: {
    id: "pro",
    name: "Pro",
    documentsPerMonth: 50,
    questionsPerMonth: 500,
    priceTwd: 199,
    maxUploadBytes: 15 * 1024 * 1024, // 15MB
  },
  business: {
    id: "business",
    name: "Business",
    documentsPerMonth: 200,
    questionsPerMonth: 2000,
    priceTwd: 499,
    maxUploadBytes: 25 * 1024 * 1024, // 25MB
  },
};

export function getPlan(plan: string | null | undefined): PlanDefinition {
  if (plan === "pro" || plan === "business" || plan === "free") {
    return PLANS[plan];
  }
  return PLANS.free;
}

/** 以台北時區取得目前用量週期 YYYY-MM */
export function currentUsagePeriod(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}
