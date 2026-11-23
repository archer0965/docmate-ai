import { createHash } from "crypto";

/** 以檔案位元組產生內容雜湊，用於去重 */
export function hashArrayBuffer(buffer: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}
