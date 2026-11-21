"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UploadPanelProps = {
  maxUploadBytes: number;
  documentsRemaining: number;
};

export function UploadPanel({ maxUploadBytes, documentsRemaining }: UploadPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onUpload() {
    if (!file) {
      setError("請先選擇 PDF 或 Word（.docx）檔案。");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.append("file", file);
      if (folder.trim()) {
        body.append("folder", folder.trim());
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body,
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || "上傳失敗");
      }

      setSuccess("上傳並完成摘要！正在開啟文件…");
      setFile(null);
      router.push(`/dashboard/documents/${json.document.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
      <h2 className="font-display text-xl font-semibold text-slate-900">上傳文件</h2>
      <p className="mt-2 text-sm text-slate-600">
        支援 PDF 與 Word（.docx）。系統會存到 Supabase Storage，解析文字後用 Gemini
        產生繁中摘要。上限 {Math.floor(maxUploadBytes / (1024 * 1024))}MB；本月還可上傳{" "}
        {Math.max(documentsRemaining, 0)} 份。
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <input
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
        />
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="資料夾名稱（選填）"
          maxLength={80}
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={onUpload}
          disabled={loading || documentsRemaining <= 0}
          className="w-fit rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "處理中（解析＋摘要）…" : "上傳並產生摘要"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
    </section>
  );
}
