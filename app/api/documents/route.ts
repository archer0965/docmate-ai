import { requireUser } from "@/lib/auth/require-user";
import { normalizeFolder } from "@/lib/documents/folders";
import { processPdfUpload } from "@/lib/documents/process-upload";
import { AppError, jsonError } from "@/lib/errors";
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
  try {
    const { user, supabase } = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = normalizeFolder(formData.get("folder"));

    if (!(file instanceof File)) {
      throw new AppError(
        "validation_error",
        "請使用 multipart 欄位 file 上傳 PDF 或 Word（.docx）。",
        400,
      );
    }

    // Document isolation: processPdfUpload always stamps user_id on rows + storage path
    const document = await processPdfUpload({
      supabase,
      userId: user.id,
      file,
      folder,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
