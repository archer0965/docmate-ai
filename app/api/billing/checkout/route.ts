import { requireUser } from "@/lib/auth/require-user";
import { createTestCheckoutOrder } from "@/lib/billing/orders";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  plan: z.enum(["pro", "business"]),
});

/**
 * 建立測試結帳訂單
 * 金額與方案以伺服器 PLANS 為準
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError("validation_error", "請選擇 Pro 或 Business 方案。", 400);
    }

    const { order, token } = await createTestCheckoutOrder(user.id, parsed.data.plan);

    return NextResponse.json({
      orderId: order.id,
      amountTwd: order.amount_twd,
      targetPlan: order.target_plan,
      checkoutPath: `/dashboard/billing/checkout/${order.id}?token=${token}`,
      mode: "test",
    });
  } catch (error) {
    return jsonError(error);
  }
}
