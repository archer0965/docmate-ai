import { requireUser } from "@/lib/auth/require-user";
import { normalizeFolder } from "@/lib/documents/folders";
import { processPdfUpload } from "@/lib/documents/process-upload";
import { AppError, jsonError } from "@/lib/errors";
import {
  beginIdempotentRequest,
  clearIdempotentInFlight,
  getIdempotentSuccess,
  normalizeClientRequestId,
  saveIdempotentSuccess,
} from "@/lib/security/idempotency";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET：列出目前使用者的文件（可選 ?folder=）。
 * Document isolation: filtered by user_id; RLS also prevents cross-user reads.
 */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const url = new URL(request.url);
    const folderParam = url.searchParams.get("folder");
    const folder = folderParam != null ? normalizeFolder(folderParam) : undefined;

    let query = supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, folder, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (folder) {
      query = query.eq("folder", folder);
    } else if (folderParam === "") {
      query = query.is("folder", null);
    }

    const { data, error } = await query;

    if (error) {
      // folder 欄位尚未 migration：後援查詢不含 folder
      if (/folder/i.test(error.message || "")) {
        const fallback = await supabase
          .from("documents")
          .select(
            "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (fallback.error) {
          throw new AppError("internal_error", "無法取得文件列表。", 500);
        }
        return NextResponse.json({ documents: fallback.data ?? [] });
      }
      throw new AppError("internal_error", "無法取得文件列表。", 500);
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：上傳 PDF / DOCX → Storage → 解析 → 分段 → Gemini 摘要 */
export async function POST(request: Request) {
  let userId: string | null = null;
  let idempotencyKey: string | null = null;

  try {
    const { user, supabase } = await requireUser();
    userId = user.id;
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = normalizeFolder(formData.get("folder"));
    idempotencyKey = normalizeClientRequestId(
      String(formData.get("clientRequestId") || "") ||
        request.headers.get("idempotency-key"),
    );

    if (!(file instanceof File)) {
      throw new AppError(
        "validation_error",
        "請使用 multipart 欄位 file 上傳 PDF 或 Word（.docx）。",
        400,
      );
    }

    if (idempotencyKey) {
      const cached = getIdempotentSuccess(user.id, idempotencyKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
      if (!beginIdempotentRequest(user.id, idempotencyKey)) {
        const raced = getIdempotentSuccess(user.id, idempotencyKey);
        if (raced) {
          return NextResponse.json(raced.body, { status: raced.status });
        }
        throw new AppError(
          "conflict",
          "相同上傳處理中或已完成，請稍候再試。",
          409,
        );
      }
    }

    // Document isolation: processPdfUpload always stamps user_id on rows + storage path
    const document = await processPdfUpload({
      supabase,
      userId: user.id,
      file,
      folder,
    });

    const payload = { document };
    if (idempotencyKey) {
      saveIdempotentSuccess(user.id, idempotencyKey, 201, payload);
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    if (userId && idempotencyKey) {
      clearIdempotentInFlight(userId, idempotencyKey);
    }
    const msg = error instanceof Error ? error.message : "upload_failed";
    if (/ai|gemini|502|暫時無法/i.test(msg)) {
      const { reportToHub } = await import("@/lib/novaos-telemetry");
      await reportToHub({
        kind: "ai_failure",
        severity: "error",
        message: msg,
        meta: { userId, route: "documents/upload" },
      });
    }
    return jsonError(error);
  }
}
