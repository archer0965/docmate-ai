"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TeamRow = {
  role: string;
  team: {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
  };
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  created_at: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type SharedDoc = {
  id: string;
  title: string;
  file_name: string;
  status: string;
  created_at: string;
  user_id: string;
};

export function TeamsManager({
  isBusiness,
  currentUserId,
}: {
  isBusiness: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [documents, setDocuments] = useState<SharedDoc[]>([]);
  const [teamName, setTeamName] = useState("");
  const [createName, setCreateName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error?.message || "無法載入團隊");
      setTeams([]);
      return;
    }
    setTeams(json.teams || []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/teams/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error?.message || "無法載入團隊詳情");
      return;
    }
    setSelectedId(id);
    setMyRole(json.myRole);
    setTeamName(json.team?.name || "");
    setMembers(json.members || []);
    setInvites(json.invites || []);
    setDocuments(json.documents || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTeams();
      setLoading(false);
    })();
  }, [loadTeams]);

  useEffect(() => {
    if (teams.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      const nextId =
        prev && teams.some((t) => t.team.id === prev) ? prev : teams[0].team.id;
      void loadDetail(nextId);
      return nextId;
    });
    // 僅在 teams 清單變更時同步選取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, loadDetail]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "建立失敗");
      setCreateName("");
      setMessage("團隊已建立");
      await loadTeams();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onRename(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "更新失敗");
      setMessage("團隊名稱已更新");
      await loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setLastAcceptUrl(null);
    try {
      const res = await fetch(`/api/teams/${selectedId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "邀請失敗");
      setInviteEmail("");
      setLastAcceptUrl(json.invite?.acceptUrl || null);
      setMessage("邀請已建立，請將連結傳給對方");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "邀請失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(inviteId: string) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${selectedId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "撤銷失敗");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤銷失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveMember(userId: string) {
    if (!selectedId) return;
    if (!confirm("確定移除此成員？")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${selectedId}/members/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "移除失敗");
      if (userId === currentUserId) {
        setMessage("已退出團隊");
        await loadTeams();
      } else {
        await loadDetail(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失敗");
    } finally {
      setBusy(false);
    }
  }

  async function onDissolve() {
    if (!selectedId) return;
    if (!confirm("確定解散團隊？共享文件將恢復為僅個人可見。")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${selectedId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "解散失敗");
      setMessage("團隊已解散");
      setSelectedId(null);
      await loadTeams();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解散失敗");
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  if (loading) {
    return <p className="text-sm text-slate-500">載入團隊…</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {!isBusiness && teams.length === 0 && (
        <div className="rounded-2xl border border-brand-100 bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            升級商業版即可建立團隊
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            邀請同事共享文件、一起摘要與提問。若你已被邀請，登入受邀信箱後開啟邀請連結即可加入。
          </p>
          <Link
            href="/dashboard/upgrade"
            className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            查看商業版
          </Link>
        </div>
      )}

      {isBusiness && (
        <section className="rounded-2xl border border-brand-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            建立團隊
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            商業版可建立 1 個團隊，最多 10 位成員。
          </p>
          <form onSubmit={onCreate} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="團隊名稱"
              required
              maxLength={80}
              className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
            <button
              type="submit"
              disabled={busy || !createName.trim()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              建立
            </button>
          </form>
        </section>
      )}

      {teams.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              我的團隊
            </p>
            <ul className="space-y-1">
              {teams.map((row) => (
                <li key={row.team.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(row.team.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                      selectedId === row.team.id
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-700 ring-1 ring-brand-100 hover:bg-brand-50"
                    }`}
                  >
                    <span className="font-medium">{row.team.name}</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        selectedId === row.team.id
                          ? "text-brand-100"
                          : "text-slate-400"
                      }`}
                    >
                      {row.role === "owner"
                        ? "擁有者"
                        : row.role === "admin"
                          ? "管理員"
                          : "成員"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selectedId && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-brand-100 bg-white p-5">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  團隊設定
                </h2>
                {isAdmin ? (
                  <form
                    onSubmit={onRename}
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                    >
                      儲存名稱
                    </button>
                  </form>
                ) : (
                  <p className="mt-2 text-sm text-slate-700">{teamName}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {!isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveMember(currentUserId)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      退出團隊
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onDissolve}
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      解散團隊
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-brand-100 bg-white p-5">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  成員（{members.length}）
                </h3>
                <ul className="mt-3 divide-y divide-brand-50">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {m.email || m.user_id.slice(0, 8)}
                          {m.user_id === currentUserId ? "（你）" : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          {m.role === "owner"
                            ? "擁有者"
                            : m.role === "admin"
                              ? "管理員"
                              : "成員"}
                        </p>
                      </div>
                      {isAdmin &&
                        m.role !== "owner" &&
                        m.user_id !== currentUserId && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onRemoveMember(m.user_id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            移除
                          </button>
                        )}
                    </li>
                  ))}
                </ul>
              </section>

              {isAdmin && (
                <section className="rounded-2xl border border-brand-100 bg-white p-5">
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    邀請成員
                  </h3>
                  <form
                    onSubmit={onInvite}
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as "member" | "admin")
                      }
                      className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
                    >
                      <option value="member">成員</option>
                      <option value="admin">管理員</option>
                    </select>
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      產生邀請
                    </button>
                  </form>
                  {lastAcceptUrl && (
                    <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-900">
                      <p className="font-semibold">邀請連結（請手動分享）</p>
                      <p className="mt-1 break-all">{lastAcceptUrl}</p>
                      <button
                        type="button"
                        className="mt-2 text-brand-700 underline"
                        onClick={() => {
                          void navigator.clipboard.writeText(lastAcceptUrl);
                          setMessage("已複製邀請連結");
                        }}
                      >
                        複製連結
                      </button>
                    </div>
                  )}
                  {invites.length > 0 && (
                    <ul className="mt-4 space-y-2 text-sm">
                      {invites.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span>
                            {inv.email} · {inv.role} · 到期{" "}
                            {new Date(inv.expires_at).toLocaleDateString("zh-TW", {
                              timeZone: "Asia/Taipei",
                            })}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onRevoke(inv.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            撤銷
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-brand-100 bg-white p-5">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  共享文件（{documents.length}）
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  在工作區開啟文件後，可將文件共享至此團隊。
                </p>
                {documents.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">尚無共享文件。</p>
                ) : (
                  <ul className="mt-3 divide-y divide-brand-50">
                    {documents.map((doc) => (
                      <li key={doc.id} className="py-2">
                        <Link
                          href={`/dashboard/workspace?doc=${doc.id}`}
                          className="text-sm font-medium text-brand-800 hover:underline"
                        >
                          {doc.title}
                        </Link>
                        <p className="text-xs text-slate-500">{doc.file_name}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
