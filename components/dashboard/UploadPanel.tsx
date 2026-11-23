"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type UploadPanelProps = {
  maxUploadBytes: number;
  documentsRemaining: number;
  compact?: boolean;
  onUploaded?: (documentId: string) => void;
};

export function UploadPanel({
  maxUploadBytes,
  documentsRemaining,
  compact = false,
  onUploaded,
}: UploadPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onUpload() {
    if (!file) {
      setError("請先選擇 PDF 檔案。");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(8);
    setPhase("驗證檔案…");

    try {
      if (file.size > maxUploadBytes) {
        throw new Error(
          `檔案超過 ${Math.floor(maxUploadBytes / (1024 * 1024))}MB 上限。`,
        );
      }

      const body = new FormData();
      body.append("file", file);

      setProgress(25);
      setPhase("上傳並解析中…");

      // 以 XHR 取得上傳進度（解析／AI 在伺服器端完成）
      const json = await new Promise<{
        document: { id: string };
        deduplicated?: boolean;
        error?: { message?: string };
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/documents");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 55) + 25;
            setProgress(Math.min(pct, 80));
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(data);
            else reject(new Error(data?.error?.message || "上傳失敗"));
          } catch {
            reject(new Error("伺服器回應無法解析"));
          }
        };
        xhr.onerror = () => reject(new Error("網路錯誤，請稍後再試"));
        xhr.send(body);
      });

      setProgress(100);
      setPhase(json.deduplicated ? "偵測到相同文件，已開啟既有檔案" : "處理完成");
      setSuccess(
        json.deduplicated
          ? "此檔案先前已上傳過，不會重複扣額度。"
          : "上傳並完成摘要！正在開啟工作區…",
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";

      onUploaded?.(json.document.id);
      router.push(`/dashboard/workspace?doc=${json.document.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上傳失敗");
      setProgress(0);
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "border-b border-brand-100 bg-white p-3"
          : "rounded-2xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6"
      }
    >
      {!compact && (
        <>
          <h2 className="font-display text-xl font-semibold text-slate-900">上傳 PDF</h2>
          <p className="mt-2 text-sm text-slate-600">
            自動驗證格式、解析文字（掃描件將嘗試 OCR），並以 Gemini 產生摘要。上限{" "}
            {Math.floor(maxUploadBytes / (1024 * 1024))}MB；本月還可上傳{" "}
            {Math.max(documentsRemaining, 0)} 份。
          </p>
        </>
      )}

      <div className={`flex flex-col gap-3 ${compact ? "" : "mt-4"} sm:flex-row sm:items-center`}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
        />
        <button
          type="button"
          onClick={onUpload}
          disabled={loading || documentsRemaining <= 0}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "處理中…" : compact ? "上傳" : "上傳並產生摘要"}
        </button>
      </div>

      {loading && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{phase || "處理中…"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
    </section>
  );
}
