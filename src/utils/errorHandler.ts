/**
 * Centralized Error Handling Utility
 * Provides consistent error handling and user feedback across the application
 */

import toast from 'react-hot-toast';
import { logger } from './logger';
import {
  ErrorDetails,
  FirebaseError,
  LogContext,
  isFirebaseError,
  isErrorWithMessage,
} from '../types/common';

export interface AppError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Secure Error Handler
 * Handles errors with proper type safety and logging
 */

interface ErrorHandlerOptions {
  component?: string;
  operation?: string;
  userId?: string;
  details?: ErrorDetails;
  rethrow?: boolean;
  fallbackMessage?: string;
}

/**
 * Enhanced error handling with type safety
 */
export const handleError = (
  error: unknown,
  options: ErrorHandlerOptions = {}
): ErrorDetails => {
  const {
    component = 'Unknown',
    operation = 'unknown',
    userId,
    details = {},
    rethrow = false,
    fallbackMessage = 'An unexpected error occurred',
  } = options;

  // Create error details object
  const errorDetails: ErrorDetails = {
    ...details,
    timestamp: Date.now(),
    userId,
    component,
    operation,
  };

  if (isFirebaseError(error)) {
    errorDetails.code = error.code;
    errorDetails.message = error.message;

    logger.error(
      'Firebase error occurred',
      isErrorWithMessage(error) ? error : undefined,
      {
        component,
        operation,
        userId,
        extra: { code: error.code },
      }
    );
  } else if (isErrorWithMessage(error)) {
    errorDetails.message = error.message;
    errorDetails.stack = error.stack;

    if (isCriticalError(error)) {
      logger.critical(
        'Critical error occurred',
        isErrorWithMessage(error) ? error : undefined,
        {
          component,
          operation,
          userId,
        }
      );
    } else {
      logger.error(
        'Error occurred',
        isErrorWithMessage(error) ? error : undefined,
        {
          component,
          operation,
          userId,
        }
      );
    }
  } else {
    // Handle unknown error types
    errorDetails.message = fallbackMessage;

    logger.error('Unknown error occurred', undefined, {
      component,
      operation,
      userId,
      extra: { errorType: typeof error, errorValue: String(error) },
    });
  }

  if (rethrow) {
    if (isErrorWithMessage(error)) {
      throw error;
    } else {
      throw new Error(errorDetails.message || fallbackMessage);
    }
  }

  return errorDetails;
};

/**
 * Check if error is critical and needs immediate attention
 */
const isCriticalError = (error: Error | FirebaseError): boolean => {
  const criticalPatterns = [
    'permission-denied',
    'unauthenticated',
    'quota-exceeded',
    'unavailable',
    'SecurityError',
    'NetworkError',
  ];

  if (isFirebaseError(error)) {
    return criticalPatterns.some(
      pattern => error.code.includes(pattern) || error.message.includes(pattern)
    );
  }

  return criticalPatterns.some(
    pattern =>
      error.name.includes(pattern) ||
      error.message.toLowerCase().includes(pattern.toLowerCase())
  );
};

/**
 * Create a user-friendly error message
 */
export const createUserFriendlyMessage = (error: unknown): string => {
  if (isFirebaseError(error)) {
    switch (error.code) {
      case 'permission-denied':
        return 'Nie masz uprawnień do wykonania tej operacji.';
      case 'unauthenticated':
        return 'Musisz być zalogowany, aby wykonać tę operację.';
      case 'network-request-failed':
        return 'Sprawdź połączenie internetowe i spróbuj ponownie.';
      case 'quota-exceeded':
        return 'Przekroczono limit operacji. Spróbuj ponownie później.';
      case 'unavailable':
        return 'Usługa jest obecnie niedostępna. Spróbuj ponownie później.';
      default:
        return 'Wystąpił błąd systemu. Spróbuj ponownie.';
    }
  }

  if (isErrorWithMessage(error)) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection')) {
      return 'Sprawdź połączenie internetowe i spróbuj ponownie.';
    }

    if (message.includes('timeout')) {
      return 'Operacja przekroczyła limit czasu. Spróbuj ponownie.';
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'Wprowadzone dane są nieprawidłowe.';
    }
  }

  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
};

/**
 * Handle async operations with error catching
 */
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    handleError(error, options);
    return null;
  }
};

/**
 * Create error context for logging
 */
export const createErrorContext = (
  component: string,
  operation: string,
  userId?: string,
  extra?: Record<string, unknown>
): LogContext => ({
  component,
  operation,
  userId,
  extra,
});

/**
 * Validate error object structure
 */
export const isValidErrorObject = (error: unknown): error is Error => {
  return error instanceof Error || isErrorWithMessage(error);
};

/**
 * Extract error code from various error types
 */
export const getErrorCode = (error: unknown): string => {
  if (isFirebaseError(error)) {
    return error.code;
  }

  if (isErrorWithMessage(error)) {
    return error.name;
  }

  return 'unknown-error';
};

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (isErrorWithMessage(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error occurred';
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
export const handleSilentError = (error: unknown, context: string): void => {
  logger.warn(
    `Silent error in ${context}`,
    isErrorWithMessage(error) ? error : undefined,
    {
      component: 'ErrorHandler',
      operation: 'handleSilentError',
      extra: { context },
    }
  );
};
