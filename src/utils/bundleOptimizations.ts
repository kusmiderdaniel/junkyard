/**
 * Bundle Optimization Utilities
 * Helps with reducing initial bundle size through smart lazy loading
 */

import { logger } from './logger';
import { isErrorWithMessage } from '../types/common';
// Utility to preload critical chunks when the user is likely to need them
export const preloadCriticalChunks = (): void => {
  // Only preload in production and when the browser is idle
  if (
    process.env.NODE_ENV === 'production' &&
    'requestIdleCallback' in window
  ) {
    (window as any).requestIdleCallback(() => {
      // Preload ExcelJS for export functionality
      import('../utils/excelExport').catch(() => {
        // Silently fail if module can't be loaded
      });

      // Preload encryption utilities for offline features
      import('../utils/encryption').catch(() => {
        // Silently fail if module can't be loaded
      });

      // Preload critical route chunks
      const criticalRoutes = [
        () => import('../pages/Dashboard'),
        () => import('../pages/AddReceipt'),
        () => import('../pages/Receipts'),
      ];

      criticalRoutes.forEach(importFn => {
        importFn().catch(error => {
          logger.warn(
            'Dynamic import failed',
            isErrorWithMessage(error) ? error : undefined,
            {
              component: 'BundleOptimizations',
              operation: 'preloadCriticalChunks',
            }
          );
        });
      });
    });
  }
};

// Dynamic import wrapper with error handling
export const dynamicImport = async <T>(
  importFn: () => Promise<T>,
  fallback?: () => T
): Promise<T> => {
  try {
    return await importFn();
  } catch (error) {
    logger.warn(
      'Dynamic import failed',
      isErrorWithMessage(error) ? error : undefined,
      {
        component: 'BundleOptimizations',
        operation: 'dynamicImport',
      }
    );
    if (fallback) {
      return fallback();
    }
    throw error;
  }
};

// Lazy load heavy libraries only when needed
export const loadExcelUtility = () =>
  dynamicImport(() => import('../utils/excelExport'));

export const loadEncryptionUtility = () =>
  dynamicImport(() => import('../utils/encryption'));

export const loadInputSanitizer = () =>
  dynamicImport(() => import('../utils/inputSanitizer'));

// Bundle size monitor (development only)
export const logBundleMetrics = (): void => {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const navigationEntries = performance.getEntriesByType(
      'navigation'
    ) as PerformanceNavigationTiming[];
    const resourceEntries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[];

    if (navigationEntries.length > 0) {
      const nav = navigationEntries[0];

      logger.debug('Navigation Performance Metrics', undefined, {
        component: 'BundleOptimizations',
        operation: 'logBundleMetrics',
        extra: {
          domContentLoaded: `${Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart)}ms`,
          loadComplete: `${Math.round(nav.loadEventEnd - nav.loadEventStart)}ms`,
          firstPaint: nav.responseEnd - nav.fetchStart,
          transferSize: nav.transferSize,
        },
      });
    }

    // Log largest resources
    const largeResources = resourceEntries
      .filter(entry => entry.transferSize > 10000) // > 10KB
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 5);

    if (largeResources.length > 0) {
      logger.debug('Large Resources', undefined, {
        component: 'BundleOptimizations',
        operation: 'logBundleMetrics',
        extra: {
          resources: largeResources.map(r => ({
            name: r.name.split('/').pop(),
            size: `${Math.round(r.transferSize / 1024)}KB`,
            duration: `${Math.round(r.duration)}ms`,
          })),
        },
      });
    }

    // Log core web vitals if available
    if ('getEntriesByName' in performance) {
      setTimeout(() => {
        const paintEntries = performance.getEntriesByType('paint');
        const navigationEntry = navigationEntries[0];

        logger.debug('Core Web Vitals', undefined, {
          component: 'BundleOptimizations',
          operation: 'logBundleMetrics',
          extra: {
            fcp: paintEntries.find(
              entry => entry.name === 'first-contentful-paint'
            )?.startTime,
            lcp: 'Need LCP observer',
            ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
          },
        });
      }, 1000);
    }
  }
};

// Optimize resource loading
export const optimizeResourceLoading = (): void => {
  // Prefetch DNS for external resources
  const prefetchDomains = ['fonts.googleapis.com', 'fonts.gstatic.com'];

  prefetchDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${domain}`;
    document.head.appendChild(link);
  });
};

// Critical resource hints
export const addResourceHints = () => {
  // Only in production
  if (process.env.NODE_ENV === 'production') {
    // Prefetch likely-to-be-needed resources
    const prefetchResources = [
      '/static/js/exceljs.chunk.js', // If ExcelJS gets its own chunk
      '/static/js/encryption.chunk.js', // If encryption gets its own chunk
    ];

    prefetchResources.forEach(href => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    });
  }
};
