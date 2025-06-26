import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { usePDFReceipt } from '../components/PDFReceipt';
// ExcelJS will be lazy loaded
import { createSanitizedInputHandler } from '../utils/inputSanitizer';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
import { Receipt, Client, CompanyDetails } from '../types/receipt';

interface ClientKPIs {
  totalQuantity: number;
  totalAmount: number;
  receiptCount: number;
}

interface ExcelRowData {
  'Numer kwitu': string;
  Data: string;
  Klient: string;
  'Nazwa towaru': string;
  'Kod towaru': string;
  Ilość: number;
  Jednostka: string;
  'Cena zakupu': number;
  'Wartość pozycji': number;
}

const ClientDetail: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { generatePDF, viewPDF } = usePDFReceipt();

  const [client, setClient] = useState<Client | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(
    null
  );
  const [kpis, setKPIs] = useState<ClientKPIs>({
    totalQuantity: 0,
    totalAmount: 0,
    receiptCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create sanitized search input handler
  const handleSearchChange = createSanitizedInputHandler(setSearchTerm, {
    maxLength: 500,
    preserveWhitespace: false,
  });

  // Fetch client details
  const fetchClient = useCallback(async () => {
    if (!user || !clientId) return;

    try {
      setLoading(true);
      setError(null);

      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists()) {
        const clientData = { id: clientDoc.id, ...clientDoc.data() } as Client;
        setClient(clientData);
      } else {
        toast.error('Klient nie został znaleziony.');
        navigate('/clients');
        return;
      }
    } catch (error) {
      logger.error(
        'Błąd ładowania danych klienta',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'ClientDetail',
          operation: 'fetchClient',
          userId: user?.uid,
          extra: { clientId },
        }
      );
      toast.error('Błąd ładowania danych klienta.');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  }, [user, clientId, navigate]);

  // Fetch company details
  const fetchCompanyDetails = useCallback(async () => {
    if (!user) return;

    try {
      const docRef = doc(db, 'companyDetails', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data() as CompanyDetails);
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
    } catch (error) {
      logger.warn(
        'Failed to fetch company details, using defaults',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'ClientDetail',
          operation: 'fetchCompanyDetails',
          userId: user.uid,
        }
      );
      // Fallback to default company details if fetch fails
    }
  }, [user]);

  // Fetch receipts for this client
  const fetchClientReceipts = useCallback(async () => {
    if (!user || !clientId) return;

    setLoading(true);
    try {
      // Debug logging for development only
      logger.debug('Fetching receipts for client', undefined, {
        component: 'ClientDetail',
        operation: 'fetchClientReceipts',
        userId: user.uid,
        extra: {
          clientId,
          environment: process.env.REACT_APP_ENV || 'unknown',
        },
      });

      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(receiptsQuery);
      const receiptsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      logger.info('Found receipts for this client', {
        component: 'ClientDetail',
        operation: 'fetchClientReceipts',
        userId: user.uid,
        extra: { receiptCount: receiptsData.length },
      });

      setReceipts(receiptsData);

      // Calculate KPIs
      const totalQuantity = receiptsData.reduce(
        (sum, receipt) =>
          sum +
          receipt.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0
      );
      const totalAmount = receiptsData.reduce(
        (sum, receipt) => sum + receipt.totalAmount,
        0
      );
      const receiptCount = receiptsData.length;

      setKPIs({ totalQuantity, totalAmount, receiptCount });
    } catch (error) {
      logger.error(
        'Error fetching receipts for client',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'ClientDetail',
          operation: 'fetchClientReceipts',
          userId: user.uid,
          extra: {
            clientId,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
            errorCode:
              error && typeof error === 'object' && 'code' in error
                ? (error as any).code
                : 'no-code',
          },
        }
      );

      // Check if it's a missing index error
      if (error instanceof Error && error.message.includes('index')) {
        logger.warn(
          'Missing Firestore index detected',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'ClientDetail',
            operation: 'fetchClientReceipts',
            userId: user.uid,
            extra: { clientId, indexError: true },
          }
        );
        toast.error(
          'Indeks bazy danych jest w trakcie budowania. Spróbuj ponownie za kilka minut.'
        );
      } else {
        logger.error(
          'Unexpected error during receipt fetch',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'ClientDetail',
            operation: 'fetchClientReceipts',
            userId: user.uid,
            extra: { clientId },
          }
        );
      }

      // Receipts list will remain empty if fetch fails
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [user, clientId]);

  useEffect(() => {
    fetchClient();
    fetchCompanyDetails();
    fetchClientReceipts();
  }, [fetchClient, fetchCompanyDetails, fetchClientReceipts]);

  // PDF Handlers
  const handleViewPDF = async (receipt: Receipt) => {
    if (!companyDetails || !client) {
      toast.error(
        'Dane klienta lub firmy nie zostały załadowane. Spróbuj ponownie.'
      );
      return;
    }

    try {
      await viewPDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Błąd podczas generowania PDF. Spróbuj ponownie.');
    }
  };

  const handleDownloadPDF = async (receipt: Receipt) => {
    if (!companyDetails || !client) {
      toast.error(
        'Dane klienta lub firmy nie zostały załadowane. Spróbuj ponownie.'
      );
      return;
    }

    try {
      await generatePDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Błąd podczas generowania PDF. Spróbuj ponownie.');
    }
  };

  const handleEditReceipt = (receiptId: string) => {
    navigate(`/edit-receipt/${receiptId}`);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000 && amount < 10000) {
      const parts = amount.toFixed(2).split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const thousands = integerPart.slice(0, -3);
      const hundreds = integerPart.slice(-3);
      return `${thousands} ${hundreds},${decimalPart} zł`;
    }

    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  };

  const formatQuantity = (quantity: number) => {
    if (quantity >= 1000 && quantity < 10000) {
      const parts = quantity.toFixed(2).split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const thousands = integerPart.slice(0, -3);
      const hundreds = integerPart.slice(-3);
      return `${thousands} ${hundreds},${decimalPart}`;
    }

    return quantity.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const toggleRowExpansion = (receiptId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receiptId)) {
        newSet.delete(receiptId);
      } else {
        newSet.add(receiptId);
      }
      return newSet;
    });
  };

  // Filter receipts based on search term
  const filteredReceipts = receipts.filter(receipt => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();

    // Search in receipt number
    if (receipt.number.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Search in product names within items
    if (
      receipt.items.some(
        item =>
          item.itemName.toLowerCase().includes(searchLower) ||
          item.itemCode.toLowerCase().includes(searchLower)
      )
    ) {
      return true;
    }

    return false;
  });

  // Handle Excel Export using lazy loading
  const handleExportToExcel = async () => {
    if (!client) return;

    try {
      // Create detailed data with one row per item
      const excelData: ExcelRowData[] = [];

      filteredReceipts.forEach(receipt => {
        const receiptDate = receipt.date.toLocaleDateString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        receipt.items.forEach(item => {
          excelData.push({
            'Numer kwitu': receipt.number,
            Data: receiptDate,
            Klient: client.name,
            'Nazwa towaru': item.itemName,
            'Kod towaru': item.itemCode,
            Ilość: item.quantity,
            Jednostka: item.unit,
            'Cena zakupu': item.buy_price,
            'Wartość pozycji': item.total_price,
          });
        });
      });

      if (excelData.length === 0) {
        toast.error('Brak danych do eksportu.');
        return;
      }

      // Lazy load Excel export utility
      const { ExcelExportUtility } = await import('../utils/excelExport');

      // Prepare filters
      const filters: Record<string, string> = {};
      if (searchTerm) {
        filters['Wyszukiwanie'] = `"${searchTerm}"`;
      }

      // Prepare summary information
      const summary = {
        'Łączna liczba pozycji': excelData.length.toString(),
        'Łączna liczba kwitów': filteredReceipts.length.toString(),
        'Łączna ilość': `${kpis.totalQuantity.toFixed(2)} kg`,
        'Łączna kwota': formatCurrency(kpis.totalAmount),
      };

      // Prepare subtitle with client information
      const subtitle = `Klient: ${client.name}\nAdres: ${client.address}\nNumer dokumentu: ${client.documentNumber}`;

      // Generate filename
      const clientNameSafe = client.name.replace(/[^a-zA-Z0-9\s]/g, '');
      const filename = `kwity_${clientNameSafe}`;

      // Export using the utility
      await ExcelExportUtility.exportToExcel({
        filename,
        worksheetName: 'Kwity klienta',
        headers: [
          'Numer kwitu',
          'Data',
          'Klient',
          'Nazwa towaru',
          'Kod towaru',
          'Ilość',
          'Jednostka',
          'Cena zakupu',
          'Wartość pozycji',
        ],
        data: excelData,
        title: 'Raport klienta wygenerowany',
        subtitle,
        filters,
        summary,
      });
    } catch (error) {
      toast.error('Błąd podczas eksportu do Excel. Spróbuj ponownie.');
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">
          Zaloguj się, aby wyświetlić szczegóły klienta.
        </p>
      </div>
    );
  }

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
        <span className="ml-2">Ładowanie szczegółów klienta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Błąd</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
            <div className="mt-6">
              <Link
                to="/clients"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Powrót do listy klientów
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Klient nie znaleziony
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Klient o podanym ID nie istnieje lub został usunięty.
            </p>
            <div className="mt-6">
              <Link
                to="/clients"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Powrót do listy klientów
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="space-y-4">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
          Powrót do Klientów
        </button>
        <h1 className="text-3xl font-bold text-gray-800">{client.name}</h1>
      </div>

      {/* Client Information and KPIs Side by Side */}
      <div className="flex gap-6 items-center">
        {/* Client Details - Compact Box */}
        <div className="bg-white p-6 rounded-lg shadow-md w-80">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Informacje o Kliencie
          </h2>
          <div className="space-y-3">
            <div className="flex">
              <span className="text-sm font-medium text-gray-700 w-24">
                Nazwa:
              </span>
              <span className="text-sm text-gray-900 flex-1">
                {client.name}
              </span>
            </div>
            <div className="flex">
              <span className="text-sm font-medium text-gray-700 w-24">
                Dokument:
              </span>
              <span className="text-sm text-gray-900 flex-1">
                {client.documentNumber}
              </span>
            </div>
            <div className="flex">
              <span className="text-sm font-medium text-gray-700 w-24">
                Adres:
              </span>
              <span className="text-sm text-gray-900 flex-1">
                {client.fullAddress || client.address}
              </span>
            </div>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="flex-1 flex gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Łączna Ilość
            </h3>
            <p className="text-3xl font-bold text-orange-700">
              {formatQuantity(kpis.totalQuantity)} kg
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Łączna Kwota
            </h3>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(kpis.totalAmount)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex-1 flex flex-col justify-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Liczba Kwitów
            </h3>
            <p className="text-3xl font-bold text-purple-600">
              {kpis.receiptCount}
            </p>
          </div>
        </div>
      </div>

      {/* Receipts Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Kwity Klienta</h2>
          <button
            onClick={handleExportToExcel}
            disabled={loading || filteredReceipts.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="21"></line>
              <line x1="8" y1="13" x2="16" y2="21"></line>
            </svg>
            Eksportuj do Excela
          </button>
        </div>

        {/* Search Box */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Szukaj kwitów..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg
                  className="h-4 w-4 text-gray-400 hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Receipts Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Numer Kwitu
                </th>
                <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
                  Data
                </th>
                <th className="text-right py-3 px-4 uppercase font-semibold text-sm">
                  Łączna Kwota
                </th>
                <th className="text-center py-3 px-4 uppercase font-semibold text-sm">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
                      <span className="ml-2">Ładowanie kwitów...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map(receipt => (
                  <React.Fragment key={receipt.id}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRowExpansion(receipt.id)}
                    >
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center">
                          <span className="mr-2">
                            {expandedRows.has(receipt.id) ? (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6,9 12,15 18,9"></polyline>
                              </svg>
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9,18 15,12 9,6"></polyline>
                              </svg>
                            )}
                          </span>
                          {receipt.number}
                        </div>
                      </td>
                      <td className="py-3 px-4">{formatDate(receipt.date)}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(receipt.totalAmount)}
                      </td>
                      <td
                        className="py-3 px-4 text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleViewPDF(receipt)}
                            className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                            aria-label="Zobacz PDF"
                            title="Zobacz PDF"
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
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(receipt)}
                            className="text-gray-400 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50"
                            aria-label="Pobierz PDF"
                            title="Pobierz PDF"
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
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                              <polyline points="9,15 12,18 15,15"></polyline>
                              <line x1="12" y1="18" x2="12" y2="10"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditReceipt(receipt.id)}
                            className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                            aria-label="Edytuj kwit"
                            title="Edytuj kwit"
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
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(receipt.id) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-0 bg-gray-50">
                          <div className="py-4">
                            <div className="overflow-x-auto">
                              <table className="min-w-full bg-white rounded-lg shadow-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Nazwa Towaru
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Kod
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ilość
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Cena Skupu
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Razem
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {receipt.items.map((item, index) => (
                                    <tr key={index}>
                                      <td className="py-2 px-3 text-sm text-gray-900">
                                        {item.itemName}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-500">
                                        {item.itemCode}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                        {item.quantity.toLocaleString('pl-PL', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{' '}
                                        {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                        {formatCurrency(item.buy_price)}
                                      </td>
                                      <td className="py-2 px-3 text-sm font-medium text-gray-900 text-right">
                                        {formatCurrency(item.total_price)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
              {filteredReceipts.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    {searchTerm
                      ? `Nie znaleziono kwitów pasujących do "${searchTerm}".`
                      : `Nie znaleziono kwitów dla ${client.name}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;
