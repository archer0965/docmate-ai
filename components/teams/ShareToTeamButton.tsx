"use client";

import { useState } from "react";

type TeamOption = {
  role: string;
  team: { id: string; name: string };
};

export function ShareToTeamButton({
  documentId,
  teamId,
  isOwner,
}: {
  documentId: string;
  teamId: string | null;
  isOwner: boolean;
}) {
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [sharedOverride, setSharedOverride] = useState<{
    documentId: string;
    teamId: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const currentTeamId =
    sharedOverride && sharedOverride.documentId === documentId
      ? sharedOverride.teamId
      : teamId;

  if (!isOwner) {
    if (!currentTeamId) return null;
    return (
      <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
        團隊共享
      </span>
    );
  }

  async function loadTeams() {
    const res = await fetch("/api/teams");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setTeams(json.teams || []);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadTeams();
  }

  async function share(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "無法更新共享");
      setSharedOverride({
        documentId,
        teamId: json.document?.team_id ?? next,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法更新共享");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50"
      >
        {currentTeamId ? "管理共享" : "共享到團隊"}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-brand-100 bg-white p-2 shadow-lg">
          {error && <p className="mb-2 px-1 text-xs text-red-600">{error}</p>}
          {teams.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">
              尚未加入團隊。請先到「團隊」建立或接受邀請。
            </p>
          ) : (
            <ul className="space-y-1">
              {teams.map((row) => (
                <li key={row.team.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => share(row.team.id)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                      currentTeamId === row.team.id
                        ? "bg-brand-600 text-white"
                        : "text-slate-700 hover:bg-brand-50"
                    }`}
                  >
                    {row.team.name}
                    {currentTeamId === row.team.id ? " ✓" : ""}
                  </button>
                </li>
              ))}
              {currentTeamId && (
                <li>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => share(null)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                  >
                    取消共享
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
