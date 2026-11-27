import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL_FALLBACKS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.0-flash",
] as const;

const MAX_SKEW_MS = 5 * 60 * 1000;

function verifyNovaOsSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
): boolean {
  const sharedSecret = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!sharedSecret || !timestampHeader || !signatureHeader) {
    return false;
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", sharedSecret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const receivedBuf = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

/**
 * Authenticated internal Gemini relay for NovaOS hub (paycheck.com.de / NovaShield).
 * Authorized strictly via HMAC-SHA256 using the shared SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 20_000) {
      return NextResponse.json(
        { ok: false, error: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }

    const okSig = verifyNovaOsSignature(
      rawBody,
      request.headers.get("x-novaos-timestamp"),
      request.headers.get("x-novaos-signature"),
    );

    if (!okSig) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "GEMINI_NOT_CONFIGURED" },
        { status: 503 },
      );
    }

    let payload: { systemPrompt?: unknown; userPrompt?: unknown };
    try {
      payload = JSON.parse(rawBody) as {
        systemPrompt?: unknown;
        userPrompt?: unknown;
      };
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_JSON" },
        { status: 400 },
      );
    }

    const systemPrompt =
      typeof payload.systemPrompt === "string"
        ? payload.systemPrompt.trim().slice(0, 2000)
        : "";
    const userPrompt =
      typeof payload.userPrompt === "string"
        ? payload.userPrompt.trim().slice(0, 4000)
        : "";

    if (!systemPrompt || !userPrompt) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PROMPTS" },
        { status: 400 },
      );
    }

    const preferred =
      (process.env.GEMINI_MODEL || "").trim() || MODEL_FALLBACKS[0];
    const candidates = [
      preferred,
      ...MODEL_FALLBACKS.filter((m) => m !== preferred),
    ];

    const client = new GoogleGenerativeAI(apiKey);

    for (const modelName of candidates) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        });
        const response = await model.generateContent(userPrompt);
        const text = response.response.text()?.trim();
        if (!text) continue;

        const parsed = JSON.parse(stripJsonCodeFence(text)) as Record<
          string,
          unknown
        >;
        if (parsed && typeof parsed === "object") {
          return NextResponse.json({
            ok: true,
            model: modelName,
            result: parsed,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const retryable =
          /404|not found|no longer available|high demand|503|UNAVAILABLE|429/i.test(
            msg,
          );
        if (!retryable) break;
      }
    }

    return NextResponse.json(
      { ok: false, error: "GEMINI_UNAVAILABLE" },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
