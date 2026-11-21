import { AppError } from "@/lib/errors";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

/** 檢查檔案開頭是否為 PDF magic bytes，避免偽裝副檔名 */
export function assertPdfMagicBytes(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  if (bytes.length < 4) {
    throw new AppError("invalid_file_type", "檔案內容不是有效的 PDF。", 415);
  }

  const ok = PDF_MAGIC.every((value, index) => bytes[index] === value);
  if (!ok) {
    throw new AppError("invalid_file_type", "檔案內容不是有效的 PDF。", 415);
  }
}

/** 限制頁數，避免超大 PDF 造成 AI 成本失控 */
export function assertPageLimit(pageCount: number, maxPages: number) {
  if (pageCount > maxPages) {
    throw new AppError(
      "validation_error",
      `此 PDF 有 ${pageCount} 頁，超過目前方案上限 ${maxPages} 頁。請分割後再上傳。`,
      413,
    );
  }
}
