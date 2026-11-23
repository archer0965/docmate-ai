import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import { askDocumentQuestion } from "@/lib/gemini/ask";
import { getPlan } from "@/lib/plans";
import {
  beginIdempotentRequest,
  clearIdempotentInFlight,
  getIdempotentSuccess,
  normalizeClientRequestId,
  saveIdempotentSuccess,
} from "@/lib/security/idempotency";
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

async function reportAskFailure(message: string, userId: string | null) {
  if (!/ai|gemini|502|暫時無法/i.test(message)) return;
  const { reportToHub } = await import("@/lib/novaos-telemetry");
  await reportToHub({
    kind: "ai_failure",
    severity: "error",
    message,
    meta: { userId, route: "ask" },
  });
}

/**
 * POST：跨多份文件問答（最多 5 份）。
 * 合併 chunks（皆經 user_id 過濾），預扣一次提問額度；失敗退回。
 */
export async function POST(request: Request) {
  let reserved = false;
  let userId: string | null = null;
  let idempotencyKey: string | null = null;

  try {
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
      documentIds: z
        .array(z.string().uuid())
        .min(1, "請至少選擇一份文件")
        .max(5, "一次最多查詢 5 份文件"),
      question: z
        .string()
        .trim()
        .min(2, "問題太短")
        .max(safety.maxQuestionChars, `問題請控制在 ${safety.maxQuestionChars} 字內`),
      clientRequestId: z.string().trim().max(80).optional(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(
        "validation_error",
        parsed.error.issues[0]?.message || "請求格式不正確。",
        400,
      );
    }

    idempotencyKey = normalizeClientRequestId(
      parsed.data.clientRequestId ||
        request.headers.get("idempotency-key"),
    );

    if (idempotencyKey) {
      const cached = getIdempotentSuccess(user.id, idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
      if (!beginIdempotentRequest(user.id, idempotencyKey)) {
        const raced = getIdempotentSuccess(user.id, idempotencyKey);
        if (raced) {
          return NextResponse.json(raced.body, { status: raced.status });
        }
        throw new AppError(
          "conflict",
          "相同請求處理中或已完成，請稍候再試。",
          409,
        );
      }
    }

    const documentIds = [...new Set(parsed.data.documentIds)];
    const question = parsed.data.question;

    // Isolation: only the owner's ready documents
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, title, status")
      .in("id", documentIds)
      .eq("user_id", user.id);

    if (docError) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!documents || documents.length !== documentIds.length) {
      throw new AppError(
        "not_found",
        "部分文件不存在或你沒有權限。",
        404,
      );
    }
    if (documents.some((d) => d.status !== "ready")) {
      throw new AppError(
        "validation_error",
        "所選文件尚未全部處理完成。",
        409,
      );
    }

    const titleById = new Map(documents.map((d) => [d.id, d.title]));
    const perDocLimit = Math.max(
      4,
      Math.floor(safety.maxChunksForAsk / documentIds.length),
    );

    const { data: chunkRows, error: chunkError } = await supabase
      .from("document_chunks")
      .select("document_id, chunk_index, page_number, content")
      .in("document_id", documentIds)
      .eq("user_id", user.id)
      .order("chunk_index", { ascending: true });

    if (chunkError) {
      throw new AppError("internal_error", "無法讀取文件內容。", 500);
    }
    if (!chunkRows || chunkRows.length === 0) {
      throw new AppError("empty_document", "所選文件沒有可問答的文字內容。", 422);
    }

    // Cap chunks per document then overall
    const byDoc = new Map<string, typeof chunkRows>();
    for (const row of chunkRows) {
      const list = byDoc.get(row.document_id) ?? [];
      if (list.length < perDocLimit) {
        list.push(row);
        byDoc.set(row.document_id, list);
      }
    }

    const merged = [...byDoc.values()].flat().slice(0, safety.maxChunksForAsk);
    const chunksForAsk = merged.map((row, index) => ({
      chunkIndex: index,
      pageNumber: row.page_number,
      content: `【文件：${titleById.get(row.document_id) || row.document_id}】\n${row.content}`,
      documentId: row.document_id,
      documentTitle: titleById.get(row.document_id) || "",
      sourcePage: row.page_number,
    }));

    await reserveQuestionSlot(user.id, plan.questionsPerMonth);
    reserved = true;

    const result = await askDocumentQuestion(
      question,
      chunksForAsk.map((c) => ({
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        content: c.content,
      })),
      safety.maxChunksForAsk,
    );

    // Map cited pages back to document titles when possible
    const sources = result.sourcePages.map((page) => {
      const hit = chunksForAsk.find((c) => c.sourcePage === page);
      return {
        documentId: hit?.documentId ?? null,
        documentTitle: hit?.documentTitle ?? null,
        page,
      };
    });

    // Persist against the first document for history continuity
    const primaryId = documentIds[0];
    await supabase.from("chat_messages").insert([
      {
        document_id: primaryId,
        user_id: user.id,
        role: "user",
        content: `[多文件] ${question}`,
        source_pages: [],
      },
      {
        document_id: primaryId,
        user_id: user.id,
        role: "assistant",
        content: result.answer,
        source_pages: result.sourcePages,
      },
    ]);

    const payload = {
      answer: result.answer,
      sourcePages: result.sourcePages,
      sources,
      documentIds,
    };

    if (idempotencyKey) {
      saveIdempotentSuccess(user.id, idempotencyKey, 200, payload);
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (reserved && userId) {
      await releaseQuestionSlot(userId);
    }
    if (userId && idempotencyKey) {
      clearIdempotentInFlight(userId, idempotencyKey);
    }
    const msg = error instanceof Error ? error.message : "ask_failed";
    await reportAskFailure(msg, userId);
    return jsonError(error);
  }
}
