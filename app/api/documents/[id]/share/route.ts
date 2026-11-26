import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { getMembership } from "@/lib/teams/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST：將文件共享到團隊，或取消共享
 * body: { teamId: string | null }
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const body = z
      .object({ teamId: z.string().uuid().nullable() })
      .safeParse(await request.json().catch(() => null));

    if (!body.success) {
      throw new AppError("validation_error", "請提供 teamId 或 null。", 400);
    }

    const { data: document } = await supabase
      .from("documents")
      .select("id, user_id, team_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!document) {
      throw new AppError(
        "not_found",
        "找不到這份文件，或只有擁有者可以設定共享。",
        404,
      );
    }

    const teamId = body.data.teamId;
    if (teamId) {
      const membership = await getMembership(supabase, teamId, user.id);
      if (!membership) {
        throw new AppError("forbidden", "你不是此團隊成員，無法共享。", 403);
      }
    }

    const { data: updated, error } = await supabase
      .from("documents")
      .update({ team_id: teamId })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        "id, title, file_name, status, team_id, created_at, updated_at",
      )
      .single();

    if (error || !updated) {
      throw new AppError(
        "internal_error",
        error?.message?.includes("team_id")
          ? "尚未套用團隊 migration（007），無法共享。"
          : "無法更新共享設定。",
        500,
      );
    }

    return NextResponse.json({ document: updated });
  } catch (error) {
    return jsonError(error);
  }
}
