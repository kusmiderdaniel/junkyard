import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CompanyDetailsForm from '../components/settings/CompanyDetailsForm';
import PasswordChangeForm from '../components/settings/PasswordChangeForm';
import DataExportSection from '../components/settings/DataExportSection';
import DataImportSection from '../components/settings/DataImportSection';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';

const Settings: React.FC = () => {
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const { isOnline } = useOfflineStatus();

  const handleSuccess = useCallback((message: string) => {
    setGlobalMessage({ type: 'success', text: message });
    setTimeout(() => setGlobalMessage(null), 5000);
  }, []);

  const handleError = useCallback((message: string) => {
    setGlobalMessage({ type: 'error', text: message });
    setTimeout(() => setGlobalMessage(null), 5000);
  }, []);

  useEffect(() => {
    const loadCacheInfo = async () => {
      const info = await offlineStorage.getCacheInfo();
      setCacheInfo(info);
    };
    loadCacheInfo();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Ustawienia</h1>
        <p className="mt-4 text-gray-600">
          Zarządzaj swoim kontem i danymi aplikacji
        </p>
      </div>

      {/* Global Message */}
      {globalMessage && (
        <div
          className={`mb-6 p-4 rounded-md ${
            globalMessage.type === 'success'
              ? 'bg-green-50 border border-green-300 text-green-700'
              : 'bg-red-50 border border-red-300 text-red-700'
          }`}
        >
          {globalMessage.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Company Details Section */}
        <CompanyDetailsForm onSuccess={handleSuccess} onError={handleError} />

        {/* Password Change Section */}
        <PasswordChangeForm onSuccess={handleSuccess} onError={handleError} />

        {/* Data Export Section */}
        <DataExportSection onSuccess={handleSuccess} onError={handleError} />

        {/* Data Import Section */}
        <DataImportSection onSuccess={handleSuccess} onError={handleError} />

        {/* Offline Data Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Dane Offline
          </h2>
          <p className="text-gray-600 mb-4">
            Zarządzaj danymi dostępnymi offline w aplikacji PWA. Dane są
            automatycznie cachowane gdy jesteś online.
          </p>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <span className="text-sm font-medium text-gray-700">
                Status: {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {cacheInfo && (
              <div className="text-sm text-gray-600">
                Cache: {cacheInfo.clientsCount} klientów,{' '}
                {cacheInfo.receiptsCount} kwitów
              </div>
            )}
          </div>

          <Link
            to="/offline-data"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Zarządzaj Danymi Offline
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Settings;
