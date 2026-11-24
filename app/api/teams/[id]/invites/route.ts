import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { SITE_URL } from "@/lib/constants";
import { createInvite, requireTeamAdmin } from "@/lib/teams/service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** POST：邀請成員（email） */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const body = z
      .object({
        email: z.string().email(),
        role: z.enum(["admin", "member"]).optional(),
      })
      .safeParse(await request.json().catch(() => null));

    if (!body.success) {
      throw new AppError("validation_error", "請提供有效 Email。", 400);
    }

    const invite = await createInvite({
      supabase,
      teamId: id,
      actorId: user.id,
      email: body.data.email,
      role: body.data.role,
    });

    const acceptUrl = `${SITE_URL}/dashboard/teams/invite?token=${invite.token}`;

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expires_at: invite.expires_at,
        // 目前未接信箱服務：回傳連結供管理員手動分享
        acceptUrl,
      },
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE：撤銷邀請 body: { inviteId } */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    await requireTeamAdmin(supabase, id, user.id);

    const body = z
      .object({ inviteId: z.string().uuid() })
      .safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new AppError("validation_error", "缺少 inviteId。", 400);
    }

    const { error } = await supabase
      .from("team_invites")
      .update({ status: "revoked" })
      .eq("id", body.data.inviteId)
      .eq("team_id", id);

    if (error) {
      throw new AppError("internal_error", "無法撤銷邀請。", 500);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
