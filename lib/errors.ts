import { NextResponse } from "next/server";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "file_too_large"
  | "invalid_file_type"
  | "pdf_parse_failed"
  | "ocr_failed"
  | "empty_document"
  | "quota_exceeded"
  | "ai_error"
  | "storage_error"
  | "conflict"
  | "internal_error";

export class AppError extends Error {
  status: number;
  code: ErrorCode;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  console.error("[Nova AI Doc] unexpected error", error);
  // 短暫帶出細節以利正式環境排查（確認後可收回）
  const detail = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "伺服器發生未預期錯誤，請稍後再試。",
        detail: detail.slice(0, 300),
      },
    },
    { status: 500 },
  );
}
