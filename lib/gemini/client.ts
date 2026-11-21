import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "@/lib/errors";

export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("ai_error", "伺服器尚未設定 GEMINI_API_KEY。", 500);
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({ model: modelName });
}
