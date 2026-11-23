/**
 * Short-lived in-memory idempotency (single server instance).
 * Prevents double-deduct when a client retries the same clientRequestId
 * after a success or while a request is still in flight.
 */

type StoredSuccess = {
  kind: "success";
  status: number;
  body: unknown;
  expiresAt: number;
};

type StoredInFlight = {
  kind: "inflight";
  expiresAt: number;
};

type Entry = StoredSuccess | StoredInFlight;

const store = new Map<string, Entry>();
const TTL_MS = 15 * 60 * 1000;
const INFLIGHT_MS = 2 * 60 * 1000;

function keyOf(userId: string, clientRequestId: string) {
  return `${userId}:${clientRequestId}`;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function normalizeClientRequestId(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const id = raw.trim().slice(0, 80);
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  return id;
}

/** Return cached success body, or null if none / expired. */
export function getIdempotentSuccess(
  userId: string,
  clientRequestId: string,
): { status: number; body: unknown } | null {
  prune();
  const entry = store.get(keyOf(userId, clientRequestId));
  if (!entry || entry.kind !== "success") return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(keyOf(userId, clientRequestId));
    return null;
  }
  return { status: entry.status, body: entry.body };
}

/**
 * Mark request as in-flight. Returns false if another request with the
 * same key is already running (caller should respond 409).
 */
export function beginIdempotentRequest(
  userId: string,
  clientRequestId: string,
): boolean {
  prune();
  const k = keyOf(userId, clientRequestId);
  const existing = store.get(k);
  if (existing) {
    if (existing.kind === "success" && existing.expiresAt > Date.now()) {
      return false;
    }
    if (existing.kind === "inflight" && existing.expiresAt > Date.now()) {
      return false;
    }
  }
  store.set(k, { kind: "inflight", expiresAt: Date.now() + INFLIGHT_MS });
  return true;
}

export function saveIdempotentSuccess(
  userId: string,
  clientRequestId: string,
  status: number,
  body: unknown,
) {
  store.set(keyOf(userId, clientRequestId), {
    kind: "success",
    status,
    body,
    expiresAt: Date.now() + TTL_MS,
  });
}

/** Clear in-flight marker after failure so the same key may retry. */
export function clearIdempotentInFlight(
  userId: string,
  clientRequestId: string,
) {
  const k = keyOf(userId, clientRequestId);
  const entry = store.get(k);
  if (entry?.kind === "inflight") store.delete(k);
}
