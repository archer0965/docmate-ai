"use client";

import { FormEvent, useMemo, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source_pages: number[];
  created_at: string;
};

export function AskPanel({
  documentId,
  initialMessages,
  questionsRemaining,
}: {
  documentId: string;
  initialMessages: ChatMessage[];
  questionsRemaining: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(questionsRemaining);

  const filteredMessages = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, historyQuery]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question.trim(),
      source_pages: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    const asked = question.trim();
    setQuestion("");

    const clientRequestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ask-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const res = await fetch(`/api/documents/${documentId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": clientRequestId,
        },
        body: JSON.stringify({ question: asked, clientRequestId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "提問失敗");
      }

      const assistant: ChatMessage = {
        id: json.message.id,
        role: "assistant",
        content: json.answer,
        source_pages: json.sourcePages || [],
        created_at: json.message.created_at,
      };

      setMessages((prev) => [...prev, assistant]);
      setRemaining((n) => Math.max(n - 1, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "提問失敗");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      setQuestion(asked);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-slate-900">文件問答</h2>
        <p className="text-xs text-slate-500">本月剩餘提問：{remaining}</p>
      </div>

      <div className="mt-3">
        <label className="sr-only" htmlFor="history-search">
          搜尋對話紀錄
        </label>
        <input
          id="history-search"
          value={historyQuery}
          onChange={(e) => setHistoryQuery(e.target.value)}
          placeholder="搜尋對話紀錄…"
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {filteredMessages.length === 0 && (
          <p className="text-sm text-slate-500">
            {messages.length === 0
              ? "還沒有對話。試著問：「這份文件的重點是什麼？」"
              : "沒有符合搜尋的對話。"}
          </p>
        )}
        {filteredMessages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "ml-8 bg-brand-600 text-white"
                : "mr-8 bg-white text-slate-800 ring-1 ring-brand-100"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.role === "assistant" && (
              <p className="mt-2 text-xs text-brand-700">
                來源頁碼：
                {message.source_pages?.length > 0
                  ? message.source_pages.join("、")
                  : "（無頁碼引用）"}
              </p>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="針對這份文件提問…"
          disabled={loading || remaining <= 0}
          className="flex-1 rounded-xl border border-brand-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:ring-2 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={loading || remaining <= 0}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "回答中…" : "送出"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
