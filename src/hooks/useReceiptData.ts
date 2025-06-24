import { useState, useCallback } from 'react';
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
import {
  Receipt,
  Client,
  CompanyDetails,
  PageSnapshots,
} from '../types/receipt';

interface UseReceiptDataProps {
  user: any;
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
      // If offline, use cached data
      if (isOffline) {
        const cachedCompanyDetails = offlineStorage.getCachedCompanyDetails();
        if (cachedCompanyDetails) {
          setCompanyDetails(cachedCompanyDetails);
        } else {
          setCompanyDetails({
            companyName: 'Your Company',
            numberNIP: '',
            numberREGON: '',
            address: '',
            postalCode: '',
            city: '',
            email: '',
            phoneNumber: '',
          });
        }
        return;
      }

      // Online mode - fetch from Firebase
      const docRef = doc(db, 'companyDetails', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const companyData = docSnap.data() as CompanyDetails;
        // Cache the company details for offline use
        offlineStorage.cacheCompanyDetails(companyData);
        setCompanyDetails(companyData);
      } else {
        const defaultCompanyDetails = {
          companyName: 'Your Company',
          numberNIP: '',
          numberREGON: '',
          address: '',
          postalCode: '',
          city: '',
          email: '',
          phoneNumber: '',
        };
        setCompanyDetails(defaultCompanyDetails);
      }
    } catch (error) {
      // If online fetch fails, try cached data as fallback
      if (!isOffline) {
        console.warn(
          'Online company details fetch failed, trying cached data:',
          error
        );
        const cachedCompanyDetails = offlineStorage.getCachedCompanyDetails();
        if (cachedCompanyDetails) {
          setCompanyDetails(cachedCompanyDetails);
        } else {
          setCompanyDetails({
            companyName: 'Your Company',
            numberNIP: '',
            numberREGON: '',
            address: '',
            postalCode: '',
            city: '',
            email: '',
            phoneNumber: '',
          });
        }
      } else {
        setCompanyDetails({
          companyName: 'Your Company',
          numberNIP: '',
          numberREGON: '',
          address: '',
          postalCode: '',
          city: '',
          email: '',
          phoneNumber: '',
        });
      }
    }
  }, [user, isOffline]);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      // If offline, use cached data
      if (isOffline) {
        const cachedClients = offlineStorage.getCachedClients();
        setClients(cachedClients);
        return;
      }

      // Online mode - fetch from Firebase
      const clientsQuery = query(
        collection(db, 'clients'),
        where('userID', '==', user.uid)
      );
      const clientsSnapshot = await getDocs(clientsQuery);
      const clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];

      // Cache the clients for offline use
      offlineStorage.cacheClients(clientsData);

      setClients(clientsData);
    } catch (error) {
      // If online fetch fails, try cached data as fallback
      if (!isOffline) {
        console.warn('Online client fetch failed, trying cached data:', error);
        const cachedClients = offlineStorage.getCachedClients();
        if (cachedClients.length > 0) {
          setClients(cachedClients);
        } else {
          setClients([]);
        }
      } else {
        setClients([]);
      }
    }
  }, [user, isOffline]);

  // Fetch all available months for the filter dropdown
  const fetchAvailableMonths = useCallback(async () => {
    if (!user) return;

    try {
      // If offline, generate months from cached receipts
      if (isOffline) {
        const cachedReceipts = offlineStorage.getCachedReceipts();
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
        console.warn(
          'Online available months fetch failed, trying cached data:',
          error
        );
        const cachedReceipts = offlineStorage.getCachedReceipts();
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
      // If offline, use cached data
      if (isOffline) {
        const cachedReceipts = offlineStorage.getCachedReceipts();

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
          const cachedClients = offlineStorage.getCachedClients();

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

        // Sort by date (newest first)
        filteredReceipts.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Apply pagination
        setTotalPages(Math.ceil(filteredReceipts.length / itemsPerPage));
        const start = (currentPage - 1) * itemsPerPage;
        const paginated = filteredReceipts.slice(start, start + itemsPerPage);
        setReceipts(paginated);

        if (process.env.NODE_ENV === 'development') {
          console.log('📱 Loaded receipts from cache (offline mode)');
        }
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

          // Cache the receipts for offline use
          offlineStorage.cacheReceipts(allReceipts);

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

          setTotalPages(Math.ceil(filteredReceipts.length / itemsPerPage));
          const start = (currentPage - 1) * itemsPerPage;
          const paginated = filteredReceipts.slice(start, start + itemsPerPage);
          setReceipts(paginated);
        } catch (searchError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              'Search failed, falling back to basic query:',
              searchError
            );
          }

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

        // Cache the receipts for offline use
        offlineStorage.cacheReceipts(receiptsData);

        setReceipts(receiptsData);

        if (querySnapshot.docs.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }
      }
    } catch (error) {
      // If online fetch fails, try to use cached data as fallback
      if (!isOffline) {
        console.warn('Online receipt fetch failed, trying cached data:', error);
        const cachedReceipts = offlineStorage.getCachedReceipts();
        if (cachedReceipts.length > 0) {
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
