import { AppError } from "@/lib/errors";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { ocrPdfWithGemini } from "@/lib/gemini/ocr";
import { summarizeDocument } from "@/lib/gemini/summarize";
import { getPlan } from "@/lib/plans";
import { chunkPdfPages } from "@/lib/pdf/chunk";
import { hashArrayBuffer } from "@/lib/pdf/hash";
import { assertHasTextContent, parsePdfPages, type PdfPageText } from "@/lib/pdf/parse";
import { assertPdfMagicBytes, assertPageLimit } from "@/lib/security/pdf";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import {
  assertCanUpload,
  getFreshProfile,
  releaseDocumentSlot,
  reserveDocumentSlot,
} from "@/lib/usage/quota";
import type { SupabaseClient } from "@supabase/supabase-js";

const PDF_MIME = "application/pdf";

async function extractPagesWithOcrFallback(
  arrayBuffer: ArrayBuffer,
  maxPages: number,
): Promise<{ pages: PdfPageText[]; sourceKind: "text" | "ocr" | "mixed" }> {
  let pages: PdfPageText[];
  try {
    pages = await parsePdfPages(arrayBuffer);
  } catch (error) {
    // 解析失敗：嘗試整份 OCR
    const ocrPages = await ocrPdfWithGemini(arrayBuffer, maxPages);
    assertHasTextContent(ocrPages);
    assertPageLimit(ocrPages.length, maxPages);
    return { pages: ocrPages, sourceKind: "ocr" };
  }

  const joined = pages.map((p) => p.text).join("").trim();
  if (joined) {
    assertPageLimit(pages.length, maxPages);
    return { pages, sourceKind: "text" };
  }

  // 無文字層 → OCR
  const ocrPages = await ocrPdfWithGemini(arrayBuffer, maxPages);
  assertHasTextContent(ocrPages);
  assertPageLimit(ocrPages.length, maxPages);
  return { pages: ocrPages, sourceKind: "ocr" };
}

export async function processPdfUpload(options: {
  supabase: SupabaseClient;
  userId: string;
  file: File;
}) {
  const { supabase, userId, file } = options;
  pruneRateLimitBuckets();

  if (!file || file.size <= 0) {
    throw new AppError("validation_error", "請選擇要上傳的 PDF 檔案。", 400);
  }

  if (file.type && file.type !== PDF_MIME) {
    throw new AppError("invalid_file_type", "只接受 PDF 檔案。", 415);
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new AppError("invalid_file_type", "只接受 .pdf 副檔名。", 415);
  }

  const profile = await getFreshProfile(supabase, userId);
  const plan = getPlan(profile.plan);
  const safety = getAiSafetyLimits(profile.plan);

  assertRateLimit({
    key: `upload:${userId}`,
    limit: safety.uploadPerMinute,
    windowMs: 60_000,
    message: "上傳過於頻繁，請稍後再試。",
  });

  assertCanUpload(profile, file.size);

  const arrayBuffer = await file.arrayBuffer();
  assertPdfMagicBytes(arrayBuffer);

  const contentHash = hashArrayBuffer(arrayBuffer);

  // 去重：同使用者已有相同內容的就緒文件 → 不重複扣額度
  try {
    const { data: existing, error: dedupeError } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at, content_hash, source_kind",
      )
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!dedupeError && existing) {
      return { document: existing, deduplicated: true as const };
    }
  } catch {
    // content_hash 欄位尚未 migration 時略過
  }

  const { pages, sourceKind } = await extractPagesWithOcrFallback(
    arrayBuffer,
    safety.maxPages,
  );

  const chunks = chunkPdfPages(pages);
  if (chunks.length === 0) {
    throw new AppError("empty_document", "此 PDF 沒有可保存的文字內容。", 422);
  }

  await reserveDocumentSlot(userId, plan.documentsPerMonth);

  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\u4e00-\u9fff-]+/g, "_").slice(0, 180);
  const storagePath = `${userId}/${documentId}.pdf`;
  const title = (file.name.replace(/\.pdf$/i, "") || "未命名文件").slice(0, 120);

  // 使用 Blob，避免部分 runtime 上傳 ArrayBuffer 變成 0-byte
  const fileBlob = new Blob([new Uint8Array(arrayBuffer)], { type: PDF_MIME });
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBlob, {
      contentType: PDF_MIME,
      upsert: false,
    });

  if (uploadError) {
    console.error("[Nova AI Doc] storage upload failed", uploadError);
    await releaseDocumentSlot(userId);
    throw new AppError("storage_error", "上傳到雲端儲存失敗，請稍後再試。", 500);
  }

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    user_id: userId,
    title,
    file_name: safeName,
    storage_path: storagePath,
    file_size: file.size,
    status: "processing",
    content_hash: contentHash,
    source_kind: sourceKind,
  });

  if (insertError) {
    // content_hash 欄位可能尚未 migration → 重試不帶新欄位
    if (String(insertError.message || "").includes("content_hash") || insertError.code === "PGRST204") {
      const { error: retryError } = await supabase.from("documents").insert({
        id: documentId,
        user_id: userId,
        title,
        file_name: safeName,
        storage_path: storagePath,
        file_size: file.size,
        status: "processing",
      });
      if (retryError) {
        await supabase.storage.from("documents").remove([storagePath]);
        await releaseDocumentSlot(userId);
        throw new AppError("internal_error", "無法建立文件紀錄。", 500);
      }
    } else {
      await supabase.storage.from("documents").remove([storagePath]);
      await releaseDocumentSlot(userId);
      throw new AppError("internal_error", "無法建立文件紀錄。", 500);
    }
  }

  try {
    const summary = await summarizeDocument(pages, "general");

    const chunkRows = chunks.map((chunk) => ({
      document_id: documentId,
      user_id: userId,
      chunk_index: chunk.chunkIndex,
      page_number: chunk.pageNumber,
      content: chunk.content,
    }));

    const { error: chunkError } = await supabase.from("document_chunks").insert(chunkRows);
    if (chunkError) {
      throw new AppError("internal_error", "文字分段保存失敗。", 500);
    }

    // 寫入多型摘要表（若已 migration）
    await supabase.from("document_summaries").upsert(
      {
        document_id: documentId,
        user_id: userId,
        summary_type: "general",
        content: summary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "document_id,summary_type" },
    );

    const { data: document, error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        summary,
        page_count: pages.length,
        error_message: null,
        source_kind: sourceKind,
        content_hash: contentHash,
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at, content_hash, source_kind",
      )
      .single();

    if (updateError || !document) {
      // 後備：不選新欄位
      const { data: fallbackDoc, error: fallbackError } = await supabase
        .from("documents")
        .update({
          status: "ready",
          summary,
          page_count: pages.length,
          error_message: null,
        })
        .eq("id", documentId)
        .eq("user_id", userId)
        .select(
          "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
        )
        .single();

      if (fallbackError || !fallbackDoc) {
        throw new AppError("internal_error", "無法更新文件摘要狀態。", 500);
      }
      return { document: fallbackDoc, deduplicated: false as const };
    }

    return { document, deduplicated: false as const };
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "處理文件時發生錯誤。";

    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: message,
        page_count: pages.length,
      })
      .eq("id", documentId)
      .eq("user_id", userId);

    // 儲存成功後 AI 失敗：退還額度（使用者可刪除後重試；避免白白扣額）
    await releaseDocumentSlot(userId);

    throw error;
  }
}
