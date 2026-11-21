"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { folderFromTitlePrefix, groupDocumentsByFolder } from "@/lib/documents/folders";

export type DocumentListItem = {
  id: string;
  title: string;
  file_name: string;
  status: string;
  page_count: number | null;
  created_at: string;
  error_message: string | null;
  file_size?: number | null;
  folder?: string | null;
};

const statusLabel: Record<string, string> = {
  processing: "處理中",
  ready: "已完成",
  failed: "失敗",
};

function resolveFolder(doc: DocumentListItem): string | null {
  if (doc.folder?.trim()) return doc.folder.trim();
  return folderFromTitlePrefix(doc.title).folder;
}

function displayTitle(doc: DocumentListItem): string {
  if (doc.folder?.trim()) return doc.title;
  return folderFromTitlePrefix(doc.title).displayTitle;
}

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const withFolder = documents.map((d) => ({
      ...d,
      folder: resolveFolder(d),
    }));
    return groupDocumentsByFolder(withFolder);
  }, [documents]);

  async function onDelete(id: string, title: string) {
    if (!window.confirm(`確定刪除「${title}」？此動作無法復原。`)) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || "刪除失敗");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-200 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
        還沒有文件。上傳第一份 PDF 或 Word 開始使用吧。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {[...grouped.entries()].map(([folderName, docs]) => (
        <div key={folderName}>
          <h3 className="mb-2 text-sm font-semibold text-slate-600">
            資料夾：{folderName}
          </h3>
          <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/dashboard/documents/${doc.id}`}
                  className="min-w-0 flex-1 transition hover:opacity-90"
                >
                  <p className="font-medium text-slate-900">{displayTitle(doc)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc.file_name}
                    {doc.page_count ? ` · ${doc.page_count} 頁` : ""}
                    {typeof doc.file_size === "number"
                      ? ` · ${(doc.file_size / (1024 * 1024)).toFixed(2)} MB`
                      : ""}
                    {" · "}
                    {new Date(doc.created_at).toLocaleString("zh-TW", {
                      timeZone: "Asia/Taipei",
                    })}
                  </p>
                  {doc.status === "failed" && doc.error_message && (
                    <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>
                  )}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                      doc.status === "ready"
                        ? "bg-emerald-50 text-emerald-700"
                        : doc.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {statusLabel[doc.status] || doc.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(doc.id, displayTitle(doc))}
                    disabled={deletingId === doc.id}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === doc.id ? "刪除中…" : "刪除"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
