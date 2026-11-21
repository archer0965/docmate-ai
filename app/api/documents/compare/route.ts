import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import { getGeminiModel } from "@/lib/gemini/client";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { getFreshProfile } from "@/lib/usage/quota";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST：比較兩份文件差異（摘要 + 部分 chunks），僅限本人文件。
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    pruneRateLimitBuckets();

    const profile = await getFreshProfile(supabase, user.id);
    const safety = getAiSafetyLimits(profile.plan);

    assertRateLimit({
      key: `compare:${user.id}`,
      limit: Math.max(2, Math.floor(safety.askPerMinute / 2)),
      windowMs: 60_000,
      message: "比較過於頻繁，請稍後再試。",
    });

    const bodySchema = z.object({
      documentIdA: z.string().uuid(),
      documentIdB: z.string().uuid(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("validation_error", "請提供兩份有效的文件 ID。", 400);
    }

    const { documentIdA, documentIdB } = parsed.data;
    if (documentIdA === documentIdB) {
      throw new AppError("validation_error", "請選擇兩份不同的文件。", 400);
    }

    // Isolation: user_id filter (RLS also enforces ownership)
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, title, summary, status")
      .in("id", [documentIdA, documentIdB])
      .eq("user_id", user.id);

    if (docError) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!documents || documents.length !== 2) {
      throw new AppError("not_found", "找不到文件，或你沒有權限。", 404);
    }
    if (documents.some((d) => d.status !== "ready")) {
      throw new AppError("validation_error", "兩份文件皆須為「已完成」狀態。", 409);
    }

    const docA = documents.find((d) => d.id === documentIdA)!;
    const docB = documents.find((d) => d.id === documentIdB)!;

    const chunkLimit = Math.min(12, Math.floor(safety.maxChunksForAsk / 2));

    const [{ data: chunksA }, { data: chunksB }] = await Promise.all([
      supabase
        .from("document_chunks")
        .select("page_number, content")
        .eq("document_id", documentIdA)
        .eq("user_id", user.id)
        .order("chunk_index", { ascending: true })
        .limit(chunkLimit),
      supabase
        .from("document_chunks")
        .select("page_number, content")
        .eq("document_id", documentIdB)
        .eq("user_id", user.id)
        .order("chunk_index", { ascending: true })
        .limit(chunkLimit),
    ]);

    const formatChunks = (
      title: string,
      summary: string | null,
      chunks: { page_number: number; content: string }[] | null,
    ) => {
      const body = (chunks || [])
        .map((c) => `（頁 ${c.page_number}）\n${c.content}`)
        .join("\n\n")
        .slice(0, 12000);
      return `【文件：${title}】\n摘要：\n${(summary || "（無摘要）").slice(0, 2000)}\n\n摘錄：\n${body}`;
    };

    const prompt = `你是 Nova AI Doc。請用繁體中文（台灣）比較下列兩份文件的差異與共通點。

要求：
1. 先列 3～8 點「主要差異」
2. 再列 2～5 點「共通之處」
3. 最後給一段 80～150 字總結
4. 只根據提供內容，不要編造

文件 A：
${formatChunks(docA.title, docA.summary, chunksA)}

文件 B：
${formatChunks(docB.title, docB.summary, chunksB)}`;

    try {
      const model = getGeminiModel();
      const result = await model.generateContent(prompt);
      const comparison = result.response.text()?.trim();
      if (!comparison) {
        throw new AppError("ai_error", "AI 未回傳比較結果。", 502);
      }

      return NextResponse.json({
        comparison,
        documents: {
          a: { id: docA.id, title: docA.title },
          b: { id: docB.id, title: docB.title },
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("[Nova AI Doc] compare failed", error);
      throw new AppError("ai_error", "文件比較暫時無法使用，請稍後再試。", 502);
    }
  } catch (error) {
    return jsonError(error);
  }
}
