import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import { summarizeDocument } from "@/lib/gemini/summarize";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/**
 * POST：重新分析（以既有 chunks 重產一般摘要，不重複扣文件額度）
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    pruneRateLimitBuckets();

    assertRateLimit({
      key: `reanalyze:${user.id}`,
      limit: 6,
      windowMs: 60_000,
      message: "重新分析過於頻繁，請稍後再試。",
    });

    const { data: document } = await supabase
      .from("documents")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!document) {
      throw new AppError("not_found", "找不到這份文件。", 404);
    }

    const safety = getAiSafetyLimits("free");
    const { data: chunkRows, error } = await supabase
      .from("document_chunks")
      .select("page_number, content, chunk_index")
      .eq("document_id", id)
      .eq("user_id", user.id)
      .order("chunk_index", { ascending: true })
      .limit(safety.maxChunksForAsk);

    if (error || !chunkRows?.length) {
      throw new AppError(
        "empty_document",
        "沒有可重新分析的內容。若為失敗文件，請刪除後重新上傳。",
        422,
      );
    }

    const byPage = new Map<number, string[]>();
    for (const row of chunkRows) {
      const list = byPage.get(row.page_number) || [];
      list.push(row.content);
      byPage.set(row.page_number, list);
    }
    const pages = [...byPage.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([pageNumber, parts]) => ({ pageNumber, text: parts.join("\n") }));

    await supabase
      .from("documents")
      .update({ status: "processing", error_message: null })
      .eq("id", id)
      .eq("user_id", user.id);

    try {
      const summary = await summarizeDocument(pages, "general");

      await supabase.from("document_summaries").upsert(
        {
          document_id: id,
          user_id: user.id,
          summary_type: "general",
          content: summary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_id,summary_type" },
      );

      const { data: updated, error: updateError } = await supabase
        .from("documents")
        .update({
          status: "ready",
          summary,
          error_message: null,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select(
          "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
        )
        .single();

      if (updateError || !updated) {
        throw new AppError("internal_error", "無法更新重新分析結果。", 500);
      }

      return NextResponse.json({ document: updated });
    } catch (aiError) {
      const message =
        aiError instanceof AppError ? aiError.message : "重新分析失敗。";
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: message })
        .eq("id", id)
        .eq("user_id", user.id);
      throw aiError;
    }
  } catch (error) {
    return jsonError(error);
  }
}
