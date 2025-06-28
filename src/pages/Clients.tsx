import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
  deleteDoc,
  updateDoc,
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import AddClientModal from '../components/AddClientModal';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { offlineStorage } from '../utils/offlineStorage';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { normalizePolishText, createSearchableText } from '../utils/textUtils';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
import { useNavigate } from 'react-router-dom';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Client as BaseClient } from '../types/receipt';
import { createSanitizedInputHandler } from '../utils/inputSanitizer';

type Client = BaseClient & {
  name_lowercase?: string;
  receiptCount?: number;
  // New normalized fields
  name_normalized?: string;
  address_normalized?: string;
  documentNumber_normalized?: string;
  postalCode_normalized?: string;
  city_normalized?: string;
  fullAddress_normalized?: string;
};

const Clients: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isOffline } = useOfflineStatus();
  useOfflineSync(); // Initialize sync functionality
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [pageSnapshots, setPageSnapshots] = useState<{
    [page: number]: QueryDocumentSnapshot<DocumentData> | null;
  }>({ 1: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [receiptCounts, setReceiptCounts] = useState<{
    [clientId: string]: number;
  }>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Create sanitized search input handler
  const handleSearchChange = createSanitizedInputHandler(setSearchTerm, {
    maxLength: 500,
    preserveWhitespace: false,
  });

  const fetchReceiptCounts = useCallback(async () => {
    if (!user) return;

    try {
      // Get all receipts for the user
      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid)
      );
      const receiptsSnapshot = await getDocs(receiptsQuery);

      // Count receipts per client
      const counts: { [clientId: string]: number } = {};
      receiptsSnapshot.docs.forEach(doc => {
        const receipt = doc.data();
        const clientId = receipt.clientId;
        if (clientId) {
          counts[clientId] = (counts[clientId] || 0) + 1;
        }
      });

      setReceiptCounts(counts);
    } catch (error) {
      // Receipt counts will default to 0 if fetch fails
    }
  }, [user]);

  const fetchClients = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // If offline, use cached data
      if (isOffline) {
        const cachedClients = await offlineStorage.getCachedClients();

        let allClients = cachedClients;

        // Apply search filter if active
        if (activeSearchTerm) {
          const normalizedSearchTerm = normalizePolishText(activeSearchTerm);

          allClients = cachedClients.filter(client => {
            // Use searchableText if available, otherwise create it from individual fields
            const searchableText =
              client.searchableText ||
              createSearchableText([
                client.name,
                client.address,
                client.documentNumber,
                client.postalCode || '',
                client.city || '',
                client.fullAddress || '',
              ]);

            // Also check individual normalized fields for better compatibility
            const normalizedClientName = normalizePolishText(client.name);
            const normalizedClientAddress = normalizePolishText(
              client.address || ''
            );
            const normalizedDocumentNumber = normalizePolishText(
              client.documentNumber || ''
            );
            const normalizedPostalCode = normalizePolishText(
              client.postalCode || ''
            );
            const normalizedCity = normalizePolishText(client.city || '');
            const normalizedFullAddress = normalizePolishText(
              client.fullAddress || ''
            );

            return (
              searchableText.includes(normalizedSearchTerm) ||
              normalizedClientName.includes(normalizedSearchTerm) ||
              normalizedClientAddress.includes(normalizedSearchTerm) ||
              normalizedDocumentNumber.includes(normalizedSearchTerm) ||
              normalizedPostalCode.includes(normalizedSearchTerm) ||
              normalizedCity.includes(normalizedSearchTerm) ||
              normalizedFullAddress.includes(normalizedSearchTerm)
            );
          });
        }

        // Sort by name for consistent results
        allClients.sort((a, b) => a.name.localeCompare(b.name));

        // Apply pagination
        setTotalPages(Math.ceil(allClients.length / itemsPerPage));
        const start = (currentPage - 1) * itemsPerPage;
        const paginated = allClients.slice(start, start + itemsPerPage);
        setClients(paginated);
        return;
      }

      // Online mode - fetch from Firebase
      const clientsCollection = collection(db, 'clients');

      if (activeSearchTerm) {
        // Optimized search: try server-side filtering first, fallback to client-side
        const normalizedSearchTerm = normalizePolishText(activeSearchTerm);

        try {
          // For search, fetch all user's clients and filter client-side to support "contains" search
          const allClientsQuery = query(
            clientsCollection,
            where('userID', '==', user.uid)
          );

          const allClientsSnapshot = await getDocs(allClientsQuery);
          const allClients = allClientsSnapshot.docs.map(
            doc => ({ ...doc.data(), id: doc.id }) as Client
          );

          // Cache the clients for offline use
          offlineStorage.cacheClients(allClients);

          // Filter clients that contain the search term anywhere in their searchable fields
          const filteredClients = allClients.filter(client => {
            // Use searchableText if available, otherwise create it from individual fields
            const searchableText =
              client.searchableText ||
              createSearchableText([
                client.name,
                client.address,
                client.documentNumber,
                client.postalCode || '',
                client.city || '',
                client.fullAddress || '',
              ]);

            // Also check individual normalized fields for better compatibility
            const normalizedClientName = normalizePolishText(client.name);
            const normalizedClientAddress = normalizePolishText(
              client.address || ''
            );
            const normalizedDocumentNumber = normalizePolishText(
              client.documentNumber || ''
            );
            const normalizedPostalCode = normalizePolishText(
              client.postalCode || ''
            );
            const normalizedCity = normalizePolishText(client.city || '');
            const normalizedFullAddress = normalizePolishText(
              client.fullAddress || ''
            );

            return (
              searchableText.includes(normalizedSearchTerm) ||
              normalizedClientName.includes(normalizedSearchTerm) ||
              normalizedClientAddress.includes(normalizedSearchTerm) ||
              normalizedDocumentNumber.includes(normalizedSearchTerm) ||
              normalizedPostalCode.includes(normalizedSearchTerm) ||
              normalizedCity.includes(normalizedSearchTerm) ||
              normalizedFullAddress.includes(normalizedSearchTerm)
            );
          });

          // Sort by name for consistent results
          filteredClients.sort((a, b) => a.name.localeCompare(b.name));

          setTotalPages(Math.ceil(filteredClients.length / itemsPerPage));
          const start = (currentPage - 1) * itemsPerPage;
          const paginated = filteredClients.slice(start, start + itemsPerPage);
          setClients(paginated);
        } catch (searchError) {
          // Fallback to client-side filtering if server-side search fails
          logger.warn(
            'Server-side search failed, falling back to client-side filtering',
            isErrorWithMessage(searchError) ? searchError : undefined,
            {
              component: 'Clients',
              operation: 'fetchClients',
              userId: user.uid,
              extra: { searchTerm: activeSearchTerm },
            }
          );

          const allClientsQuery = query(
            clientsCollection,
            where('userID', '==', user.uid),
            orderBy('name_lowercase')
          );
          const querySnapshot = await getDocs(allClientsQuery);
          const allClients = querySnapshot.docs.map(
            doc => ({ ...doc.data(), id: doc.id }) as Client
          );

          // Cache the clients for offline use
          await offlineStorage.cacheClients(allClients);

          const filteredClients = allClients.filter(client => {
            const normalizedClientName = normalizePolishText(client.name);
            const normalizedClientAddress = normalizePolishText(
              client.address || ''
            );
            const normalizedDocumentNumber = normalizePolishText(
              client.documentNumber || ''
            );
            const normalizedPostalCode = normalizePolishText(
              client.postalCode || ''
            );
            const normalizedCity = normalizePolishText(client.city || '');
            const normalizedFullAddress = normalizePolishText(
              client.fullAddress || ''
            );

            return (
              normalizedClientName.includes(normalizedSearchTerm) ||
              normalizedClientAddress.includes(normalizedSearchTerm) ||
              normalizedDocumentNumber.includes(normalizedSearchTerm) ||
              normalizedPostalCode.includes(normalizedSearchTerm) ||
              normalizedCity.includes(normalizedSearchTerm) ||
              normalizedFullAddress.includes(normalizedSearchTerm)
            );
          });

          setTotalPages(Math.ceil(filteredClients.length / itemsPerPage));
          const start = (currentPage - 1) * itemsPerPage;
          const paginated = filteredClients.slice(start, start + itemsPerPage);
          setClients(paginated);
        }
      } else {
        // Default: server-side pagination
        const baseQuery = query(
          clientsCollection,
          where('userID', '==', user.uid),
          orderBy('name')
        );

        const countSnapshot = await getCountFromServer(baseQuery);
        const totalClients = countSnapshot.data().count;
        setTotalPages(Math.ceil(totalClients / itemsPerPage));

        let clientsQuery = query(baseQuery, limit(itemsPerPage));

        if (currentPage > 1 && pageSnapshots[currentPage]) {
          clientsQuery = query(
            baseQuery,
            startAfter(pageSnapshots[currentPage]),
            limit(itemsPerPage)
          );
        }

        const documentSnapshots = await getDocs(clientsQuery);
        const clientsData = documentSnapshots.docs.map(
          doc => ({ ...doc.data(), id: doc.id }) as Client
        );

        // Cache the clients for offline use
        await offlineStorage.cacheClients(clientsData);

        const lastDoc =
          documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setLastVisible(lastDoc || null);

        setClients(clientsData);
      }

      // Fetch receipt counts for all clients (skip when offline)
      if (!isOffline) {
        await fetchReceiptCounts();
      }
    } catch (error) {
      // If online fetch fails, try to use cached data as fallback
      if (!isOffline) {
        logger.warn(
          'Online fetch failed, trying cached data',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'Clients',
            operation: 'fetchClients',
            userId: user.uid,
          }
        );
        const cachedClients = await offlineStorage.getCachedClients();
        if (cachedClients.length > 0) {
          setClients(cachedClients.slice(0, itemsPerPage));
          setTotalPages(Math.ceil(cachedClients.length / itemsPerPage));
          toast.error(
            'Błąd połączenia z serwerem. Wyświetlane są dane z cache.'
          );
        } else {
          setClients([]);
        }
      } else {
        setClients([]);
      }
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    itemsPerPage,
    pageSnapshots,
    activeSearchTerm,
    user,
    fetchReceiptCounts,
    isOffline,
  ]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearch = () => {
    if (!user) return;
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  const handleClearSearch = () => {
    if (!user) return;
    setSearchTerm('');
    setActiveSearchTerm('');
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  const handlePageChange = (page: number) => {
    if (!user) return;
    if (page >= 1 && page <= totalPages) {
      if (page > currentPage) {
        setPageSnapshots(prev => ({ ...prev, [page]: lastVisible }));
      }
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    if (!user) return;
    setItemsPerPage(Number(event.target.value));
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  const handleClientAdded = () => {
    if (!user) return;
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
    if (activeSearchTerm) {
      setActiveSearchTerm('');
      setSearchTerm('');
    }
    fetchClients();
  };

  const handleEditClient = (client: Client) => {
    if (!user) return;
    setEditingClient(client);
    setIsEditModalOpen(true);
  };

  const handleUpdateClient = async (updatedClient?: Omit<Client, 'id'>) => {
    if (!user || !editingClient || !updatedClient) return;

    try {
      // Create fullAddress field
      const addressParts = [];
      if (updatedClient.address.trim())
        addressParts.push(updatedClient.address.trim());
      if (updatedClient.postalCode?.trim() || updatedClient.city?.trim()) {
        const locationPart = [
          updatedClient.postalCode?.trim(),
          updatedClient.city?.trim(),
        ]
          .filter(Boolean)
          .join(' ');
        if (locationPart) addressParts.push(locationPart);
      }
      const fullAddress = addressParts.join(', ');

      await updateDoc(doc(db, 'clients', editingClient.id), {
        name: updatedClient.name,
        address: updatedClient.address,
        documentNumber: updatedClient.documentNumber,
        postalCode: updatedClient.postalCode,
        city: updatedClient.city,
        fullAddress: fullAddress,
        name_lowercase: updatedClient.name.toLowerCase(),
        name_normalized: normalizePolishText(updatedClient.name),
        address_normalized: normalizePolishText(updatedClient.address),
        documentNumber_normalized: normalizePolishText(
          updatedClient.documentNumber
        ),
        postalCode_normalized: normalizePolishText(
          updatedClient.postalCode || ''
        ),
        city_normalized: normalizePolishText(updatedClient.city || ''),
        fullAddress_normalized: normalizePolishText(fullAddress),
        searchableText: createSearchableText([
          updatedClient.name,
          updatedClient.address,
          updatedClient.documentNumber,
          updatedClient.postalCode || '',
          updatedClient.city || '',
          fullAddress,
        ]),
      });
      setIsEditModalOpen(false);
      setEditingClient(null);
      fetchClients();
      toast.success('Klient został zaktualizowany.');
    } catch (error) {
      toast.error('Błąd aktualizowania klienta. Proszę spróbować ponownie.');
    }
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    if (!user) return;

    setClientToDelete({ id: clientId, name: clientName });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteClient = async () => {
    if (!user || !clientToDelete) return;

    try {
      await deleteDoc(doc(db, 'clients', clientToDelete.id));
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
      fetchClients();
      toast.success('Klient został usunięty.');
    } catch (error) {
      toast.error('Błąd usuwania klienta. Proszę spróbować ponownie.');
    }
  };

  const cancelDeleteClient = () => {
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const Controls = () => (
    <div className="flex justify-between items-center mt-4">
      <button
        onClick={() => {
          if (!user) return;
          setIsModalOpen(true);
        }}
        disabled={!user}
        className="px-4 py-2 text-sm font-medium text-white bg-orange-700 rounded-md hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Dodaj Klienta
      </button>
      <div className="flex items-center space-x-4">
        <div>
          <select
            id="items-per-page"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            disabled={!user}
            className="block w-24 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-50"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <span className="text-sm text-gray-700">
          {currentPage}/{totalPages}
        </span>
        <div>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading || !user}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900 disabled:opacity-50"
          >
            Poprzednia
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading || !user}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-r border-0 border-l border-gray-700 hover:bg-gray-900 disabled:opacity-50"
          >
            Następna
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">Klienci</h1>
      <p className="mt-4 text-gray-600">Zarządzaj swoimi klientami tutaj.</p>

      <div className="mt-6 flex items-center">
        <input
          type="text"
          placeholder="Szukaj po nazwie, adresie lub numerze dokumentu..."
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          disabled={!user}
          className="w-full md:w-1/3 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-l-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSearch}
          disabled={!user}
          className="px-4 py-2 text-white bg-indigo-600 rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Szukaj
        </button>
        {activeSearchTerm && (
          <button
            onClick={handleClearSearch}
            disabled={!user}
            className="ml-2 px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Wyczyść
          </button>
        )}
      </div>

      <div className="mt-8">
        <Controls />
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="w-1/5 text-left py-3 px-4 uppercase font-semibold text-sm">
                  Nazwisko i Imię
                </th>
                <th className="w-1/5 text-left py-3 px-4 uppercase font-semibold text-sm">
                  Pełny Adres
                </th>
                <th className="w-1/5 text-left py-3 px-4 uppercase font-semibold text-sm">
                  Numer Dokumentu
                </th>
                <th className="w-1/5 text-center py-3 px-4 uppercase font-semibold text-sm">
                  Kwity
                </th>
                <th className="w-1/5 text-center py-3 px-4 uppercase font-semibold text-sm">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    Ładowanie...
                  </td>
                </tr>
              ) : (
                clients.map(client => (
                  <tr key={client.id} className="border-b">
                    <td className="w-1/5 text-left py-3 px-4">
                      <button
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className="text-orange-700 hover:text-orange-900 hover:underline font-medium focus:outline-none focus:underline"
                      >
                        {client.name}
                      </button>
                    </td>
                    <td className="w-1/5 text-left py-3 px-4">
                      {client.fullAddress || client.address}
                    </td>
                    <td className="w-1/5 text-left py-3 px-4">
                      {client.documentNumber}
                    </td>
                    <td className="w-1/5 text-center py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {receiptCounts[client.id] || 0}
                      </span>
                    </td>
                    <td className="w-1/5 text-center py-3 px-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50"
                          aria-label="Edytuj klienta"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="m18.5 2.5 3 3L10 17l-4 1 1-4 11.5-11.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteClient(client.id, client.name)
                          }
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                          aria-label="Usuń klienta"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {clients.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    Nie znaleziono klientów.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Controls />
      </div>
      <AddClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onClientAdded={handleClientAdded}
      />
      {editingClient && (
        <AddClientModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingClient(null);
          }}
          onClientAdded={handleUpdateClient}
          initialData={{
            name: editingClient.name,
            address: editingClient.address,
            documentNumber: editingClient.documentNumber,
            postalCode: editingClient.postalCode || '',
            city: editingClient.city || '',
            fullAddress: editingClient.fullAddress || '',
          }}
        />
      )}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Usuń Klienta"
        message={`Czy na pewno chcesz usunąć klienta "${clientToDelete?.name}"? Ta operacja jest nieodwracalna.`}
        confirmButtonText="Usuń"
        cancelButtonText="Anuluj"
        onConfirm={confirmDeleteClient}
        onCancel={cancelDeleteClient}
        isDangerous={true}
      />
    </div>
  );
};

export default Clients;
