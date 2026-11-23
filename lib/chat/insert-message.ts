import type { SupabaseClient } from "@supabase/supabase-js";

type ChatInsert = {
  document_id?: string | null;
  session_id?: string | null;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  source_pages?: number[];
  citations?: unknown;
};

export type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  source_pages: number[] | null;
  created_at: string;
  citations?: unknown;
};

/**
 * 寫入 chat_messages；若尚未套用 citations／session 欄位則自動降級重試
 */
export async function insertChatMessage(
  supabase: SupabaseClient,
  row: ChatInsert,
): Promise<{
  data: ChatMessageRow | null;
  error: { message?: string } | null;
  persistedCitations: boolean;
}> {
  const full = {
    document_id: row.document_id ?? null,
    user_id: row.user_id,
    role: row.role,
    content: row.content,
    source_pages: row.source_pages ?? [],
    citations: row.citations ?? [],
    ...(row.session_id ? { session_id: row.session_id } : {}),
  };

  const first = await supabase
    .from("chat_messages")
    .insert(full)
    .select("id, role, content, source_pages, citations, created_at")
    .single();
  if (!first.error && first.data) {
    return {
      data: first.data as ChatMessageRow,
      error: null,
      persistedCitations: true,
    };
  }

  const legacy = {
    document_id: row.document_id ?? null,
    user_id: row.user_id,
    role: row.role,
    content: row.content,
    source_pages: row.source_pages ?? [],
  };
  const second = await supabase
    .from("chat_messages")
    .insert(legacy)
    .select("id, role, content, source_pages, created_at")
    .single();

  return {
    data: (second.data as ChatMessageRow | null) ?? null,
    error: second.error,
    persistedCitations: false,
  };
}
