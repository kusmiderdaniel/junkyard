/**
 * Centralized Error Handling Utility
 * Provides consistent error handling and user feedback across the application
 */

import toast from 'react-hot-toast';
import { logger } from './logger';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Handles errors with user-friendly messages and optional logging
 */
export const handleError = (
  error: any,
  userMessage: string,
  shouldLog: boolean = process.env.NODE_ENV === 'development'
): AppError => {
  const appError: AppError = {
    message: userMessage,
    code: error?.code || 'UNKNOWN_ERROR',
    details: shouldLog ? error : undefined,
  };

  // Only log in development or for critical errors
  if (shouldLog || isCriticalError(error)) {
    logger.error('Application Error', error, {
      component: 'ErrorHandler',
      operation: 'handleError',
      extra: {
        userMessage,
        isCritical: isCriticalError(error),
        timestamp: new Date().toISOString(),
      },
    });
  }

  return appError;
};

/**
 * Determines if an error is critical and should always be logged
 */
const isCriticalError = (error: any): boolean => {
  const criticalCodes = [
    'permission-denied',
    'unauthorized',
    'network-request-failed',
    'internal',
  ];

  return (
    criticalCodes.includes(error?.code) ||
    error?.message?.includes('security') ||
    error?.message?.includes('auth')
  );
};

/**
 * Shows user-friendly error messages using toast notifications
 */
export const showErrorMessage = (error: AppError): void => {
  toast.error(error.message);
};

/**
 * Shows success messages using toast notifications
 */
export const showSuccessMessage = (message: string): void => {
  toast.success(message);
};

/**
 * Shows warning messages using toast notifications
 */
export const showWarningMessage = (message: string): void => {
  toast(message, {
    icon: '⚠️',
    style: {
      background: '#f59e0b',
      color: '#fff',
    },
  });
};

/**
 * Shows info messages using toast notifications
 */
export const showInfoMessage = (message: string): void => {
  toast(message, {
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
    },
  });
};

/**
 * Silent error handler for non-critical operations
 */
export const handleSilentError = (error: any, context: string): void => {
  logger.warn(`Silent error in ${context}`, error, {
    component: 'ErrorHandler',
    operation: 'handleSilentError',
    extra: { context },
  });
};
