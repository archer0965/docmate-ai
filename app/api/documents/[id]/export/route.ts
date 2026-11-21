import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

/**
 * GET：匯出文件摘要為可下載 .md（Word 可開啟）。
 * Isolation: user_id filter + RLS.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: document, error } = await supabase
      .from("documents")
      .select("id, title, file_name, summary, status, page_count, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!document) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
    }
    if (!document.summary) {
      throw new AppError("validation_error", "尚無摘要可匯出。", 422);
    }

    const safeTitle = (document.title || "summary")
      .replace(/[^\w\u4e00-\u9fff-]+/g, "_")
      .slice(0, 80);
    const body = [
      `# ${document.title}`,
      "",
      `- 檔名：${document.file_name}`,
      `- 頁數：${document.page_count ?? "—"}`,
      `- 建立：${document.created_at}`,
      "",
      "## AI 摘要",
      "",
      document.summary,
      "",
    ].join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}-summary.md"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
