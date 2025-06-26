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
  private isStaging = process.env.REACT_APP_ENV === 'staging';

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(data: any): any {
    if (!data) return data;

    if (typeof data === 'string') {
      // Remove potential email addresses, UIDs, and tokens
      return data
        .replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          '[EMAIL]'
        )
        .replace(/\b[A-Za-z0-9]{20,}\b/g, '[TOKEN]')
        .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[HASH]');
    }

    if (typeof data === 'object' && data !== null) {
      const sensitiveKeys = [
        'password',
        'token',
        'key',
        'secret',
        'uid',
        'email',
        'phone',
      ];
      const sanitized = { ...data };

      for (const key of Object.keys(sanitized)) {
        if (
          sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))
        ) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitize(sanitized[key]);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Log info messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.log(
        `ℹ️ ${message}`,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
    }
  }

  /**
   * Log warning messages (only in development)
   */
  warn(message: string, error?: any, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitizedError = this.sanitize(error);
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.warn(
        `⚠️ ${message}`,
        sanitizedError,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
    }
  }

  /**
   * Log error messages (only in development unless critical)
   */
  error(message: string, error?: any, context?: LogContext): void {
    const isCritical = this.isCriticalError(error);

    if (this.isDevelopment || isCritical) {
      const sanitizedError = this.sanitize(error);
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.error(
        `❌ ${message}`,
        sanitizedError,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: any, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitizedData = this.sanitize(data);
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.log(
        `🐛 ${message}`,
        sanitizedData,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
    }
  }

  /**
   * Log success messages (only in development)
   */
  success(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.log(
        `✅ ${message}`,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
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
   * Force log critical errors even in production (but sanitized)
   */
  critical(message: string, error?: any, context?: LogContext): void {
    const sanitizedError = this.sanitize(error);
    const sanitizedContext = context ? this.sanitize(context) : undefined;
    console.error(
      `🚨 CRITICAL: ${message}`,
      sanitizedError,
      sanitizedContext ? this.formatContext(sanitizedContext) : ''
    );
  }

  /**
   * Staging-only logs (visible in staging but not production)
   */
  staging(message: string, data?: any, context?: LogContext): void {
    if (this.isDevelopment || this.isStaging) {
      const sanitizedData = this.sanitize(data);
      const sanitizedContext = context ? this.sanitize(context) : undefined;
      console.log(
        `🧪 STAGING: ${message}`,
        sanitizedData,
        sanitizedContext ? this.formatContext(sanitizedContext) : ''
      );
    }
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

  /**
   * Get current environment info (safe for logging)
   */
  getEnvironmentInfo(): Record<string, string> {
    return {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      reactEnv: process.env.REACT_APP_ENV || 'unknown',
      isDevelopment: this.isDevelopment.toString(),
      isStaging: this.isStaging.toString(),
    };
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
