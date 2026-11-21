import { requireUser } from "@/lib/auth/require-user";
import { cancelSubscriptionToFree } from "@/lib/billing/orders";
import { jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";

/** 測試模式：取消付費訂閱並降回 FREE */
export async function POST() {
  try {
    const { user } = await requireUser();
    const subscription = await cancelSubscriptionToFree(user.id);
    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    return jsonError(error);
  }
}
