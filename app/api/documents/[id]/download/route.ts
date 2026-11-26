import { requireUser } from "@/lib/auth/require-user";
import { AppError, jsonError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleDocument } from "@/lib/teams/access";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET：下載原始 PDF（擁有者或團隊成員） */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const document = await getAccessibleDocument(supabase, user.id, id);

    // 團隊共享時 storage 路徑在擁有者資料夾；以 admin 簽章避免 storage RLS 卡關
    const admin = createAdminClient();
    const { data: signed, error: signedError } = await admin.storage
      .from("documents")
      .createSignedUrl(document.storage_path, 60);

    if (!signedError && signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, 302);
    }

    const { data: file, error: downloadError } = await admin.storage
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
