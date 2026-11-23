import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { AppError } from "@/lib/errors";

/** 依目前 API 可用性排序；可用 GEMINI_MODEL 覆寫第一順位 */
const MODEL_FALLBACKS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
] as const;

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL || MODEL_FALLBACKS[0];
}

export function getGeminiModel(modelName = getGeminiModelName()): GenerativeModel {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("ai_error", "伺服器尚未設定 GEMINI_API_KEY。", 500);
  }

  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}

/**
 * 對過時／忙碌模型自動改試後備型號（不變更正式環境變數）
 */
export async function generateWithGeminiFallback(
  buildPrompt: (model: GenerativeModel) => Promise<string>,
): Promise<string> {
  const preferred = getGeminiModelName();
  const candidates = [
    preferred,
    ...MODEL_FALLBACKS.filter((m) => m !== preferred),
  ];

  let lastError: unknown;
  for (const name of candidates) {
    try {
      const model = getGeminiModel(name);
      const text = (await buildPrompt(model))?.trim();
      if (!text) {
        throw new AppError("ai_error", "AI 未回傳內容，請稍後再試。", 502);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (error instanceof AppError && error.code !== "ai_error") {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      const retryable =
        /404|not found|no longer available|high demand|503|UNAVAILABLE|429/i.test(
          msg,
        );
      if (!retryable) break;
      console.error("[Nova AI Doc] gemini model failed, trying fallback", name);
    }
  }

  if (lastError instanceof AppError) throw lastError;
  console.error("[Nova AI Doc] gemini all models failed", lastError);
  throw new AppError("ai_error", "AI 服務暫時無法使用，請稍後再試。", 502);
}
