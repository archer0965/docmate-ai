import { requireUser } from "@/lib/auth/require-user";
import { processPdfUpload } from "@/lib/documents/process-upload";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET：列出目前使用者的文件（支援 q 搜尋） */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();

    let query = supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at, content_hash, source_kind",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,file_name.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      // 新欄位尚未 migration 時後備
      const { data: fallback, error: fallbackError } = await supabase
        .from("documents")
        .select(
          "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fallbackError) {
        throw new AppError("internal_error", "無法取得文件列表。", 500);
      }
      return NextResponse.json({ documents: fallback ?? [] });
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：上傳 PDF → Storage → 解析／OCR → 分段 → Gemini 摘要 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("validation_error", "請使用 multipart 欄位 file 上傳 PDF。", 400);
    }

    const result = await processPdfUpload({
      supabase,
      userId: user.id,
      file,
    });

    return NextResponse.json(
      {
        document: result.document,
        deduplicated: result.deduplicated,
      },
      { status: result.deduplicated ? 200 : 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
