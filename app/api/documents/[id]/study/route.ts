import { requireUser } from "@/lib/auth/require-user";
import { getAiSafetyLimits } from "@/lib/config/limits";
import { AppError, jsonError } from "@/lib/errors";
import {
  STUDY_TYPES,
  generateStudyArtifact,
  type StudyType,
} from "@/lib/gemini/study";
import { getPlan } from "@/lib/plans";
import { assertRateLimit, pruneRateLimitBuckets } from "@/lib/security/rate-limit";
import { getAccessibleDocument } from "@/lib/teams/access";
import {
  assertCanAsk,
  getFreshProfile,
  releaseQuestionSlot,
  reserveQuestionSlot,
} from "@/lib/usage/quota";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

async function loadPagesFromChunks(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  documentId: string,
  maxChunks: number,
) {
  const { data: chunkRows, error } = await supabase
    .from("document_chunks")
    .select("page_number, content, chunk_index")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(maxChunks);

  if (error) throw new AppError("internal_error", "無法讀取文件內容。", 500);
  if (!chunkRows?.length) {
    throw new AppError("empty_document", "這份文件沒有可產生學習內容的文字。", 422);
  }

  const byPage = new Map<number, string[]>();
  for (const row of chunkRows) {
    const list = byPage.get(row.page_number) || [];
    list.push(row.content);
    byPage.set(row.page_number, list);
  }

  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, parts]) => ({ pageNumber, text: parts.join("\n") }));
}

/** GET：列出學習產物（本人 + 文件擁有者在共享文件上的產物） */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const document = await getAccessibleDocument(supabase, user.id, id);

    const { data, error } = await supabase
      .from("study_artifacts")
      .select("id, artifact_type, title, payload, question_count, created_at, updated_at, user_id")
      .eq("document_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ artifacts: [] });
    }

    const artifacts = (data ?? [])
      .filter((a) => a.user_id === user.id || a.user_id === document.user_id)
      .map(({ user_id: _u, ...rest }) => rest);

    return NextResponse.json({ artifacts });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：產生筆記／考題／閃卡等（扣除 1 次提問額度） */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    pruneRateLimitBuckets();

    const profile = await getFreshProfile(supabase, user.id);
    const plan = getPlan(profile.plan);
    const safety = getAiSafetyLimits(profile.plan);

    assertRateLimit({
      key: `study:${user.id}`,
      limit: Math.max(3, Math.floor(safety.askPerMinute / 2)),
      windowMs: 60_000,
      message: "學習工具請求過於頻繁，請稍後再試。",
    });

    assertCanAsk(profile);

    const bodySchema = z.object({
      type: z.enum(STUDY_TYPES),
      count: z.number().int().min(1).max(20).optional(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("validation_error", "學習工具類型或數量不正確。", 400);
    }

    const type = parsed.data.type as StudyType;
    const count = parsed.data.count ?? 5;

    const document = await getAccessibleDocument(supabase, user.id, id);
    if (document.status !== "ready") {
      throw new AppError("validation_error", "文件尚未就緒。", 409);
    }

    const pages = await loadPagesFromChunks(supabase, id, safety.maxChunksForAsk);

    await reserveQuestionSlot(user.id, plan.questionsPerMonth);

    let generated;
    try {
      generated = await generateStudyArtifact(pages, type, count);
    } catch (aiError) {
      await releaseQuestionSlot(user.id);
      throw aiError;
    }

    const { data: artifact, error } = await supabase
      .from("study_artifacts")
      .insert({
        document_id: id,
        user_id: user.id,
        artifact_type: type,
        title: generated.title,
        payload: generated.payload,
        question_count: count,
      })
      .select("id, artifact_type, title, payload, question_count, created_at, updated_at")
      .single();

    if (error || !artifact) {
      return NextResponse.json({
        artifact: {
          id: crypto.randomUUID(),
          artifact_type: type,
          title: generated.title,
          payload: generated.payload,
          question_count: count,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        persisted: false,
      });
    }

    return NextResponse.json({ artifact, persisted: true });
  } catch (error) {
    return jsonError(error);
  }
}
