/**
 * Centralized Logging Utility
 * Ensures console statements are only executed in development environment
 * and provides consistent logging patterns across the application
 */

export interface LogContext {
  component?: string;
  operation?: string;
  userId?: string;
  extra?: Record<string, any>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log info messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`ℹ️ ${message}`, context ? this.formatContext(context) : '');
    }
  }

  /**
   * Log warning messages (only in development)
   */
  warn(message: string, error?: any, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(
        `⚠️ ${message}`,
        error,
        context ? this.formatContext(context) : ''
      );
    }
  }

  /**
   * Log error messages (only in development unless critical)
   */
  error(message: string, error?: any, context?: LogContext): void {
    const isCritical = this.isCriticalError(error);

    if (this.isDevelopment || isCritical) {
      console.error(
        `❌ ${message}`,
        error,
        context ? this.formatContext(context) : ''
      );
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: any, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(
        `🐛 ${message}`,
        data,
        context ? this.formatContext(context) : ''
      );
    }
  }

  /**
   * Log success messages (only in development)
   */
  success(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`✅ ${message}`, context ? this.formatContext(context) : '');
    }
  }

  /**
   * Performance timing (only in development)
   */
  time(label: string): void {
    if (this.isDevelopment) {
      console.time(`⏱️ ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      console.timeEnd(`⏱️ ${label}`);
    }
  }

  /**
   * Group logging (only in development)
   */
  group(label: string): void {
    if (this.isDevelopment) {
      console.group(`📂 ${label}`);
    }
  }

  groupEnd(): void {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }

  /**
   * Force log critical errors even in production
   */
  critical(message: string, error?: any, context?: LogContext): void {
    console.error(
      `🚨 CRITICAL: ${message}`,
      error,
      context ? this.formatContext(context) : ''
    );
  }

  /**
   * Format context information for logging
   */
  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.component) parts.push(`Component: ${context.component}`);
    if (context.operation) parts.push(`Operation: ${context.operation}`);
    if (context.userId) parts.push(`User: ${context.userId}`);
    if (context.extra) parts.push(`Extra: ${JSON.stringify(context.extra)}`);

    return parts.length > 0 ? `[${parts.join(', ')}]` : '';
  }

  /**
   * Determine if an error is critical and should be logged in production
   */
  private isCriticalError(error: any): boolean {
    if (!error) return false;

    const criticalCodes = [
      'permission-denied',
      'unauthorized',
      'network-request-failed',
      'internal',
      'security-error',
    ];

    return (
      criticalCodes.includes(error?.code) ||
      error?.message?.includes('security') ||
      error?.message?.includes('auth') ||
      error?.message?.includes('critical')
    );
  }
}

// Export singleton instance
export const logger = new Logger();

// Export individual methods for convenience
export const {
  info,
  warn,
  error,
  debug,
  success,
  time,
  timeEnd,
  group,
  groupEnd,
  critical,
} = logger;

// Default export
export default logger;
