import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { offlineStorage, PendingOperation } from '../utils/offlineStorage';
import { Client, Receipt, Product, Category } from '../types/receipt';

const OfflineData: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, isOffline } = useOfflineStatus();
  const { triggerSync, isSyncing, pendingOperationsCount } = useOfflineSync();
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [cachedClients, setCachedClients] = useState<Client[]>([]);
  const [cachedReceipts, setCachedReceipts] = useState<Receipt[]>([]);
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [pendingOperations, setPendingOperations] = useState<
    PendingOperation[]
  >([]);

  useEffect(() => {
    if (user) {
      loadCacheInfo();
    }
  }, [user]);

  const loadCacheInfo = async () => {
    const info = await offlineStorage.getCacheInfo();
    setCacheInfo(info);
    setCachedClients(await offlineStorage.getCachedClients());
    setCachedReceipts(await offlineStorage.getCachedReceipts());
    setCachedProducts(await offlineStorage.getCachedProducts());
    setCachedCategories(await offlineStorage.getCachedCategories());
    setPendingOperations(await offlineStorage.getPendingOperations());
  };

  const clearCache = () => {
    if (
      window.confirm(
        'Czy na pewno chcesz wyczyścić cache offline? Spowoduje to usunięcie wszystkich danych dostępnych offline.'
      )
    ) {
      offlineStorage.clearCache();
      loadCacheInfo();
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">
          Zaloguj się, aby wyświetlić dane offline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Dane Offline</h1>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
          ></div>
          <span className="text-sm font-medium text-gray-600">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {isOffline && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-blue-600 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-blue-800">
              Jesteś w trybie offline. Poniżej widzisz dane zapisane lokalnie,
              które są dostępne bez połączenia z internetem.
            </p>
          </div>
        </div>
      )}

      {/* Cache Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Informacje o Cache
        </h2>
        {cacheInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">
                Ostatnia synchronizacja
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.lastSync}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">Klienci</h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.clientsCount}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">Kwity</h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.receiptsCount}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">Produkty</h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.productsCount || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">Kategorie</h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.categoriesCount || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">
                Oczekujące operacje
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                {cacheInfo.pendingOperationsCount || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">
                Rozmiar cache
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                {formatBytes(cacheInfo.storageSize)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Ładowanie informacji o cache...</p>
        )}

        <div className="mt-6 flex space-x-4">
          <button
            onClick={loadCacheInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Odśwież
          </button>
          {isOnline && pendingOperationsCount > 0 && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing
                ? 'Synchronizowanie...'
                : `Synchronizuj (${pendingOperationsCount})`}
            </button>
          )}
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Wyczyść Cache
          </button>
        </div>
      </div>

      {/* Pending Operations */}
      {pendingOperations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Oczekujące Operacje
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data utworzenia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Próby synchronizacji
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Szczegóły
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingOperations.map(operation => (
                  <tr key={operation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          operation.type === 'CREATE_CLIENT'
                            ? 'bg-blue-100 text-blue-800'
                            : operation.type === 'CREATE_RECEIPT'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {operation.type === 'CREATE_CLIENT'
                          ? 'Nowy Klient'
                          : operation.type === 'CREATE_RECEIPT'
                            ? 'Nowy Kwit'
                            : operation.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(operation.timestamp).toLocaleString('pl-PL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {operation.retryCount} / 3
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {operation.type === 'CREATE_CLIENT' &&
                      operation.data?.name
                        ? `Klient: ${operation.data.name}`
                        : operation.type === 'CREATE_RECEIPT' &&
                            operation.data?.number
                          ? `Kwit: ${operation.data.number}`
                          : 'Szczegóły niedostępne'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cached Clients */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Klienci (Cache)
          </h2>
        </div>

        {cachedClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nazwa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adres
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numer Dokumentu
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cachedClients.slice(0, 10).map(client => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.fullAddress || client.address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.documentNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cachedClients.length > 10 && (
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                Wyświetlono 10 z {cachedClients.length} klientów
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Brak klientów w cache
          </div>
        )}
      </div>

      {/* Cached Receipts */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Ostatnie Kwity (Cache)
          </h2>
        </div>

        {cachedReceipts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klient
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kwota
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cachedReceipts.slice(0, 10).map(receipt => {
                  const client = cachedClients.find(
                    c => c.id === receipt.clientId
                  );
                  return (
                    <tr key={receipt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {receipt.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(receipt.date).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {client
                          ? client.name
                          : receipt.clientName || 'Nieznany Klient'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {new Intl.NumberFormat('pl-PL', {
                          style: 'currency',
                          currency: 'PLN',
                        }).format(receipt.totalAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cachedReceipts.length > 10 && (
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                Wyświetlono 10 z {cachedReceipts.length} kwitów
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Brak kwitów w cache
          </div>
        )}
      </div>

      {/* Cached Products */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Produkty (Cache)
          </h2>
        </div>

        {cachedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nazwa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategoria
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cena zakupu
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cena sprzedaży
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cachedProducts.slice(0, 10).map(product => {
                  const category = cachedCategories.find(
                    c => c.id === product.categoryId
                  );
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.itemCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category ? category.name : 'Brak kategorii'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {new Intl.NumberFormat('pl-PL', {
                          style: 'currency',
                          currency: 'PLN',
                        }).format(product.buy_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {new Intl.NumberFormat('pl-PL', {
                          style: 'currency',
                          currency: 'PLN',
                        }).format(product.sell_price)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cachedProducts.length > 10 && (
              <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500">
                Wyświetlono 10 z {cachedProducts.length} produktów
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Brak produktów w cache
          </div>
        )}
      </div>

      {/* Cached Categories */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Kategorie (Cache)
          </h2>
        </div>

        {cachedCategories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nazwa
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Liczba produktów
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cachedCategories.map(category => {
                  const productCount = cachedProducts.filter(
                    p => p.categoryId === category.id
                  ).length;
                  return (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {productCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Brak kategorii w cache
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineData;
