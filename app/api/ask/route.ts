import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import { askDocumentQuestion } from "@/lib/gemini/ask";
import { getPlan } from "@/lib/plans";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import {
  assertCanAsk,
  getFreshProfile,
  releaseQuestionSlot,
  reserveQuestionSlot,
} from "@/lib/usage/quota";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST：多份文件問答（RAG）
 * body: { question, documentIds: string[], sessionId? }
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    pruneRateLimitBuckets();

    const profile = await getFreshProfile(supabase, user.id);
    const plan = getPlan(profile.plan);
    const safety = getAiSafetyLimits(profile.plan);

    assertRateLimit({
      key: `ask-multi:${user.id}`,
      limit: safety.askPerMinute,
      windowMs: 60_000,
      message: "提問過於頻繁，請稍後再試。",
    });

    assertCanAsk(profile);

    const bodySchema = z.object({
      question: z
        .string()
        .trim()
        .min(2)
        .max(safety.maxQuestionChars),
      documentIds: z.array(z.string().uuid()).min(1).max(10),
      sessionId: z.string().uuid().optional(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "validation_error",
        parsed.error.issues[0]?.message || "請選擇至少一份文件並輸入問題。",
        400,
      );
    }

    const { question, documentIds, sessionId } = parsed.data;

    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select("id, title, status")
      .eq("user_id", user.id)
      .in("id", documentIds);

    if (docsError) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }

    const readyDocs = (docs || []).filter((d) => d.status === "ready");
    if (readyDocs.length === 0) {
      throw new AppError(
        "validation_error",
        "所選文件皆未就緒，或你沒有權限。",
        404,
      );
    }

    // 防止越權：只使用本人且就緒的文件
    const allowedIds = readyDocs.map((d) => d.id);
    const titleMap = new Map(readyDocs.map((d) => [d.id, d.title]));

    const perDocLimit = Math.max(
      4,
      Math.floor(safety.maxChunksForAsk / Math.max(allowedIds.length, 1)),
    );

    const allChunks: {
      id?: string;
      documentId: string;
      documentTitle?: string;
      chunkIndex: number;
      pageNumber: number;
      content: string;
    }[] = [];

    for (const docId of allowedIds) {
      const { data: rows } = await supabase
        .from("document_chunks")
        .select("id, chunk_index, page_number, content")
        .eq("document_id", docId)
        .eq("user_id", user.id)
        .order("chunk_index", { ascending: true })
        .limit(perDocLimit);

      for (const row of rows || []) {
        allChunks.push({
          id: row.id,
          documentId: docId,
          documentTitle: titleMap.get(docId),
          chunkIndex: row.chunk_index,
          pageNumber: row.page_number,
          content: row.content,
        });
      }
    }

    if (allChunks.length === 0) {
      throw new AppError("empty_document", "所選文件沒有可問答的內容。", 422);
    }

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const { data: session } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: question.slice(0, 40),
          document_ids: allowedIds,
        })
        .select("id")
        .single();
      activeSessionId = session?.id;
    } else {
      const { data: owned } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", activeSessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) {
        throw new AppError("not_found", "找不到此對話工作階段。", 404);
      }
    }

    let history: { role: "user" | "assistant"; content: string }[] = [];
    if (activeSessionId) {
      const { data: historyRows } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", activeSessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      history = (historyRows || [])
        .reverse()
        .map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        }));
    }

    await reserveQuestionSlot(user.id, plan.questionsPerMonth);

    try {
      if (activeSessionId) {
        await supabase.from("chat_messages").insert({
          session_id: activeSessionId,
          document_id: allowedIds[0],
          user_id: user.id,
          role: "user",
          content: question,
          source_pages: [],
          citations: [],
        });
      }

      const result = await askDocumentQuestion(
        question,
        allChunks,
        Math.min(safety.maxChunksForAsk, 16),
        history,
      );

      let message = null;
      if (activeSessionId) {
        const { data: assistantMsg } = await supabase
          .from("chat_messages")
          .insert({
            session_id: activeSessionId,
            document_id: allowedIds[0],
            user_id: user.id,
            role: "assistant",
            content: result.answer,
            source_pages: result.sourcePages,
            citations: result.citations,
          })
          .select("id, role, content, source_pages, citations, created_at")
          .single();
        message = assistantMsg;
      }

      return NextResponse.json({
        answer: result.answer,
        sourcePages: result.sourcePages,
        citations: result.citations,
        insufficientEvidence: result.insufficientEvidence,
        sessionId: activeSessionId ?? null,
        documentIds: allowedIds,
        message,
      });
    } catch (aiError) {
      await releaseQuestionSlot(user.id);
      throw aiError;
    }
  } catch (error) {
    return jsonError(error);
  }
}
