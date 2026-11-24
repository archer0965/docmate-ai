import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { createTeam, listUserTeams } from "@/lib/teams/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

/** GET：我加入的團隊 */
export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const teams = await listUserTeams(supabase, user.id);
    return NextResponse.json({ teams });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：建立團隊（僅 BUSINESS） */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const body = z
      .object({ name: z.string().trim().min(1).max(80) })
      .safeParse(await request.json().catch(() => null));

    if (!body.success) {
      throw new AppError("validation_error", "請提供團隊名稱。", 400);
    }

    const team = await createTeam(supabase, user.id, body.data.name);
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
