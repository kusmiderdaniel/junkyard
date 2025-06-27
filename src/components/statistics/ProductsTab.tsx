import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import { StatisticsSummary, SortDirection } from '../../types/statistics';

interface ProductsTabProps {
  statistics: StatisticsSummary[];
  sortField: keyof StatisticsSummary;
  sortDirection: SortDirection;
  loading: boolean;
  onSort: (field: keyof StatisticsSummary) => void;
  onExportToExcel: () => void;
  formatCurrency: (amount: number) => string;
  formatQuantity: (quantity: number) => string;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  statistics,
  sortField,
  sortDirection,
  loading,
  onSort,
  onExportToExcel,
  formatCurrency,
  formatQuantity,
}) => {
  // Calculate summary cards data
  const totalQuantity = statistics.reduce(
    (sum, item) => sum + item.totalQuantity,
    0
  );
  const totalAmount = statistics.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );
  const totalItems = statistics.length;
  const averagePrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;

  // Prepare chart data (all items by amount)
  const chartData = statistics.map(item => ({
    name: item.itemName,
    value: item.totalAmount,
    itemCode: item.itemCode,
  }));

  const getSortIcon = (field: keyof StatisticsSummary) => {
    if (sortField !== field) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg
        className="w-4 h-4 text-orange-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-orange-500"
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Łączna Ilość
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-700">
            {formatQuantity(totalQuantity)} kg
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Łączna Kwota
          </h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Liczba Produktów
          </h3>
          <p className="mt-2 text-3xl font-bold text-purple-600">
            {totalItems}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Średnia Cena
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-600">
            {formatCurrency(averagePrice)}
          </p>
        </div>
      </div>

      {/* Table and Chart Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Statistics Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Podsumowanie Produktów
              </h3>
              <button
                onClick={onExportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Eksport do Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('itemCode')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Kod Produktu</span>
                      {getSortIcon('itemCode')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('itemName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nazwa Produktu</span>
                      {getSortIcon('itemName')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('totalQuantity')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Łączna Ilość</span>
                      {getSortIcon('totalQuantity')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('totalAmount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Łączna Kwota</span>
                      {getSortIcon('totalAmount')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('averagePrice')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Średnia Cena</span>
                      {getSortIcon('averagePrice')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('transactionCount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Liczba Transakcji</span>
                      {getSortIcon('transactionCount')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        <span className="ml-2 text-gray-500">
                          Ładowanie danych...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : statistics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Brak danych do wyświetlenia
                    </td>
                  </tr>
                ) : (
                  statistics.map(item => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatQuantity(item.totalQuantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.averagePrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.transactionCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Łączna kwota wg produktu
            </h3>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(600, chartData.length * 60)}
            >
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{
                  top: 20,
                  right: 40,
                  left: 5,
                  bottom: 20,
                }}
                barCategoryGap="40%"
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  fontSize={12}
                  tick={{ fill: '#374151' }}
                  interval={0}
                />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  barSize={30}
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value: number) => formatCurrency(value)}
                    fontSize="10"
                    fill="#374151"
                    offset={5}
                  />
                  {chartData.map((_entry, index) => (
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
                Nie znaleziono danych dla wybranych filtrów.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
