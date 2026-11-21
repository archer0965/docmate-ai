import { extractText } from "unpdf";
import { AppError } from "@/lib/errors";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

/**
 * 解析 PDF：依頁取出文字（繁中 PDF 亦可）
 */
export async function parsePdfPages(buffer: ArrayBuffer): Promise<PdfPageText[]> {
  try {
    const { totalPages, text } = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });

    if (!totalPages || totalPages < 1) {
      throw new AppError("pdf_parse_failed", "無法讀取此 PDF 的頁面資訊。", 422);
    }

    const pages = (Array.isArray(text) ? text : [text]).map((pageText, index) => ({
      pageNumber: index + 1,
      text: (pageText || "").replace(/\u0000/g, "").trim(),
    }));

    return pages;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[Nova AI Doc] pdf parse failed", error);
    throw new AppError(
      "pdf_parse_failed",
      "PDF 解析失敗。請確認檔案未加密，且為可選取文字的 PDF。",
      422,
    );
  }
}

export function assertHasTextContent(pages: PdfPageText[]) {
  const joined = pages.map((p) => p.text).join("").trim();
  if (!joined) {
    throw new AppError(
      "empty_document",
      "此 PDF 沒有可擷取的文字（可能是純掃描圖片）。請先做 OCR 後再上傳。",
      422,
    );
  }
}
