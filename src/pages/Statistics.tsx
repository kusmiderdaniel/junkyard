import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
// Remove direct import - will be lazy loaded

interface ReceiptItem {
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  total_price: number;
}

interface Receipt {
  id: string;
  number: string;
  date: Date;
  clientId: string;
  userID: string;
  totalAmount: number;
  items: ReceiptItem[];
}

interface StatisticsSummary {
  itemCode: string;
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
  averagePrice: number;
  transactionCount: number;
}

interface ExcelStatisticsData {
  'Kod produktu': string;
  'Nazwa produktu': string;
  Ilość: number;
  Kwota: number;
}

type DateFilterType =
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

const Statistics: React.FC = () => {
  const { user } = useAuth();

  // State for filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedItemCode, setSelectedItemCode] = useState('');

  // Data state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [statisticsSummary, setStatisticsSummary] = useState<
    StatisticsSummary[]
  >([]);
  const [availableItemCodes, setAvailableItemCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Sorting state
  const [sortField, setSortField] =
    useState<keyof StatisticsSummary>('totalAmount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Toggle state for future features
  const [showFutureFeatures, setShowFutureFeatures] = useState(false);

  // Date range calculation functions
  const getDateRange = useCallback(
    (filterType: DateFilterType): { start: Date; end: Date } => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (filterType) {
        case 'thisWeek': {
          const dayOfWeek = today.getDay();
          const monday = new Date(today);
          monday.setDate(
            today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
          );
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          return { start: monday, end: sunday };
        }

        case 'lastWeek': {
          const dayOfWeek = today.getDay();
          const lastMonday = new Date(today);
          lastMonday.setDate(
            today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7
          );
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          lastSunday.setHours(23, 59, 59, 999);
          return { start: lastMonday, end: lastSunday };
        }

        case 'thisMonth': {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'lastMonth': {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'thisYear': {
          const start = new Date(now.getFullYear(), 0, 1);
          const end = new Date(now.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'custom': {
          const start = startDate
            ? new Date(startDate)
            : new Date(now.getFullYear(), now.getMonth(), 1);
          const end = endDate ? new Date(endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        default:
          return { start: today, end: today };
      }
    },
    [startDate, endDate]
  );

  // Fetch receipts based on filters
  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { start, end } = getDateRange(dateFilter);

      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end))
      );

      const querySnapshot = await getDocs(receiptsQuery);
      const receiptsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      setReceipts(receiptsData);
    } catch (error) {
      // Statistics will remain empty if fetch fails
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [user, dateFilter, getDateRange]);

  // Process receipts to create statistics summary
  const processStatistics = useCallback(() => {
    const itemMap = new Map<string, StatisticsSummary>();

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        // Filter by selected item code if specified
        if (selectedItemCode && item.itemCode !== selectedItemCode) {
          return;
        }

        const key = `${item.itemCode}-${item.itemName}`;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.totalQuantity += item.quantity;
          existing.totalAmount += item.total_price;
          existing.transactionCount += 1;
          existing.averagePrice = existing.totalAmount / existing.totalQuantity;
        } else {
          itemMap.set(key, {
            itemCode: item.itemCode,
            itemName: item.itemName,
            totalQuantity: item.quantity,
            totalAmount: item.total_price,
            averagePrice: item.total_price / item.quantity,
            transactionCount: 1,
          });
        }
      });
    });

    // Convert map to array and apply sorting
    const summaryArray = Array.from(itemMap.values());
    setStatisticsSummary(summaryArray);
  }, [receipts, selectedItemCode]);

  // Extract unique item codes from receipts
  const extractItemCodes = useCallback(() => {
    const itemCodesSet = new Set<string>();

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        if (item.itemCode) {
          itemCodesSet.add(item.itemCode);
        }
      });
    });

    const sortedItemCodes = Array.from(itemCodesSet).sort();
    setAvailableItemCodes(sortedItemCodes);
  }, [receipts]);

  // Initialize default date range for custom filter
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfMonth.toISOString().split('T')[0]);
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Process statistics when receipts change
  useEffect(() => {
    processStatistics();
    extractItemCodes();
  }, [processStatistics, extractItemCodes]);

  // Handle date filter change
  const handleDateFilterChange = (filterType: DateFilterType) => {
    setDateFilter(filterType);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      useGrouping: true,
    }).format(amount);
  };

  // Format quantity with thousands separator
  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(quantity);
  };

  // Sorting function
  const handleSort = (field: keyof StatisticsSummary) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sorted data
  const sortedStatistics = React.useMemo(() => {
    return [...statisticsSummary].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });
  }, [statisticsSummary, sortField, sortDirection]);

  // Calculate totals
  const totalQuantity = statisticsSummary.reduce(
    (sum, item) => sum + item.totalQuantity,
    0
  );
  const totalAmount = statisticsSummary.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );

  // Excel export function using lazy loading
  const handleExportToExcel = async () => {
    try {
      // Create data for Excel export using sorted statistics
      const excelData: ExcelStatisticsData[] = sortedStatistics.map(item => ({
        'Kod produktu': item.itemCode,
        'Nazwa produktu': item.itemName,
        Ilość: item.totalQuantity,
        Kwota: item.totalAmount,
      }));

      if (excelData.length === 0) {
        toast.error('Brak danych do eksportu.');
        return;
      }
      
      // Lazy load Excel export utility
      const { ExcelExportUtility } = await import('../utils/excelExport');

      // Prepare filter information
      const { start, end } = getDateRange(dateFilter);
      const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      let dateRangeLabel = '';
      switch (dateFilter) {
        case 'thisWeek':
          dateRangeLabel = 'Ten Tydzień';
          break;
        case 'lastWeek':
          dateRangeLabel = 'Poprzedni Tydzień';
          break;
        case 'thisMonth':
          dateRangeLabel = 'Ten Miesiąc';
          break;
        case 'lastMonth':
          dateRangeLabel = 'Poprzedni Miesiąc';
          break;
        case 'thisYear':
          dateRangeLabel = 'Ten Rok';
          break;
        case 'custom':
          dateRangeLabel = 'Zakres Niestandardowy';
          break;
      }

      const filters: Record<string, string> = {
        Okres: `${dateRangeLabel} (${formatDate(start)} - ${formatDate(end)})`,
        'Kod produktu': selectedItemCode || 'Wszystkie',
      };

      const summary = {
        'Łączna liczba pozycji': excelData.length.toString(),
        'Łączna ilość': `${totalQuantity.toFixed(2)} kg`,
        'Łączna kwota': formatCurrency(totalAmount),
      };

      // Generate filename
      const filterSuffix =
        selectedItemCode || dateFilter !== 'thisMonth' ? `-filtered` : '';
      const filename = `statistics${filterSuffix}-${new Date().toISOString().split('T')[0]}`;

      // Export using the utility
      await ExcelExportUtility.exportToExcel({
        filename,
        worksheetName: 'Statystyki produktów',
        headers: ['Kod produktu', 'Nazwa produktu', 'Ilość', 'Kwota'],
        data: excelData,
        title: 'Raport statystyk wygenerowany',
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
        <p className="text-gray-500">Zaloguj się, aby wyświetlić statystyki.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Statystyki</h1>
      </div>

      {/* Filters and Future Ideas Section */}
      <div className="flex gap-6">
        <div className="w-1/2">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtry</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date Filter Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zakres Dat
                </label>
                <div className="relative">
                  <div className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-3">
                      {/* Calendar Icon */}
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {/* Date Range Display */}
                      <span className="text-sm text-gray-700">
                        {(() => {
                          const formatDate = (date: Date) => {
                            const day = date
                              .getDate()
                              .toString()
                              .padStart(2, '0');
                            const month = (date.getMonth() + 1)
                              .toString()
                              .padStart(2, '0');
                            const year = date.getFullYear();
                            return `${day}/${month}/${year}`;
                          };

                          const { start, end } = getDateRange(dateFilter);
                          if (dateFilter === 'custom' && startDate && endDate) {
                            return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`;
                          }
                          return `${formatDate(start)} - ${formatDate(end)}`;
                        })()}
                      </span>
                    </div>
                    {/* Dropdown Arrow */}
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Hidden Select */}
                  <select
                    value={dateFilter}
                    onChange={e =>
                      handleDateFilterChange(e.target.value as DateFilterType)
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    <option value="thisWeek">Ten Tydzień</option>
                    <option value="lastWeek">Poprzedni Tydzień</option>
                    <option value="thisMonth">Ten Miesiąc</option>
                    <option value="lastMonth">Poprzedni Miesiąc</option>
                    <option value="thisYear">Ten Rok</option>
                    <option value="custom">Zakres Niestandardowy</option>
                  </select>
                </div>
              </div>

              {/* Item Code Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtruj po Kodzie Produktu
                </label>
                <div className="relative">
                  <div className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white flex items-center justify-between cursor-pointer">
                    <div className="flex items-center space-x-3">
                      {/* Tag Icon */}
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      {/* Selected Item Code Display */}
                      <span className="text-sm text-gray-700">
                        {selectedItemCode || 'Wszystkie kody produktów'}
                      </span>
                    </div>
                    {/* Dropdown Arrow */}
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Hidden Select */}
                  <select
                    value={selectedItemCode}
                    onChange={e => setSelectedItemCode(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    <option value="">Wszystkie kody produktów</option>
                    {availableItemCodes.map(itemCode => (
                      <option key={itemCode} value={itemCode}>
                        {itemCode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Początkowa
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Końcowa
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Future Statistics Ideas */}
        <div className="w-1/2">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow-md border border-blue-200 overflow-hidden">
            <button
              onClick={() => setShowFutureFeatures(!showFutureFeatures)}
              className="w-full p-6 text-left hover:bg-blue-100 hover:bg-opacity-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            >
              <h2 className="text-xl font-semibold text-gray-800 flex items-center justify-between">
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
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Przyszłe Funkcje
                </div>
                <svg
                  className={`w-5 h-5 text-blue-600 transform transition-transform duration-200 ${showFutureFeatures ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </h2>
            </button>

            {showFutureFeatures && (
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    <span className="text-sm">
                      Top klienci według wartości transakcji
                    </span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">
                      Historia cen produktów w czasie
                    </span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                    <span className="text-sm">Kwoty sprzedaży wg miesięcy</span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    <span className="text-sm">
                      Ilości wg miesięcy (wykres skumulowany)
                    </span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-md">
                  <p className="text-xs text-gray-600 italic">
                    Te funkcje będą dostępne w przyszłych aktualizacjach systemu
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content container for KPIs, Table, and Chart */}
      <div className="flex gap-6">
        <div className="w-1/2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Łączna Ilość
              </h3>
              <p className="text-3xl font-bold text-orange-700">
                {formatQuantity(totalQuantity)} kg
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Łączna Kwota
              </h3>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          {/* Statistics Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                Podsumowanie Produktów
              </h2>
              <button
                onClick={handleExportToExcel}
                disabled={!user || loading || statisticsSummary.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
              </div>
            ) : statisticsSummary.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('itemCode')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Kod produktu</span>
                          {sortField === 'itemCode' && (
                            <span className="text-orange-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('itemName')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Nazwa produktu</span>
                          {sortField === 'itemName' && (
                            <span className="text-orange-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('totalQuantity')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Łączna Ilość</span>
                          {sortField === 'totalQuantity' && (
                            <span className="text-orange-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('totalAmount')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Łączna Kwota</span>
                          {sortField === 'totalAmount' && (
                            <span className="text-orange-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedStatistics.map((item, index) => (
                      <tr
                        key={`${item.itemCode}-${item.itemName}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.itemCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.itemName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQuantity(item.totalQuantity)} kg
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">
                  Nie znaleziono danych dla wybranych filtrów.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Bar Chart */}
        <div className="w-1/2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Łączna kwota wg produktu
              </h2>
            </div>
            <div className="p-6">
              {sortedStatistics.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(400, sortedStatistics.length * 60)}
                >
                  <BarChart
                    layout="vertical"
                    data={sortedStatistics.map((item, index) => ({
                      name: item.itemName,
                      value: item.totalAmount,
                    }))}
                    margin={{
                      top: 20,
                      right: 100,
                      left: 5,
                      bottom: 20,
                    }}
                    barCategoryGap={sortedStatistics.length > 10 ? 0.5 : 1}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={150}
                      fontSize={14}
                      tick={{ fill: '#374151' }}
                      interval={0}
                    />
                    <Bar
                      dataKey="value"
                      fill="#3b82f6"
                      barSize={
                        sortedStatistics.length > 15
                          ? 35
                          : sortedStatistics.length > 10
                            ? 40
                            : 50
                      }
                      radius={[0, 6, 6, 0]}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(value: number) => formatCurrency(value)}
                        style={{
                          fontSize: '12px',
                          fill: '#374151',
                          fontWeight: '500',
                        }}
                      />
                      {sortedStatistics.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={`hsl(${200 + (index % 12) * 25}, 70%, 50%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">
                    Brak danych dostępnych dla wykresu
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
