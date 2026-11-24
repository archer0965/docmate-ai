import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import {
  getMembership,
  requireTeamAdmin,
} from "@/lib/teams/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET：團隊詳情、成員、邀請 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const membership = await getMembership(supabase, id, user.id);
    if (!membership) {
      throw new AppError("not_found", "找不到團隊或你不是成員。", 404);
    }

    const { data: team, error } = await supabase
      .from("teams")
      .select("id, name, owner_id, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error || !team) {
      throw new AppError("not_found", "找不到團隊。", 404);
    }

    const { data: members } = await supabase
      .from("team_members")
      .select("id, user_id, role, created_at")
      .eq("team_id", id)
      .order("created_at", { ascending: true });

    // 補 email（service role）
    const admin = createAdminClient();
    const memberRows = members || [];
    const withEmail = await Promise.all(
      memberRows.map(async (m) => {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        return {
          ...m,
          email: data.user?.email ?? null,
        };
      }),
    );

    let invites: unknown[] = [];
    if (membership.role === "owner" || membership.role === "admin") {
      const { data } = await supabase
        .from("team_invites")
        .select("id, email, role, status, expires_at, created_at")
        .eq("team_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      invites = data || [];
    }

    const { data: sharedDocs } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, status, page_count, file_size, created_at, user_id",
      )
      .eq("team_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      team,
      myRole: membership.role,
      members: withEmail,
      invites,
      documents: sharedDocs || [],
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** PATCH：更新團隊名稱 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    await requireTeamAdmin(supabase, id, user.id);

    const body = z
      .object({ name: z.string().trim().min(1).max(80) })
      .safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new AppError("validation_error", "請提供有效團隊名稱。", 400);
    }

    const { data, error } = await supabase
      .from("teams")
      .update({ name: body.data.name })
      .eq("id", id)
      .select("id, name, owner_id, created_at, updated_at")
      .single();

    if (error || !data) {
      throw new AppError("internal_error", "無法更新團隊。", 500);
    }
    return NextResponse.json({ team: data });
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE：解散團隊（僅擁有者） */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: team } = await supabase
      .from("teams")
      .select("id, owner_id")
      .eq("id", id)
      .maybeSingle();

    if (!team || team.owner_id !== user.id) {
      throw new AppError("forbidden", "只有擁有者可以解散團隊。", 403);
    }

    // 取消文件共享
    await supabase.from("documents").update({ team_id: null }).eq("team_id", id);

    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) {
      throw new AppError("internal_error", "無法解散團隊。", 500);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
