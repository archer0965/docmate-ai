import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET：下載原始 PDF（僅本人） */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const { data: document, error } = await supabase
      .from("documents")
      .select("id, file_name, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new AppError("internal_error", "無法讀取文件。", 500);
    }
    if (!document) {
      throw new AppError("not_found", "找不到這份文件，或你沒有權限。", 404);
    }

    // 優先簽章 URL（較穩定）；失敗則直接串流
    const { data: signed, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.storage_path, 60);

    if (!signedError && signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, 302);
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("documents")
      .download(document.storage_path);

    if (downloadError || !file) {
      throw new AppError("not_found", "原始檔案不存在或已刪除。", 404);
    }

    const ab = await file.arrayBuffer();
    const fileName = document.file_name.endsWith(".pdf")
      ? document.file_name
      : `${document.file_name}.pdf`;

    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(ab.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
