import type { PdfPageText } from "@/lib/pdf/parse";

export type TextChunk = {
  chunkIndex: number;
  pageNumber: number;
  content: string;
};

const MAX_CHARS = 1200;

/**
 * 將每頁文字切成較小段落，保留 pageNumber 供問答引用
 */
export function chunkPdfPages(pages: PdfPageText[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    if (!page.text) continue;

    if (page.text.length <= MAX_CHARS) {
      chunks.push({
        chunkIndex,
        pageNumber: page.pageNumber,
        content: page.text,
      });
      chunkIndex += 1;
      continue;
    }

    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + MAX_CHARS, page.text.length);
      const slice = page.text.slice(start, end).trim();
      if (slice) {
        chunks.push({
          chunkIndex,
          pageNumber: page.pageNumber,
          content: slice,
        });
        chunkIndex += 1;
      }
      start = end;
    }
  }

  return chunks;
}
