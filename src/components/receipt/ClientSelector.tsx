import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { offlineStorage } from '../../utils/offlineStorage';
import AddClientModal from '../AddClientModal';
import { normalizePolishText } from '../../utils/textUtils';
import { logger } from '../../utils/logger';
import { isErrorWithMessage } from '../../types/common';

interface Client {
  id: string;
  name: string;
  address: string;
  documentNumber: string;
  postalCode?: string;
  city?: string;
  fullAddress?: string;
  searchableText?: string;
}

interface ClientSelectorProps {
  selectedClient: Client | null;
  onClientSelect: (client: Client) => void;
  showValidationError?: boolean;
  validationError?: string;
  autoFocus?: boolean;
}

const ClientSelector = forwardRef<{ focus: () => void }, ClientSelectorProps>(
  (
    {
      selectedClient,
      onClientSelect,
      showValidationError = false,
      validationError = '',
      autoFocus = false,
    },
    ref
  ) => {
    const { user } = useAuth();
    const { isOffline } = useOfflineStatus();
    const [clients, setClients] = useState<Client[]>([]);
    const [clientSearchTerm, setClientSearchTerm] = useState(
      selectedClient?.name || ''
    );
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [selectedClientIndex, setSelectedClientIndex] = useState(-1);
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const clientInputRef = useRef<HTMLInputElement>(null);
    const clientsRef = useRef(clients);

    // Load clients (from Firebase and/or offline cache)
    const fetchClients = useCallback(async () => {
      if (!user) return;

      try {
        setLoading(true);

        if (isOffline) {
          // Load from offline cache only
          logger.debug('Loading clients from offline cache', undefined, {
            component: 'ClientSelector',
            operation: 'fetchClients',
            userId: user.uid,
          });
          const cachedClients = await offlineStorage.getCachedClients();
          setClients(cachedClients);
        } else {
          // Load from Firebase and update cache
          try {
            const clientsQuery = query(
              collection(db, 'clients'),
              where('userID', '==', user.uid),
              orderBy('name')
            );
            const clientsSnapshot = await getDocs(clientsQuery);
            const clientsData = clientsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            })) as Client[];

            setClients(clientsData);

            // Update offline cache
            await offlineStorage.cacheClients(clientsData);
          } catch (error) {
            // If online fetch fails, fall back to cached data
            logger.warn(
              'Failed to fetch clients online, using cached data',
              isErrorWithMessage(error) ? error : undefined,
              {
                component: 'ClientSelector',
                operation: 'fetchClients',
                userId: user.uid,
              }
            );
            const cachedClients = await offlineStorage.getCachedClients();
            setClients(cachedClients);
          }
        }
      } catch (error) {
        logger.error(
          'Error fetching clients',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'ClientSelector',
            operation: 'fetchClients',
            userId: user.uid,
          }
        );
      } finally {
        setLoading(false);
      }
    }, [user, isOffline]);

    // Initialize component
    useEffect(() => {
      fetchClients();
    }, [fetchClients]);

    // Update clients ref when clients state changes
    useEffect(() => {
      clientsRef.current = clients;
    }, [clients]);

    // Auto-focus when requested
    useEffect(() => {
      if (autoFocus && !loading && clientInputRef.current) {
        setTimeout(() => {
          clientInputRef.current?.focus();
        }, 100);
      }
    }, [autoFocus, loading]);

    // Update search term when selected client changes externally
    useEffect(() => {
      setClientSearchTerm(selectedClient?.name || '');
    }, [selectedClient]);

    // Expose focus method to parent components
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (clientInputRef.current) {
          // Make sure the element is visible and can be focused
          if (clientInputRef.current.offsetParent === null) {
            return;
          }

          // Clear any existing focus
          clientInputRef.current.blur();

          // Focus with a small delay to ensure it works
          setTimeout(() => {
            if (clientInputRef.current) {
              clientInputRef.current.focus();
            }
          }, 10);
        }
      },
    }));

    // Handle client selection
    const handleClientSelect = useCallback(
      (client: Client) => {
        onClientSelect(client);
        setClientSearchTerm(client.name);
        setIsClientDropdownOpen(false);
        setSelectedClientIndex(-1);
      },
      [onClientSelect]
    );

    // Handle client dropdown keyboard navigation
    const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isClientDropdownOpen || filteredClients.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedClientIndex(prev =>
            prev < filteredClients.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedClientIndex(prev =>
            prev > 0 ? prev - 1 : filteredClients.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (
            selectedClientIndex >= 0 &&
            selectedClientIndex < filteredClients.length
          ) {
            handleClientSelect(filteredClients[selectedClientIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsClientDropdownOpen(false);
          setSelectedClientIndex(-1);
          break;
      }
    };

    // Handle new client added
    const handleClientAdded = useCallback(async () => {
      setIsAddClientModalOpen(false);

      // Store current client IDs before refresh
      const currentClientIds = new Set(clientsRef.current.map(c => c.id));

      // Refresh the clients list to get the newly added client
      await fetchClients();

      // Wait for state to update and then find the new client
      setTimeout(async () => {
        // Function to find and select new client
        const findAndSelectNewClient = async () => {
          // Get the most up-to-date clients list
          const latestClients = isOffline
            ? await offlineStorage.getCachedClients()
            : clientsRef.current;

          // Find the newly added client (one that wasn't in the original list)
          const newClient = latestClients.find(
            client => !currentClientIds.has(client.id)
          );

          if (newClient) {
            logger.debug('Auto-selecting newly added client', undefined, {
              component: 'ClientSelector',
              operation: 'handleClientAdded',
              userId: user?.uid,
              extra: { clientName: newClient.name, clientId: newClient.id },
            });
            handleClientSelect(newClient);
            return true;
          }
          return false;
        };

        // Try to find the client immediately
        if (!(await findAndSelectNewClient())) {
          logger.warn(
            'Could not find newly added client for auto-selection, retrying...',
            undefined,
            {
              component: 'ClientSelector',
              operation: 'handleClientAdded',
              userId: user?.uid,
            }
          );
          // If not found, try once more after a short delay
          setTimeout(async () => {
            if (!(await findAndSelectNewClient())) {
              logger.warn(
                'Could not find newly added client for auto-selection after retry',
                undefined,
                {
                  component: 'ClientSelector',
                  operation: 'handleClientAdded',
                  userId: user?.uid,
                }
              );
            }
          }, 300);
        }
      }, 200); // Increased timeout for better reliability
    }, [fetchClients, handleClientSelect, isOffline, user?.uid]);

    // Filter clients based on search term using Polish text normalization
    const filteredClients = clients.filter(client => {
      if (!clientSearchTerm.trim()) return true;

      const normalizedSearchTerm = normalizePolishText(clientSearchTerm);

      // Use searchableText if available, otherwise create it on the fly
      const searchableText =
        client.searchableText ||
        normalizePolishText(
          `${client.name} ${client.address} ${client.documentNumber} ${client.postalCode || ''} ${client.city || ''} ${client.fullAddress || ''}`
        );

      return searchableText.includes(normalizedSearchTerm);
    });

    if (loading) {
      return (
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Klient
        </label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              ref={clientInputRef}
              value={clientSearchTerm}
              onChange={e => {
                setClientSearchTerm(e.target.value);
                setIsClientDropdownOpen(true);
                setSelectedClientIndex(-1);
              }}
              onFocus={() => {
                setIsClientDropdownOpen(true);
                setSelectedClientIndex(-1);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsClientDropdownOpen(false);
                  setSelectedClientIndex(-1);
                }, 150);
              }}
              onKeyDown={handleClientKeyDown}
              placeholder="Szukaj i wybierz klienta..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                showValidationError && validationError
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-orange-600'
              }`}
              required
            />

            {isClientDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client, idx) => (
                    <div
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      onMouseEnter={() => setSelectedClientIndex(idx)}
                      className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                        idx === selectedClientIndex
                          ? 'bg-orange-100 text-orange-900'
                          : 'hover:bg-orange-50'
                      }`}
                    >
                      <div className="font-medium">
                        {client.name}
                        {client.documentNumber && (
                          <span className="text-gray-500 font-normal">
                            {' '}
                            | {client.documentNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {client.fullAddress || client.address}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">
                    Nie znaleziono klientów
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAddClientModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Dodaj Klienta
          </button>
        </div>

        {showValidationError && validationError && (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        )}

        {/* Client Details - Show after selection */}
        {selectedClient && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <h4 className="text-sm font-medium text-orange-900 mb-2">
              Szczegóły Wybranego Klienta
            </h4>
            <div className="space-y-1">
              <div className="flex">
                <span className="text-sm font-medium text-orange-700 w-24">
                  Adres:
                </span>
                <span className="text-sm text-orange-600">
                  {selectedClient.fullAddress || selectedClient.address}
                </span>
              </div>
              <div className="flex">
                <span className="text-sm font-medium text-orange-700 w-24">
                  Dokument:
                </span>
                <span className="text-sm text-orange-600">
                  {selectedClient.documentNumber}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Add Client Modal */}
        <AddClientModal
          isOpen={isAddClientModalOpen}
          onClose={() => setIsAddClientModalOpen(false)}
          onClientAdded={handleClientAdded}
        />
      </div>
    );
  }
);

ClientSelector.displayName = 'ClientSelector';

export default ClientSelector;
