import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** GET：取得單一文件（含摘要） */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, title, file_name, file_size, page_count, status, error_message, summary, created_at, updated_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }

    if (!data) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限查看。", 404);
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * DELETE：刪除文件、分段、問答與 Storage 檔案。
 * Document isolation: always scope by user_id; RLS also enforces auth.uid() = user_id
 * so other members cannot delete or read another user's documents.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: document, error } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!document) {
      throw new AppError("not_found", "找不到這份文件。", 404);
    }

    await supabase.storage.from("documents").remove([document.storage_path]);

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      throw new AppError("internal_error", "刪除文件失敗。", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
