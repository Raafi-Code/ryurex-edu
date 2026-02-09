/**
 * Security utilities for safe logging and data handling
 */

/**
 * Safe logger that doesn't expose user PII
 * Use this instead of console.log for sensitive operations
 */
export const secureLog = {
  success: (message: string, context?: Record<string, unknown>) => {
    const safe = sanitizeContext(context);
    console.log(`✅ ${message}`, safe?.length ? safe : '');
  },
  
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const safe = sanitizeContext(context);
    console.error(`❌ ${message}`, error instanceof Error ? error.message : error, safe?.length ? safe : '');
  },
  
  warn: (message: string, context?: Record<string, unknown>) => {
    const safe = sanitizeContext(context);
    console.warn(`⚠️ ${message}`, safe?.length ? safe : '');
  },
  
  info: (message: string, context?: Record<string, unknown>) => {
    const safe = sanitizeContext(context);
    console.info(`ℹ️ ${message}`, safe?.length ? safe : '');
  },
};

/**
 * Remove sensitive fields from context before logging
 */
function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | null {
  if (!context) return null;
  
  // List of sensitive fields to exclude
  const sensitiveFields = [
    'user_id',
    'userId',
    'id',
    'email',
    'password',
    'token',
    'apiKey',
    'secret',
    'key',
    'auth',
    'session',
    'credential',
    'accessToken',
    'refreshToken',
    'apiSecret',
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(context)) {
    if (!sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = value;
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Hash user ID for logging purposes (anonymized)
 * Safe to log the result - cannot be reversed to get original ID
 */
export async function hashUserId(userId: string): Promise<string> {
  // Simple string hash for logging (not cryptographic secure, for display only)
  const hash = Array.from(userId)
    .reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    .toString(36);
  return `[USER_${hash.slice(-8)}]`;
}

/**
 * Rate limit key generator that doesn't expose user ID
 * Returns a hashed/anonymized key
 */
export function generateRateLimitKey(userId: string, operation: string): string {
  // Hash the user ID for the rate limit key
  const hash = userId
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    .toString(36);
  
  return `${operation}-${hash}`;
}

/**
 * Validate and sanitize user input
 */
export function sanitizeUserInput(input: unknown, maxLength: number = 100): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  return sanitized;
}

/**
 * Check if a URL is from an allowed origin
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    // Add production domain here
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);
  
  return allowedOrigins.includes(origin);
}

/**
 * Safe CORS headers
 */
export function getCorsHeaders(requestOrigin: string | null) {
  const allowed = isAllowedOrigin(requestOrigin);
  
  return {
    'Access-Control-Allow-Origin': allowed ? requestOrigin || 'http://localhost:3000' : 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
