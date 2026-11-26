import { AppError } from "@/lib/errors";
import { TEAM_LIMITS } from "@/lib/teams/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

export type TeamRole = "owner" | "admin" | "member";

export async function requireBusinessPlan(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("docmate_profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError("unauthorized", "找不到會員資料。", 401);
  }
  if (data.plan !== "business") {
    throw new AppError(
      "forbidden",
      "團隊功能僅限商業版。請先升級方案。",
      403,
    );
  }
  return data.plan as "business";
}

export async function getMembership(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("team_members")
    .select("id, role, team_id, user_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; role: TeamRole; team_id: string; user_id: string } | null;
}

export async function requireTeamAdmin(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
) {
  const membership = await getMembership(supabase, teamId, userId);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new AppError("forbidden", "需要團隊管理員權限。", 403);
  }
  return membership;
}

export async function createTeam(
  supabase: SupabaseClient,
  userId: string,
  name: string,
) {
  await requireBusinessPlan(supabase, userId);

  const { count } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if ((count ?? 0) >= TEAM_LIMITS.maxOwnedTeams) {
    throw new AppError(
      "validation_error",
      `商業版最多建立 ${TEAM_LIMITS.maxOwnedTeams} 個團隊。`,
      400,
    );
  }

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new AppError("validation_error", "團隊名稱長度需為 1～80 字。", 400);
  }

  const { data: team, error } = await supabase
    .from("teams")
    .insert({ name: trimmed, owner_id: userId })
    .select("id, name, owner_id, created_at, updated_at")
    .single();

  if (error || !team) {
    throw new AppError(
      "internal_error",
      error?.message?.includes("teams")
        ? "團隊資料表尚未建立，請先執行 migration 007。"
        : "無法建立團隊。",
      500,
    );
  }

  const { error: memberError } = await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    // 回滾團隊
    await supabase.from("teams").delete().eq("id", team.id);
    throw new AppError("internal_error", "無法加入團隊擁有者。", 500);
  }

  return team;
}

export async function listUserTeams(supabase: SupabaseClient, userId: string) {
  const { data: memberships, error } = await supabase
    .from("team_members")
    .select("role, team_id, teams(id, name, owner_id, created_at, updated_at)")
    .eq("user_id", userId);

  if (error) {
    return [];
  }

  return (memberships || []).map((m) => {
    const team = Array.isArray(m.teams) ? m.teams[0] : m.teams;
    return {
      role: m.role as TeamRole,
      team,
    };
  }).filter((row) => row.team);
}

export function newInviteToken() {
  return randomBytes(24).toString("hex");
}

const USER_LOOKUP_PAGE_SIZE = 1000;
const USER_LOOKUP_MAX_PAGES = 50;

async function findUserIdByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= USER_LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USER_LOOKUP_PAGE_SIZE,
    });
    if (error) {
      throw new AppError("internal_error", "無法查詢使用者。", 500);
    }
    const users = data?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === email);
    if (found) return { id: found.id };
    if (users.length < USER_LOOKUP_PAGE_SIZE) break;
  }
  return null;
}

export async function createInvite(options: {
  supabase: SupabaseClient;
  teamId: string;
  actorId: string;
  email: string;
  role?: "admin" | "member";
}) {
  const { supabase, teamId, actorId } = options;
  await requireTeamAdmin(supabase, teamId, actorId);
  // 邀請人若非 owner，仍須商業版團隊存在即可；建立團隊已檢查 BUSINESS

  const email = options.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new AppError("validation_error", "邀請信箱格式不正確。", 400);
  }

  const role = options.role || "member";

  const { count: memberCount } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  const { count: pendingCount } = await supabase
    .from("team_invites")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("status", "pending");

  if ((memberCount ?? 0) + (pendingCount ?? 0) >= TEAM_LIMITS.maxMembers) {
    throw new AppError(
      "validation_error",
      `團隊人數上限為 ${TEAM_LIMITS.maxMembers}（含待接受邀請）。`,
      400,
    );
  }

  // 若已是成員
  const existingUser = await findUserIdByEmail(email);

  if (existingUser) {
    const membership = await getMembership(supabase, teamId, existingUser.id);
    if (membership) {
      throw new AppError("conflict", "此使用者已是團隊成員。", 409);
    }
  }

  const token = newInviteToken();
  const expires = new Date();
  expires.setDate(expires.getDate() + TEAM_LIMITS.inviteExpiryDays);

  const { data: invite, error } = await supabase
    .from("team_invites")
    .upsert(
      {
        team_id: teamId,
        email,
        role,
        token,
        invited_by: actorId,
        status: "pending",
        expires_at: expires.toISOString(),
      },
      { onConflict: "team_id,email" },
    )
    .select("id, team_id, email, role, token, status, expires_at, created_at")
    .single();

  if (error || !invite) {
    throw new AppError("internal_error", "無法建立邀請。", 500);
  }

  return invite;
}

export async function acceptInvite(options: {
  supabase: SupabaseClient;
  userId: string;
  email: string | null | undefined;
  token: string;
}) {
  const { supabase, userId, token } = options;
  const email = (options.email || "").toLowerCase();

  const { data: invite, error } = await supabase
    .from("team_invites")
    .select("id, team_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    throw new AppError("not_found", "邀請不存在或已失效。", 404);
  }
  if (invite.status !== "pending") {
    throw new AppError("validation_error", "此邀請已處理過。", 400);
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabase
      .from("team_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    throw new AppError("validation_error", "邀請已過期，請請管理員重寄。", 400);
  }
  if (email && invite.email.toLowerCase() !== email) {
    throw new AppError(
      "forbidden",
      "請使用受邀信箱登入後再接受邀請。",
      403,
    );
  }

  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", invite.team_id);

  if ((count ?? 0) >= TEAM_LIMITS.maxMembers) {
    throw new AppError("validation_error", "團隊人數已滿。", 400);
  }

  // 使用 service role 寫入，避免 RLS 與邀請狀態競態
  const admin = createAdminClient();
  const { error: memberError } = await admin.from("team_members").upsert(
    {
      team_id: invite.team_id,
      user_id: userId,
      role: invite.role,
    },
    { onConflict: "team_id,user_id" },
  );

  if (memberError) {
    throw new AppError("internal_error", "無法加入團隊。", 500);
  }

  await admin
    .from("team_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  return { teamId: invite.team_id };
}
