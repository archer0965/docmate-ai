import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * 一次性 E2E bootstrap：以 service role 建立已驗證測試帳號（不寄信）。
 * 測完後必須刪除此路由。
 */
const ONE_TIME_SECRET = "nova-e2e-bootstrap-2026-11-23-x7k9m2p4";

export async function POST(request: Request) {
  try {
    const bodySchema = z.object({
      secret: z.string().min(8),
      email: z.string().email(),
      password: z.string().min(10).max(72),
    });
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("validation_error", "參數不正確。", 400);
    }

    if (parsed.data.secret !== ONE_TIME_SECRET) {
      throw new AppError("forbidden", "禁止存取。", 403);
    }

    // 僅允許明確測試用網域／前綴，避免誤建真實使用者
    const email = parsed.data.email.toLowerCase();
    if (
      !email.startsWith("nova.e2e.") &&
      !email.startsWith("novae2e") &&
      !email.includes("+e2e@")
    ) {
      throw new AppError(
        "validation_error",
        "僅允許 nova.e2e.* / novae2e* 測試信箱。",
        400,
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { display_name: "Nova E2E", e2e: true },
    });

    if (error) {
      // 已存在則嘗試直接回傳可登入狀態
      if (/already|registered|exists/i.test(error.message)) {
        return NextResponse.json({
          ok: true,
          existed: true,
          email,
        });
      }
      throw new AppError("internal_error", `建立測試帳號失敗：${error.message}`, 500);
    }

    // 確保 docmate_profiles 存在（觸發器可能已建立）
    if (data.user?.id) {
      await admin.from("docmate_profiles").upsert(
        {
          id: data.user.id,
          email,
          plan: "free",
          documents_used: 0,
          questions_used: 0,
        },
        { onConflict: "id" },
      );
    }

    return NextResponse.json({
      ok: true,
      existed: false,
      userId: data.user?.id ?? null,
      email,
    });
  } catch (error) {
    return jsonError(error);
  }
}
