import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  offlineStorage,
  PendingOperation,
  PendingClient,
  PendingReceipt,
} from './offlineStorage';
import { normalizePolishText, createSearchableText } from './textUtils';
import rateLimiter from './rateLimiter';
import toast from 'react-hot-toast';

export interface SyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  errors: string[];
}

class SyncService {
  private isSyncing = false;
  private syncCallbacks: ((result: SyncResult) => void)[] = [];
  private tempToRealIdMap: Map<string, string> = new Map(); // Track temp → real ID mappings

  // Register callback for sync completion
  onSyncComplete(callback: (result: SyncResult) => void): void {
    this.syncCallbacks.push(callback);
  }

  // Remove sync callback
  removeSyncCallback(callback: (result: SyncResult) => void): void {
    this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
  }

  private notifySyncComplete(result: SyncResult): void {
    this.syncCallbacks.forEach(callback => callback(result));
  }

  async syncPendingOperations(userUID: string): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedOperations: 0,
        failedOperations: 0,
        errors: ['Sync already in progress'],
      };
    }

    // Check rate limits for sync operation
    const syncLimit = rateLimiter.checkLimit('sync:operation', userUID);
    if (!syncLimit.allowed) {
      const message =
        syncLimit.message ||
        'Zbyt wiele operacji synchronizacji. Spróbuj ponownie później.';
      toast.error(message);
      return {
        success: false,
        syncedOperations: 0,
        failedOperations: 1,
        errors: [message],
      };
    }

    this.isSyncing = true;
    this.tempToRealIdMap.clear(); // Clear previous mappings

    const pendingOperations = await offlineStorage.getPendingOperations();

    if (pendingOperations.length === 0) {
      this.isSyncing = false;
      return {
        success: true,
        syncedOperations: 0,
        failedOperations: 0,
        errors: [],
      };
    }

    const result: SyncResult = {
      success: true,
      syncedOperations: 0,
      failedOperations: 0,
      errors: [],
    };

    // Sort operations by timestamp to maintain order
    const sortedOperations = pendingOperations.sort(
      (a, b) => a.timestamp - b.timestamp
    );

    for (const operation of sortedOperations) {
      try {
        await this.syncOperation(operation, userUID);
        await offlineStorage.removePendingOperation(operation.id);
        result.syncedOperations++;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(
            `❌ Failed to sync operation: ${operation.type} (${operation.id})`,
            error
          );
        }
        result.failedOperations++;
        result.errors.push(
          `${operation.type}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Increment retry count
        await offlineStorage.updatePendingOperation(operation.id, {
          retryCount: operation.retryCount + 1,
        });

        // Remove operation if it has failed too many times
        if (operation.retryCount >= 3) {
          await offlineStorage.removePendingOperation(operation.id);
          result.errors.push(
            `${operation.type}: Removed after 3 failed attempts`
          );
        }
      }
    }

    if (result.failedOperations > 0) {
      result.success = false;
    }

    // CRITICAL FIX: Clean up any lingering temp entries after successful sync
    if (result.success && result.syncedOperations > 0) {
      await this.cleanupTempEntries();

      // Additional verification step - ensure cache consistency
      await this.verifyCacheConsistency();
    }

    this.isSyncing = false;
    this.notifySyncComplete(result);

    // Show user-friendly toast
    if (result.success && result.syncedOperations > 0) {
      toast.success(
        `Zsynchronizowano ${result.syncedOperations} operacji offline`
      );
    } else if (result.failedOperations > 0) {
      toast.error(
        `Nie udało się zsynchronizować ${result.failedOperations} operacji`
      );
    }

    return result;
  }

  private async syncOperation(
    operation: PendingOperation,
    userUID: string
  ): Promise<void> {
    switch (operation.type) {
      case 'CREATE_CLIENT':
        await this.syncCreateClient(operation.data as PendingClient, userUID);
        break;
      case 'CREATE_RECEIPT':
        await this.syncCreateReceipt(operation.data as PendingReceipt, userUID);
        break;
      case 'UPDATE_CLIENT':
        await this.syncUpdateClient(operation.data, userUID);
        break;
      case 'DELETE_CLIENT':
        await this.syncDeleteClient(operation.data.clientId, userUID);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async syncCreateClient(
    clientData: PendingClient,
    userUID: string
  ): Promise<void> {
    // Remove temp fields
    const { tempId, ...cleanClientData } = clientData;

    // Ensure userID is set
    const clientToCreate = {
      ...cleanClientData,
      userID: userUID,
    };

    // Add server-side fields
    const addressParts = [];
    if (clientToCreate.address.trim())
      addressParts.push(clientToCreate.address.trim());
    if (clientToCreate.postalCode?.trim() || clientToCreate.city?.trim()) {
      const locationPart = [
        clientToCreate.postalCode?.trim(),
        clientToCreate.city?.trim(),
      ]
        .filter(Boolean)
        .join(' ');
      if (locationPart) addressParts.push(locationPart);
    }
    const fullAddress = addressParts.join(', ');

    const finalClientData = {
      ...clientToCreate,
      fullAddress,
      name_lowercase: clientToCreate.name.toLowerCase(),
      name_normalized: normalizePolishText(clientToCreate.name),
      address_normalized: normalizePolishText(clientToCreate.address),
      documentNumber_normalized: normalizePolishText(
        clientToCreate.documentNumber
      ),
      postalCode_normalized: normalizePolishText(
        clientToCreate.postalCode || ''
      ),
      city_normalized: normalizePolishText(clientToCreate.city || ''),
      fullAddress_normalized: normalizePolishText(fullAddress),
      searchableText: createSearchableText([
        clientToCreate.name,
        clientToCreate.address,
        clientToCreate.documentNumber,
        clientToCreate.postalCode || '',
        clientToCreate.city || '',
        fullAddress,
      ]),
    };

    // Create in Firebase
    const docRef = await addDoc(collection(db, 'clients'), finalClientData);

    // CRITICAL: Store the mapping for later receipt updates
    this.tempToRealIdMap.set(tempId, docRef.id);

    if (process.env.NODE_ENV === 'development') {
      console.log(`🗺️ Stored mapping: ${tempId} → ${docRef.id}`);
    }

    // Update local cache to replace temp client with real one
    await this.updateCachedClientId(tempId, docRef.id, finalClientData);
  }

  private async syncCreateReceipt(
    receiptData: PendingReceipt,
    userUID: string
  ): Promise<void> {
    // Remove temp fields
    const { tempId, ...cleanReceiptData } = receiptData;

    // CRITICAL FIX: If receipt references a temp client ID, use the real ID from mapping
    let updatedClientId = cleanReceiptData.clientId;
    if (
      cleanReceiptData.clientId &&
      cleanReceiptData.clientId.startsWith('temp_client_')
    ) {
      const realClientId = this.tempToRealIdMap.get(cleanReceiptData.clientId);
      if (realClientId) {
        updatedClientId = realClientId;
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `🔗 Receipt ${tempId} clientId updated: ${cleanReceiptData.clientId} → ${realClientId}`
          );
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `⚠️ No mapping found for temp client ID: ${cleanReceiptData.clientId}`
          );
        }
      }
    }

    // Ensure userID is set and convert Date object to Firestore timestamp
    const receiptToCreate = {
      ...cleanReceiptData,
      clientId: updatedClientId, // Use the updated client ID
      userID: userUID,
      date: new Date(cleanReceiptData.date), // Ensure it's a proper Date object
    };

    // Create in Firebase
    const docRef = await addDoc(collection(db, 'receipts'), receiptToCreate);

    // Update local cache to replace temp receipt with real one
    await this.updateCachedReceiptId(tempId, docRef.id, receiptToCreate);
  }

  private async syncUpdateClient(
    clientData: any,
    userUID: string
  ): Promise<void> {
    const { id, ...updateData } = clientData;
    await updateDoc(doc(db, 'clients', id), {
      ...updateData,
      userID: userUID,
    });
  }

  private async syncDeleteClient(
    clientId: string,
    userUID: string
  ): Promise<void> {
    await deleteDoc(doc(db, 'clients', clientId));

    // Remove from local cache
    const cachedClients = await offlineStorage.getCachedClients();
    const filtered = cachedClients.filter(client => client.id !== clientId);
    await offlineStorage.cacheClients(filtered);
  }

  private async updateCachedClientId(
    tempId: string,
    realId: string,
    clientData: any
  ): Promise<void> {
    try {
      // Get current cached data
      const cachedClients = await offlineStorage.getCachedClients();
      const cachedReceipts = await offlineStorage.getCachedReceipts();

      // Find and update the client
      const clientIndex = cachedClients.findIndex(
        client => client.id === tempId
      );
      let clientUpdated = false;

      if (clientIndex !== -1) {
        cachedClients[clientIndex] = { ...clientData, id: realId };
        clientUpdated = true;

        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Updated client cache: ${tempId} → ${realId}`);
        }
      }

      // Find and update any receipts that reference this temp client ID
      let receiptsUpdated = false;
      for (let i = 0; i < cachedReceipts.length; i++) {
        if (cachedReceipts[i].clientId === tempId) {
          cachedReceipts[i].clientId = realId;
          receiptsUpdated = true;

          if (process.env.NODE_ENV === 'development') {
            console.log(
              `🔗 Updated receipt ${cachedReceipts[i].id} clientId: ${tempId} → ${realId}`
            );
          }
        }
      }

      // Apply updates atomically
      if (clientUpdated) {
        await offlineStorage.cacheClients(cachedClients);
      }

      if (receiptsUpdated) {
        await offlineStorage.cacheReceipts(cachedReceipts);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to update cached client ID:', error);
      }
    }
  }

  private async updateCachedReceiptId(
    tempId: string,
    realId: string,
    receiptData: any
  ): Promise<void> {
    try {
      const cachedReceipts = await offlineStorage.getCachedReceipts();
      const index = cachedReceipts.findIndex(receipt => receipt.id === tempId);

      if (index !== -1) {
        cachedReceipts[index] = { ...receiptData, id: realId };
        await offlineStorage.cacheReceipts(cachedReceipts);

        if (process.env.NODE_ENV === 'development') {
          console.log(`🔄 Updated receipt cache: ${tempId} → ${realId}`);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to update cached receipt ID:', error);
      }
    }
  }

  // Get sync status
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  // Check if there are pending operations
  async hasPendingOperations(): Promise<boolean> {
    const operations = await offlineStorage.getPendingOperations();
    return operations.length > 0;
  }

  // Get pending operations count
  async getPendingOperationsCount(): Promise<number> {
    const operations = await offlineStorage.getPendingOperations();
    return operations.length;
  }

  // NEW: Clean up temporary entries that might still be in cache
  private async cleanupTempEntries(): Promise<void> {
    try {
      // Clean up temp clients
      const cachedClients = await offlineStorage.getCachedClients();
      const cleanClients = cachedClients.filter(
        client => !client.id.startsWith('temp_client_')
      );
      if (cleanClients.length !== cachedClients.length) {
        await offlineStorage.cacheClients(cleanClients);
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `🧹 Cleaned up ${cachedClients.length - cleanClients.length} temp clients`
          );
        }
      }

      // Clean up temp receipts
      const cachedReceipts = await offlineStorage.getCachedReceipts();
      const cleanReceipts = cachedReceipts.filter(
        receipt => !receipt.id.startsWith('temp_receipt_')
      );
      if (cleanReceipts.length !== cachedReceipts.length) {
        await offlineStorage.cacheReceipts(cleanReceipts);
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `🧹 Cleaned up ${cachedReceipts.length - cleanReceipts.length} temp receipts`
          );
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to cleanup temp entries:', error);
      }
    }
  }

  // NEW: Verify and fix cache consistency after sync
  private async verifyCacheConsistency(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Verifying cache consistency...');
      }

      const cachedClients = await offlineStorage.getCachedClients();
      const cachedReceipts = await offlineStorage.getCachedReceipts();

      // Check for orphaned receipts (receipts with invalid client IDs)
      const validClientIds = new Set(cachedClients.map(c => c.id));
      let orphanedReceipts = 0;
      let fixedReceipts = 0;

      for (let i = 0; i < cachedReceipts.length; i++) {
        const receipt = cachedReceipts[i];

        // If receipt references a temp client ID that doesn't exist, try to fix it
        if (
          receipt.clientId.startsWith('temp_client_') &&
          !validClientIds.has(receipt.clientId)
        ) {
          orphanedReceipts++;

          // Try to find the real client ID using our mapping
          const realClientId = this.tempToRealIdMap.get(receipt.clientId);
          if (realClientId && validClientIds.has(realClientId)) {
            // Fix the orphaned receipt
            cachedReceipts[i].clientId = realClientId;
            fixedReceipts++;

            if (process.env.NODE_ENV === 'development') {
              console.log(
                `🔧 Fixed orphaned receipt ${receipt.id}: ${receipt.clientId} → ${realClientId}`
              );
            }
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `⚠️ Cannot fix orphaned receipt ${receipt.id} with clientId: ${receipt.clientId}`
              );
            }
          }
        }
      }

      if (orphanedReceipts > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `⚠️ Found ${orphanedReceipts} orphaned receipts, fixed ${fixedReceipts}`
          );
        }

        // Save the fixed receipts back to cache
        if (fixedReceipts > 0) {
          await offlineStorage.cacheReceipts(cachedReceipts);
        }
      }

      // Force a fresh deduplication to clean up any remaining issues
      await offlineStorage.cacheClients(cachedClients);
      await offlineStorage.cacheReceipts(cachedReceipts);

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `✅ Cache consistency verification completed - Fixed ${fixedReceipts} orphaned receipts`
        );
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to verify cache consistency:', error);
      }
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
