/**
 * Secure Logger Utility
 * Provides safe logging with proper TypeScript types
 */

import { FirebaseError, LogContext, isFirebaseError } from '../types/common';

interface Logger {
  info(message: string, context?: LogContext): void;
  warn(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void;
  error(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void;
  debug(message: string, data?: unknown, context?: LogContext): void;
  critical(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void;
}

class SecureLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Log general information
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`ℹ️ ${this.formatMessage(message, context)}`);
    }
  }

  /**
   * Log warnings with optional error details
   */
  warn(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void {
    const formattedMessage = this.formatMessage(message, context);

    if (this.isDevelopment) {
      console.warn(
        `⚠️ ${formattedMessage}`,
        error ? this.sanitizeError(error) : ''
      );
    }

    if (this.isProduction && this.isCriticalError(error)) {
      // In production, only log critical warnings
      console.warn(formattedMessage);
    }
  }

  /**
   * Log errors with full context
   */
  error(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void {
    const formattedMessage = this.formatMessage(message, context);

    if (this.isDevelopment) {
      console.error(
        `❌ ${formattedMessage}`,
        error ? this.sanitizeError(error) : ''
      );
    }

    if (this.isProduction) {
      // Always log errors in production, but sanitized
      console.error(formattedMessage, error?.message || 'Unknown error');
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, data?: unknown, context?: LogContext): void {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage(message, context);
      console.log(
        `🔍 ${formattedMessage}`,
        data ? this.sanitizeData(data) : ''
      );
    }
  }

  /**
   * Log critical errors that need immediate attention
   */
  critical(
    message: string,
    error?: Error | FirebaseError,
    context?: LogContext
  ): void {
    const formattedMessage = this.formatMessage(message, context);

    // Always log critical errors, even in production
    console.error(
      `🚨 CRITICAL: ${formattedMessage}`,
      error ? this.sanitizeError(error) : ''
    );

    // In development, also show full stack trace
    if (this.isDevelopment && error?.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Format log message with context
   */
  private formatMessage(message: string, context?: LogContext): string {
    if (!context) return message;

    const parts = [message];

    if (context.component) {
      parts.push(`[${context.component}]`);
    }

    if (context.operation) {
      parts.push(`(${context.operation})`);
    }

    if (context.userId && this.isDevelopment) {
      // Only show user ID in development
      parts.push(`{user: ${context.userId.substring(0, 8)}...}`);
    }

    if (context.extra && this.isDevelopment) {
      // Only show extra data in development
      const extraStr = Object.entries(context.extra)
        .map(([key, value]) => `${key}: ${this.sanitizeValue(value)}`)
        .join(', ');
      if (extraStr) {
        parts.push(`{${extraStr}}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Sanitize error object for safe logging
   */
  private sanitizeError(error: Error | FirebaseError): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if (isFirebaseError(error)) {
      sanitized.code = error.code;
    }

    if (this.isDevelopment && error.stack) {
      sanitized.stack = error.stack;
    }

    return sanitized;
  }

  /**
   * Sanitize data for safe logging
   */
  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (
      typeof data === 'string' ||
      typeof data === 'number' ||
      typeof data === 'boolean'
    ) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeValue(item));
    }

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeValue(value);
      }
      return sanitized;
    }

    return '[Complex Object]';
  }

  /**
   * Sanitize individual values for logging
   */
  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      // Don't log sensitive patterns
      if (this.isSensitiveString(value)) {
        return '[REDACTED]';
      }
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }

    if (typeof value === 'object') {
      return `[Object]`;
    }

    return '[Unknown]';
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error?: Error | FirebaseError): boolean {
    if (!error) return false;

    const criticalPatterns = [
      'permission-denied',
      'unauthenticated',
      'quota-exceeded',
      'unavailable',
    ];

    if (isFirebaseError(error)) {
      return criticalPatterns.some(pattern => error.code.includes(pattern));
    }

    return (
      error.name === 'SecurityError' ||
      error.name === 'NetworkError' ||
      error.message.toLowerCase().includes('critical')
    );
  }

  /**
   * Check if string contains sensitive information
   */
  private isSensitiveString(str: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /bearer/i,
      /\b[A-Za-z0-9]{20,}\b/, // Long random strings
    ];

    return sensitivePatterns.some(pattern => pattern.test(str));
  }
}

// Export singleton instance
export const logger = new SecureLogger();
export default logger;
