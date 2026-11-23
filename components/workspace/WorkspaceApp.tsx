"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import type { Citation, ChatMessageRecord, DocumentRecord } from "@/types";

const SUMMARY_OPTIONS = [
  { id: "general", label: "一般摘要" },
  { id: "detailed", label: "詳細摘要" },
  { id: "chapters", label: "章節重點" },
  { id: "bullets", label: "條列筆記" },
  { id: "keywords", label: "關鍵字" },
  { id: "exam", label: "考試重點" },
] as const;

const STUDY_OPTIONS = [
  { id: "notes", label: "課堂筆記" },
  { id: "concepts", label: "重要觀念" },
  { id: "mcq", label: "選擇題" },
  { id: "true_false", label: "是非題" },
  { id: "qa", label: "問答題" },
  { id: "flashcards", label: "閃卡" },
  { id: "mock_exam", label: "模擬測驗" },
] as const;

type Props = {
  documents: DocumentRecord[];
  initialDocId: string | null;
  questionsRemaining: number;
  documentsRemaining: number;
  maxUploadBytes: number;
  planName: string;
  usageLabel: string;
};

type StudyArtifact = {
  id: string;
  artifact_type: string;
  title: string;
  payload: Record<string, unknown>;
  question_count: number | null;
  created_at: string;
};

export function WorkspaceApp({
  documents: initialDocuments,
  initialDocId,
  questionsRemaining,
  documentsRemaining,
  maxUploadBytes,
  planName,
  usageLabel,
}: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialDocId) return [initialDocId];
    const firstReady = initialDocuments.find((d) => d.status === "ready");
    return firstReady ? [firstReady.id] : [];
  });
  const [search, setSearch] = useState("");
  const [mobileTab, setMobileTab] = useState<"docs" | "chat" | "tools">("chat");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(questionsRemaining);
  const [summaryType, setSummaryType] = useState<string>("general");
  const [summaryText, setSummaryText] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [studyType, setStudyType] = useState<string>("notes");
  const [studyCount, setStudyCount] = useState(5);
  const [studyLoading, setStudyLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<StudyArtifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<StudyArtifact | null>(null);
  const [citationPreview, setCitationPreview] = useState<{
    title: string;
    page: number;
    text: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const primaryId = selectedIds[0] || null;
  const primaryDoc = useMemo(
    () => documents.find((d) => d.id === primaryId) || null,
    [documents, primaryId],
  );

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q),
    );
  }, [documents, search]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadMessages = useCallback(async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}/ask`);
    const json = await res.json();
    if (res.ok) {
      setMessages(
        (json.messages || []).map((m: ChatMessageRecord & { citations?: Citation[] }) => ({
          ...m,
          citations: m.citations || [],
        })),
      );
    }
  }, []);

  const loadSummary = useCallback(
    async (docId: string, type: string, regenerate = false) => {
      setSummaryLoading(true);
      try {
        const res = await fetch(`/api/documents/${docId}/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, regenerate }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "摘要失敗");
        setSummaryText(json.summary?.content || "");
      } catch (err) {
        setSummaryText(err instanceof Error ? err.message : "摘要失敗");
      } finally {
        setSummaryLoading(false);
      }
    },
    [],
  );

  const loadArtifacts = useCallback(async (docId: string) => {
    const res = await fetch(`/api/documents/${docId}/study`);
    const json = await res.json();
    if (res.ok) {
      setArtifacts(json.artifacts || []);
      setActiveArtifact((json.artifacts || [])[0] || null);
    } else {
      setArtifacts([]);
      setActiveArtifact(null);
    }
  }, []);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    if (!primaryId || !primaryDoc) {
      setMessages([]);
      setSummaryText("");
      setArtifacts([]);
      return;
    }
    if (primaryDoc.status === "ready") {
      void loadMessages(primaryId);
      void loadSummary(primaryId, summaryType);
      void loadArtifacts(primaryId);
    } else {
      setMessages([]);
      setSummaryText(primaryDoc.summary || primaryDoc.error_message || "文件尚未就緒");
      setArtifacts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryId]);

  function selectDoc(id: string, multi = false) {
    setSelectedIds((prev) => {
      if (multi) {
        if (prev.includes(id)) {
          if (prev.length === 1) return prev;
          return prev.filter((x) => x !== id);
        }
        return [...prev, id];
      }
      return [id];
    });
    router.replace(`/dashboard/workspace?doc=${id}`);
  }

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || selectedIds.length === 0) return;
    setAsking(true);
    setAskError(null);

    const asked = question.trim();
    const optimistic: ChatMessageRecord = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: asked,
      source_pages: [],
      citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setQuestion("");

    try {
      const endpoint =
        selectedIds.length === 1
          ? `/api/documents/${selectedIds[0]}/ask`
          : "/api/ask";
      const body =
        selectedIds.length === 1
          ? { question: asked }
          : { question: asked, documentIds: selectedIds };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "提問失敗");

      const assistant: ChatMessageRecord = {
        id: json.message?.id || `a-${Date.now()}`,
        role: "assistant",
        content: json.answer,
        source_pages: json.sourcePages || [],
        citations: json.citations || [],
        created_at: json.message?.created_at || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistant]);
      setRemaining((n) => Math.max(n - 1, 0));
      if (json.insufficientEvidence) {
        showToast("文件中資訊不足，AI 已如實說明");
      }
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "提問失敗");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setQuestion(asked);
    } finally {
      setAsking(false);
    }
  }

  async function onGenerateStudy() {
    if (!primaryId) return;
    setStudyLoading(true);
    try {
      const res = await fetch(`/api/documents/${primaryId}/study`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: studyType, count: studyCount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "產生失敗");
      setActiveArtifact(json.artifact);
      setArtifacts((prev) => [json.artifact, ...prev]);
      setRemaining((n) => Math.max(n - 1, 0));
      showToast("學習內容已產生");
      setMobileTab("tools");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "產生失敗");
    } finally {
      setStudyLoading(false);
    }
  }

  async function openCitation(c: Citation) {
    try {
      const res = await fetch(
        `/api/documents/${c.documentId}/chunks?page=${c.pageNumber}&chunkIndex=${c.chunkIndex}`,
      );
      const json = await res.json();
      const chunk = json.chunks?.[0];
      setCitationPreview({
        title: c.documentTitle || json.title || "文件",
        page: c.pageNumber,
        text: chunk?.content || c.excerpt,
      });
    } catch {
      setCitationPreview({
        title: c.documentTitle,
        page: c.pageNumber,
        text: c.excerpt,
      });
    }
  }

  async function onDeletePrimary() {
    if (!primaryId) return;
    if (!confirm("確定刪除此文件？相關資料將一併清除。")) return;
    const res = await fetch(`/api/documents/${primaryId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      showToast(json?.error?.message || "刪除失敗");
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== primaryId));
    setSelectedIds((prev) => prev.filter((id) => id !== primaryId));
    showToast("文件已刪除");
    router.refresh();
  }

  const docsPane = (
    <aside className="flex h-full min-h-0 flex-col border-brand-100 bg-white md:border-r">
      <div className="border-b border-brand-100 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-900">文件</h2>
          <span className="text-[11px] text-slate-500">{planName}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{usageLabel}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋…"
          className="mt-2 w-full rounded-lg border border-brand-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <UploadPanel
        compact
        maxUploadBytes={maxUploadBytes}
        documentsRemaining={documentsRemaining}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredDocs.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-slate-500">尚無文件</p>
        ) : (
          <ul className="space-y-1">
            {filteredDocs.map((doc) => {
              const active = selectedIds.includes(doc.id);
              return (
                <li key={doc.id}>
                  <div
                    className={`flex items-start gap-2 rounded-xl px-2 py-2 transition ${
                      active
                        ? "bg-brand-50 ring-1 ring-brand-200"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1.5"
                      checked={active}
                      title="加入多文件問答"
                      onChange={() => selectDoc(doc.id, true)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        selectDoc(doc.id, false);
                        setMobileTab("chat");
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-slate-900">{doc.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {doc.status === "ready"
                          ? "已完成"
                          : doc.status === "failed"
                            ? "失敗"
                            : "處理中"}
                        {doc.page_count ? ` · ${doc.page_count} 頁` : ""}
                      </p>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );

  const chatPane = (
    <section className="flex h-full min-h-0 flex-col bg-[#f7f9fc]">
      <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-white px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-slate-900">
            {primaryDoc?.title || "選擇文件開始對話"}
          </h1>
          <p className="text-[11px] text-slate-500">
            {selectedIds.length > 1
              ? `已選 ${selectedIds.length} 份文件（多文件問答）`
              : primaryDoc
                ? `${primaryDoc.file_name} · 剩餘提問 ${remaining}`
                : "從左側選取或上傳 PDF"}
          </p>
        </div>
        {primaryId && (
          <div className="flex shrink-0 gap-1">
            <a
              href={`/api/documents/${primaryId}/download`}
              className="rounded-lg border border-brand-200 px-2 py-1 text-xs text-slate-700 hover:bg-brand-50"
            >
              下載
            </a>
            <button
              type="button"
              onClick={onDeletePrimary}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              刪除
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!primaryDoc && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="font-display text-lg font-semibold text-slate-800">AI 文件工作區</p>
            <p className="mt-2 text-sm text-slate-500">
              上傳 PDF 後即可摘要、提問、產生筆記與考題。回答皆附頁碼引用。
            </p>
          </div>
        )}
        {primaryDoc?.status === "failed" && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {primaryDoc.error_message || "文件處理失敗"}
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-brand-600 text-white"
                : "bg-white text-slate-800 shadow-sm ring-1 ring-brand-100"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.role === "assistant" &&
              (message.citations?.length || message.source_pages?.length) > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(message.citations && message.citations.length > 0
                    ? message.citations
                    : (message.source_pages || []).map((p) => ({
                        documentId: primaryId || "",
                        documentTitle: primaryDoc?.title || "文件",
                        pageNumber: p,
                        chunkIndex: 0,
                        excerpt: "",
                      }))
                  ).map((c, idx) => (
                    <button
                      key={`${c.documentId}-${c.pageNumber}-${idx}`}
                      type="button"
                      onClick={() => openCitation(c as Citation)}
                      className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800 hover:bg-brand-100"
                    >
                      {(c as Citation).documentTitle || "文件"} p.
                      {(c as Citation).pageNumber}
                    </button>
                  ))}
                </div>
              )}
          </div>
        ))}
      </div>

      <form
        onSubmit={onAsk}
        className="border-t border-brand-100 bg-white p-3"
      >
        {askError && <p className="mb-2 text-xs text-red-600">{askError}</p>}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              selectedIds.length === 0
                ? "請先選擇文件"
                : selectedIds.length > 1
                  ? "針對已選多份文件提問…"
                  : "針對文件提問…"
            }
            disabled={asking || remaining <= 0 || selectedIds.length === 0}
            className="flex-1 rounded-xl border border-brand-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={asking || remaining <= 0 || selectedIds.length === 0}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {asking ? "…" : "送出"}
          </button>
        </div>
      </form>
    </section>
  );

  const toolsPane = (
    <aside className="flex h-full min-h-0 flex-col border-brand-100 bg-white md:border-l">
      <div className="border-b border-brand-100 px-3 py-3">
        <h2 className="font-display text-sm font-semibold text-slate-900">摘要與工具</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            摘要類型
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUMMARY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!primaryId || summaryLoading}
                onClick={() => {
                  setSummaryType(opt.id);
                  if (primaryId) void loadSummary(primaryId, opt.id);
                }}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  summaryType === opt.id
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!primaryId || summaryLoading}
            onClick={() => primaryId && loadSummary(primaryId, summaryType, true)}
            className="mt-2 text-xs text-brand-700 hover:underline disabled:opacity-50"
          >
            重新產生
          </button>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
            {summaryLoading ? "產生中…" : summaryText || "尚無摘要"}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            筆記與考試
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STUDY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStudyType(opt.id)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  studyType === opt.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-slate-600">
              數量
              <input
                type="number"
                min={1}
                max={20}
                value={studyCount}
                onChange={(e) => setStudyCount(Number(e.target.value) || 5)}
                className="ml-1 w-14 rounded border border-brand-200 px-1.5 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={!primaryId || studyLoading || remaining <= 0}
              onClick={onGenerateStudy}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {studyLoading ? "產生中…" : "產生（扣 1 提問）"}
            </button>
          </div>

          {activeArtifact && (
            <div className="mt-3 rounded-xl border border-brand-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-800">{activeArtifact.title}</p>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-700">
                {JSON.stringify(activeArtifact.payload, null, 2)}
              </pre>
            </div>
          )}

          {artifacts.length > 1 && (
            <ul className="mt-2 space-y-1">
              {artifacts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setActiveArtifact(a)}
                    className="text-left text-[11px] text-brand-700 hover:underline"
                  >
                    {a.title} ·{" "}
                    {new Date(a.created_at).toLocaleString("zh-TW", {
                      timeZone: "Asia/Taipei",
                    })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-[100svh] flex-col bg-[#eef2f8]">
      <header className="flex items-center justify-between gap-3 border-b border-brand-100 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="font-display text-sm font-semibold text-slate-900">
            Nova AI Doc
          </Link>
          <nav className="hidden gap-3 text-xs text-slate-600 sm:flex">
            <Link href="/dashboard" className="hover:text-brand-700">
              文件中心
            </Link>
            <Link href="/dashboard/workspace" className="text-brand-700">
              工作區
            </Link>
            <Link href="/dashboard/upgrade" className="hover:text-brand-700">
              升級
            </Link>
          </nav>
        </div>
        <p className="text-[11px] text-slate-500">提問剩餘 {remaining}</p>
      </header>

      {/* Desktop 三欄 */}
      <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-[240px_minmax(0,1fr)_300px]">
        {docsPane}
        {chatPane}
        {toolsPane}
      </div>

      {/* Mobile */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          {mobileTab === "docs" && docsPane}
          {mobileTab === "chat" && chatPane}
          {mobileTab === "tools" && toolsPane}
        </div>
        <nav className="grid grid-cols-3 border-t border-brand-100 bg-white text-xs">
          {(
            [
              ["docs", "文件"],
              ["chat", "對話"],
              ["tools", "工具"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`py-3 font-medium ${
                mobileTab === id ? "text-brand-700" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {citationPreview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setCitationPreview(null)}
        >
          <div
            className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-slate-900">
                  {citationPreview.title}
                </p>
                <p className="text-xs text-slate-500">第 {citationPreview.page} 頁</p>
              </div>
              <button
                type="button"
                onClick={() => setCitationPreview(null)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                關閉
              </button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {citationPreview.text}
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
