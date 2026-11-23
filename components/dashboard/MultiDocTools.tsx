"use client";

import { useState } from "react";

type DocOption = {
  id: string;
  title: string;
  status: string;
};

export function MultiDocTools({
  documents,
  questionsRemaining,
}: {
  documents: DocOption[];
  questionsRemaining: number;
}) {
  const ready = documents.filter((d) => d.status === "ready");
  const [selected, setSelected] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [askResult, setAskResult] = useState<string | null>(null);
  const [askSources, setAskSources] = useState<
    { documentTitle: string | null; page: number }[]
  >([]);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);

  function toggleDoc(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  async function onMultiAsk() {
    if (selected.length === 0 || !question.trim()) return;
    setLoadingAsk(true);
    setError(null);
    setAskResult(null);
    setAskSources([]);
    const clientRequestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mask-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientRequestId,
        },
        body: JSON.stringify({
          documentIds: selected,
          question: question.trim(),
          clientRequestId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "多文件問答失敗");
      setAskResult(json.answer);
      setAskSources(json.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "多文件問答失敗");
    } finally {
      setLoadingAsk(false);
    }
  }

  async function onCompare() {
    if (!compareA || !compareB || compareA === compareB) {
      setError("請選擇兩份不同的已完成文件。");
      return;
    }
    setLoadingCompare(true);
    setError(null);
    setCompareResult(null);
    try {
      const res = await fetch("/api/documents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIdA: compareA, documentIdB: compareB }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "比較失敗");
      setCompareResult(json.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "比較失敗");
    } finally {
      setLoadingCompare(false);
    }
  }

  if (ready.length === 0) return null;

  return (
    <section className="space-y-6 rounded-2xl border border-brand-100 bg-white p-5 sm:p-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900">多文件工具</h2>
        <p className="mt-1 text-sm text-slate-600">
          跨文件問答（最多 5 份）與兩份文件比較。剩餘提問：{questionsRemaining}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">跨文件問答</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {ready.map((doc) => (
            <label
              key={doc.id}
              className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs ${
                selected.includes(doc.id)
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-brand-100 text-slate-600"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.includes(doc.id)}
                onChange={() => toggleDoc(doc.id)}
              />
              {doc.title}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="對所選文件提問…"
            disabled={loadingAsk || questionsRemaining <= 0}
            className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={onMultiAsk}
            disabled={
              loadingAsk || selected.length === 0 || questionsRemaining <= 0
            }
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loadingAsk ? "回答中…" : "送出"}
          </button>
        </div>
        {askResult && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
            <p className="whitespace-pre-wrap">{askResult}</p>
            <p className="mt-2 text-xs text-brand-700">
              來源頁碼：
              {askSources.length > 0
                ? askSources
                    .map(
                      (s) =>
                        `${s.documentTitle || "文件"} p.${s.page}`,
                    )
                    .join("、")
                : "（無頁碼引用）"}
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">文件比較</h3>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          >
            <option value="">文件 A</option>
            {ready.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
            className="rounded-xl border border-brand-200 px-3 py-2 text-sm"
          >
            <option value="">文件 B</option>
            {ready.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCompare}
            disabled={loadingCompare}
            className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
          >
            {loadingCompare ? "比較中…" : "比較差異"}
          </button>
        </div>
        {compareResult && (
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-800">
            {compareResult}
          </pre>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
