import React from 'react';
import { DateFilterType } from '../../types/statistics';

interface StatisticsFiltersProps {
  dateFilter: DateFilterType;
  startDate: string;
  endDate: string;
  selectedItemCode: string;
  availableItemCodes: string[];
  onDateFilterChange: (filterType: DateFilterType) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onItemCodeChange: (itemCode: string) => void;
  getDateRange: (filterType: DateFilterType) => { start: Date; end: Date };
}

export const StatisticsFilters: React.FC<StatisticsFiltersProps> = ({
  dateFilter,
  startDate,
  endDate,
  selectedItemCode,
  availableItemCodes,
  onDateFilterChange,
  onStartDateChange,
  onEndDateChange,
  onItemCodeChange,
  getDateRange,
}) => {
  return (
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
                      const day = date.getDate().toString().padStart(2, '0');
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
                onDateFilterChange(e.target.value as DateFilterType)
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
              onChange={e => onItemCodeChange(e.target.value)}
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
              onChange={e => onStartDateChange(e.target.value)}
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
              onChange={e => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
