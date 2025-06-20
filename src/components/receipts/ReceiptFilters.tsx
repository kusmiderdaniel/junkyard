import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ReceiptFiltersProps {
  user: any;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  itemsPerPage: number;
  setItemsPerPage: (value: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  filteredReceiptsLength: number;
  onDownloadSummary: () => void;
  onExportToExcel: () => void;
  onSearch: () => void;
  onClearSearch: () => void;
  activeSearchTerm: string;
}

const ReceiptFilters: React.FC<ReceiptFiltersProps> = ({
  user,
  searchTerm,
  setSearchTerm,
  selectedMonth,
  setSelectedMonth,
  availableMonths,
  itemsPerPage,
  setItemsPerPage,
  currentPage,
  totalPages,
  onPageChange,
  loading,
  filteredReceiptsLength,
  onDownloadSummary,
  onExportToExcel,
  onSearch,
  onClearSearch,
  activeSearchTerm
}) => {
  const navigate = useNavigate();

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const handleItemsPerPageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = parseInt(event.target.value);
    setItemsPerPage(newValue);
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedMonth('');
    onClearSearch();
  };

  return (
    <div>
      {/* Action Buttons */}
      <div className="mb-4 flex gap-3">
        <button
          onClick={() => {
            if (!user) return;
            navigate('/add-receipt');
          }}
          disabled={!user}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-700 rounded-md hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Dodaj Kwit
        </button>
        <button
          onClick={onDownloadSummary}
          disabled={!user || loading || filteredReceiptsLength === 0}
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
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            <polyline points="9,15 12,18 15,15"></polyline>
            <line x1="12" y1="18" x2="12" y2="10"></line>
          </svg>
          Podsumowanie PDF
        </button>
        <button
          onClick={onExportToExcel}
          disabled={!user || loading || filteredReceiptsLength === 0}
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
      
      {/* Search, Filter, and Pagination Bar */}
      <div className="mb-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        {/* Left side: Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 lg:flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
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
              placeholder="Szukaj kwitów, klientów lub produktów..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              disabled={!user}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
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

          {/* Search Button */}
          <button
            onClick={onSearch}
            disabled={!user}
            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Szukaj
          </button>

          {/* Month Filter */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            >
              <option value="">Wszystkie miesiące</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {(activeSearchTerm || selectedMonth) && (
            <button
              onClick={handleClearAllFilters}
              disabled={!user}
              className="px-4 py-2 text-sm text-white bg-gray-600 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Wyczyść
            </button>
          )}
        </div>

        {/* Right side: Pagination Controls */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          {/* Items per page selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="items-per-page" className="text-sm text-gray-700 whitespace-nowrap">Pokaż:</label>
            <select
              id="items-per-page"
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              disabled={!user}
              className="block w-24 pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md disabled:opacity-50"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page info and navigation */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 whitespace-nowrap">
              {currentPage}/{totalPages}
            </span>
            <div className="flex">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading || !user}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900 disabled:opacity-50"
              >
                Poprzednia
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading || !user}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-r border-0 border-l border-gray-700 hover:bg-gray-900 disabled:opacity-50"
              >
                Następna
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(activeSearchTerm || selectedMonth) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-800">Aktywne filtry:</span>
              {activeSearchTerm && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Wyszukiwanie: "{activeSearchTerm}"
                </span>
              )}
              {selectedMonth && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Miesiąc: {formatMonthLabel(selectedMonth)}
                </span>
              )}
            </div>
            <button
              onClick={handleClearAllFilters}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Wyczyść wszystkie
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptFilters; 