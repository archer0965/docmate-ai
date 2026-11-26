import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import {
  getAccessibleDocument,
  isDocumentOwner,
} from "@/lib/teams/access";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/** GET：取得單一文件（含摘要；擁有者或團隊成員） */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const document = await getAccessibleDocument(supabase, user.id, id);

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        file_name: document.file_name,
        file_size: document.file_size,
        page_count: document.page_count,
        status: document.status,
        error_message: document.error_message,
        summary: document.summary,
        team_id: document.team_id,
        user_id: document.user_id,
        isOwner: isDocumentOwner(document, user.id),
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** DELETE：刪除文件（僅擁有者） */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const document = await getAccessibleDocument(supabase, user.id, id);
    if (!isDocumentOwner(document, user.id)) {
      throw new AppError("forbidden", "只有文件擁有者可以刪除。", 403);
    }

    await Promise.all([
      supabase.from("document_chunks").delete().eq("document_id", id).eq("user_id", user.id),
      supabase.from("chat_messages").delete().eq("document_id", id).eq("user_id", user.id),
      supabase.from("document_summaries").delete().eq("document_id", id).eq("user_id", user.id),
      supabase.from("study_artifacts").delete().eq("document_id", id).eq("user_id", user.id),
    ]);

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
