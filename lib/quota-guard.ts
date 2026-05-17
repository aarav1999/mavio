/**
 * Per-user, per-day in-memory quota guard for AI endpoints.
 *
 * Why: Groq's free tier (`llama-3.3-70b-versatile`) is 14,400 requests/day
 * across the whole API key. Without a guard, a single user iterating on their
 * inbox could exhaust the daily budget for everyone. This module enforces a
 * conservative *per-user* cap so the shared key stays healthy.
 *
 * Scope: in-memory only. Resets on cold start. Good enough for an MVP and
 * single-region Vercel deployment; swap for Upstash Redis when scaling out.
 */

export interface QuotaWindow {
  /** Unix-day bucket (UTC). */
  day: number;
  count: number;
}

export interface QuotaConfig {
  /** Max calls per user per day. Default: 200. */
  perUserPerDay?: number;
}

const DEFAULT_PER_USER_PER_DAY = 200;

const windows = new Map<string, QuotaWindow>();

function todayBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the bucket resets. */
  resetSeconds: number;
}

/**
 * Increment-and-check. Returns whether the call is allowed and the
 * remaining headroom for headers / UX.
 */
export function consumeQuota(
  userId: string,
  config: QuotaConfig = {},
  now: Date = new Date(),
): QuotaResult {
  const limit = config.perUserPerDay ?? DEFAULT_PER_USER_PER_DAY;
  const day = todayBucket(now);

  const existing = windows.get(userId);
  if (!existing || existing.day !== day) {
    windows.set(userId, { day, count: 1 });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetSeconds: secondsUntilNextDay(now),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetSeconds: secondsUntilNextDay(now),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    limit,
    resetSeconds: secondsUntilNextDay(now),
  };
}

function secondsUntilNextDay(now: Date): number {
  const ms = 86_400_000 - (now.getTime() % 86_400_000);
  return Math.ceil(ms / 1000);
}

/** Test-only helper. Do not call from production code. */
export function __resetQuotaForTests(): void {
  windows.clear();
}
