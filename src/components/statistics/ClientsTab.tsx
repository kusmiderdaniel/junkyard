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
import { ClientStatistics } from '../../types/statistics';

interface ClientsTabProps {
  clientStatistics: ClientStatistics[];
  clientSortField: keyof ClientStatistics;
  clientSortDirection: 'asc' | 'desc';
  loading: boolean;
  onSort: (field: keyof ClientStatistics) => void;
  onClientClick: (clientId: string) => void;
  formatCurrency: (amount: number) => string;
  formatQuantity: (quantity: number) => string;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({
  clientStatistics,
  clientSortField,
  clientSortDirection,
  loading,
  onSort,
  onClientClick,
  formatCurrency,
  formatQuantity,
}) => {
  // Calculate summary cards data
  const totalReceiptCount = clientStatistics.reduce(
    (sum, client) => sum + client.receiptCount,
    0
  );
  const totalAmount = clientStatistics.reduce(
    (sum, client) => sum + client.totalAmount,
    0
  );

  // Prepare chart data (all clients by amount)
  const chartData = clientStatistics.map(client => ({
    name: client.clientName,
    value: client.totalAmount,
    clientId: client.clientId,
  }));

  const getSortIcon = (field: keyof ClientStatistics) => {
    if (clientSortField !== field) {
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

    return clientSortDirection === 'asc' ? (
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
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Łączna Ilość Kwitów
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-600">
            {totalReceiptCount}
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
      </div>

      {/* Table and Chart Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Top Klienci</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('clientName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nazwa Klienta</span>
                      {getSortIcon('clientName')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => onSort('receiptCount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Liczba Kwitów</span>
                      {getSortIcon('receiptCount')}
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        <span className="ml-2 text-gray-500">
                          Ładowanie danych...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : clientStatistics.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Brak danych do wyświetlenia
                    </td>
                  </tr>
                ) : (
                  clientStatistics.map(client => (
                    <tr key={client.clientId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => onClientClick(client.clientId)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {client.clientName}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {client.receiptCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatQuantity(client.totalQuantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(client.totalAmount)}
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
              Łączna kwota wg klientów
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
                  right: 60,
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
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(${120 + (index % 12) * 25}, 70%, 50%)`}
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
