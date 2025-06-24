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
  const [syncProtectionActive, setSyncProtectionActive] = useState(false);

  // Update pending operations count
  const updatePendingCount = useCallback(async () => {
    const count = await syncService.getPendingOperationsCount();
    setPendingOperationsCount(count);
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    if (!user || !isOnline) {
      return null;
    }

    // Check if already syncing using state directly to avoid dependency loop
    if (syncService.getIsSyncing()) {
      return null;
    }

    setIsSyncing(true);
    setSyncProtectionActive(true);

    try {
      const result = await syncService.syncPendingOperations(user.uid);
      setLastSyncResult(result);
      updatePendingCount();

      // Keep sync protection active for longer after completion
      setTimeout(() => {
        setSyncProtectionActive(false);
        if (process.env.NODE_ENV === 'development') {
          console.log('🛡️ Sync protection deactivated - data fetching allowed');
        }
      }, 2000); // Extended protection period

      return result;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Manual sync failed:', error);
      }
      setSyncProtectionActive(false);
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
  }, [user, isOnline, updatePendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkAndSync = async () => {
      if (
        user &&
        isOnline &&
        !syncService.getIsSyncing() &&
        (await syncService.hasPendingOperations())
      ) {
        if (process.env.NODE_ENV === 'development') {
          console.log(
            '🔄 User came back online with pending operations, starting auto-sync'
          );
        }

        // Wait longer to ensure stable connection and prevent race conditions
        timeoutId = setTimeout(async () => {
          try {
            await triggerSync();

            // After sync completes, trigger a refresh of data to ensure consistency
            setTimeout(() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('📱 Sync completed, triggering data refresh...');
              }
              // Trigger a custom event that components can listen to for data refresh
              window.dispatchEvent(new CustomEvent('sync-completed'));
            }, 500);
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Auto-sync failed:', error);
            }
          }
        }, 3000); // Increased to 3 seconds for better stability
      }
    };

    if (user && isOnline) {
      checkAndSync();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, isOnline, triggerSync]);

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
    async (clientData: any) => {
      if (!user) return null;

      const tempId = await offlineStorage.addPendingClient({
        ...clientData,
        userID: user.uid,
      });

      await updatePendingCount();
      return tempId;
    },
    [user, updatePendingCount]
  );

  // Helper function to add offline receipt
  const addOfflineReceipt = useCallback(
    async (receiptData: any) => {
      if (!user) return null;

      const tempId = await offlineStorage.addPendingReceipt({
        ...receiptData,
        userID: user.uid,
      });

      await updatePendingCount();
      return tempId;
    },
    [user, updatePendingCount]
  );

  return {
    // Sync status
    isSyncing: isSyncing || syncService.getIsSyncing() || syncProtectionActive,
    lastSyncResult,
    pendingOperationsCount,
    hasPendingOperations: pendingOperationsCount > 0,

    // Actions
    triggerSync,
    addOfflineClient,
    addOfflineReceipt,

    // Utilities
    canAddOffline: !!user && (isOnline || isOffline), // Can add both online and offline
    shouldShowSyncIndicator: pendingOperationsCount > 0 || syncProtectionActive,
  };
};
