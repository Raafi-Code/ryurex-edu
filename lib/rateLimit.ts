/**
 * Rate Limiting Utility
 * Prevents API spam and excessive requests
 */

type RateLimitStore = Map<string, { count: number; resetTime: number }>;

// In-memory store for rate limiting (per-process)
// For production with multiple servers, use Redis instead
const requestStore: RateLimitStore = new Map();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

/**
 * Check if request should be rate limited
 * @param identifier - Unique identifier (userId, IP address, or combined)
 * @param config - Rate limit configuration
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 } // 10 requests per minute
) {
  const now = Date.now();
  const record = requestStore.get(identifier);

  // If no record or window expired, create new record
  if (!record || now > record.resetTime) {
    requestStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment counter
  record.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Get rate limit status for identifier
 */
export function getRateLimitStatus(identifier: string) {
  const record = requestStore.get(identifier);
  if (!record || Date.now() > record.resetTime) {
    return { count: 0, resetTime: null };
  }
  return { count: record.count, resetTime: record.resetTime };
}

/**
 * Reset rate limit for identifier
 */
export function resetRateLimit(identifier: string) {
  requestStore.delete(identifier);
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupExpiredLimiters() {
  const now = Date.now();
  for (const [key, record] of requestStore.entries()) {
    if (now > record.resetTime) {
      requestStore.delete(key);
    }
  }
}

// Cleanup expired entries every 5 minutes
if (typeof global !== 'undefined') {
  const globalWithCleanup = global as typeof global & { _rateLimitCleanupInterval?: NodeJS.Timeout };
  if (!globalWithCleanup._rateLimitCleanupInterval) {
    globalWithCleanup._rateLimitCleanupInterval = setInterval(cleanupExpiredLimiters, 5 * 60 * 1000);
  }
}

/**
 * Predefined rate limit configs
 */
export const RATE_LIMITS = {
  STRICT: { maxRequests: 3, windowMs: 60000 }, // 3 requests per minute
  NORMAL: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  LENIENT: { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
  GROQ_API: { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute for AI calls
};
