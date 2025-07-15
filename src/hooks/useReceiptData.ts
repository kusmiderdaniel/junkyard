import { useState, useCallback, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  getCountFromServer,
  orderBy,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { normalizePolishText } from '../utils/textUtils';
import { useOfflineStatus } from './useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { syncService } from '../utils/syncService';
import { sortReceiptsInPlace } from '../utils/receiptSorting';
import {
  Receipt,
  Client,
  CompanyDetails,
  PageSnapshots,
} from '../types/receipt';
import { logger } from '../utils/logger';
import { isErrorWithMessage, AuthUser } from '../types/common';
interface UseReceiptDataProps {
  user: AuthUser | null;
  currentPage: number;
  itemsPerPage: number;
  pageSnapshots: PageSnapshots;
  selectedMonth: string;
  activeSearchTerm: string;
}

interface UseReceiptDataReturn {
  receipts: Receipt[];
  clients: Client[];
  companyDetails: CompanyDetails | null;
  loading: boolean;
  totalPages: number;
  availableMonths: string[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  fetchReceipts: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchCompanyDetails: () => Promise<void>;
  fetchAvailableMonths: () => Promise<void>;
  getClientName: (receipt: Receipt) => string;
}

export const useReceiptData = ({
  user,
  currentPage,
  itemsPerPage,
  pageSnapshots,
  selectedMonth,
  activeSearchTerm,
}: UseReceiptDataProps): UseReceiptDataReturn => {
  const { isOffline } = useOfflineStatus();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Fetch company details
  const fetchCompanyDetails = useCallback(async () => {
    if (!user) return;

    try {
      let details: CompanyDetails | null = null;

      if (isOffline) {
        details = await offlineStorage.getCachedCompanyDetails();
      } else {
        try {
          const companyDocRef = doc(db, 'companyDetails', user.uid);
          const companyDocSnap = await getDoc(companyDocRef);

          if (companyDocSnap.exists()) {
            details = companyDocSnap.data() as CompanyDetails;

            // Cache the company details for offline use
            if (details) {
              await offlineStorage.cacheCompanyDetails(details);
            }
          }
        } catch (onlineError) {
          logger.warn(
            'Online company details fetch failed, trying cached data',
            isErrorWithMessage(onlineError) ? onlineError : undefined,
            {
              component: 'useReceiptData',
              operation: 'fetchCompanyDetails',
              userId: user.uid,
            }
          );

          // Try cached data if online fetch fails
          details = await offlineStorage.getCachedCompanyDetails();
        }
      }

      // Fallback to default company details if fetch fails
      if (!details) {
        details = {
          companyName: 'Nazwa firmy',
          numberNIP: 'NIP',
          numberREGON: 'REGON',
          address: 'Adres',
          postalCode: 'Kod pocztowy',
          city: 'Miasto',
          email: 'email@example.com',
          phoneNumber: 'Telefon',
        };
      }

      setCompanyDetails(details);
    } catch (error) {
      logger.error(
        'Error fetching company details',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'useReceiptData',
          operation: 'fetchCompanyDetails',
          userId: user?.uid,
        }
      );
    }
  }, [user, isOffline]);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      if (isOffline) {
        const cachedClients = await offlineStorage.getCachedClients();
        setClients(cachedClients);
      } else {
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

          // Cache for offline use
          await offlineStorage.cacheClients(clientsData);
        } catch (onlineError) {
          logger.warn(
            'Online clients fetch failed, trying cached data',
            isErrorWithMessage(onlineError) ? onlineError : undefined,
            {
              component: 'useReceiptData',
              operation: 'fetchClients',
              userId: user.uid,
            }
          );

          // Fallback to cached data
          const cachedClients = await offlineStorage.getCachedClients();
          setClients(cachedClients);
        }
      }
    } catch (error) {
      logger.error(
        'Error fetching clients',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'useReceiptData',
          operation: 'fetchClients',
          userId: user?.uid,
        }
      );
    }
  }, [user, isOffline]);

  // Fetch all available months for the filter dropdown
  const fetchAvailableMonths = useCallback(async () => {
    if (!user) return;

    try {
      // If offline or sync in progress, generate months from cached receipts
      if (isOffline || syncService.getIsSyncing()) {
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        const months = new Set<string>();

        cachedReceipts.forEach(receipt => {
          const receiptDate = new Date(receipt.date);
          const monthKey = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;
          months.add(monthKey);
        });

        const sortedMonths = Array.from(months).sort((a, b) =>
          b.localeCompare(a)
        );
        setAvailableMonths(sortedMonths);
        return;
      }

      // Online mode - fetch from Firebase
      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(receiptsQuery);
      const months = new Set<string>();

      querySnapshot.docs.forEach(doc => {
        const receiptDate = doc.data().date.toDate();
        const monthKey = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      });

      const sortedMonths = Array.from(months).sort((a, b) =>
        b.localeCompare(a)
      );
      setAvailableMonths(sortedMonths);
    } catch (error) {
      // If online fetch fails, try to generate from cached data
      if (!isOffline) {
        logger.warn(
          'Online available months fetch failed, trying cached data',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'useReceiptData',
            operation: 'fetchAvailableMonths',
            userId: user.uid,
          }
        );
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        if (cachedReceipts.length > 0) {
          const months = new Set<string>();

          cachedReceipts.forEach(receipt => {
            const receiptDate = new Date(receipt.date);
            const monthKey = `${receiptDate.getFullYear()}-${String(receiptDate.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
          });

          const sortedMonths = Array.from(months).sort((a, b) =>
            b.localeCompare(a)
          );
          setAvailableMonths(sortedMonths);
        } else {
          setAvailableMonths([]);
        }
      } else {
        setAvailableMonths([]);
      }
    }
  }, [user, isOffline]);

  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // If offline or sync in progress, use cached data
      if (isOffline || syncService.getIsSyncing()) {
        const cachedReceipts = await offlineStorage.getCachedReceipts();

        let filteredReceipts = [...cachedReceipts];

        // Apply month filter if selected
        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(
            parseInt(year),
            parseInt(month),
            0,
            23,
            59,
            59,
            999
          );

          filteredReceipts = cachedReceipts.filter(receipt => {
            const receiptDate = new Date(receipt.date);
            return receiptDate >= startDate && receiptDate <= endDate;
          });
        }

        // Apply search filter if active
        if (activeSearchTerm) {
          const normalizedSearchTerm = normalizePolishText(activeSearchTerm);
          const cachedClients = await offlineStorage.getCachedClients();

          // Find matching client IDs
          const matchingClientIds = new Set<string>();
          cachedClients.forEach(client => {
            const searchableText = client.searchableText || '';
            const normalizedClientName = normalizePolishText(client.name || '');
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

            if (
              searchableText.includes(normalizedSearchTerm) ||
              normalizedClientName.includes(normalizedSearchTerm) ||
              normalizedClientAddress.includes(normalizedSearchTerm) ||
              normalizedDocumentNumber.includes(normalizedSearchTerm) ||
              normalizedPostalCode.includes(normalizedSearchTerm) ||
              normalizedCity.includes(normalizedSearchTerm) ||
              normalizedFullAddress.includes(normalizedSearchTerm)
            ) {
              matchingClientIds.add(client.id);
            }
          });

          // Filter receipts based on search criteria
          filteredReceipts = filteredReceipts.filter(receipt => {
            // Search by client ID match
            if (matchingClientIds.has(receipt.clientId)) {
              return true;
            }

            // Search by receipt number
            const normalizedReceiptNumber = normalizePolishText(receipt.number);
            if (normalizedReceiptNumber.includes(normalizedSearchTerm)) {
              return true;
            }

            // Search within items
            const itemsMatch = receipt.items.some(item => {
              const normalizedItemName = normalizePolishText(item.itemName);
              const normalizedItemCode = normalizePolishText(item.itemCode);
              return (
                normalizedItemName.includes(normalizedSearchTerm) ||
                normalizedItemCode.includes(normalizedSearchTerm)
              );
            });

            return itemsMatch;
          });
        }

        // Sort by by receipt number descending
        sortReceiptsInPlace(filteredReceipts);

        // Apply pagination
        setTotalPages(Math.ceil(filteredReceipts.length / itemsPerPage));
        const start = (currentPage - 1) * itemsPerPage;
        const paginated = filteredReceipts.slice(start, start + itemsPerPage);
        setReceipts(paginated);

        logger.info('Loaded receipts from cache (offline mode)', {
          component: 'useReceiptData',
          operation: 'fetchReceipts',
          extra: { receiptCount: paginated.length },
        });
        return;
      }

      // Online mode - fetch from Firebase
      const receiptsCollection = collection(db, 'receipts');

      if (activeSearchTerm) {
        // Comprehensive search across all receipts
        const normalizedSearchTerm = normalizePolishText(activeSearchTerm);

        try {
          // Strategy 1: Find matching clients using client-side filtering for "contains" search
          const matchingClientIds = new Set<string>();

          // Get all user's clients for client-side filtering
          const allClientsQuery = query(
            collection(db, 'clients'),
            where('userID', '==', user.uid)
          );

          const allClientsSnapshot = await getDocs(allClientsQuery);

          // Filter clients that contain the search term anywhere in their searchable fields
          allClientsSnapshot.docs.forEach(doc => {
            const clientData = doc.data() as Client;

            // Use searchableText if available, otherwise check individual fields
            const searchableText = clientData.searchableText || '';
            const normalizedClientName = normalizePolishText(
              clientData.name || ''
            );
            const normalizedClientAddress = normalizePolishText(
              clientData.address || ''
            );
            const normalizedDocumentNumber = normalizePolishText(
              clientData.documentNumber || ''
            );
            const normalizedPostalCode = normalizePolishText(
              clientData.postalCode || ''
            );
            const normalizedCity = normalizePolishText(clientData.city || '');
            const normalizedFullAddress = normalizePolishText(
              clientData.fullAddress || ''
            );

            if (
              searchableText.includes(normalizedSearchTerm) ||
              normalizedClientName.includes(normalizedSearchTerm) ||
              normalizedClientAddress.includes(normalizedSearchTerm) ||
              normalizedDocumentNumber.includes(normalizedSearchTerm) ||
              normalizedPostalCode.includes(normalizedSearchTerm) ||
              normalizedCity.includes(normalizedSearchTerm) ||
              normalizedFullAddress.includes(normalizedSearchTerm)
            ) {
              matchingClientIds.add(doc.id);
            }
          });

          // Strategy 2: Get ALL receipts and filter them
          const allReceiptsQuery = query(
            receiptsCollection,
            where('userID', '==', user.uid),
            orderBy('date', 'desc')
          );

          // Add month filter if selected
          let filteredQuery = allReceiptsQuery;
          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(
              parseInt(year),
              parseInt(month),
              0,
              23,
              59,
              59,
              999
            );

            filteredQuery = query(
              receiptsCollection,
              where('userID', '==', user.uid),
              where('date', '>=', startDate),
              where('date', '<=', endDate),
              orderBy('date', 'desc')
            );
          }

          const allReceiptsSnapshot = await getDocs(filteredQuery);
          const allReceipts = allReceiptsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
          })) as Receipt[];

          // Merge the receipts with existing cache to prevent duplicates
          await offlineStorage.mergeReceipts(allReceipts);

          // Client-side filtering for comprehensive search
          const filteredReceipts = allReceipts.filter(receipt => {
            // Search by client ID match
            if (matchingClientIds.has(receipt.clientId)) {
              return true;
            }

            // Search by receipt number
            const normalizedReceiptNumber = normalizePolishText(receipt.number);
            if (normalizedReceiptNumber.includes(normalizedSearchTerm)) {
              return true;
            }

            // Search within items
            const itemsMatch = receipt.items.some(item => {
              const normalizedItemName = normalizePolishText(item.itemName);
              const normalizedItemCode = normalizePolishText(item.itemCode);
              return (
                normalizedItemName.includes(normalizedSearchTerm) ||
                normalizedItemCode.includes(normalizedSearchTerm)
              );
            });

            return itemsMatch;
          });

          // Sort by receipt number descending
          sortReceiptsInPlace(filteredReceipts);

          setTotalPages(Math.ceil(filteredReceipts.length / itemsPerPage));
          const start = (currentPage - 1) * itemsPerPage;
          const paginated = filteredReceipts.slice(start, start + itemsPerPage);
          setReceipts(paginated);
        } catch (searchError) {
          logger.warn(
            'Search failed, falling back to basic query',
            isErrorWithMessage(searchError) ? searchError : undefined,
            {
              component: 'useReceiptData',
              operation: 'fetchReceipts',
              userId: user.uid,
            }
          );

          // Fallback to basic query if search fails
          let fallbackQuery = query(
            receiptsCollection,
            where('userID', '==', user.uid),
            orderBy('date', 'desc'),
            limit(itemsPerPage)
          );

          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(
              parseInt(year),
              parseInt(month),
              0,
              23,
              59,
              59,
              999
            );

            fallbackQuery = query(
              receiptsCollection,
              where('userID', '==', user.uid),
              where('date', '>=', startDate),
              where('date', '<=', endDate),
              orderBy('date', 'desc'),
              limit(itemsPerPage)
            );
          }

          const fallbackSnapshot = await getDocs(fallbackQuery);
          const fallbackReceipts = fallbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
          })) as Receipt[];

          // Sort by receipt number descending
          sortReceiptsInPlace(fallbackReceipts);

          setReceipts(fallbackReceipts);
          setTotalPages(1);
        }
      } else {
        // Default: server-side pagination without search
        const countQueryConstraints = [where('userID', '==', user.uid)];

        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(
            parseInt(year),
            parseInt(month),
            0,
            23,
            59,
            59,
            999
          );

          countQueryConstraints.push(
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          );
        }

        const countQuery = query(receiptsCollection, ...countQueryConstraints);
        const countSnapshot = await getCountFromServer(countQuery);
        const totalCount = countSnapshot.data().count;
        setTotalPages(Math.ceil(totalCount / itemsPerPage));

        let receiptsQuery = query(
          receiptsCollection,
          where('userID', '==', user.uid),
          orderBy('date', 'desc')
        );

        if (selectedMonth) {
          const [year, month] = selectedMonth.split('-');
          const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
          const endDate = new Date(
            parseInt(year),
            parseInt(month),
            0,
            23,
            59,
            59,
            999
          );

          receiptsQuery = query(
            receiptsCollection,
            where('userID', '==', user.uid),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
          );
        }

        receiptsQuery = query(receiptsQuery, limit(itemsPerPage));

        const startAfterDoc = pageSnapshots[currentPage];
        if (startAfterDoc) {
          receiptsQuery = query(receiptsQuery, startAfter(startAfterDoc));
        }

        const querySnapshot = await getDocs(receiptsQuery);

        const receiptsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
        })) as Receipt[];

        // Merge the receipts with existing cache to prevent duplicates
        await offlineStorage.mergeReceipts(receiptsData);

        // Sort by receipt number descending on client side
        sortReceiptsInPlace(receiptsData);

        setReceipts(receiptsData);

        if (querySnapshot.docs.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }
      }
    } catch (error) {
      // If online fetch fails, try to use cached data as fallback
      if (!isOffline) {
        logger.warn(
          'Online receipt fetch failed, trying cached data',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'useReceiptData',
            operation: 'fetchReceipts',
            userId: user.uid,
          }
        );
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        if (cachedReceipts.length > 0) {
          // Sort by receipt number descending
          sortReceiptsInPlace(cachedReceipts);

          setReceipts(cachedReceipts.slice(0, itemsPerPage));
          setTotalPages(Math.ceil(cachedReceipts.length / itemsPerPage));
        } else {
          setReceipts([]);
        }
      } else {
        setReceipts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [
    user,
    currentPage,
    itemsPerPage,
    pageSnapshots,
    selectedMonth,
    activeSearchTerm,
    isOffline,
  ]);

  // Get client name by ID
  const getClientName = useCallback(
    (receipt: Receipt) => {
      if (receipt.clientId) {
        const client = clients.find(c => c.id === receipt.clientId);
        return client ? client.name : 'Nieznany Klient';
      }
      return receipt.clientName || 'Nieznany Klient';
    },
    [clients]
  );

  // Listen for sync completion to refresh data
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleSyncCompleted = async () => {
      logger.debug('Sync completed - refreshing data...', undefined, {
        component: 'useReceiptData',
        operation: 'handleSyncCompleted',
      });

      // Force refresh all data after sync with longer delay
      timeoutId = setTimeout(async () => {
        if (user && !syncService.getIsSyncing()) {
          await fetchClients();
          await fetchReceipts();
          await fetchAvailableMonths();
        }
      }, 1000); // Longer delay to ensure sync is fully complete
    };

    window.addEventListener('sync-completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('sync-completed', handleSyncCompleted);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, fetchClients, fetchReceipts, fetchAvailableMonths]);

  return {
    receipts,
    clients,
    companyDetails,
    loading,
    totalPages,
    availableMonths,
    lastVisible,
    fetchReceipts,
    fetchClients,
    fetchCompanyDetails,
    fetchAvailableMonths,
    getClientName,
  };
};
