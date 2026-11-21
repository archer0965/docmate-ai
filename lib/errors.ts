import { NextResponse } from "next/server";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "file_too_large"
  | "invalid_file_type"
  | "pdf_parse_failed"
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

  console.error("[DocMate] unexpected error", error);
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "伺服器發生未預期錯誤，請稍後再試。",
      },
    },
    { status: 500 },
  );
}
