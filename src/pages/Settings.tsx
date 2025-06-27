import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CompanyDetailsForm from '../components/settings/CompanyDetailsForm';
import PasswordChangeForm from '../components/settings/PasswordChangeForm';
import DataExportSection from '../components/settings/DataExportSection';
import DataImportSection from '../components/settings/DataImportSection';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';

interface CacheInfo {
  clientsCount: number;
  receiptsCount: number;
}

type SettingsTab = 'company' | 'password' | 'import-export' | 'offline';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const { isOnline } = useOfflineStatus();

  const handleSuccess = useCallback((message: string) => {
    setGlobalMessage({ type: 'success', text: message });
    const timeoutId = setTimeout(() => setGlobalMessage(null), 5000);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleError = useCallback((message: string) => {
    setGlobalMessage({ type: 'error', text: message });
    const timeoutId = setTimeout(() => setGlobalMessage(null), 5000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      // This will clean up any pending timeouts when component unmounts
    };
  }, []);

  useEffect(() => {
    const loadCacheInfo = async () => {
      const info = await offlineStorage.getCacheInfo();
      setCacheInfo(info);
    };
    loadCacheInfo();
  }, []);

  // Tab navigation component
  const TabNavigation = () => {
    const tabs: { key: SettingsTab; label: string; icon: string }[] = [
      {
        key: 'company',
        label: 'Dane Firmy',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      },
      {
        key: 'password',
        label: 'Zmiana Hasła',
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      },
      {
        key: 'import-export',
        label: 'Import / Export',
        icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10',
      },
      {
        key: 'offline',
        label: 'Dane Offline',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      },
    ];

    return (
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tab.key
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={tab.icon}
                  />
                </svg>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>
    );
  };

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

      {/* Tab Navigation and Content */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <TabNavigation />

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'company' && (
            <CompanyDetailsForm
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}

          {activeTab === 'password' && (
            <PasswordChangeForm
              onSuccess={handleSuccess}
              onError={handleError}
            />
          )}

          {activeTab === 'import-export' && (
            <div className="space-y-8">
              <DataExportSection
                onSuccess={handleSuccess}
                onError={handleError}
              />
              <DataImportSection
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </div>
          )}

          {activeTab === 'offline' && (
            <div>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
