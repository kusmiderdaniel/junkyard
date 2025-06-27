import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
import { useAuth } from '../contexts/AuthContext';
import { useStatisticsData } from '../hooks/useStatisticsData';
import {
  DateFilterType,
  ReportTab,
  MonthlyViewType,
  StatisticsSummary,
  ClientStatistics,
  ExcelStatisticsData,
  SortDirection,
} from '../types/statistics';
import { StatisticsFilters } from '../components/statistics/StatisticsFilters';
import { TabNavigation } from '../components/statistics/TabNavigation';
import { ProductsTab } from '../components/statistics/ProductsTab';
import { ClientsTab } from '../components/statistics/ClientsTab';
import { MonthlyTrendsTab } from '../components/statistics/MonthlyTrendsTab';

const Statistics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State for filters
  const [dateFilter, setDateFilter] = useState<DateFilterType>('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedItemCode, setSelectedItemCode] = useState('');

  // Monthly view type state
  const [monthlyViewType, setMonthlyViewType] =
    useState<MonthlyViewType>('amount');

  // Use custom hook for data management
  const {
    statisticsSummary,
    availableItemCodes,
    clientStatistics,
    monthlyData,
    loading,
    getDateRange,
  } = useStatisticsData(dateFilter, startDate, endDate, selectedItemCode);

  // Client statistics state
  const [clientStatistics, setClientStatistics] = useState<ClientStatistics[]>(
    []
  );
  const [clients, setClients] = useState<{ [key: string]: string }>({});

  // Monthly statistics state
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyViewType, setMonthlyViewType] =
    useState<MonthlyViewType>('amount');

  // Sorting state
  const [sortField, setSortField] =
    useState<keyof StatisticsSummary>('totalAmount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Client sorting state
  const [clientSortField, setClientSortField] =
    useState<keyof ClientStatistics>('totalAmount');
  const [clientSortDirection, setClientSortDirection] =
    useState<SortDirection>('desc');

  // Client sorting state
  const [clientSortField, setClientSortField] =
    useState<keyof ClientStatistics>('totalAmount');
  const [clientSortDirection, setClientSortDirection] = useState<
    'asc' | 'desc'
  >('desc');

  // Toggle state for future features
  const [showFutureFeatures, setShowFutureFeatures] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>('products');

  // Track if trends tab has been visited to prevent automatic date filter reset
  const [trendsTabVisited, setTrendsTabVisited] = useState(false);

  // Initialize default date range for custom filter
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setStartDate(firstDayOfMonth.toISOString().split('T')[0]);
    setEndDate(lastDayOfMonth.toISOString().split('T')[0]);
  }, []);

  // Auto-select "this year" when monthly trends tab is first selected
  useEffect(() => {
    if (
      activeTab === 'trends' &&
      !trendsTabVisited &&
      dateFilter !== 'thisYear'
    ) {
      setDateFilter('thisYear');
      setTrendsTabVisited(true);
    } else if (activeTab === 'trends' && !trendsTabVisited) {
      setTrendsTabVisited(true);
    }
  }, [activeTab, trendsTabVisited, dateFilter]);

  // Process client statistics when receipts or clients change
  useEffect(() => {
    processClientStatistics();
  }, [processClientStatistics]);

  // Process monthly statistics when receipts change
  useEffect(() => {
    processMonthlyStatistics();
  }, [processMonthlyStatistics]);

  // Auto-select "this year" when monthly trends tab is active
  useEffect(() => {
    if (activeTab === 'trends' && dateFilter !== 'thisYear') {
      setDateFilter('thisYear');
    }
  }, [activeTab, dateFilter]);

  // Handle date filter change
  const handleDateFilterChange = (filterType: DateFilterType) => {
    setDateFilter(filterType);
  };

  // Handle client navigation
  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}`);
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

  // Client sorting function
  const handleClientSort = (field: keyof ClientStatistics) => {
    if (clientSortField === field) {
      setClientSortDirection(clientSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setClientSortField(field);
      setClientSortDirection('desc');
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

  // Get sorted client data
  const sortedClientStatistics = React.useMemo(() => {
    return [...clientStatistics].sort((a, b) => {
      const aValue = a[clientSortField];
      const bValue = b[clientSortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return clientSortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return clientSortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      return 0;
    });
  }, [clientStatistics, clientSortField, clientSortDirection]);

  // Calculate client totals
  const totalClientQuantity = clientStatistics.reduce(
    (sum, client) => sum + client.totalQuantity,
    0
  );
  const totalClientAmount = clientStatistics.reduce(
    (sum, client) => sum + client.totalAmount,
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

      // Dynamically import the Excel utility
      const { ExcelExportUtility } = await import('../utils/excelExport');

      const { start, end } = getDateRange(dateFilter);
      const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      };

      const filename = `statystyki_${formatDate(start)}_${formatDate(end)}`;

      await ExcelExportUtility.exportToExcel({
        filename,
        worksheetName: 'Statystyki',
        headers: ['Kod produktu', 'Nazwa produktu', 'Ilość', 'Kwota'],
        data: excelData,
        title: 'Statystyki produktów',
        subtitle: `Okres: ${formatDate(start)} - ${formatDate(end)}`,
      });

      toast.success('Plik Excel został wygenerowany pomyślnie!');
    } catch (error) {
      logger.error(
        'Błąd podczas eksportu do Excel',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'Statistics',
          operation: 'handleExportToExcel',
          userId: user?.uid,
        }
      );
      toast.error('Wystąpił błąd podczas generowania pliku Excel');
    }
  };

  // Show loading or login prompt if no user
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Zaloguj się, aby wyświetlić statystyki.</p>
      </div>
    );
  }

  const renderPlaceholderTab = (tabName: string) => (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-gray-800 mb-2">{tabName}</h3>
      <p className="text-gray-500">
        Ta funkcja będzie dostępna w przyszłych aktualizacjach systemu.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Statystyki</h1>
      </div>

      {/* Filters Section */}
      <div className="flex gap-6">
        <div className="w-1/2">
          <StatisticsFilters
            dateFilter={dateFilter}
            startDate={startDate}
            endDate={endDate}
            selectedItemCode={selectedItemCode}
            availableItemCodes={availableItemCodes}
            onDateFilterChange={handleDateFilterChange}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onItemCodeChange={setSelectedItemCode}
            getDateRange={getDateRange}
          />
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
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">
                      Historia cen produktów w czasie
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

      {/* Tab Navigation and Content */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'products' && (
            <ProductsTab
              statistics={sortedStatistics}
              sortField={sortField}
              sortDirection={sortDirection}
              loading={loading}
              onSort={handleSort}
              onExportToExcel={handleExportToExcel}
              formatCurrency={formatCurrency}
              formatQuantity={formatQuantity}
            />
          )}
          {activeTab === 'clients' && (
            <ClientsTab
              clientStatistics={sortedClientStatistics}
              clientSortField={clientSortField}
              clientSortDirection={clientSortDirection}
              loading={loading}
              onSort={handleClientSort}
              onClientClick={handleClientClick}
              formatCurrency={formatCurrency}
              formatQuantity={formatQuantity}
            />
          )}
          {activeTab === 'trends' && (
            <MonthlyTrendsTab
              monthlyData={monthlyData}
              monthlyViewType={monthlyViewType}
              loading={loading}
              onViewTypeChange={setMonthlyViewType}
              formatCurrency={formatCurrency}
              formatQuantity={formatQuantity}
            />
          )}
          {activeTab === 'monthly' &&
            renderPlaceholderTab('Raporty miesięczne')}
        </div>
      </div>
    </div>
  );
};

export default Statistics;
