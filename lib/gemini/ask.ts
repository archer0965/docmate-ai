import { AppError } from "@/lib/errors";
import { getGeminiModel } from "@/lib/gemini/client";
import type { TextChunk } from "@/lib/pdf/chunk";

export type AskResult = {
  answer: string;
  sourcePages: number[];
};

/**
 * 依文件內容回答問題，並要求回傳來源頁碼
 */
export async function askDocumentQuestion(
  question: string,
  chunks: TextChunk[],
  maxChunks = 40,
): Promise<AskResult> {
  const model = getGeminiModel();

  const context = chunks
    .slice(0, maxChunks)
    .map((c) => `（頁碼 ${c.pageNumber}｜段落 ${c.chunkIndex}）\n${c.content}`)
    .join("\n\n")
    .slice(0, 50000);

  const prompt = `你是 Nova AI Doc。只能根據「文件內容」用繁體中文（台灣）回答。

規則：
1. 不可使用文件以外的知識來編造答案
2. 若文件沒有答案，明確說「文件中找不到相關資訊」
3. 回答結尾必須附上 JSON（單獨一行），格式嚴格如下：
SOURCE_PAGES: {"pages":[1,2]}
4. pages 只能填你實際引用的頁碼數字陣列；若無法引用則 {"pages":[]}

文件內容：
${context}

使用者問題：
${question}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text()?.trim();
    if (!raw) {
      throw new AppError("ai_error", "AI 未回傳回答，請稍後再試。", 502);
    }

    const match = raw.match(/SOURCE_PAGES:\s*(\{[\s\S]*\})\s*$/);
    let sourcePages: number[] = [];
    let answer = raw;

    if (match) {
      answer = raw.slice(0, match.index).trim();
      try {
        const parsed = JSON.parse(match[1]) as { pages?: unknown };
        if (Array.isArray(parsed.pages)) {
          sourcePages = parsed.pages
            .map((p) => Number(p))
            .filter((n) => Number.isInteger(n) && n > 0);
          sourcePages = [...new Set(sourcePages)].sort((a, b) => a - b);
        }
      } catch {
        sourcePages = [];
      }
    }

    // Only keep citations that exist in the provided chunks (no hallucinated pages)
    const allowedPages = new Set(
      chunks.slice(0, maxChunks).map((c) => c.pageNumber),
    );
    sourcePages = sourcePages.filter((p) => allowedPages.has(p));

    return { answer, sourcePages };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[Nova AI Doc] gemini ask failed", error);
    throw new AppError("ai_error", "AI 問答服務暫時無法使用，請稍後再試。", 502);
  }
}
