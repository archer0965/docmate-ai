import { requireUser } from "@/lib/auth/require-user";
import { normalizeFolder } from "@/lib/documents/folders";
import { AppError, jsonError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH：設定文件資料夾標籤。
 * Isolation: user_id filter + RLS.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user, supabase } = await requireUser();

    const bodySchema = z.object({
      folder: z.string().trim().max(80).nullable().optional(),
    });

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("validation_error", "資料夾名稱格式不正確。", 400);
    }

    const folder = normalizeFolder(parsed.data.folder ?? null);

    const { data, error } = await supabase
      .from("documents")
      .update({ folder })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, folder")
      .maybeSingle();

    if (error) {
      if (/folder/i.test(error.message || "")) {
        throw new AppError(
          "validation_error",
          "資料庫尚未啟用 folder 欄位，請先套用 migration 006。",
          422,
        );
      }
      throw new AppError("internal_error", "無法更新資料夾。", 500);
    }
    if (!data) {
      throw new AppError("not_found", "找不到這份文件。", 404);
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    return jsonError(error);
  }
}
