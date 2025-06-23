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

    this.isSyncing = true;
    const pendingOperations = offlineStorage.getPendingOperations();

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
        offlineStorage.removePendingOperation(operation.id);
        result.syncedOperations++;
      } catch (error) {
        console.error(
          `❌ Failed to sync operation: ${operation.type} (${operation.id})`,
          error
        );
        result.failedOperations++;
        result.errors.push(
          `${operation.type}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Increment retry count
        offlineStorage.updatePendingOperation(operation.id, {
          retryCount: operation.retryCount + 1,
        });

        // Remove operation if it has failed too many times
        if (operation.retryCount >= 3) {
          offlineStorage.removePendingOperation(operation.id);
          result.errors.push(
            `${operation.type}: Removed after 3 failed attempts`
          );
        }
      }
    }

    if (result.failedOperations > 0) {
      result.success = false;
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

    // Update local cache to replace temp client with real one
    this.updateCachedClientId(tempId, docRef.id, finalClientData);
  }

  private async syncCreateReceipt(
    receiptData: PendingReceipt,
    userUID: string
  ): Promise<void> {
    // Remove temp fields
    const { tempId, ...cleanReceiptData } = receiptData;

    // Ensure userID is set and convert Date object to Firestore timestamp
    const receiptToCreate = {
      ...cleanReceiptData,
      userID: userUID,
      date: new Date(cleanReceiptData.date), // Ensure it's a proper Date object
    };

    // Create in Firebase
    const docRef = await addDoc(collection(db, 'receipts'), receiptToCreate);

    // Update local cache to replace temp receipt with real one
    this.updateCachedReceiptId(tempId, docRef.id, receiptToCreate);
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
    const cachedClients = offlineStorage.getCachedClients();
    const filtered = cachedClients.filter(client => client.id !== clientId);
    offlineStorage.cacheClients(filtered);
  }

  private updateCachedClientId(
    tempId: string,
    realId: string,
    clientData: any
  ): void {
    const cachedClients = offlineStorage.getCachedClients();
    const index = cachedClients.findIndex(client => client.id === tempId);

    if (index !== -1) {
      cachedClients[index] = { ...clientData, id: realId };
      offlineStorage.cacheClients(cachedClients);
    }
  }

  private updateCachedReceiptId(
    tempId: string,
    realId: string,
    receiptData: any
  ): void {
    const cachedReceipts = offlineStorage.getCachedReceipts();
    const index = cachedReceipts.findIndex(receipt => receipt.id === tempId);

    if (index !== -1) {
      cachedReceipts[index] = { ...receiptData, id: realId };
      offlineStorage.cacheReceipts(cachedReceipts);
    }
  }

  // Get sync status
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  // Check if there are pending operations
  hasPendingOperations(): boolean {
    return offlineStorage.getPendingOperations().length > 0;
  }

  // Get pending operations count
  getPendingOperationsCount(): number {
    return offlineStorage.getPendingOperations().length;
  }
}

// Export singleton instance
export const syncService = new SyncService();
