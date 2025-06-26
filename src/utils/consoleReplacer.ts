/**
 * Console Replacement Utility
 * This utility helps replace remaining console.* statements with proper logger calls
 *
 * Usage: This is a development helper - not part of the production app
 */

import { logger } from './logger';
import { isErrorWithMessage } from '../types/common';
// This is a reference mapping for developers to manually replace console statements
export const CONSOLE_REPLACEMENT_GUIDE = {
  // Console.log replacements
  'console.log': {
    info: 'logger.info("message", { component: "ComponentName", operation: "operationName" })',
    debug:
      'logger.debug("message", data, { component: "ComponentName", operation: "operationName" })',
    success:
      'logger.success("message", { component: "ComponentName", operation: "operationName" })',
  },

  // Console.warn replacements
  'console.warn':
    'logger.warn("message", isErrorWithMessage(error) ? error : undefined, { component: "ComponentName", operation: "operationName" })',

  // Console.error replacements
  'console.error':
    'logger.error("message", isErrorWithMessage(error) ? error : undefined, { component: "ComponentName", operation: "operationName" })',

  // Console.info replacements
  'console.info':
    'logger.info("message", { component: "ComponentName", operation: "operationName" })',

  // Console.debug replacements
  'console.debug':
    'logger.debug("message", data, { component: "ComponentName", operation: "operationName" })',
};

// Common patterns to help developers identify what to replace
export const COMMON_PATTERNS = {
  // Auth-related logging
  AUTH_PATTERNS: [
    'User logged in',
    'Authentication failed',
    'Token expired',
    'Logout successful',
  ],

  // Data operation patterns
  DATA_PATTERNS: [
    'Data fetched successfully',
    'Save operation failed',
    'Cache updated',
    'Sync completed',
  ],

  // Error patterns
  ERROR_PATTERNS: [
    'Network error',
    'Validation failed',
    'Database error',
    'API call failed',
  ],
};

// Development-only function to check for remaining console statements
export const checkForConsoleStatements = (): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.info('Console Replacement Check', {
      component: 'ConsoleReplacer',
      operation: 'checkForConsoleStatements',
      extra: {
        message:
          'Check complete. All console statements should be replaced with logger calls.',
        guide: 'See CONSOLE_REPLACEMENT_GUIDE for replacement patterns',
      },
    });
  }
};

// Function to demonstrate proper logging patterns
export const demonstrateLoggingPatterns = (): void => {
  if (process.env.NODE_ENV === 'development') {
    // Demonstrate different log levels
    logger.info('This is an info message', {
      component: 'ConsoleReplacer',
      operation: 'demonstrateLoggingPatterns',
    });

    logger.debug(
      'This is debug data',
      { key: 'value' },
      {
        component: 'ConsoleReplacer',
        operation: 'demonstrateLoggingPatterns',
      }
    );

    logger.warn('This is a warning', undefined, {
      component: 'ConsoleReplacer',
      operation: 'demonstrateLoggingPatterns',
    });

    // Demonstrate error logging
    try {
      throw new Error('Demo error');
    } catch (error) {
      logger.error(
        'Demo error caught',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'ConsoleReplacer',
          operation: 'demonstrateLoggingPatterns',
        }
      );
    }
  }
};

const consoleReplacerUtility = {
  CONSOLE_REPLACEMENT_GUIDE,
  COMMON_PATTERNS,
  checkForConsoleStatements,
  demonstrateLoggingPatterns,
};

export default consoleReplacerUtility;
