import type { PlanId } from "@/lib/plans";

export type PaymentOrderStatus = "pending" | "paid" | "failed" | "canceled";

export type PaymentOrder = {
  id: string;
  user_id: string;
  target_plan: Exclude<PlanId, "free">;
  amount_twd: number;
  currency: string;
  status: PaymentOrderStatus;
  provider: string;
  provider_ref: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: PlanId;
  status: "active" | "canceled" | "past_due";
  provider: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};
