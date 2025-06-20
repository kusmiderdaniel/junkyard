import { useState, useEffect } from 'react';

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
      if (wasOffline) {
        // App was offline and is now back online
        console.log('App is back online');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      console.log('App is now offline');
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
    wasOffline
  };
}; 