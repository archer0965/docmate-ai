import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import {
  SUMMARY_TYPES,
  summarizeDocument,
  type SummaryType,
} from "@/lib/gemini/summarize";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

async function loadPagesFromChunks(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  documentId: string,
  userId: string,
  maxChunks: number,
) {
  const { data: chunkRows, error } = await supabase
    .from("document_chunks")
    .select("page_number, content, chunk_index")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("chunk_index", { ascending: true })
    .limit(maxChunks);

  if (error) {
    throw new AppError("internal_error", "無法讀取文件內容。", 500);
  }
  if (!chunkRows?.length) {
    throw new AppError("empty_document", "這份文件沒有可摘要的內容。", 422);
  }

  const byPage = new Map<number, string[]>();
  for (const row of chunkRows) {
    const list = byPage.get(row.page_number) || [];
    list.push(row.content);
    byPage.set(row.page_number, list);
  }

  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, parts]) => ({
      pageNumber,
      text: parts.join("\n"),
    }));
}

/** GET：列出已產生的摘要類型 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: document } = await supabase
      .from("documents")
      .select("id, summary, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!document) {
      throw new AppError("not_found", "找不到這份文件。", 404);
    }

    const { data: summaries } = await supabase
      .from("document_summaries")
      .select("id, summary_type, content, updated_at")
      .eq("document_id", id)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    const list = summaries ?? [];
    if (list.length === 0 && document.summary) {
      list.push({
        id: "legacy-general",
        summary_type: "general",
        content: document.summary,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ summaries: list });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：依類型產生／重新產生摘要（不另扣文件額度；沿用提問額度較合理？規格說摘要是上傳後功能，不另列額度，故不扣提問） */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    pruneRateLimitBuckets();

    const safety = getAiSafetyLimits(
      (await supabase.from("docmate_profiles").select("plan").eq("id", user.id).maybeSingle())
        .data?.plan || "free",
    );

    assertRateLimit({
      key: `summarize:${user.id}`,
      limit: Math.max(4, Math.floor(safety.askPerMinute / 2)),
      windowMs: 60_000,
      message: "摘要請求過於頻繁，請稍後再試。",
    });

    const bodySchema = z.object({
      type: z.enum(SUMMARY_TYPES).default("general"),
      regenerate: z.boolean().optional(),
    });

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("validation_error", "摘要類型不正確。", 400);
    }

    const type = parsed.data.type as SummaryType;

    const { data: document } = await supabase
      .from("documents")
      .select("id, status, summary")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!document) {
      throw new AppError("not_found", "找不到這份文件。", 404);
    }
    if (document.status !== "ready") {
      throw new AppError("validation_error", "文件尚未就緒。", 409);
    }

    if (!parsed.data.regenerate) {
      const { data: cached } = await supabase
        .from("document_summaries")
        .select("id, summary_type, content, updated_at")
        .eq("document_id", id)
        .eq("user_id", user.id)
        .eq("summary_type", type)
        .maybeSingle();

      if (cached) {
        return NextResponse.json({ summary: cached, cached: true });
      }

      if (type === "general" && document.summary) {
        return NextResponse.json({
          summary: {
            id: "legacy-general",
            summary_type: "general",
            content: document.summary,
            updated_at: new Date().toISOString(),
          },
          cached: true,
        });
      }
    }

    const pages = await loadPagesFromChunks(
      supabase,
      id,
      user.id,
      safety.maxChunksForAsk,
    );

    const content = await summarizeDocument(pages, type);

    const { data: saved, error } = await supabase
      .from("document_summaries")
      .upsert(
        {
          document_id: id,
          user_id: user.id,
          summary_type: type,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_id,summary_type" },
      )
      .select("id, summary_type, content, updated_at")
      .single();

    if (type === "general") {
      await supabase
        .from("documents")
        .update({ summary: content })
        .eq("id", id)
        .eq("user_id", user.id);
    }

    if (error || !saved) {
      return NextResponse.json({
        summary: {
          id: crypto.randomUUID(),
          summary_type: type,
          content,
          updated_at: new Date().toISOString(),
        },
        cached: false,
        persisted: false,
      });
    }

    return NextResponse.json({ summary: saved, cached: false, persisted: true });
  } catch (error) {
    return jsonError(error);
  }
}
