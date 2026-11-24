import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { getMembership, requireTeamAdmin } from "@/lib/teams/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; userId: string }> };

/** DELETE：移除成員或自行退出 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, userId: targetUserId } = await params;
    const { user, supabase } = await requireUser();

    const { data: team } = await supabase
      .from("teams")
      .select("owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!team) {
      throw new AppError("not_found", "找不到團隊。", 404);
    }

    if (targetUserId === team.owner_id) {
      throw new AppError("validation_error", "無法移除團隊擁有者，請改為解散團隊。", 400);
    }

    const isSelf = targetUserId === user.id;
    if (!isSelf) {
      await requireTeamAdmin(supabase, id, user.id);
    } else {
      const membership = await getMembership(supabase, id, user.id);
      if (!membership) {
        throw new AppError("not_found", "你不是此團隊成員。", 404);
      }
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", id)
      .eq("user_id", targetUserId);

    if (error) {
      throw new AppError("internal_error", "無法移除成員。", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
