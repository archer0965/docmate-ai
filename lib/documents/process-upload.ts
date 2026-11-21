import { AppError } from "@/lib/errors";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { summarizeDocument } from "@/lib/gemini/summarize";
import { getPlan } from "@/lib/plans";
import { chunkPdfPages } from "@/lib/pdf/chunk";
import { assertHasTextContent, parsePdfPages } from "@/lib/pdf/parse";
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

  // 先做便宜驗證，再預扣額度與呼叫 AI
  let pages;
  try {
    pages = await parsePdfPages(arrayBuffer);
    assertHasTextContent(pages);
    assertPageLimit(pages.length, safety.maxPages);
  } catch (error) {
    throw error;
  }

  const chunks = chunkPdfPages(pages);
  if (chunks.length === 0) {
    throw new AppError("empty_document", "此 PDF 沒有可保存的文字內容。", 422);
  }

  // 預扣額度：之後即使 AI 失敗也不退回（避免白嫖 API）
  await reserveDocumentSlot(userId, plan.documentsPerMonth);

  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\u4e00-\u9fff-]+/g, "_").slice(0, 180);
  const storagePath = `${userId}/${documentId}.pdf`;
  const title = (file.name.replace(/\.pdf$/i, "") || "未命名文件").slice(0, 120);

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, arrayBuffer, {
      contentType: PDF_MIME,
      upsert: false,
    });

  if (uploadError) {
    console.error("[Nova AI Doc] storage upload failed", uploadError);
    // 儲存失敗：退回額度（尚未呼叫 AI）
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
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    await releaseDocumentSlot(userId);
    throw new AppError("internal_error", "無法建立文件紀錄。", 500);
  }

  try {
    const summary = await summarizeDocument(pages);

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

    const { data: document, error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        summary,
        page_count: pages.length,
        error_message: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError || !document) {
      throw new AppError("internal_error", "無法更新文件摘要狀態。", 500);
    }

    return document;
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

    // AI / 後處理失敗：不退額度，避免重試刷 API
    throw error;
  }
}
