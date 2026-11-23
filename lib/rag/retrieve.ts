/**
 * 輕量 RAG 檢索：依關鍵字重疊排序段落（不需 pgvector）
 * 之後可換成 embedding 而不改 API 介面。
 */

export type RetrievableChunk = {
  id?: string;
  documentId: string;
  documentTitle?: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
};

export type Citation = {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  chunkIndex: number;
  excerpt: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export function retrieveRelevantChunks(
  chunks: RetrievableChunk[],
  question: string,
  limit = 12,
): RetrievableChunk[] {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) {
    return chunks.slice(0, limit);
  }

  const scored = chunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    for (const token of qTokens) {
      if (contentLower.includes(token)) score += 1;
    }
    // 稍微加權較長命中
    if (score > 0) score += Math.min(chunk.content.length / 2000, 1);
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const positive = scored.filter((s) => s.score > 0).map((s) => s.chunk);
  if (positive.length >= Math.min(3, limit)) {
    return positive.slice(0, limit);
  }
  // 沒有關鍵字命中時，回傳前幾段作為弱上下文，並由模型自行判斷不足
  return chunks.slice(0, Math.min(limit, 6));
}

export function toCitations(chunks: RetrievableChunk[]): Citation[] {
  return chunks.map((c) => ({
    documentId: c.documentId,
    documentTitle: c.documentTitle || "文件",
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    excerpt: c.content.slice(0, 280),
  }));
}
