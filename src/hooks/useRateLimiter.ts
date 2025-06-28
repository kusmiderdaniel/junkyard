/**
 * React hooks for rate limiter integration
 * Provides type-safe rate limiter functionality with proper resource management
 */

import { useCallback, useEffect, useRef } from 'react';
import { rateLimiter, RateLimitResult } from '../utils/rateLimiter';
import { RateLimiterStatuses } from '../types/common';
import { logger } from '../utils/logger';

interface UseRateLimiterReturn {
  checkLimit: (operation: string, identifier?: string) => RateLimitResult;
  getStatus: (operation: string, identifier?: string) => RateLimitResult;
  reset: (operation: string, identifier?: string) => void;
  getAllStatuses: () => RateLimiterStatuses;
  isDestroyed: boolean;
}

/**
 * Hook for safe rate limiter usage in React components
 */
export const useRateLimiter = (): UseRateLimiterReturn => {
  const componentMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
    };
  }, []);

  const checkLimit = useCallback(
    (operation: string, identifier?: string): RateLimitResult => {
      if (!componentMountedRef.current) {
        // Component unmounted, return graceful response
        return {
          allowed: true,
          remainingRequests: Infinity,
          resetTime: Date.now() + 60000,
        };
      }

      try {
        return rateLimiter.checkLimit(operation, identifier);
      } catch (error) {
        logger.error(
          'Rate limiter check failed',
          error instanceof Error ? error : undefined,
          {
            component: 'useRateLimiter',
            operation: 'checkLimit',
            extra: { operationType: operation, identifier },
          }
        );

        // Return permissive result on error
        return {
          allowed: true,
          remainingRequests: Infinity,
          resetTime: Date.now() + 60000,
        };
      }
    },
    []
  );

  const getStatus = useCallback(
    (operation: string, identifier?: string): RateLimitResult => {
      if (!componentMountedRef.current) {
        return {
          allowed: true,
          remainingRequests: Infinity,
          resetTime: Date.now() + 60000,
        };
      }

      try {
        return rateLimiter.getStatus(operation, identifier);
      } catch (error) {
        logger.error(
          'Rate limiter status check failed',
          error instanceof Error ? error : undefined,
          {
            component: 'useRateLimiter',
            operation: 'getStatus',
            extra: { operationType: operation, identifier },
          }
        );

        return {
          allowed: true,
          remainingRequests: Infinity,
          resetTime: Date.now() + 60000,
        };
      }
    },
    []
  );

  const reset = useCallback((operation: string, identifier?: string): void => {
    if (!componentMountedRef.current) {
      return;
    }

    try {
      rateLimiter.reset(operation, identifier);
    } catch (error) {
      logger.error(
        'Rate limiter reset failed',
        error instanceof Error ? error : undefined,
        {
          component: 'useRateLimiter',
          operation: 'reset',
          extra: { operationType: operation, identifier },
        }
      );
    }
  }, []);

  const getAllStatuses = useCallback((): RateLimiterStatuses => {
    if (!componentMountedRef.current) {
      return {
        statuses: {},
        deviceFingerprint: '',
        totalLimits: 0,
        sessionMarkers: 0,
        destroyed: true,
      };
    }

    try {
      return rateLimiter.getAllStatuses();
    } catch (error) {
      logger.error(
        'Rate limiter status retrieval failed',
        error instanceof Error ? error : undefined,
        {
          component: 'useRateLimiter',
          operation: 'getAllStatuses',
        }
      );

      return {
        statuses: {},
        deviceFingerprint: '',
        totalLimits: 0,
        sessionMarkers: 0,
        destroyed: false,
        error: true,
      };
    }
  }, []);

  const isDestroyed = rateLimiter.getIsDestroyed();

  return {
    checkLimit,
    getStatus,
    reset,
    getAllStatuses,
    isDestroyed,
  };
};

/**
 * Hook for component-specific rate limiter cleanup
 */
export const useRateLimiterCleanup = (operations: string[]): void => {
  useEffect(() => {
    return () => {
      // Clean up component-specific rate limits on unmount
      operations.forEach(operation => {
        try {
          rateLimiter.reset(operation);
        } catch (error) {
          logger.debug('Failed to cleanup rate limit on unmount', undefined, {
            component: 'useRateLimiterCleanup',
            operation: 'cleanup',
            extra: { operationType: operation },
          });
        }
      });
    };
  }, [operations]);
};

/**
 * Development-only hook for rate limiter debugging
 */
export const useRateLimiterDebug = (
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  const { getAllStatuses } = useRateLimiter();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const statuses = getAllStatuses();
      logger.debug('Rate limiter status debug', statuses, {
        component: 'useRateLimiterDebug',
        operation: 'debug',
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [enabled, getAllStatuses]);
};

/**
 * Hook for monitoring rate limiter activity in long-running components
 */
export const useRateLimiterMonitor = (
  onLimitExceeded?: (operation: string) => void,
  onLimitReset?: (operation: string) => void
) => {
  const { getAllStatuses } = useRateLimiter();
  const lastStatusesRef = useRef<RateLimiterStatuses | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatuses = getAllStatuses();
      const lastStatuses = lastStatusesRef.current;

      if (lastStatuses && onLimitExceeded) {
        // Check for new limits exceeded
        Object.entries(currentStatuses.statuses).forEach(([key, status]) => {
          const lastStatus = lastStatuses.statuses[key];
          if (!lastStatus?.blockedUntil && status.blockedUntil) {
            onLimitExceeded(key);
          }
        });
      }

      if (lastStatuses && onLimitReset) {
        // Check for limits that have been reset
        Object.entries(lastStatuses.statuses).forEach(([key, status]) => {
          const currentStatus = currentStatuses.statuses[key];
          if (status.blockedUntil && !currentStatus?.blockedUntil) {
            onLimitReset(key);
          }
        });
      }

      lastStatusesRef.current = currentStatuses;
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [getAllStatuses, onLimitExceeded, onLimitReset]);
};
