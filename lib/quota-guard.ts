/**
 * Per-user, per-day quota guard for AI endpoints.
 *
 * Why: Groq's free tier (`llama-3.3-70b-versatile`) is 14,400 requests/day
 * across the whole API key. Without a guard, a single user iterating on their
 * inbox could exhaust the daily budget for everyone. This module enforces a
 * conservative *per-user* cap so the shared key stays healthy.
 *
 * Implementation: Uses Upstash Redis for distributed quota tracking across
 * multiple Vercel instances. Falls back to in-memory for local development
 * when UPSTASH_REDIS_REST_URL is not configured.
 */

import { Redis } from '@upstash/redis';

export interface QuotaWindow {
  /** Unix-day bucket (UTC). */
  day: number;
  count: number;
}

export interface QuotaConfig {
  /** Max calls per user per day. Default: 200. */
  perUserPerDay?: number;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the bucket resets. */
  resetSeconds: number;
}

const DEFAULT_PER_USER_PER_DAY = 200;
const QUOTA_KEY_PREFIX = 'quota:ai:';

// In-memory fallback for local development
const localWindows = new Map<string, QuotaWindow>();

// Lazy-initialized Redis client
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }
  
  return null;
}

function todayBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

function secondsUntilNextDay(now: Date): number {
  const ms = 86_400_000 - (now.getTime() % 86_400_000);
  return Math.ceil(ms / 1000);
}

/**
 * Increment-and-check using Redis (distributed) or in-memory (local fallback).
 * Returns whether the call is allowed and the remaining headroom for headers / UX.
 */
export async function consumeQuota(
  userId: string,
  config: QuotaConfig = {},
  now: Date = new Date(),
): Promise<QuotaResult> {
  const limit = config.perUserPerDay ?? DEFAULT_PER_USER_PER_DAY;
  const day = todayBucket(now);
  const resetSeconds = secondsUntilNextDay(now);
  
  const redisClient = getRedis();
  
  // Use Redis if available (production)
  if (redisClient) {
    return consumeQuotaRedis(redisClient, userId, limit, day, resetSeconds);
  }
  
  // Fallback to in-memory (local development)
  return consumeQuotaLocal(userId, limit, day, resetSeconds);
}

async function consumeQuotaRedis(
  redis: Redis,
  userId: string,
  limit: number,
  day: number,
  resetSeconds: number,
): Promise<QuotaResult> {
  const key = `${QUOTA_KEY_PREFIX}${userId}:${day}`;
  
  try {
    // Atomic increment with TTL
    const count = await redis.incr(key);
    
    // Set expiry on first increment (24 hours from now)
    if (count === 1) {
      await redis.expire(key, resetSeconds);
    }
    
    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        resetSeconds,
      };
    }
    
    return {
      allowed: true,
      remaining: limit - count,
      limit,
      resetSeconds,
    };
  } catch (error) {
    // On Redis error, allow the request but log warning
    console.warn('[QuotaGuard] Redis error, allowing request:', error);
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetSeconds,
    };
  }
}

function consumeQuotaLocal(
  userId: string,
  limit: number,
  day: number,
  resetSeconds: number,
): QuotaResult {
  const existing = localWindows.get(userId);
  
  if (!existing || existing.day !== day) {
    localWindows.set(userId, { day, count: 1 });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetSeconds,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    limit,
    resetSeconds,
  };
}

/** Test-only helper. Do not call from production code. */
export function __resetQuotaForTests(): void {
  localWindows.clear();
}
