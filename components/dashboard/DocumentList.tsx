"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type DocumentListItem = {
  id: string;
  title: string;
  file_name: string;
  status: string;
  page_count: number | null;
  file_size?: number | null;
  created_at: string;
  error_message: string | null;
  team_id?: string | null;
  isOwner?: boolean;
  shared?: boolean;
};

const statusLabel: Record<string, string> = {
  processing: "處理中",
  ready: "已完成",
  failed: "失敗",
};

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(needle) ||
        d.file_name.toLowerCase().includes(needle),
    );
  }, [documents, q]);

  async function onDelete(id: string) {
    if (!confirm("確定刪除此文件？相關摘要、對話與索引將一併清除。")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "刪除失敗");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function onReanalyze(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/reanalyze`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "重新分析失敗");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新分析失敗");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋文件名稱…"
          className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 sm:max-w-xs"
        />
        <p className="text-xs text-slate-500">{filtered.length} 份文件</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-200 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
          {documents.length === 0
            ? "還沒有文件。上傳第一份 PDF 開始使用吧。"
            : "找不到符合搜尋條件的文件。"}
        </p>
      ) : (
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white">
          {filtered.map((doc) => (
            <li key={doc.id} className="px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/workspace?doc=${doc.id}`}
                    className="font-medium text-slate-900 hover:text-brand-700"
                  >
                    {doc.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc.file_name}
                    {doc.page_count ? ` · ${doc.page_count} 頁` : ""}
                    {` · ${formatBytes(doc.file_size)}`}
                    {" · "}
                    {new Date(doc.created_at).toLocaleString("zh-TW", {
                      timeZone: "Asia/Taipei",
                    })}
                  </p>
                  {doc.status === "failed" && doc.error_message && (
                    <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      doc.status === "ready"
                        ? "bg-emerald-50 text-emerald-700"
                        : doc.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {statusLabel[doc.status] || doc.status}
                  </span>
                  {(doc.shared || (doc.team_id && doc.isOwner === false)) && (
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      團隊共享
                    </span>
                  )}
                  {doc.team_id && doc.isOwner !== false && !doc.shared && (
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      已共享
                    </span>
                  )}
                  <Link
                    href={`/dashboard/workspace?doc=${doc.id}`}
                    className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-50"
                  >
                    開啟
                  </Link>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    下載
                  </a>
                  {doc.isOwner !== false && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === doc.id}
                        onClick={() => onReanalyze(doc.id)}
                        className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        重新分析
                      </button>
                      <button
                        type="button"
                        disabled={busyId === doc.id}
                        onClick={() => onDelete(doc.id)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        刪除
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
