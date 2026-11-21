import { requireUser } from "@/lib/auth/require-user";
import { processPdfUpload } from "@/lib/documents/process-upload";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET：列出目前使用者的文件 */
export async function GET() {
  try {
    const { user, supabase } = await requireUser();

    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new AppError("internal_error", "無法取得文件列表。", 500);
    }

    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST：上傳 PDF → Storage → 解析 → 分段 → Gemini 摘要 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("validation_error", "請使用 multipart 欄位 file 上傳 PDF。", 400);
    }

    const document = await processPdfUpload({
      supabase,
      userId: user.id,
      file,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
