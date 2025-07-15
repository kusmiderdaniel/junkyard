import {
  Receipt,
  Client,
  CompanyDetails,
  Product,
  Category,
} from '../types/receipt';
import { encryptData, decryptData, isEncryptionAvailable } from './encryption';
import { getCurrentUserId } from '../firebase';
import { logger } from './logger';
import { sortReceiptsInPlace } from './receiptSorting';
import { SyncableEntity } from '../types/common';

// Types for offline operations queue
export interface PendingOperation {
  id: string;
  type: 'CREATE_CLIENT' | 'CREATE_RECEIPT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT';
  data: SyncableEntity | PendingClient | PendingReceipt;
  timestamp: number;
  retryCount: number;
}

export interface PendingClient extends Omit<Client, 'id'> {
  tempId: string;
  userID: string;
}

export interface PendingReceipt extends Omit<Receipt, 'id'> {
  tempId: string;
  userID: string;
}

const STORAGE_KEYS = {
  CLIENTS: 'offline_clients',
  RECEIPTS: 'offline_receipts',
  COMPANY_DETAILS: 'offline_company_details',
  PRODUCTS: 'offline_products',
  CATEGORIES: 'offline_categories',
  PENDING_OPERATIONS: 'offline_pending_operations',
  LAST_SYNC: 'offline_last_sync',
} as const;

// Get current user ID safely
const getUserIdSafe = (): string | null => {
  try {
    return getCurrentUserId();
  } catch {
    return null;
  }
};

// Secure storage wrapper
const secureStorage = {
  setItem: async (key: string, data: unknown): Promise<void> => {
    const userId = getUserIdSafe();
    if (!userId || !isEncryptionAvailable()) {
      // Fallback to regular storage if no user or encryption unavailable
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }

    const encrypted = await encryptData(data, userId);
    localStorage.setItem(key, encrypted);
  },

  getItem: async <T>(key: string): Promise<T | null> => {
    const userId = getUserIdSafe();
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    if (!userId || !isEncryptionAvailable()) {
      // Fallback to regular parsing
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }

    return await decryptData<T>(stored, userId);
  },
};

// Cache management
export const offlineStorage = {
  // Clients
  cacheClients: async (clients: Client[]): Promise<void> => {
    // Deduplicate clients by ID and remove any temp entries that might have real counterparts
    const deduplicatedClients = deduplicateAndCleanEntries(
      clients,
      'temp_client_'
    );
    await secureStorage.setItem(STORAGE_KEYS.CLIENTS, deduplicatedClients);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  // NEW: Merge clients with existing cache instead of overwriting
  mergeClients: async (newClients: Client[]): Promise<void> => {
    const existingClients = await offlineStorage.getCachedClients();
    const allClients = [...existingClients, ...newClients];
    const deduplicatedClients = deduplicateAndCleanEntries(
      allClients,
      'temp_client_'
    );
    await secureStorage.setItem(STORAGE_KEYS.CLIENTS, deduplicatedClients);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedClients: async (): Promise<Client[]> => {
    const clients = await secureStorage.getItem<Client[]>(STORAGE_KEYS.CLIENTS);
    return clients || [];
  },

  // Receipts
  cacheReceipts: async (receipts: Receipt[]): Promise<void> => {
    // Deduplicate receipts by ID and remove any temp entries that might have real counterparts
    const deduplicatedReceipts = deduplicateAndCleanEntries(
      receipts,
      'temp_receipt_'
    );

    // Only cache recent receipts to avoid storage bloat
    const recentReceipts = deduplicatedReceipts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100); // Cache only the 100 most recent receipts

    await secureStorage.setItem(STORAGE_KEYS.RECEIPTS, recentReceipts);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  // NEW: Merge receipts with existing cache instead of overwriting
  mergeReceipts: async (newReceipts: Receipt[]): Promise<void> => {
    const existingReceipts = await offlineStorage.getCachedReceipts();
    const allReceipts = [...existingReceipts, ...newReceipts];
    const deduplicatedReceipts = deduplicateAndCleanEntries(
      allReceipts,
      'temp_receipt_'
    );

    // Only cache recent receipts to avoid storage bloat
    sortReceiptsInPlace(deduplicatedReceipts);
    const recentReceipts = deduplicatedReceipts.slice(0, 100); // Cache only the 100 most recent receipts

    await secureStorage.setItem(STORAGE_KEYS.RECEIPTS, recentReceipts);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedReceipts: async (): Promise<Receipt[]> => {
    const receipts = await secureStorage.getItem<Receipt[]>(
      STORAGE_KEYS.RECEIPTS
    );
    if (!receipts) return [];

    // Convert date strings back to Date objects
    return receipts.map(receipt => ({
      ...receipt,
      date: new Date(receipt.date),
    }));
  },

  // Company Details
  cacheCompanyDetails: async (details: CompanyDetails): Promise<void> => {
    await secureStorage.setItem(STORAGE_KEYS.COMPANY_DETAILS, details);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedCompanyDetails: async (): Promise<CompanyDetails | null> => {
    return await secureStorage.getItem<CompanyDetails>(
      STORAGE_KEYS.COMPANY_DETAILS
    );
  },

  // Products
  cacheProducts: async (products: Product[]): Promise<void> => {
    await secureStorage.setItem(STORAGE_KEYS.PRODUCTS, products);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedProducts: async (): Promise<Product[]> => {
    const products = await secureStorage.getItem<Product[]>(
      STORAGE_KEYS.PRODUCTS
    );
    return products || [];
  },

  // Categories
  cacheCategories: async (categories: Category[]): Promise<void> => {
    await secureStorage.setItem(STORAGE_KEYS.CATEGORIES, categories);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedCategories: async (): Promise<Category[]> => {
    const categories = await secureStorage.getItem<Category[]>(
      STORAGE_KEYS.CATEGORIES
    );
    return categories || [];
  },

  // Pending Operations Queue
  addPendingOperation: async (
    operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<string> => {
    const operations = await offlineStorage.getPendingOperations();
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newOperation: PendingOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    operations.push(newOperation);
    await secureStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, operations);

    return id;
  },

  getPendingOperations: async (): Promise<PendingOperation[]> => {
    const operations = await secureStorage.getItem<PendingOperation[]>(
      STORAGE_KEYS.PENDING_OPERATIONS
    );
    return operations || [];
  },

  removePendingOperation: async (operationId: string): Promise<void> => {
    const operations = await offlineStorage.getPendingOperations();
    const filtered = operations.filter(op => op.id !== operationId);
    await secureStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, filtered);
  },

  updatePendingOperation: async (
    operationId: string,
    updates: Partial<PendingOperation>
  ): Promise<void> => {
    const operations = await offlineStorage.getPendingOperations();
    const index = operations.findIndex(op => op.id === operationId);
    if (index !== -1) {
      operations[index] = { ...operations[index], ...updates };
      await secureStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, operations);
    }
  },

  // Offline Client Management
  addPendingClient: async (
    clientData: Omit<PendingClient, 'tempId'>
  ): Promise<string> => {
    const tempId =
      'temp_client_' +
      Date.now().toString() +
      Math.random().toString(36).substr(2, 9);
    const pendingClient: PendingClient = {
      ...clientData,
      tempId,
    };

    // Add to local cache immediately for UI responsiveness
    const cachedClients = await offlineStorage.getCachedClients();
    const clientWithTempId = { ...pendingClient, id: tempId };
    cachedClients.unshift(clientWithTempId);
    await offlineStorage.cacheClients(cachedClients);

    // Add to pending operations queue
    await offlineStorage.addPendingOperation({
      type: 'CREATE_CLIENT',
      data: pendingClient,
    });

    return tempId;
  },

  // Offline Receipt Management
  addPendingReceipt: async (
    receiptData: Omit<PendingReceipt, 'tempId'>
  ): Promise<string> => {
    const tempId =
      'temp_receipt_' +
      Date.now().toString() +
      Math.random().toString(36).substr(2, 9);
    const pendingReceipt: PendingReceipt = {
      ...receiptData,
      tempId,
    };

    // Add to local cache immediately for UI responsiveness
    const cachedReceipts = await offlineStorage.getCachedReceipts();
    const receiptWithTempId = { ...pendingReceipt, id: tempId };
    cachedReceipts.unshift(receiptWithTempId);
    await offlineStorage.cacheReceipts(cachedReceipts);

    // Add to pending operations queue
    await offlineStorage.addPendingOperation({
      type: 'CREATE_RECEIPT',
      data: pendingReceipt,
    });

    return tempId;
  },

  // Sync status (non-encrypted)
  getLastSyncTime: (): number | null => {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? parseInt(lastSync, 10) : null;
  },

  // Check if cached data is fresh (less than 24 hours old)
  isCacheFresh: (): boolean => {
    const lastSync = offlineStorage.getLastSyncTime();
    if (!lastSync) return false;

    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    return Date.now() - lastSync < oneDay;
  },

  // Clear all cached data
  clearCache: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // Get cache info for debugging
  getCacheInfo: async () => {
    const lastSync = offlineStorage.getLastSyncTime();
    const clients = await offlineStorage.getCachedClients();
    const receipts = await offlineStorage.getCachedReceipts();
    const companyDetails = await offlineStorage.getCachedCompanyDetails();
    const products = await offlineStorage.getCachedProducts();
    const categories = await offlineStorage.getCachedCategories();
    const pendingOperations = await offlineStorage.getPendingOperations();

    return {
      lastSync: lastSync ? new Date(lastSync).toLocaleString('pl-PL') : 'Never',
      isFresh: offlineStorage.isCacheFresh(),
      clientsCount: clients.length,
      receiptsCount: receipts.length,
      productsCount: products.length,
      categoriesCount: categories.length,
      pendingOperationsCount: pendingOperations.length,
      hasCompanyDetails: !!companyDetails,
      isEncrypted: isEncryptionAvailable(),
      storageSize: new Blob([
        localStorage.getItem(STORAGE_KEYS.CLIENTS) || '',
        localStorage.getItem(STORAGE_KEYS.RECEIPTS) || '',
        localStorage.getItem(STORAGE_KEYS.COMPANY_DETAILS) || '',
        localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '',
        localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '',
        localStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS) || '',
      ]).size,
    };
  },
};

// NEW: Improved deduplication utility to prevent duplicates by both ID and business logic
const deduplicateAndCleanEntries = <T extends { id: string }>(
  entries: T[],
  tempPrefix: string
): T[] => {
  const seenIds = new Set<string>();
  const seenBusinessKeys = new Set<string>();
  const result: T[] = [];

  // Sort entries to prioritize real entries over temp entries
  const sortedEntries = [...entries].sort((a, b) => {
    const aIsTemp = a.id.startsWith(tempPrefix);
    const bIsTemp = b.id.startsWith(tempPrefix);

    // Real entries come first
    if (!aIsTemp && bIsTemp) return -1;
    if (aIsTemp && !bIsTemp) return 1;
    return 0;
  });

  for (const entry of sortedEntries) {
    // Skip if we've already seen this exact ID
    if (seenIds.has(entry.id)) {
      logger.debug(`Skipping duplicate ID: ${entry.id}`, undefined, {
        component: 'OfflineStorage',
        operation: 'deduplicateAndCleanEntries',
        extra: { duplicateId: entry.id },
      });
      continue;
    }

    // Create business key for deduplication
    let businessKey = '';

    // For clients: use name + address combination
    if ('name' in entry && 'address' in entry) {
      const client = entry as any;
      businessKey =
        `client:${client.name}:${client.address}:${client.documentNumber || ''}`.toLowerCase();
    }

    // For receipts: use number + date + clientId combination
    if ('number' in entry && 'date' in entry && 'clientId' in entry) {
      const receipt = entry as any;
      const dateStr =
        receipt.date instanceof Date
          ? receipt.date.toISOString().split('T')[0]
          : new Date(receipt.date).toISOString().split('T')[0];
      businessKey =
        `receipt:${receipt.number}:${dateStr}:${receipt.clientId}`.toLowerCase();
    }

    // Skip if we've seen this business combination before
    if (businessKey && seenBusinessKeys.has(businessKey)) {
      // logger.debug(
      //   `Skipping duplicate business key: ${businessKey} (ID: ${entry.id})`,
      //   { component: 'offlineStorage', operation: 'deduplicate' }
      // );
      continue;
    }

    // Add to results
    seenIds.add(entry.id);
    if (businessKey) {
      seenBusinessKeys.add(businessKey);
    }
    result.push(entry);
  }

  if (result.length !== entries.length) {
    logger.debug(
      `Deduplication: ${entries.length} → ${result.length} entries`,
      undefined,
      {
        component: 'OfflineStorage',
        operation: 'deduplicateAndCleanEntries',
        extra: { original: entries.length, deduplicated: result.length },
      }
    );
  }

  return result;
};
