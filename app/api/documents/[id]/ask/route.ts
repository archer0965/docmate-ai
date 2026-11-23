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
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** POST：依文件內容問答（RAG + 引用），並保存紀錄 */
export async function POST(request: Request, { params }: Params) {
  let reserved = false;
  let userId: string | null = null;

  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    userId = user.id;
    pruneRateLimitBuckets();

    const profile = await getFreshProfile(supabase, user.id);
    const plan = getPlan(profile.plan);
    const safety = getAiSafetyLimits(profile.plan);

    assertRateLimit({
      key: `ask:${user.id}`,
      limit: safety.askPerMinute,
      windowMs: 60_000,
      message: "提問過於頻繁，請稍後再試。",
    });

    assertCanAsk(profile);

    const bodySchema = z.object({
      question: z
        .string()
        .trim()
        .min(2, "問題太短")
        .max(safety.maxQuestionChars, `問題請控制在 ${safety.maxQuestionChars} 字內`),
      sessionId: z.string().uuid().optional(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "validation_error",
        parsed.error.issues[0]?.message || "問題格式不正確。",
        400,
      );
    }

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, title, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (docError) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!document) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
    }
    if (document.status !== "ready") {
      throw new AppError(
        "validation_error",
        "文件尚未處理完成，暫時無法提問。",
        409,
      );
    }

    const { data: chunkRows, error: chunkError } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, content")
      .eq("document_id", id)
      .eq("user_id", user.id)
      .order("chunk_index", { ascending: true })
      .limit(safety.maxChunksForAsk);

    if (chunkError) {
      throw new AppError("internal_error", "無法讀取文件內容。", 500);
    }
    if (!chunkRows || chunkRows.length === 0) {
      throw new AppError("empty_document", "這份文件沒有可問答的文字內容。", 422);
    }

    const question = parsed.data.question;
    const sessionId = parsed.data.sessionId;

    // 載入近期對話作為上下文
    let historyQuery = supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (sessionId) {
      historyQuery = historyQuery.eq("session_id", sessionId);
    } else {
      historyQuery = historyQuery.eq("document_id", id);
    }

    const { data: historyRows } = await historyQuery;
    const history = (historyRows || [])
      .reverse()
      .map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      }));

    await reserveQuestionSlot(user.id, plan.questionsPerMonth);
    reserved = true;

    const userInsert: Record<string, unknown> = {
      document_id: id,
      user_id: user.id,
      role: "user",
      content: question,
      source_pages: [],
      citations: [],
    };
    if (sessionId) userInsert.session_id = sessionId;

    const { error: userMsgError } = await supabase.from("chat_messages").insert(userInsert);

    if (userMsgError) {
      await releaseQuestionSlot(user.id);
      reserved = false;
      throw new AppError("internal_error", "無法保存提問紀錄。", 500);
    }

    let result;
    try {
      result = await askDocumentQuestion(
        question,
        chunkRows.map((row) => ({
          id: row.id,
          documentId: id,
          documentTitle: document.title,
          chunkIndex: row.chunk_index,
          pageNumber: row.page_number,
          content: row.content,
        })),
        Math.min(safety.maxChunksForAsk, 12),
        history,
      );
    } catch (aiError) {
      await releaseQuestionSlot(user.id);
      reserved = false;
      throw aiError;
    }

    const assistantInsert: Record<string, unknown> = {
      document_id: id,
      user_id: user.id,
      role: "assistant",
      content: result.answer,
      source_pages: result.sourcePages,
      citations: result.citations,
    };
    if (sessionId) assistantInsert.session_id = sessionId;

    const { data: assistantMsg, error: assistantError } = await supabase
      .from("chat_messages")
      .insert(assistantInsert)
      .select("id, role, content, source_pages, citations, created_at")
      .single();

    if (assistantError || !assistantMsg) {
      // citations 欄位可能不存在
      const { data: fallbackMsg, error: fallbackError } = await supabase
        .from("chat_messages")
        .insert({
          document_id: id,
          user_id: user.id,
          role: "assistant",
          content: result.answer,
          source_pages: result.sourcePages,
        })
        .select("id, role, content, source_pages, created_at")
        .single();

      if (fallbackError || !fallbackMsg) {
        throw new AppError("internal_error", "無法保存 AI 回答。", 500);
      }

      return NextResponse.json({
        answer: fallbackMsg.content,
        sourcePages: fallbackMsg.source_pages,
        citations: result.citations,
        insufficientEvidence: result.insufficientEvidence,
        message: fallbackMsg,
      });
    }

    return NextResponse.json({
      answer: assistantMsg.content,
      sourcePages: assistantMsg.source_pages,
      citations: assistantMsg.citations ?? result.citations,
      insufficientEvidence: result.insufficientEvidence,
      message: assistantMsg,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** GET：取得此文件的問答紀錄 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: document } = await supabase
      .from("documents")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!document) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, source_pages, citations, created_at")
      .eq("document_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      const { data: fallback, error: fallbackError } = await supabase
        .from("chat_messages")
        .select("id, role, content, source_pages, created_at")
        .eq("document_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (fallbackError) {
        throw new AppError("internal_error", "無法讀取對話紀錄。", 500);
      }
      return NextResponse.json({ messages: fallback ?? [] });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
