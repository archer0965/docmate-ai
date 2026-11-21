import { AppError } from "@/lib/errors";
import type { PdfPageText } from "@/lib/pdf/parse";

/**
 * 用 mammoth 將 .docx 轉成文字頁面。
 * 以空行／段落切成合成頁，供既有 chunking／引用流程重用。
 */
export async function parseDocxPages(buffer: ArrayBuffer): Promise<PdfPageText[]> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });
    const raw = (result.value || "").replace(/\u0000/g, "").trim();
    if (!raw) {
      throw new AppError(
        "empty_document",
        "此 Word 檔沒有可擷取的文字內容。",
        422,
      );
    }

    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (paragraphs.length === 0) {
      return [{ pageNumber: 1, text: raw }];
    }

    // 約每 3 段合成一「頁」，避免頁數過碎
    const pages: PdfPageText[] = [];
    const perPage = 3;
    for (let i = 0; i < paragraphs.length; i += perPage) {
      const slice = paragraphs.slice(i, i + perPage).join("\n\n");
      pages.push({
        pageNumber: pages.length + 1,
        text: slice,
      });
    }

    return pages.length > 0 ? pages : [{ pageNumber: 1, text: raw }];
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[Nova AI Doc] docx parse failed", error);
    throw new AppError(
      "pdf_parse_failed",
      "Word 檔解析失敗。請確認為可讀取文字的 .docx。",
      422,
    );
  }
}
