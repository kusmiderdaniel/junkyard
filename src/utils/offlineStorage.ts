import { Receipt, Client, CompanyDetails, Product, Category } from '../types/receipt';

// Types for offline operations queue
export interface PendingOperation {
  id: string;
  type: 'CREATE_CLIENT' | 'CREATE_RECEIPT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT';
  data: any;
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
  LAST_SYNC: 'offline_last_sync'
} as const;

// Utility to safely parse JSON from localStorage
const safeParseJSON = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse cached data:', error);
    return fallback;
  }
};

// Cache management
export const offlineStorage = {
  // Clients
  cacheClients: (clients: Client[]): void => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedClients: (): Client[] => {
    const cached = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return safeParseJSON(cached, []);
  },

  // Receipts
  cacheReceipts: (receipts: Receipt[]): void => {
    // Only cache recent receipts to avoid storage bloat
    const recentReceipts = receipts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100); // Cache only the 100 most recent receipts
    
    localStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(recentReceipts));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedReceipts: (): Receipt[] => {
    const cached = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
    const receipts = safeParseJSON<Receipt[]>(cached, []);
    // Convert date strings back to Date objects
    return receipts.map(receipt => ({
      ...receipt,
      date: new Date(receipt.date)
    }));
  },

  // Company Details
  cacheCompanyDetails: (details: CompanyDetails): void => {
    localStorage.setItem(STORAGE_KEYS.COMPANY_DETAILS, JSON.stringify(details));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedCompanyDetails: (): CompanyDetails | null => {
    const cached = localStorage.getItem(STORAGE_KEYS.COMPANY_DETAILS);
    return safeParseJSON(cached, null);
  },

  // Products
  cacheProducts: (products: Product[]): void => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedProducts: (): Product[] => {
    const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return safeParseJSON(cached, []);
  },

  // Categories
  cacheCategories: (categories: Category[]): void => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  },

  getCachedCategories: (): Category[] => {
    const cached = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return safeParseJSON(cached, []);
  },

  // Pending Operations Queue
  addPendingOperation: (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): string => {
    const operations = offlineStorage.getPendingOperations();
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newOperation: PendingOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    operations.push(newOperation);
    localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
    
    console.log('📝 Added pending operation:', operation.type, id);
    return id;
  },

  getPendingOperations: (): PendingOperation[] => {
    const cached = localStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS);
    return safeParseJSON(cached, []);
  },

  removePendingOperation: (operationId: string): void => {
    const operations = offlineStorage.getPendingOperations();
    const filtered = operations.filter(op => op.id !== operationId);
    localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(filtered));
    console.log('✅ Removed pending operation:', operationId);
  },

  updatePendingOperation: (operationId: string, updates: Partial<PendingOperation>): void => {
    const operations = offlineStorage.getPendingOperations();
    const index = operations.findIndex(op => op.id === operationId);
    if (index !== -1) {
      operations[index] = { ...operations[index], ...updates };
      localStorage.setItem(STORAGE_KEYS.PENDING_OPERATIONS, JSON.stringify(operations));
    }
  },

  // Offline Client Management
  addPendingClient: (clientData: Omit<PendingClient, 'tempId'>): string => {
    const tempId = 'temp_client_' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const pendingClient: PendingClient = {
      ...clientData,
      tempId
    };

    // Add to local cache immediately for UI responsiveness
    const cachedClients = offlineStorage.getCachedClients();
    const clientWithTempId = { ...pendingClient, id: tempId };
    cachedClients.unshift(clientWithTempId);
    offlineStorage.cacheClients(cachedClients);

    // Add to pending operations queue
    offlineStorage.addPendingOperation({
      type: 'CREATE_CLIENT',
      data: pendingClient
    });

    return tempId;
  },

  // Offline Receipt Management
  addPendingReceipt: (receiptData: Omit<PendingReceipt, 'tempId'>): string => {
    const tempId = 'temp_receipt_' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const pendingReceipt: PendingReceipt = {
      ...receiptData,
      tempId
    };

    // Add to local cache immediately for UI responsiveness
    const cachedReceipts = offlineStorage.getCachedReceipts();
    const receiptWithTempId = { ...pendingReceipt, id: tempId };
    cachedReceipts.unshift(receiptWithTempId);
    offlineStorage.cacheReceipts(cachedReceipts);

    // Add to pending operations queue
    offlineStorage.addPendingOperation({
      type: 'CREATE_RECEIPT',
      data: pendingReceipt
    });

    return tempId;
  },

  // Sync status
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
  getCacheInfo: () => {
    const lastSync = offlineStorage.getLastSyncTime();
    const clients = offlineStorage.getCachedClients();
    const receipts = offlineStorage.getCachedReceipts();
    const companyDetails = offlineStorage.getCachedCompanyDetails();
    const products = offlineStorage.getCachedProducts();
    const categories = offlineStorage.getCachedCategories();
    const pendingOperations = offlineStorage.getPendingOperations();
    
    return {
      lastSync: lastSync ? new Date(lastSync).toLocaleString('pl-PL') : 'Never',
      isFresh: offlineStorage.isCacheFresh(),
      clientsCount: clients.length,
      receiptsCount: receipts.length,
      productsCount: products.length,
      categoriesCount: categories.length,
      pendingOperationsCount: pendingOperations.length,
      hasCompanyDetails: !!companyDetails,
      storageSize: new Blob([
        localStorage.getItem(STORAGE_KEYS.CLIENTS) || '',
        localStorage.getItem(STORAGE_KEYS.RECEIPTS) || '',
        localStorage.getItem(STORAGE_KEYS.COMPANY_DETAILS) || '',
        localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '',
        localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '',
        localStorage.getItem(STORAGE_KEYS.PENDING_OPERATIONS) || ''
      ]).size
    };
  }
}; 