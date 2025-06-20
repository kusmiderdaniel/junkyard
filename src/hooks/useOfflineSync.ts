import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from './useOfflineStatus';
import { syncService, SyncResult } from '../utils/syncService';
import { offlineStorage } from '../utils/offlineStorage';

export const useOfflineSync = () => {
  const { user } = useAuth();
  const { isOnline, isOffline } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingOperationsCount, setPendingOperationsCount] = useState(0);

  // Update pending operations count
  const updatePendingCount = useCallback(() => {
    setPendingOperationsCount(syncService.getPendingOperationsCount());
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    if (!user || !isOnline || isSyncing) {
      return null;
    }

    setIsSyncing(true);
    try {
      const result = await syncService.syncPendingOperations(user.uid);
      setLastSyncResult(result);
      updatePendingCount();
      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Manual sync failed:', error);
      }
      const errorResult: SyncResult = {
        success: false,
        syncedOperations: 0,
        failedOperations: 1,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      };
      setLastSyncResult(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }, [user, isOnline, isSyncing, updatePendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (user && isOnline && !isSyncing && syncService.hasPendingOperations()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '🔄 User came back online with pending operations, starting auto-sync'
        );
      }
      const timeoutId = setTimeout(() => {
        triggerSync();
      }, 2000); // Wait 2 seconds to ensure stable connection

      return () => clearTimeout(timeoutId);
    }
  }, [user, isOnline, isSyncing, triggerSync]);

  // Update pending count when operations are added
  useEffect(() => {
    updatePendingCount();

    // Set up periodic updates to catch changes from other components
    const interval = setInterval(updatePendingCount, 1000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Listen for sync completion events
  useEffect(() => {
    const onSyncComplete = (result: SyncResult) => {
      setLastSyncResult(result);
      setIsSyncing(false);
      updatePendingCount();
    };

    syncService.onSyncComplete(onSyncComplete);

    return () => {
      syncService.removeSyncCallback(onSyncComplete);
    };
  }, [updatePendingCount]);

  // Helper function to add offline client
  const addOfflineClient = useCallback(
    (clientData: any) => {
      if (!user) return null;

      const tempId = offlineStorage.addPendingClient({
        ...clientData,
        userID: user.uid,
      });

      updatePendingCount();
      return tempId;
    },
    [user, updatePendingCount]
  );

  // Helper function to add offline receipt
  const addOfflineReceipt = useCallback(
    (receiptData: any) => {
      if (!user) return null;

      const tempId = offlineStorage.addPendingReceipt({
        ...receiptData,
        userID: user.uid,
      });

      updatePendingCount();
      return tempId;
    },
    [user, updatePendingCount]
  );

  return {
    // Sync status
    isSyncing: isSyncing || syncService.getIsSyncing(),
    lastSyncResult,
    pendingOperationsCount,
    hasPendingOperations: pendingOperationsCount > 0,

    // Actions
    triggerSync,
    addOfflineClient,
    addOfflineReceipt,

    // Utilities
    canAddOffline: !!user && (isOnline || isOffline), // Can add both online and offline
    shouldShowSyncIndicator: pendingOperationsCount > 0,
  };
};
