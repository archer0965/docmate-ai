import { AppError } from "@/lib/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

/**
 * 簡易記憶體 rate limit（單一伺服器實例）
 * Vercel 多實例不保證全域一致，但仍能大幅降低單實例濫用。
 */
const buckets = new Map<string, Bucket>();

export function assertRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (current.count >= options.limit) {
    throw new AppError(
      "quota_exceeded",
      options.message || "請求過於頻繁，請稍後再試。",
      429,
    );
  }

  current.count += 1;
  buckets.set(options.key, current);
}

/** 避免 Map 無限成長 */
export function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
