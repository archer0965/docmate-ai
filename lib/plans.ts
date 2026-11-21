/**
 * 會員方案與額度（伺服器端唯一真相來源）
 * 初學者提示：前端只能顯示，不可信任前端傳來的 plan。
 * 價格結構獨立於拓脈／NovaStore；折扣規則與拓新雲端主站一致（早鳥／一般／大使）。
 */

export type PlanId = "free" | "pro" | "business";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  documentsPerMonth: number;
  questionsPerMonth: number;
  priceTwd: number;
  maxUploadBytes: number;
  blurb: string;
  isPopular?: boolean;
  popularBadge?: string;
  features: string[];
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "免費版",
    documentsPerMonth: 3,
    questionsPerMonth: 20,
    priceTwd: 0,
    maxUploadBytes: 5 * 1024 * 1024, // 5MB
    blurb: "適合體驗",
    features: ["每月 3 份文件", "每月 20 次提問", "基礎摘要", "基礎 AI 問答"],
  },
  pro: {
    id: "pro",
    name: "專業版",
    documentsPerMonth: 50,
    questionsPerMonth: 500,
    priceTwd: 199,
    maxUploadBytes: 15 * 1024 * 1024, // 15MB
    blurb: "個人高效文件工作流",
    isPopular: true,
    popularBadge: "主推方案",
    features: [
      "每月 50 份文件",
      "每月 500 次提問",
      "AI 考題與筆記",
      "完整文件管理",
    ],
  },
  business: {
    id: "business",
    name: "商業版",
    documentsPerMonth: 200,
    questionsPerMonth: 2000,
    priceTwd: 499,
    maxUploadBytes: 25 * 1024 * 1024, // 25MB
    blurb: "進階分析與優先處理",
    features: [
      "每月 200 份文件",
      "每月 2,000 次提問",
      "進階文件分析",
      "優先處理",
      "團隊功能",
    ],
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
