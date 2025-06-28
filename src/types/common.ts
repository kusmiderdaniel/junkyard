/**
 * Common TypeScript interfaces and types
 * Used to replace unsafe 'any' type usage throughout the codebase
 */

import { User as FirebaseUser } from 'firebase/auth';
import { ReceiptItem } from './receipt';

// User-related types
export interface AuthUser extends FirebaseUser {
  uid: string;
  email: string | null;
}

// Error handling types
export interface ErrorDetails {
  code?: string;
  message?: string;
  stack?: string;
  timestamp?: number;
  userId?: string;
  component?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface FirebaseError extends Error {
  code: string;
  customData?: ErrorDetails;
}

// Data import/export types
export interface ImportRecord {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ExportDataItem {
  id: string;
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface ExcelExportOptions {
  data: ExportDataItem[];
  filename: string;
  sheetName: string;
  summary?: {
    totalRecords: number;
    exportDate: string;
    [key: string]: string | number;
  };
}

// Storage types
export interface CacheEntry {
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

export interface StorageItem {
  key: string;
  data: unknown;
  timestamp: number;
  userId?: string;
}

// Sync operation types
export interface SyncableEntity {
  id: string;
  lastModified?: number;
  userID: string;
  [key: string]: unknown;
}

export interface SyncClientData extends SyncableEntity {
  name: string;
  address: string;
  documentNumber: string;
  postalCode?: string;
  city?: string;
}

export interface SyncReceiptData extends SyncableEntity {
  number: string;
  date: Date;
  clientId: string;
  totalAmount: number;
  items: ReceiptItem[];
}

// Rate limiter types
export interface RateLimitStatus {
  count: number;
  resetTime: string;
  blockedUntil?: string;
  deviceFingerprint: string;
  persistedAt: string;
}

export interface RateLimiterStatuses {
  statuses: Record<string, RateLimitStatus>;
  deviceFingerprint: string;
  totalLimits: number;
  sessionMarkers: number;
  destroyed: boolean;
  error?: boolean;
}

// Session marker type
export interface SessionMarker {
  id: string;
  timestamp: number;
}

// Form validation types
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface SanitizedFormData {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// ID mapping types
export interface IdMappingEntry {
  tempId: string;
  realId: string;
  timestamp: number;
}

export interface ResolvableEntity {
  [key: string]: string | number | boolean | Date | null | undefined;
}

// Encryption types
export interface EncryptionData {
  encryptedData: string;
  iv: string;
  salt: string;
}

// Logger types
export interface LogContext {
  component: string;
  operation: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  error?: Error | FirebaseError;
  context?: LogContext;
  timestamp: number;
}

// Component props types
export interface BaseComponentProps {
  user: AuthUser | null;
  className?: string;
  children?: React.ReactNode;
}

export interface FilterComponentProps extends BaseComponentProps {
  onFilterChange: (filters: Record<string, unknown>) => void;
  filters: Record<string, unknown>;
}

export interface PaginationComponentProps extends BaseComponentProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Generic utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Type guards
export function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

export function isErrorWithMessage(error: unknown): error is Error {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

export function isValidRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(item => typeof item === 'number');
}
