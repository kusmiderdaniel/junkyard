import React from 'react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

const OfflineIndicator: React.FC = () => {
  const { isOffline } = useOfflineStatus();

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 text-center text-sm font-medium shadow-lg">
      <div className="flex items-center justify-center space-x-2">
        <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Brak połączenia z internetem - niektóre funkcje mogą być niedostępne</span>
      </div>
    </div>
  );
};

export default OfflineIndicator; 