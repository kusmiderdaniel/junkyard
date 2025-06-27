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
import { MonthlyData, MonthlyViewType } from '../../types/statistics';

interface MonthlyTrendsTabProps {
  monthlyData: MonthlyData[];
  monthlyViewType: MonthlyViewType;
  loading: boolean;
  onViewTypeChange: (viewType: MonthlyViewType) => void;
  formatCurrency: (amount: number) => string;
  formatQuantity: (quantity: number) => string;
}

export const MonthlyTrendsTab: React.FC<MonthlyTrendsTabProps> = ({
  monthlyData,
  monthlyViewType,
  loading,
  onViewTypeChange,
  formatCurrency,
  formatQuantity,
}) => {
  // Prepare chart data
  const chartData = monthlyData.map(item => ({
    name: item.displayMonth,
    value: monthlyViewType === 'amount' ? item.totalAmount : item.totalQuantity,
  }));

  return (
    <div className="space-y-6">
      {/* View Type Selector */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Trendy w czasie</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Widok:</label>
          <div className="flex items-center">
            <svg
              className="w-4 h-4 text-gray-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <select
              value={monthlyViewType}
              onChange={e =>
                onViewTypeChange(e.target.value as MonthlyViewType)
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="quantity">Ilości (kg)</option>
              <option value="amount">Kwoty (zł)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {monthlyViewType === 'amount' ? 'Kwoty' : 'Ilości'} wg miesięcy
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
          </div>
        ) : monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={12}
                tick={{ fill: '#374151' }}
              />
              <YAxis
                fontSize={12}
                tick={{ fill: '#374151' }}
                tickFormatter={(value: number) =>
                  new Intl.NumberFormat('pl-PL', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(value)
                }
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value: number) =>
                    monthlyViewType === 'amount'
                      ? formatCurrency(value)
                      : `${formatQuantity(value)} kg`
                  }
                  style={{
                    fontSize: '10px',
                    fill: '#374151',
                    fontWeight: '500',
                  }}
                />
                {monthlyData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(${220 + (index % 8) * 15}, 70%, 50%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">
              Brak danych dostępnych dla wybranego okresu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
