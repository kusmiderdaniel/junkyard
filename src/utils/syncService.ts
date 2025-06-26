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
import { idMappingService } from './idMappingService';
import { cacheUpdateService } from './cacheUpdateService';
import { logger } from './logger';
import { isErrorWithMessage } from '../types/common';
export interface SyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  errors: string[];
  cacheUpdates?: {
    updatedClients: number;
    updatedReceipts: number;
    removedTempEntries: number;
  };
}

class SyncService {
  private isSyncing = false;
  private syncCallbacks: ((result: SyncResult) => void)[] = [];

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

    // Clear previous mappings and prepare for new sync
    idMappingService.clear();

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

    // Phase 1: Build dependency graph before syncing
    this.buildDependencyGraph(sortedOperations);

    // Phase 2: Sync operations
    for (const operation of sortedOperations) {
      try {
        await this.syncOperation(operation, userUID);
        await offlineStorage.removePendingOperation(operation.id);
        result.syncedOperations++;
      } catch (error) {
        logger.error(
          `Failed to sync operation: ${operation.type} (${operation.id})`,
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'SyncService',
            operation: 'syncPendingOperations',
            extra: {
              operationType: operation.type,
              operationId: operation.id,
            },
          }
        );
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

    // Phase 3: Apply cache updates using the decoupled services
    if (result.success && result.syncedOperations > 0) {
      const cacheUpdateResult = await this.applyCacheUpdates();
      result.cacheUpdates = {
        updatedClients: cacheUpdateResult.updatedClients,
        updatedReceipts: cacheUpdateResult.updatedReceipts,
        removedTempEntries: cacheUpdateResult.removedTempEntries,
      };

      if (!cacheUpdateResult.success) {
        result.errors.push(...cacheUpdateResult.errors);
      }

      // Verify cache consistency
      const consistencyCheck =
        await cacheUpdateService.verifyCacheConsistency();
      if (!consistencyCheck.isConsistent) {
        logger.warn('Cache consistency issues found', undefined, {
          component: 'SyncService',
          operation: 'syncPendingOperations',
          extra: {
            issues: consistencyCheck.issues,
            autoFixed: consistencyCheck.fixed,
          },
        });
        if (consistencyCheck.fixed.length > 0) {
          logger.debug('Auto-fixed cache issues', undefined, {
            component: 'SyncService',
            operation: 'syncPendingOperations',
            extra: { fixed: consistencyCheck.fixed },
          });
        }
      }
    }

    // Clean up mapping service
    idMappingService.clear();

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

  /**
   * Build dependency graph to track receipt-client relationships
   */
  private buildDependencyGraph(operations: PendingOperation[]): void {
    for (const operation of operations) {
      if (operation.type === 'CREATE_RECEIPT') {
        const receiptData = operation.data as PendingReceipt;
        if (receiptData.tempId && receiptData.clientId) {
          idMappingService.addDependency(
            receiptData.tempId,
            receiptData.clientId
          );
        }
      }
    }
  }

  /**
   * Apply cache updates using the decoupled services
   */
  private async applyCacheUpdates() {
    // Generate batch updates from ID mappings
    const updates = idMappingService.generateCacheUpdates();

    // Apply the updates
    const updateResult =
      await cacheUpdateService.applyIdMappingUpdates(updates);

    // Clean up temporary entries
    const cleanupResult = await cacheUpdateService.cleanupTempEntries();

    // Combine results
    return {
      success: updateResult.success && cleanupResult.success,
      updatedClients: updateResult.updatedClients,
      updatedReceipts: updateResult.updatedReceipts,
      removedTempEntries: cleanupResult.removedTempEntries,
      errors: [...updateResult.errors, ...cleanupResult.errors],
    };
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
    // Remove temp fields and resolve any temp IDs
    const { tempId, ...cleanClientData } = clientData;
    const resolvedData = idMappingService.resolveIds(cleanClientData);

    // Ensure userID is set consistently across all documents
    const clientToCreate = {
      ...resolvedData,
      userID: userUID, // [Ensures userID field is set for consistency across collections][[memory:1081839693935955108]]
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

    // Register the mapping for later use
    idMappingService.addMapping(tempId, docRef.id, 'client');

    // Replace temp entity in cache with real entity
    await cacheUpdateService.replaceEntity(
      tempId,
      docRef.id,
      { ...finalClientData, id: docRef.id },
      'client'
    );
  }

  private async syncCreateReceipt(
    receiptData: PendingReceipt,
    userUID: string
  ): Promise<void> {
    // Remove temp fields and resolve any temp IDs
    const { tempId, ...cleanReceiptData } = receiptData;
    const resolvedData = idMappingService.resolveIds(cleanReceiptData);

    // Ensure userID is set consistently across all documents
    const receiptToCreate = {
      ...resolvedData,
      userID: userUID, // [Ensures userID field is set for consistency across collections][[memory:1081839693935955108]]
      date: new Date(resolvedData.date), // Ensure it's a proper Date object
    };

    // Create in Firebase
    const docRef = await addDoc(collection(db, 'receipts'), receiptToCreate);

    // Register the mapping
    idMappingService.addMapping(tempId, docRef.id, 'receipt');

    // Replace temp entity in cache with real entity
    await cacheUpdateService.replaceEntity(
      tempId,
      docRef.id,
      { ...receiptToCreate, id: docRef.id },
      'receipt'
    );
  }

  private async syncUpdateClient(
    clientData: any,
    userUID: string
  ): Promise<void> {
    const { id, ...updateData } = clientData;
    const resolvedData = idMappingService.resolveIds(updateData);

    await updateDoc(doc(db, 'clients', id), {
      ...resolvedData,
      userID: userUID, // [Ensures userID field is set for consistency across collections][[memory:1081839693935955108]]
    });
  }

  private async syncDeleteClient(
    clientId: string,
    userUID: string
  ): Promise<void> {
    await deleteDoc(doc(db, 'clients', clientId));

    // Remove from cache using the decoupled service
    await cacheUpdateService.removeEntity(clientId, 'client');
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

  // Debugging and monitoring methods
  async getSyncStatistics() {
    const pendingOpsCount = await this.getPendingOperationsCount();
    const mappingStats = idMappingService.getStats();

    return {
      isSyncing: this.isSyncing,
      pendingOperations: pendingOpsCount,
      idMappings: mappingStats,
      timestamp: Date.now(),
    };
  }

  async validateSync(): Promise<{ isValid: boolean; issues: string[] }> {
    const mappingValidation = idMappingService.validateMappings();
    const cacheConsistency = await cacheUpdateService.verifyCacheConsistency();

    return {
      isValid: mappingValidation.isValid && cacheConsistency.isConsistent,
      issues: [...mappingValidation.errors, ...cacheConsistency.issues],
    };
  }
}

// Export singleton instance
const syncService = new SyncService();
export { syncService };
export default syncService;
