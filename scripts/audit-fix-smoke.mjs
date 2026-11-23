/**
 * Smoke checks for NovaOS audit fix items (no network / DB required).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// --- Mirror of lib/auth-receive parseHandoffHash ---
function parseHandoffHash(hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

assert.deepEqual(parseHandoffHash("#access_token=a&refresh_token=b"), {
  access_token: "a",
  refresh_token: "b",
});
assert.equal(parseHandoffHash("#access_token=only"), null);
assert.equal(parseHandoffHash(""), null);

// --- Mirror of getNovaOsLoginUrl / toReceiveReturnUrl contract ---
const SITE_URL = "https://docmate-ai-one.vercel.app";
const HUB = "https://paycheck.com.de";

function toReceiveReturnUrl(returnTo = "/dashboard") {
  const pathPart = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
  return `${SITE_URL}/auth/receive?next=${encodeURIComponent(pathPart)}`;
}

function getNovaOsLoginUrl(returnTo = "/dashboard") {
  const receive = toReceiveReturnUrl(returnTo);
  return `${HUB}/login?next=${encodeURIComponent(receive)}&product=docmate`;
}

const loginUrl = getNovaOsLoginUrl("/dashboard");
assert.ok(loginUrl.startsWith(`${HUB}/login?next=`));
assert.ok(loginUrl.includes("product=docmate"));
const nextParam = new URL(loginUrl).searchParams.get("next");
assert.equal(
  nextParam,
  `${SITE_URL}/auth/receive?next=${encodeURIComponent("/dashboard")}`,
);
assert.ok(nextParam.includes("/auth/receive"));
assert.equal(new URL(nextParam).searchParams.get("next"), "/dashboard");

// --- Idempotency store behaviour (inline) ---
const store = new Map();
const TTL = 15 * 60 * 1000;

function begin(userId, key) {
  const k = `${userId}:${key}`;
  const existing = store.get(k);
  if (existing && existing.expiresAt > Date.now()) return false;
  store.set(k, { kind: "inflight", expiresAt: Date.now() + 120_000 });
  return true;
}
function save(userId, key, body) {
  store.set(`${userId}:${key}`, {
    kind: "success",
    body,
    expiresAt: Date.now() + TTL,
  });
}
function get(userId, key) {
  const e = store.get(`${userId}:${key}`);
  return e?.kind === "success" ? e.body : null;
}
function clear(userId, key) {
  const k = `${userId}:${key}`;
  if (store.get(k)?.kind === "inflight") store.delete(k);
}

assert.equal(begin("u1", "r1"), true);
assert.equal(begin("u1", "r1"), false);
clear("u1", "r1");
assert.equal(begin("u1", "r1"), true);
save("u1", "r1", { answer: "ok" });
assert.deepEqual(get("u1", "r1"), { answer: "ok" });
assert.equal(begin("u1", "r1"), false);

// --- Plans honesty ---
const plansSrc = fs.readFileSync(path.join(root, "lib/plans.ts"), "utf8");
assert.ok(
  plansSrc.includes("團隊功能（規劃中）") || !plansSrc.includes('"團隊功能"'),
  "BUSINESS must not list bare 團隊功能 as delivered",
);
assert.ok(
  !plansSrc.includes('"AI 考題與筆記"'),
  "PRO must not claim unimplemented 考題與筆記",
);

// Source files must export getNovaOsLoginUrl and wire receive
const hubSrc = fs.readFileSync(path.join(root, "lib/novaos-hub.ts"), "utf8");
assert.ok(hubSrc.includes("export function getNovaOsLoginUrl"));
assert.ok(hubSrc.includes("/auth/receive"));
const receiveSrc = fs.readFileSync(
  path.join(root, "app/auth/receive/receive-client.tsx"),
  "utf8",
);
assert.ok(receiveSrc.includes("getNovaOsLoginUrl"));
assert.ok(receiveSrc.includes("applyHandoffSession"));

// Citation filter mirror
function filterCitations(pages, allowed) {
  const set = new Set(allowed);
  return pages.filter((p) => set.has(p));
}
assert.deepEqual(filterCitations([1, 2, 99], [1, 2, 3]), [1, 2]);

// Quota release still present on ask routes
for (const rel of [
  "app/api/documents/[id]/ask/route.ts",
  "app/api/ask/route.ts",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.ok(src.includes("reserveQuestionSlot"));
  assert.ok(src.includes("releaseQuestionSlot"));
  assert.ok(src.includes("reportToHub") || src.includes("reportAskFailure"));
}

const uploadSrc = fs.readFileSync(
  path.join(root, "lib/documents/process-upload.ts"),
  "utf8",
);
assert.ok(uploadSrc.includes("releaseDocumentSlot"));
assert.ok(uploadSrc.includes("eq(\"user_id\", userId)") || uploadSrc.includes("user_id: userId"));

console.log("audit-fix-smoke OK");
