/**
 * Bundle Optimization Utilities
 * Helps with reducing initial bundle size through smart lazy loading
 */

// Utility to preload critical chunks when the user is likely to need them
export const preloadCriticalChunks = () => {
  // Only preload in production and when the browser is idle
  if (
    process.env.NODE_ENV === 'production' &&
    'requestIdleCallback' in window
  ) {
    window.requestIdleCallback(() => {
      // Preload ExcelJS for export functionality
      import('../utils/excelExport').catch(() => {
        // Silently fail if module can't be loaded
      });

      // Preload encryption utilities for offline features
      import('../utils/encryption').catch(() => {
        // Silently fail if module can't be loaded
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
    if (process.env.NODE_ENV === 'development') {
      console.warn('Dynamic import failed:', error);
    }
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
export const logBundleMetrics = () => {
  if (process.env.NODE_ENV === 'development') {
    // Track performance metrics
    setTimeout(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        console.groupCollapsed('📊 Bundle Performance Metrics');
        console.log(
          'DOM Content Loaded:',
          `${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`
        );
        console.log(
          'Load Complete:',
          `${navigation.loadEventEnd - navigation.loadEventStart}ms`
        );
        console.log(
          'First Paint:',
          performance.getEntriesByName('first-paint')[0]?.startTime || 'N/A'
        );
        console.log(
          'First Contentful Paint:',
          performance.getEntriesByName('first-contentful-paint')[0]
            ?.startTime || 'N/A'
        );
        console.groupEnd();
      }
    }, 1000);
  }
};

// Optimize resource loading
export const optimizeResourceLoading = () => {
  // Preconnect to external resources
  const preconnectLinks = [
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com',
  ];

  preconnectLinks.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
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
