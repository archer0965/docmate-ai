import { AppError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessibleDocument = {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  page_count: number | null;
  status: string;
  error_message: string | null;
  summary: string | null;
  team_id: string | null;
  created_at: string;
  updated_at?: string;
};

/**
 * 讀取文件：擁有者或團隊成員可存取（RLS 亦會過濾）
 */
export async function getAccessibleDocument(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<AccessibleDocument> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, user_id, title, file_name, storage_path, file_size, page_count, status, error_message, summary, team_id, created_at, updated_at",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    // team_id 欄位尚未 migration 時後備
    const { data: fallback, error: fallbackError } = await supabase
      .from("documents")
      .select(
        "id, user_id, title, file_name, storage_path, file_size, page_count, status, error_message, summary, created_at, updated_at",
      )
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fallbackError || !fallback) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
    }
    return { ...fallback, team_id: null };
  }

  if (!data) {
    throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
  }

  if (data.user_id === userId) {
    return data as AccessibleDocument;
  }

  if (data.team_id) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", data.team_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membership) {
      return data as AccessibleDocument;
    }
  }

  throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
}

export function isDocumentOwner(doc: AccessibleDocument, userId: string) {
  return doc.user_id === userId;
}
