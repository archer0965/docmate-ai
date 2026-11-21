import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";

function safeInternalPath(next, fallback = "/dashboard") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("://")) return fallback;
  if (next.includes("\\")) return fallback;
  return next;
}

assert.equal(safeInternalPath("/dashboard"), "/dashboard");
assert.equal(safeInternalPath("//evil.com"), "/dashboard");
assert.equal(safeInternalPath("https://evil.com"), "/dashboard");
assert.equal(safeInternalPath("/\\evil"), "/dashboard");

function assertPdfMagic(bytes) {
  const magic = [0x25, 0x50, 0x44, 0x46];
  return magic.every((v, i) => bytes[i] === v);
}

assert.equal(assertPdfMagic([0x25, 0x50, 0x44, 0x46, 0x2d]), true);
assert.equal(assertPdfMagic([0x00, 0x50, 0x44, 0x46]), false);

const secret = "test-secret";
const token = createHmac("sha256", secret).update("order:user").digest("hex");
const a = Buffer.from(token);
const b = Buffer.from(createHmac("sha256", secret).update("order:user").digest("hex"));
assert.equal(timingSafeEqual(a, b), true);

console.log("security-smoke OK");
