import React from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

const SyncIndicator: React.FC = () => {
  const { 
    isSyncing, 
    pendingOperationsCount, 
    hasPendingOperations, 
    triggerSync 
  } = useOfflineSync();
  const { isOnline, isOffline } = useOfflineStatus();

  // Don't show if no pending operations
  if (!hasPendingOperations) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex items-center space-x-3 max-w-sm">
        {/* Icon */}
        <div className={`w-3 h-3 rounded-full ${
          isSyncing 
            ? 'bg-blue-500 animate-pulse' 
            : isOffline 
              ? 'bg-orange-500' 
              : 'bg-green-500'
        }`} />
        
        {/* Status text */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {isSyncing 
              ? 'Synchronizacja...' 
              : isOffline 
                ? `${pendingOperationsCount} operacji offline`
                : `${pendingOperationsCount} do synchronizacji`
            }
          </div>
          {isOffline && (
            <div className="text-xs text-gray-500">
              Synchronizacja po powrocie online
            </div>
          )}
        </div>

        {/* Manual sync button (only when online and not syncing) */}
        {isOnline && !isSyncing && (
          <button
            onClick={triggerSync}
            className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
          >
            Synchronizuj
          </button>
        )}

        {/* Syncing spinner */}
        {isSyncing && (
          <div className="w-4 h-4">
            <svg className="animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncIndicator; 