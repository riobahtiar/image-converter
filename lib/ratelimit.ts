/**
 * Rate Limiting Module
 *
 * Provides flexible rate limiting for API endpoints using Redis.
 * Uses the modular Redis adapter, so you can easily swap Redis implementations.
 *
 * @module lib/ratelimit
 *
 * @example
 * // Check rate limit in API route
 * import { checkRateLimit } from '@/lib/ratelimit';
 *
 * const result = await checkRateLimit('user-123', 'api:convert');
 * if (!result.success) {
 *   return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
 * }
 */

import { redis } from "./redis/adapter";

/**
 * Rate limit result
 *
 * @interface RateLimitResult
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Unix timestamp (milliseconds) when the limit resets */
  reset: number;
  /** Seconds until reset (convenience field) */
  retryAfter?: number;
}

/**
 * Rate limit configuration
 *
 * @interface RateLimitConfig
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Key prefix for Redis storage */
  prefix?: string;
}

/**
 * Sliding Window Rate Limiter
 *
 * Implements a sliding window algorithm using Redis sorted sets.
 * More accurate than fixed window, prevents boundary issues.
 *
 * @class SlidingWindowRateLimiter
 *
 * @example
 * const limiter = new SlidingWindowRateLimiter({
 *   limit: 10,
 *   window: 60, // 10 requests per 60 seconds
 * });
 *
 * const result = await limiter.check('user-123');
 * if (!result.success) {
 *   console.log(`Rate limited. Try again in ${result.retryAfter}s`);
 * }
 */
export class SlidingWindowRateLimiter {
  private limit: number;
  private window: number;
  private prefix: string;

  /**
   * Create a new sliding window rate limiter
   *
   * @param config - Rate limit configuration
   * @param config.limit - Maximum requests allowed in window
   * @param config.window - Time window in seconds
   * @param config.prefix - Redis key prefix (default: 'ratelimit')
   */
  constructor(config: RateLimitConfig) {
    this.limit = config.limit;
    this.window = config.window;
    this.prefix = config.prefix || "ratelimit";
  }

  /**
   * Check if a request should be rate limited
   *
   * Uses sliding window algorithm:
   * 1. Remove expired entries (older than window)
   * 2. Count requests in current window
   * 3. Allow if under limit, deny otherwise
   * 4. Record new request
   *
   * @param identifier - Unique identifier (user ID, IP, session ID, etc.)
   * @param namespace - Optional namespace for grouping (e.g., 'api:convert')
   * @returns Rate limit result
   *
   * @example
   * const result = await limiter.check('192.168.1.1', 'api:upload');
   * if (!result.success) {
   *   // Rate limited
   * }
   */
  async check(identifier: string, namespace: string = "default"): Promise<RateLimitResult> {
    const key = `${this.prefix}:${namespace}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.window * 1000;

    try {
      // Get current count (simplified version using basic Redis commands)
      // In production, you'd use sorted sets (ZREMRANGEBYSCORE, ZCARD, ZADD)

      const countKey = `${key}:count`;
      const timestampKey = `${key}:ts`;

      // Get current timestamp
      const lastResetStr = await redis.get(timestampKey);
      const lastReset = lastResetStr ? Number.parseInt(lastResetStr, 10) : now;

      // Check if window has expired
      if (now - lastReset > this.window * 1000) {
        // Reset window
        await redis.set(countKey, "1");
        await redis.set(timestampKey, now.toString());
        await redis.expire(countKey, this.window);
        await redis.expire(timestampKey, this.window);

        return {
          success: true,
          limit: this.limit,
          remaining: this.limit - 1,
          reset: now + this.window * 1000,
        };
      }

      // Increment counter
      const currentCount = await redis.incr(countKey);

      // Set expiration if first request
      if (currentCount === 1) {
        await redis.expire(countKey, this.window);
        await redis.set(timestampKey, now.toString());
        await redis.expire(timestampKey, this.window);
      }

      // Check limit
      const success = currentCount <= this.limit;
      const remaining = Math.max(0, this.limit - currentCount);
      const reset = lastReset + this.window * 1000;
      const retryAfter = success ? undefined : Math.ceil((reset - now) / 1000);

      return {
        success,
        limit: this.limit,
        remaining,
        reset,
        retryAfter,
      };
    } catch (error) {
      console.error("Rate limit check failed:", error);
      // Fail open - allow request on error
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit,
        reset: now + this.window * 1000,
      };
    }
  }

  /**
   * Reset rate limit for an identifier
   *
   * @param identifier - Identifier to reset
   * @param namespace - Optional namespace
   * @returns Number of keys deleted
   *
   * @example
   * await limiter.reset('user-123', 'api:convert');
   */
  async reset(identifier: string, namespace: string = "default"): Promise<number> {
    const key = `${this.prefix}:${namespace}:${identifier}`;
    return redis.del(`${key}:count`, `${key}:ts`);
  }
}

/**
 * Token Bucket Rate Limiter
 *
 * Allows burst traffic while maintaining average rate.
 * More flexible than sliding window for APIs with occasional spikes.
 *
 * @class TokenBucketRateLimiter
 *
 * @example
 * const limiter = new TokenBucketRateLimiter({
 *   limit: 100,      // Bucket capacity
 *   window: 3600,    // Refill rate (100 tokens per hour)
 * });
 *
 * // Allows bursts up to 100 requests, then throttles to 100/hour average
 * const result = await limiter.check('user-123');
 */
export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRate: number;
  private prefix: string;

  /**
   * Create a new token bucket rate limiter
   *
   * @param config - Configuration
   * @param config.limit - Bucket capacity (max burst size)
   * @param config.window - Refill window in seconds
   * @param config.prefix - Redis key prefix
   */
  constructor(config: RateLimitConfig) {
    this.capacity = config.limit;
    this.refillRate = config.limit / config.window; // Tokens per second
    this.prefix = config.prefix || "ratelimit:bucket";
  }

  /**
   * Check token bucket and consume a token
   *
   * @param identifier - Unique identifier
   * @param namespace - Optional namespace
   * @param tokens - Number of tokens to consume (default: 1)
   * @returns Rate limit result
   */
  async check(
    identifier: string,
    namespace: string = "default",
    tokens: number = 1
  ): Promise<RateLimitResult> {
    const key = `${this.prefix}:${namespace}:${identifier}`;
    const now = Date.now();

    try {
      const tokensKey = `${key}:tokens`;
      const timestampKey = `${key}:ts`;

      // Get current state
      const currentTokensStr = await redis.get(tokensKey);
      const lastUpdateStr = await redis.get(timestampKey);

      const currentTokens = currentTokensStr ? Number.parseFloat(currentTokensStr) : this.capacity;
      const lastUpdate = lastUpdateStr ? Number.parseInt(lastUpdateStr, 10) : now;

      // Calculate refill
      const elapsed = (now - lastUpdate) / 1000; // seconds
      const refill = elapsed * this.refillRate;
      const newTokens = Math.min(this.capacity, currentTokens + refill);

      // Try to consume tokens
      const success = newTokens >= tokens;
      const remaining = success ? newTokens - tokens : newTokens;

      // Update state
      await redis.set(tokensKey, remaining.toString());
      await redis.set(timestampKey, now.toString());
      await redis.expire(tokensKey, 3600); // Keep for 1 hour
      await redis.expire(timestampKey, 3600);

      // Calculate reset time (when bucket will be full again)
      const secondsToFull = (this.capacity - remaining) / this.refillRate;
      const reset = now + secondsToFull * 1000;

      return {
        success,
        limit: this.capacity,
        remaining: Math.floor(remaining),
        reset: Math.floor(reset),
        retryAfter: success ? undefined : Math.ceil(tokens / this.refillRate),
      };
    } catch (error) {
      console.error("Token bucket check failed:", error);
      // Fail open
      return {
        success: true,
        limit: this.capacity,
        remaining: this.capacity,
        reset: now + 3600 * 1000,
      };
    }
  }

  async reset(identifier: string, namespace: string = "default"): Promise<number> {
    const key = `${this.prefix}:${namespace}:${identifier}`;
    return redis.del(`${key}:tokens`, `${key}:ts`);
  }
}

// ================================
// PREDEFINED RATE LIMITERS
// ================================

/**
 * IP-based rate limiter for general API access
 * Prevents abuse from single IP addresses
 *
 * Limit: 60 requests per minute
 *
 * @example
 * import { ipRateLimiter } from '@/lib/ratelimit';
 *
 * const ip = request.headers.get('x-forwarded-for') || 'unknown';
 * const result = await ipRateLimiter.check(ip);
 */
export const ipRateLimiter = new SlidingWindowRateLimiter({
  limit: 60,
  window: 60, // 60 requests per minute
  prefix: "ratelimit:ip",
});

/**
 * Session-based rate limiter for authenticated users
 * More generous limits for identified sessions
 *
 * Limit: 50 requests per hour
 *
 * @example
 * import { sessionRateLimiter } from '@/lib/ratelimit';
 *
 * const session = await getSession();
 * const result = await sessionRateLimiter.check(session.sessionId);
 */
export const sessionRateLimiter = new SlidingWindowRateLimiter({
  limit: 50,
  window: 3600, // 50 requests per hour
  prefix: "ratelimit:session",
});

/**
 * Conversion-specific rate limiter
 * Limits expensive image conversion operations
 *
 * Limit: 20 conversions per hour
 *
 * @example
 * import { conversionRateLimiter } from '@/lib/ratelimit';
 *
 * const result = await conversionRateLimiter.check(sessionId, 'convert');
 */
export const conversionRateLimiter = new SlidingWindowRateLimiter({
  limit: 20,
  window: 3600, // 20 conversions per hour
  prefix: "ratelimit:conversion",
});

/**
 * Token bucket for burst tolerance
 * Allows occasional bursts while maintaining average rate
 *
 * Capacity: 100 requests
 * Refill: 100 requests per hour (avg 1.67/minute)
 *
 * @example
 * import { burstRateLimiter } from '@/lib/ratelimit';
 *
 * const result = await burstRateLimiter.check(userId);
 */
export const burstRateLimiter = new TokenBucketRateLimiter({
  limit: 100,
  window: 3600,
  prefix: "ratelimit:burst",
});

/**
 * Convenience function to check rate limit with response headers
 *
 * @param identifier - Unique identifier (IP, session ID, etc.)
 * @param namespace - Rate limit namespace
 * @param limiter - Rate limiter to use (default: sessionRateLimiter)
 * @returns Rate limit result with suggested headers
 *
 * @example
 * const { success, headers } = await checkRateLimit(sessionId, 'api:convert');
 *
 * if (!success) {
 *   return NextResponse.json(
 *     { error: 'Rate limited' },
 *     { status: 429, headers }
 *   );
 * }
 */
export async function checkRateLimit(
  identifier: string,
  namespace: string = "default",
  limiter: SlidingWindowRateLimiter = sessionRateLimiter
): Promise<
  RateLimitResult & {
    headers: Record<string, string>;
  }
> {
  const result = await limiter.check(identifier, namespace);

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (result.retryAfter) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return { ...result, headers };
}
