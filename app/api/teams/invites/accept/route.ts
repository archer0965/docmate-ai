import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { acceptInvite } from "@/lib/teams/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/** POST：接受邀請 { token } */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = z
      .object({ token: z.string().min(16) })
      .safeParse(await request.json().catch(() => null));

    if (!body.success) {
      throw new AppError("validation_error", "缺少邀請 token。", 400);
    }

    const result = await acceptInvite({
      supabase,
      userId: user.id,
      email: user.email,
      token: body.data.token,
    });

    return NextResponse.json({ ok: true, teamId: result.teamId });
  } catch (error) {
    return jsonError(error);
  }
}
