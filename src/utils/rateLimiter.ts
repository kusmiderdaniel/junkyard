/**
 * Robust Rate Limiter for Firebase Operations
 * Prevents abuse and DOS attacks with multiple anti-bypass mechanisms
 */

import { logger } from './logger';
import { encryptData, decryptData, isEncryptionAvailable } from './encryption';
import {
  SessionMarker,
  RateLimiterStatuses,
  RateLimitStatus,
  isErrorWithMessage,
} from '../types/common';

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
  deviceFingerprint?: string;
  ipHash?: string;
  persistedAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
  message?: string;
}

// Storage keys for persistent rate limiting
const STORAGE_KEYS = {
  RATE_LIMITS: 'rl_limits',
  DEVICE_FP: 'rl_device_fp',
  SESSION_MARKERS: 'rl_session_markers',
} as const;

class RobustRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private persistInterval: NodeJS.Timeout | null = null;
  private deviceFingerprint: string = '';
  private sessionMarkers: Set<string> = new Set();
  private isDestroyed: boolean = false;
  private boundBeforeUnloadHandler: () => void;
  private boundPageHideHandler: () => void;
  private boundVisibilityChangeHandler: () => void;

  constructor() {
    this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    this.boundPageHideHandler = this.handlePageHide.bind(this);
    this.boundVisibilityChangeHandler = this.handleVisibilityChange.bind(this);

    this.initializeDeviceFingerprint();
    this.loadPersistedLimits();
    this.initializeSessionTracking();
    this.setupBrowserEventListeners();
    this.startIntervals();
  }

  /**
   * Setup browser event listeners for cleanup
   */
  private setupBrowserEventListeners(): void {
    try {
      // Handle browser close/refresh
      window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);

      // Handle mobile browsers and back/forward navigation
      window.addEventListener('pagehide', this.boundPageHideHandler);

      // Handle tab visibility changes
      document.addEventListener(
        'visibilitychange',
        this.boundVisibilityChangeHandler
      );

      logger.debug('Browser event listeners setup', undefined, {
        component: 'RobustRateLimiter',
        operation: 'setupBrowserEventListeners',
      });
    } catch (error) {
      logger.warn(
        'Failed to setup browser event listeners',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'setupBrowserEventListeners',
        }
      );
    }
  }

  /**
   * Start the cleanup and persistence intervals
   */
  private startIntervals(): void {
    // Clean up expired entries every 2 minutes
    this.cleanupInterval = setInterval(
      () => {
        if (!this.isDestroyed) {
          this.cleanup();
        }
      },
      2 * 60 * 1000
    );

    // Persist limits every 30 seconds to handle sudden browser closes
    this.persistInterval = setInterval(() => {
      if (!this.isDestroyed) {
        this.persistLimits();
      }
    }, 30 * 1000);

    logger.debug('Rate limiter intervals started', undefined, {
      component: 'RobustRateLimiter',
      operation: 'startIntervals',
    });
  }

  /**
   * Handle browser beforeunload event
   */
  private handleBeforeUnload(): void {
    this.performFinalCleanup();
  }

  /**
   * Handle page hide event (mobile browsers)
   */
  private handlePageHide(): void {
    this.performFinalCleanup();
  }

  /**
   * Handle visibility change event
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, persist current state
      this.persistLimits();
    }
  }

  /**
   * Perform final cleanup before page unload
   */
  private performFinalCleanup(): void {
    if (!this.isDestroyed) {
      logger.debug('Performing final cleanup before page unload', undefined, {
        component: 'RobustRateLimiter',
        operation: 'performFinalCleanup',
      });

      // Persist current state synchronously
      try {
        const data: Record<string, RateLimitEntry> = {};
        const now = Date.now();

        this.limits.forEach((entry, key) => {
          if (
            entry.resetTime > now ||
            (entry.blockedUntil && entry.blockedUntil > now)
          ) {
            data[key] = {
              ...entry,
              deviceFingerprint: this.deviceFingerprint,
              persistedAt: now,
            };
          }
        });

        // Use synchronous storage for final cleanup
        if (Object.keys(data).length > 0) {
          localStorage.setItem(STORAGE_KEYS.RATE_LIMITS, JSON.stringify(data));
        }
      } catch (error) {
        logger.warn(
          'Failed to perform final cleanup',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'RobustRateLimiter',
            operation: 'performFinalCleanup',
          }
        );
      }
    }
  }

  /**
   * Generate a device fingerprint for tracking across sessions
   */
  private initializeDeviceFingerprint(): void {
    try {
      // Try to load existing fingerprint
      const stored = localStorage.getItem(STORAGE_KEYS.DEVICE_FP);
      if (stored) {
        this.deviceFingerprint = stored;
        return;
      }

      // Generate new fingerprint based on browser characteristics
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
      }

      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        window.screen.width + 'x' + window.screen.height,
        window.screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.hardwareConcurrency || 0,
        navigator.maxTouchPoints || 0,
      ].join('|');

      // Create hash of fingerprint
      this.deviceFingerprint = this.simpleHash(fingerprint);
      localStorage.setItem(STORAGE_KEYS.DEVICE_FP, this.deviceFingerprint);

      logger.debug('Device fingerprint generated', undefined, {
        component: 'RobustRateLimiter',
        operation: 'initializeDeviceFingerprint',
      });
    } catch (error) {
      // Fallback fingerprint
      this.deviceFingerprint = 'fallback_' + Date.now() + Math.random();
      logger.warn(
        'Failed to generate device fingerprint, using fallback',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'initializeDeviceFingerprint',
        }
      );
    }
  }

  /**
   * Track new sessions to detect suspicious patterns (e.g., clearing localStorage to bypass limits)
   */
  private initializeSessionTracking(): void {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Skipping session tracking in development mode', undefined, {
        component: 'RobustRateLimiter',
        operation: 'initializeSessionTracking',
      });
      return;
    }

    try {
      const sessionId =
        'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      this.sessionMarkers.add(sessionId);

      // Check for suspicious session patterns
      const markers = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.SESSION_MARKERS) || '[]'
      );
      const recentMarkers = markers.filter(
        (m: SessionMarker) => Date.now() - m.timestamp < 60 * 60 * 1000
      ); // 1 hour

      if (recentMarkers.length > 10) {
        logger.warn('Suspicious session pattern detected', undefined, {
          component: 'RobustRateLimiter',
          operation: 'initializeSessionTracking',
          extra: { recentSessions: recentMarkers.length },
        });
      }

      // Add current session
      recentMarkers.push({ id: sessionId, timestamp: Date.now() });
      localStorage.setItem(
        STORAGE_KEYS.SESSION_MARKERS,
        JSON.stringify(recentMarkers)
      );
    } catch (error) {
      logger.warn(
        'Failed to initialize session tracking',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'initializeSessionTracking',
        }
      );
    }
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Load persisted rate limits from encrypted storage
   */
  private async loadPersistedLimits(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RATE_LIMITS);
      if (!stored) return;

      let data: Record<string, RateLimitEntry> | null;

      if (isEncryptionAvailable()) {
        // Try to decrypt with device fingerprint as key
        data = await decryptData(stored, this.deviceFingerprint);
      } else {
        // Fallback to plain JSON (less secure but still functional)
        data = JSON.parse(stored);
      }

      if (data && typeof data === 'object') {
        const now = Date.now();
        Object.entries(data).forEach(([key, entry]) => {
          // Only restore if not expired and fingerprint matches
          if (
            entry.resetTime > now &&
            (!entry.deviceFingerprint ||
              entry.deviceFingerprint === this.deviceFingerprint)
          ) {
            this.limits.set(key, entry);
          }
        });

        logger.debug('Loaded persisted rate limits', undefined, {
          component: 'RobustRateLimiter',
          operation: 'loadPersistedLimits',
          extra: { restoredCount: this.limits.size },
        });
      }
    } catch (error) {
      logger.warn(
        'Failed to load persisted rate limits',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'loadPersistedLimits',
        }
      );
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEYS.RATE_LIMITS);
    }
  }

  /**
   * Persist current rate limits to encrypted storage
   */
  private async persistLimits(): Promise<void> {
    if (this.isDestroyed) return;

    try {
      const data: Record<string, RateLimitEntry> = {};
      const now = Date.now();

      // Only persist non-expired entries
      this.limits.forEach((entry, key) => {
        if (
          entry.resetTime > now ||
          (entry.blockedUntil && entry.blockedUntil > now)
        ) {
          data[key] = {
            ...entry,
            deviceFingerprint: this.deviceFingerprint,
            persistedAt: now,
          };
        }
      });

      let serialized: string;

      if (isEncryptionAvailable()) {
        // Encrypt with device fingerprint as key
        serialized = await encryptData(data, this.deviceFingerprint);
      } else {
        // Fallback to plain JSON
        serialized = JSON.stringify(data);
      }

      localStorage.setItem(STORAGE_KEYS.RATE_LIMITS, serialized);
    } catch (error) {
      logger.warn(
        'Failed to persist rate limits',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'persistLimits',
        }
      );
    }
  }

  /**
   * Destroy the rate limiter and clean up all resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    logger.info('Destroying rate limiter', {
      component: 'RobustRateLimiter',
      operation: 'destroy',
    });

    this.isDestroyed = true;

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }

    // Remove event listeners
    try {
      window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
      window.removeEventListener('pagehide', this.boundPageHideHandler);
      document.removeEventListener(
        'visibilitychange',
        this.boundVisibilityChangeHandler
      );
    } catch (error) {
      logger.warn(
        'Failed to remove event listeners',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'destroy',
        }
      );
    }

    // Final persist before cleanup
    this.performFinalCleanup();

    // Clear data structures
    this.limits.clear();
    this.configs.clear();
    this.sessionMarkers.clear();
  }

  /**
   * Check if the rate limiter has been destroyed
   */
  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * Register a rate limit configuration for a specific operation
   */
  registerLimit(operation: string, config: RateLimitConfig): void {
    if (this.isDestroyed) {
      logger.warn(
        'Attempted to register limit on destroyed rate limiter',
        undefined,
        {
          component: 'RobustRateLimiter',
          operation: 'registerLimit',
          extra: { operation },
        }
      );
      return;
    }
    this.configs.set(operation, config);
  }

  /**
   * Check if an operation is allowed and update rate limit counters
   */
  checkLimit(
    operation: string,
    identifier: string = 'global'
  ): RateLimitResult {
    if (this.isDestroyed) {
      // If destroyed, allow all operations (graceful degradation)
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: Date.now() + 60000,
      };
    }

    // Create composite key with device fingerprint for better tracking
    const key = `${operation}:${identifier}:${this.deviceFingerprint}`;
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
      logger.warn('Rate limit block active', undefined, {
        component: 'RobustRateLimiter',
        operation: 'checkLimit',
        extra: {
          operation,
          identifier,
          blockedUntil: new Date(entry.blockedUntil).toISOString(),
        },
      });

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
        deviceFingerprint: this.deviceFingerprint,
        persistedAt: now,
      };
      this.limits.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      logger.warn('Rate limit exceeded', undefined, {
        component: 'RobustRateLimiter',
        operation: 'checkLimit',
        extra: {
          operation,
          identifier,
          count: entry.count,
          maxRequests: config.maxRequests,
        },
      });

      // Block if block duration is configured
      if (config.blockDurationMs) {
        entry.blockedUntil = now + config.blockDurationMs;
        this.limits.set(key, entry);
        this.persistLimits(); // Immediately persist block
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
    entry.persistedAt = now;
    this.limits.set(key, entry);

    // Persist immediately for high-frequency operations
    if (entry.count % 5 === 0) {
      this.persistLimits();
    }

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
    if (this.isDestroyed) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: Date.now() + 60000,
      };
    }

    const key = `${operation}:${identifier}:${this.deviceFingerprint}`;
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
    if (this.isDestroyed) return;

    const key = `${operation}:${identifier}:${this.deviceFingerprint}`;
    this.limits.delete(key);
    this.persistLimits();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    if (this.isDestroyed) return;

    const now = Date.now();
    const initialSize = this.limits.size;
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

    if (this.limits.size !== initialSize) {
      logger.debug('Rate limiter cleanup completed', undefined, {
        component: 'RobustRateLimiter',
        operation: 'cleanup',
        extra: {
          removed: initialSize - this.limits.size,
          remaining: this.limits.size,
        },
      });
      this.persistLimits();
    }
  }

  /**
   * Get all current rate limit statuses (for debugging)
   */
  getAllStatuses(): RateLimiterStatuses {
    if (this.isDestroyed) {
      return {
        destroyed: true,
        statuses: {},
        deviceFingerprint: '',
        totalLimits: 0,
        sessionMarkers: 0,
      };
    }

    const statuses: Record<string, RateLimitStatus> = {};
    const entries = Array.from(this.limits.entries());
    for (const [key, entry] of entries) {
      statuses[key] = {
        count: entry.count,
        resetTime: new Date(entry.resetTime).toISOString(),
        blockedUntil: entry.blockedUntil
          ? new Date(entry.blockedUntil).toISOString()
          : undefined,
        deviceFingerprint: entry.deviceFingerprint?.substring(0, 8) + '...',
        persistedAt: new Date(entry.persistedAt).toISOString(),
      };
    }
    return {
      statuses,
      deviceFingerprint: this.deviceFingerprint.substring(0, 8) + '...',
      totalLimits: this.limits.size,
      sessionMarkers: this.sessionMarkers.size,
      destroyed: false,
    };
  }

  /**
   * Force cleanup of all rate limit data (admin function)
   */
  clearAllLimits(): void {
    if (this.isDestroyed) return;

    this.limits.clear();
    localStorage.removeItem(STORAGE_KEYS.RATE_LIMITS);
    localStorage.removeItem(STORAGE_KEYS.SESSION_MARKERS);

    logger.info('All rate limits cleared', {
      component: 'RobustRateLimiter',
      operation: 'clearAllLimits',
    });
  }
}

// Create singleton instance with automatic cleanup
const rateLimiter = new RobustRateLimiter();

// Setup process exit handlers for Node.js environments (if applicable)
if (typeof process !== 'undefined' && process.on) {
  process.on('exit', () => {
    rateLimiter.destroy();
  });

  process.on('SIGINT', () => {
    rateLimiter.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    rateLimiter.destroy();
    process.exit(0);
  });
}

// Expose destroy method for manual cleanup
(window as any).__rateLimiterDestroy = () => {
  rateLimiter.destroy();
};

// Configure rate limits for different Firebase operations with balanced security
rateLimiter.registerLimit('auth:login', {
  maxRequests: 10, // Increased from 5 for better UX
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 15 * 60 * 1000, // 15 minutes block (reduced from 30)
  message: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.',
});

rateLimiter.registerLimit('auth:signup', {
  maxRequests: 5, // Increased from 2 for better UX
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours block (reduced from 4)
  message: 'Zbyt wiele prób rejestracji. Spróbuj ponownie za 2 godziny.',
});

rateLimiter.registerLimit('auth:password-reset', {
  maxRequests: 5, // Increased from 2 for better UX
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000, // 1 hour block (reduced from 2)
  message: 'Zbyt wiele prób resetowania hasła. Spróbuj ponownie za godzinę.',
});

rateLimiter.registerLimit('firestore:write', {
  maxRequests: 100, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 3 * 60 * 1000, // 3 minutes block (reduced from 5)
  message: 'Zbyt wiele operacji zapisu. Spróbuj ponownie za 3 minuty.',
});

rateLimiter.registerLimit('firestore:read', {
  maxRequests: 200, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  message: 'Zbyt wiele operacji odczytu. Spróbuj ponownie za chwilę.',
});

rateLimiter.registerLimit('firestore:query', {
  maxRequests: 50, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 90 * 1000, // 1.5 minutes block (reduced from 2)
  message: 'Zbyt wiele zapytań do bazy danych. Spróbuj ponownie za 90 sekund.',
});

rateLimiter.registerLimit('receipt:create', {
  maxRequests: 30, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 2 * 60 * 1000, // 2 minutes block (reduced from 3)
  message: 'Zbyt wiele tworzonych kwitów. Spróbuj ponownie za 2 minuty.',
});

rateLimiter.registerLimit('receipt:update', {
  maxRequests: 50, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 90 * 1000, // 1.5 minutes block (reduced from 2)
  message: 'Zbyt wiele aktualizacji kwitów. Spróbuj ponownie za 90 sekund.',
});

rateLimiter.registerLimit('client:create', {
  maxRequests: 25, // Increased from 15 for better UX
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 3 * 60 * 1000, // 3 minutes block (reduced from 5)
  message: 'Zbyt wiele tworzonych klientów. Spróbuj ponownie za 3 minuty.',
});

rateLimiter.registerLimit('product:create', {
  maxRequests: 50, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 2 * 60 * 1000, // 2 minutes block (reduced from 3)
  message: 'Zbyt wiele tworzonych produktów. Spróbuj ponownie za 2 minuty.',
});

rateLimiter.registerLimit('sync:operation', {
  maxRequests: 15, // Increased from 5 for better UX
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 5 * 60 * 1000, // 5 minutes block (reduced from 10)
  message: 'Zbyt wiele operacji synchronizacji. Spróbuj ponownie za 5 minut.',
});

rateLimiter.registerLimit('export:data', {
  maxRequests: 10, // Increased from 3 for better UX
  windowMs: 5 * 60 * 1000, // 5 minutes
  blockDurationMs: 5 * 60 * 1000, // 5 minutes block (reduced from 15)
  message: 'Zbyt wiele operacji eksportu. Spróbuj ponownie za 5 minut.',
});

rateLimiter.registerLimit('pdf:generate', {
  maxRequests: 30, // Restored to reasonable level
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 2 * 60 * 1000, // 2 minutes block (reduced from 3)
  message: 'Zbyt wiele generowanych PDF. Spróbuj ponownie za 2 minuty.',
});

export type { RateLimitResult };
export { rateLimiter };
export default rateLimiter;
