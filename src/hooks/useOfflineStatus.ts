import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
}

export const useOfflineStatus = (): OfflineStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('App is back online', {
        component: 'useOfflineStatus',
        operation: 'handleOnline',
      });
      if (wasOffline) {
        // App was offline and is now back online
        if (process.env.NODE_ENV === 'development') {
          logger.info('App connectivity restored', {
            component: 'useOfflineStatus',
            operation: 'handleOnline',
          });
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      logger.info('App is now offline', {
        component: 'useOfflineStatus',
        operation: 'handleOffline',
      });
      if (process.env.NODE_ENV === 'development') {
        logger.info('App connectivity lost', {
          component: 'useOfflineStatus',
          operation: 'handleOffline',
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
  };
};
