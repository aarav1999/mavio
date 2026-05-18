/**
 * Lightweight rate limiting for auth-sensitive routes.
 * Uses Upstash Redis in production, falls back to in-memory for local dev.
 */

import { Redis } from '@upstash/redis';

export interface RateLimitConfig {
  /** Max requests per window. Default: 10 */
  limit?: number;
  /** Window size in seconds. Default: 60 */
  windowSeconds?: number;
  /** Key prefix for Redis. Default: 'ratelimit:' */
  prefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_SECONDS = 60;

// In-memory fallback for local development
const localWindows = new Map<string, { count: number; resetAt: number }>();

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

/**
 * Check and consume rate limit for a given identifier (e.g., IP address).
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<RateLimitResult> {
  const limit = config.limit ?? DEFAULT_LIMIT;
  const windowSeconds = config.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const prefix = config.prefix ?? 'ratelimit:';
  
  const redisClient = getRedis();
  
  if (redisClient) {
    return checkRateLimitRedis(redisClient, identifier, limit, windowSeconds, prefix);
  }
  
  return checkRateLimitLocal(identifier, limit, windowSeconds, prefix);
}

async function checkRateLimitRedis(
  redis: Redis,
  identifier: string,
  limit: number,
  windowSeconds: number,
  prefix: string
): Promise<RateLimitResult> {
  const key = `${prefix}${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  
  try {
    const count = await redis.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    // Get TTL for reset time
    const ttl = await redis.ttl(key);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;
    
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
    // On Redis error, allow the request
    console.warn('[RateLimit] Redis error, allowing request:', error);
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetSeconds: windowSeconds,
    };
  }
}

function checkRateLimitLocal(
  identifier: string,
  limit: number,
  windowSeconds: number,
  prefix: string
): RateLimitResult {
  const key = `${prefix}${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  const existing = localWindows.get(key);
  
  // Window expired or doesn't exist
  if (!existing || now >= existing.resetAt) {
    localWindows.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetSeconds: windowSeconds,
    };
  }
  
  // Window still active
  const resetSeconds = Math.ceil((existing.resetAt - now) / 1000);
  
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

/**
 * Get client IP from request headers.
 * Handles Vercel/Cloudflare proxy headers.
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}
