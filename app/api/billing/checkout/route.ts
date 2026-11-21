import { NextResponse } from "next/server";
import { z } from "zod";
import { getNovaOsUpgradeUrl } from "@/lib/novaos-hub";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  plan: z.enum(["pro", "business"]),
});

/**
 * 付費升級統一導向拓新雲端主站綠界 ECPay（同一 Auth 帳號）
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: { message: "請先登入" } },
        { status: 401 }
      );
    }

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "請選擇有效方案" } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      checkoutUrl: getNovaOsUpgradeUrl(),
      catalog: "ai_doc",
      plan: parsed.data.plan,
      gateway: "ecpay",
    });
  } catch (error) {
    console.error("[billing/checkout]", error);
    return NextResponse.json(
      { error: { message: "無法建立結帳" } },
      { status: 500 }
    );
  }
}
