/**
 * Rate Limiter for Firebase Operations
 * Prevents abuse and DOS attacks by limiting operation frequency
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
  message?: string;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
    this.configs.clear();
  }

  /**
   * Register a rate limit configuration for a specific operation
   */
  registerLimit(operation: string, config: RateLimitConfig): void {
    this.configs.set(operation, config);
  }

  /**
   * Check if an operation is allowed and update rate limit counters
   */
  checkLimit(
    operation: string,
    identifier: string = 'global'
  ): RateLimitResult {
    const key = `${operation}:${identifier}`;
    const config = this.configs.get(operation);

    if (!config) {
      // No rate limit configured, allow operation
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: Date.now() + 60000, // Default 1 minute window
      };
    }

    const now = Date.now();
    let entry = this.limits.get(key);

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime,
        retryAfter: entry.blockedUntil - now,
        message:
          config.message ||
          `Rate limit exceeded for ${operation}. Try again later.`,
      };
    }

    // Initialize or reset if window expired
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      this.limits.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      // Block if block duration is configured
      if (config.blockDurationMs) {
        entry.blockedUntil = now + config.blockDurationMs;
        this.limits.set(key, entry);
      }

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime,
        retryAfter: config.blockDurationMs
          ? config.blockDurationMs
          : entry.resetTime - now,
        message:
          config.message ||
          `Rate limit exceeded for ${operation}. Try again later.`,
      };
    }

    // Increment counter and allow operation
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remainingRequests: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Get current rate limit status without incrementing counter
   */
  getStatus(operation: string, identifier: string = 'global'): RateLimitResult {
    const key = `${operation}:${identifier}`;
    const config = this.configs.get(operation);

    if (!config) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: Date.now() + 60000,
      };
    }

    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry) {
      return {
        allowed: true,
        remainingRequests: config.maxRequests,
        resetTime: now + config.windowMs,
      };
    }

    // Check if blocked
    if (entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime,
        retryAfter: entry.blockedUntil - now,
        message:
          config.message ||
          `Rate limit exceeded for ${operation}. Try again later.`,
      };
    }

    // Check if window expired
    if (entry.resetTime <= now) {
      return {
        allowed: true,
        remainingRequests: config.maxRequests,
        resetTime: now + config.windowMs,
      };
    }

    const remaining = Math.max(0, config.maxRequests - entry.count);
    return {
      allowed: remaining > 0,
      remainingRequests: remaining,
      resetTime: entry.resetTime,
      message:
        remaining === 0
          ? config.message ||
            `Rate limit exceeded for ${operation}. Try again later.`
          : undefined,
    };
  }

  /**
   * Reset rate limit for a specific operation and identifier
   */
  reset(operation: string, identifier: string = 'global'): void {
    const key = `${operation}:${identifier}`;
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.limits.entries());
    for (const [key, entry] of entries) {
      // Remove if window expired and not currently blocked
      if (
        entry.resetTime <= now &&
        (!entry.blockedUntil || entry.blockedUntil <= now)
      ) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get all current rate limit statuses (for debugging)
   */
  getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    const entries = Array.from(this.limits.entries());
    for (const [key, entry] of entries) {
      statuses[key] = {
        count: entry.count,
        resetTime: new Date(entry.resetTime).toISOString(),
        blockedUntil: entry.blockedUntil
          ? new Date(entry.blockedUntil).toISOString()
          : undefined,
      };
    }
    return statuses;
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Configure rate limits for different Firebase operations
rateLimiter.registerLimit('auth:login', {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 30 minut.',
});

rateLimiter.registerLimit('auth:signup', {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours block
  message: 'Zbyt wiele prób rejestracji. Spróbuj ponownie za 2 godziny.',
});

rateLimiter.registerLimit('auth:password-reset', {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000, // 1 hour block
  message: 'Zbyt wiele prób resetowania hasła. Spróbuj ponownie za godzinę.',
});

rateLimiter.registerLimit('firestore:write', {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele operacji zapisu. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('firestore:read', {
  maxRequests: 200,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele operacji odczytu. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('firestore:query', {
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele zapytań do bazy danych. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('receipt:create', {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele tworzonych kwitów. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('receipt:update', {
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele aktualizacji kwitów. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('client:create', {
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele tworzonych klientów. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('product:create', {
  maxRequests: 50,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele tworzonych produktów. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('sync:operation', {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele operacji synchronizacji. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('export:data', {
  maxRequests: 5,
  windowMs: 5 * 60 * 1000, // 5 minutes
  message: 'Zbyt wiele operacji eksportu. Spróbuj ponownie za 5 minut.',
});

rateLimiter.registerLimit('pdf:generate', {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele generowanych PDF. Spróbuj ponownie za chwilę.',
});

export type { RateLimitResult };
export { rateLimiter };
export default rateLimiter;
