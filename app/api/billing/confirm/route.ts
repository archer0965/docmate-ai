import { requireUser } from "@/lib/auth/require-user";
import { confirmTestPayment, failTestPayment } from "@/lib/billing/orders";
import { AppError, jsonError } from "@/lib/errors";
import { getFreshProfile } from "@/lib/usage/quota";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(16),
  result: z.enum(["success", "failed"]),
  reason: z.string().max(200).optional(),
});

/**
 * 測試金流結果回報：一律在伺服器驗證簽章與訂單後才更新方案
 */
export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError("validation_error", "付款確認參數不正確。", 400);
    }

    if (parsed.data.result === "failed") {
      const order = await failTestPayment({
        orderId: parsed.data.orderId,
        userId: user.id,
        token: parsed.data.token,
        reason: parsed.data.reason,
      });
      return NextResponse.json({ ok: true, order });
    }

    const { order, alreadyPaid } = await confirmTestPayment({
      orderId: parsed.data.orderId,
      userId: user.id,
      token: parsed.data.token,
    });

    const supabase = await createClient();
    const profile = await getFreshProfile(supabase, user.id);

    return NextResponse.json({
      ok: true,
      alreadyPaid,
      order,
      profile: {
        plan: profile.plan,
        documents_used: profile.documents_used,
        questions_used: profile.questions_used,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
