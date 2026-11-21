import { AppError } from "@/lib/errors";
import { getGeminiModel } from "@/lib/gemini/client";
import type { PdfPageText } from "@/lib/pdf/parse";

/**
 * 使用 Gemini 產生繁體中文摘要
 */
export async function summarizeDocument(pages: PdfPageText[]): Promise<string> {
  const model = getGeminiModel();

  // 控制送入長度，避免一次塞爆 token / 成本
  const sample = pages
    .slice(0, 80)
    .map((p) => `【第 ${p.pageNumber} 頁】\n${p.text.slice(0, 2000)}`)
    .join("\n\n")
    .slice(0, 40000);

  const prompt = `你是 DocMate AI 文件助理。請根據下列 PDF 內容，用「繁體中文（台灣）」撰寫摘要。

要求：
1. 先給 3～6 點重點條列
2. 再給一段 120～200 字的總結
3. 不要編造文件中沒有的資訊
4. 若內容不足，清楚說明限制

文件內容：
${sample}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    if (!text) {
      throw new AppError("ai_error", "AI 未回傳摘要內容，請稍後再試。", 502);
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[DocMate] gemini summarize failed", error);
    throw new AppError("ai_error", "AI 摘要服務暫時無法使用，請稍後再試。", 502);
  }
}
