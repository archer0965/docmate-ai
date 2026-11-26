import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { getAccessibleDocument } from "@/lib/teams/access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET：取得文件段落（供引用點擊預覽）
 * query: page?, chunkIndex?
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();
    const url = new URL(request.url);
    const page = url.searchParams.get("page");
    const chunkIndex = url.searchParams.get("chunkIndex");

    const document = await getAccessibleDocument(supabase, user.id, id);

    // chunks 屬文件擁有者；依 document_id 讀取（RLS 允許團隊）
    let query = supabase
      .from("document_chunks")
      .select("id, chunk_index, page_number, content")
      .eq("document_id", id)
      .order("chunk_index", { ascending: true })
      .limit(40);

    if (page) {
      const pageNum = Number(page);
      if (Number.isInteger(pageNum) && pageNum > 0) {
        query = query.eq("page_number", pageNum);
      }
    }
    if (chunkIndex) {
      const idx = Number(chunkIndex);
      if (Number.isInteger(idx) && idx >= 0) {
        query = query.eq("chunk_index", idx);
      }
    }

    const { data, error } = await query;
    if (error) {
      // 後備：僅本人 chunks
      const { data: fallback, error: fallbackError } = await supabase
        .from("document_chunks")
        .select("id, chunk_index, page_number, content")
        .eq("document_id", id)
        .eq("user_id", document.user_id)
        .order("chunk_index", { ascending: true })
        .limit(40);
      if (fallbackError) {
        throw new AppError("internal_error", "無法讀取段落。", 500);
      }
      return NextResponse.json({
        documentId: document.id,
        title: document.title,
        chunks: fallback ?? [],
      });
    }

    return NextResponse.json({
      documentId: document.id,
      title: document.title,
      chunks: data ?? [],
    });
  } catch (error) {
    return jsonError(error);
  }
}
