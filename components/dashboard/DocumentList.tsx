import Link from "next/link";

export type DocumentListItem = {
  id: string;
  title: string;
  file_name: string;
  status: string;
  page_count: number | null;
  created_at: string;
  error_message: string | null;
};

const statusLabel: Record<string, string> = {
  processing: "處理中",
  ready: "已完成",
  failed: "失敗",
};

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-200 bg-white/70 px-4 py-10 text-center text-sm text-slate-500">
        還沒有文件。上傳第一份 PDF 開始使用吧。
      </p>
    );
  }

  return (
    <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-100 bg-white">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/dashboard/documents/${doc.id}`}
            className="flex flex-col gap-1 px-4 py-4 transition hover:bg-brand-50/60 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-slate-900">{doc.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {doc.file_name}
                {doc.page_count ? ` · ${doc.page_count} 頁` : ""}
                {" · "}
                {new Date(doc.created_at).toLocaleString("zh-TW", {
                  timeZone: "Asia/Taipei",
                })}
              </p>
              {doc.status === "failed" && doc.error_message && (
                <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>
              )}
            </div>
            <span
              className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold sm:mt-0 ${
                doc.status === "ready"
                  ? "bg-emerald-50 text-emerald-700"
                  : doc.status === "failed"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {statusLabel[doc.status] || doc.status}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
