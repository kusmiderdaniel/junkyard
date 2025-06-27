import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePriceHistoryData } from '../../hooks/usePriceHistoryData';
import { PriceHistoryFilters } from '../../types/statistics';
import LoadingSpinner from '../LoadingSpinner';

interface PriceHistoryTabProps {
  formatCurrency: (amount: number) => string;
  startDate: string;
  endDate: string;
  selectedItemCode: string;
}

export const PriceHistoryTab: React.FC<PriceHistoryTabProps> = ({
  formatCurrency,
  startDate,
  endDate,
  selectedItemCode,
}) => {
  const [filters, setFilters] = useState<PriceHistoryFilters>({
    selectedProductId: '',
    selectedItemCode: selectedItemCode,
    startDate: startDate,
    endDate: endDate,
    priceType: 'buy_price', // Default to buy price only
  });

  // State for highlighting specific products
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(
    null
  );

  // State for product filter
  const [selectedProductFilter, setSelectedProductFilter] =
    useState<string>('');

  // State for time aggregation
  const [timeAggregation, setTimeAggregation] = useState<
    'daily' | 'weekly' | 'monthly'
  >('daily');

  const { priceHistoryData, chartProducts, productOptions, loading, error } =
    usePriceHistoryData(filters);

  // Update filters when props change
  useEffect(() => {
    setFilters((prev: PriceHistoryFilters) => ({
      ...prev,
      selectedItemCode: selectedItemCode,
      startDate: startDate,
      endDate: endDate,
    }));
  }, [selectedItemCode, startDate, endDate]);

  // Reset product filter only when itemCode changes (not dates)
  useEffect(() => {
    setSelectedProductFilter('');
    setHighlightedProduct(null);
  }, [selectedItemCode]);

  // Update filters when selectedProductFilter changes
  useEffect(() => {
    setFilters((prev: PriceHistoryFilters) => ({
      ...prev,
      selectedProductId: selectedProductFilter,
    }));
  }, [selectedProductFilter]);

  // Handle price type change
  const handlePriceTypeChange = (
    priceType: PriceHistoryFilters['priceType']
  ) => {
    setFilters((prev: PriceHistoryFilters) => ({ ...prev, priceType }));
  };

  // Handle product highlight/focus
  const handleProductClick = (productKey: string) => {
    if (highlightedProduct === productKey) {
      // If already highlighted, remove highlight
      setHighlightedProduct(null);
    } else {
      // Highlight the clicked product
      setHighlightedProduct(productKey);
    }
  };

  // Handle product filter change
  const handleProductFilterChange = (productKey: string) => {
    setSelectedProductFilter(productKey);
    setHighlightedProduct(null); // Clear highlight when filter changes
  };

  // Get available products for the dropdown based on selected itemCode
  const availableProducts = React.useMemo(() => {
    if (!selectedItemCode || selectedItemCode === '') {
      // If no itemCode selected, show all products
      return productOptions;
    } else {
      // Filter products by selected itemCode
      return productOptions.filter(
        product => product.itemCode === selectedItemCode
      );
    }
  }, [productOptions, selectedItemCode]);

  // Determine if we should show data - either itemCode OR specific product must be selected
  const shouldShowChart = React.useMemo(() => {
    // Show chart if:
    // 1. A specific itemCode is selected (not empty/all), OR
    // 2. A specific product is selected (regardless of itemCode)
    return (
      (selectedItemCode && selectedItemCode !== '') ||
      (selectedProductFilter && selectedProductFilter !== '')
    );
  }, [selectedItemCode, selectedProductFilter]);

  // Filter chart products based on selected product filter
  const filteredChartProducts = React.useMemo(() => {
    if (!selectedProductFilter) {
      return chartProducts;
    }
    return chartProducts.filter(
      product => product.productKey === selectedProductFilter
    );
  }, [chartProducts, selectedProductFilter]);

  // Aggregate data based on time period
  const aggregatedPriceData = React.useMemo(() => {
    if (!priceHistoryData.length || timeAggregation === 'daily') {
      return priceHistoryData;
    }

    const aggregatedData = new Map<string, any>();

    priceHistoryData.forEach(dataPoint => {
      const date = new Date(dataPoint.date);
      let periodKey: string;
      let periodLabel: string;

      if (timeAggregation === 'weekly') {
        // Get Monday of the week (ISO week)
        const monday = new Date(date);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        periodKey = monday.toISOString().split('T')[0];
        periodLabel = `${monday.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })} - ${new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' })}`;
      } else {
        // monthly
        const firstDayOfMonth = new Date(
          date.getFullYear(),
          date.getMonth(),
          1
        );
        periodKey = firstDayOfMonth.toISOString().split('T')[0];
        periodLabel = firstDayOfMonth.toLocaleDateString('pl-PL', {
          year: 'numeric',
          month: 'long',
        });
      }

      if (!aggregatedData.has(periodKey)) {
        aggregatedData.set(periodKey, {
          date: periodKey,
          formattedDate: periodLabel,
          timestamp: new Date(periodKey).getTime(),
          dataPoints: [],
          values: {},
        });
      }

      const period = aggregatedData.get(periodKey);
      period.dataPoints.push(dataPoint);

      // Aggregate all price values for this period
      Object.keys(dataPoint).forEach(key => {
        if (
          key.includes('_price') &&
          typeof (dataPoint as any)[key] === 'number'
        ) {
          if (!period.values[key]) {
            period.values[key] = [];
          }
          period.values[key].push((dataPoint as any)[key]);
        }
      });
    });

    // Calculate averages for each period
    return Array.from(aggregatedData.values())
      .map(period => {
        const result: any = {
          date: period.date,
          formattedDate: period.formattedDate,
          timestamp: period.timestamp,
        };

        // Calculate average for each price field
        Object.keys(period.values).forEach(key => {
          const values = period.values[key];
          result[key] =
            values.reduce((sum: number, val: number) => sum + val, 0) /
            values.length;
        });

        return result;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [priceHistoryData, timeAggregation]);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find the data point to get the formatted date
      const dataPoint = aggregatedPriceData.find(d => d.date === label);
      const displayDate = dataPoint?.formattedDate || label;

      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="text-sm font-medium text-gray-900 pb-2">
            {timeAggregation === 'daily'
              ? `Data: ${displayDate}`
              : timeAggregation === 'weekly'
                ? `Tydzień: ${displayDate}`
                : `Miesiąc: ${displayDate}`}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
              {timeAggregation !== 'daily' && (
                <span className="text-gray-500 text-xs ml-1">(średnia)</span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">
          Historia cen produktów
        </h2>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Filtry historii cen
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Price Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ ceny
            </label>
            <div className="relative">
              <div className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  {/* Currency Icon */}
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">
                    {filters.priceType === 'buy_price'
                      ? 'Cena skupu'
                      : 'Cena sprzedaży'}
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
                value={filters.priceType}
                onChange={e =>
                  handlePriceTypeChange(
                    e.target.value as PriceHistoryFilters['priceType']
                  )
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="buy_price">Cena skupu</option>
                <option value="sell_price">Cena sprzedaży</option>
              </select>
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Konkretny produkt
            </label>
            <div className="relative">
              <div
                className={`w-full px-4 py-3 border border-gray-300 rounded-md bg-white flex items-center justify-between cursor-pointer ${availableProducts.length === 0 ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  {/* Product Icon */}
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">
                    {selectedProductFilter
                      ? availableProducts.find(
                          p =>
                            `${p.itemCode}_${p.productId}` ===
                            selectedProductFilter
                        )?.itemName || 'Nieznany produkt'
                      : 'Wszystkie produkty'}
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
                value={selectedProductFilter}
                onChange={e => handleProductFilterChange(e.target.value)}
                disabled={availableProducts.length === 0}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="">Wszystkie produkty</option>
                {availableProducts.map(product => (
                  <option
                    key={`${product.itemCode}_${product.productId}`}
                    value={`${product.itemCode}_${product.productId}`}
                  >
                    {product.itemCode} - {product.itemName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Aggregation Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agregacja czasowa
            </label>
            <div className="relative">
              <div className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white flex items-center justify-between cursor-pointer">
                <div className="flex items-center space-x-3">
                  {/* Clock Icon */}
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm text-gray-700">
                    {timeAggregation === 'daily'
                      ? 'Dziennie'
                      : timeAggregation === 'weekly'
                        ? 'Tygodniowo'
                        : 'Miesięcznie'}
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
                value={timeAggregation}
                onChange={e =>
                  setTimeAggregation(
                    e.target.value as 'daily' | 'weekly' | 'monthly'
                  )
                }
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="daily">Dziennie</option>
                <option value="weekly">Tygodniowo</option>
                <option value="monthly">Miesięcznie</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Summary */}
      {filteredChartProducts.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-medium text-blue-800 mb-2">
            Produkty w wykresie ({filteredChartProducts.length})
            {selectedProductFilter && (
              <span className="text-sm font-normal text-blue-600 ml-2">
                (filtrowane)
              </span>
            )}
            {highlightedProduct && (
              <span className="text-sm font-normal text-blue-600 ml-2">
                (kliknij ponownie, aby usunąć podświetlenie)
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {filteredChartProducts.map(product => (
              <div
                key={product.productKey}
                className={`flex items-center cursor-pointer p-2 rounded transition-all duration-200 ${
                  highlightedProduct === product.productKey
                    ? 'bg-blue-200 shadow-sm scale-105'
                    : highlightedProduct
                      ? 'opacity-50 hover:opacity-75'
                      : 'hover:bg-blue-100'
                }`}
                onClick={() => handleProductClick(product.productKey)}
                title="Kliknij, aby podświetlić tę linię na wykresie"
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: product.color }}
                ></div>
                <span className="text-blue-900">{product.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart Section */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : !shouldShowChart ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Wybierz kod produktu lub konkretny produkt
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Użyj filtru "Filtruj po Kodzie Produktu" powyżej lub wybierz
            "Konkretny produkt" powyżej, aby wyświetlić historię cen.
          </p>
        </div>
      ) : aggregatedPriceData.length === 0 &&
        filteredChartProducts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Brak danych
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Brak danych historycznych dla wybranego kodu produktu w tym okresie.
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Historia cen - {selectedItemCode}
          </h3>

          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart
                data={aggregatedPriceData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={value => {
                    const dataPoint = aggregatedPriceData.find(
                      d => d.date === value
                    );
                    if (dataPoint?.formattedDate) {
                      // For weekly/monthly, use the formatted date; for daily, show short format
                      if (timeAggregation === 'daily') {
                        const date = new Date(value);
                        return date.toLocaleDateString('pl-PL', {
                          month: 'short',
                          day: 'numeric',
                        });
                      } else {
                        // For weekly/monthly, show abbreviated format
                        return timeAggregation === 'weekly'
                          ? dataPoint.formattedDate.split(' - ')[0] // Show start of week
                          : dataPoint.formattedDate.split(' ')[0]; // Show month name only
                      }
                    }
                    return value;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={value => `${value.toFixed(2)} zł`}
                />
                <Tooltip content={<CustomTooltip />} />

                {filteredChartProducts.map(product => {
                  const isHighlighted =
                    highlightedProduct === product.productKey;
                  const shouldDim = highlightedProduct && !isHighlighted;

                  return (
                    <Line
                      key={`${filters.priceType}_${product.productKey}`}
                      type="monotone"
                      dataKey={`${filters.priceType}_${product.productKey}`}
                      stroke={product.color}
                      strokeWidth={isHighlighted ? 3 : 2}
                      strokeOpacity={shouldDim ? 0.2 : 1}
                      dot={{
                        fill: product.color,
                        strokeWidth: isHighlighted ? 3 : 2,
                        r: isHighlighted ? 5 : 4,
                        fillOpacity: shouldDim ? 0.3 : 1,
                        cursor: 'pointer',
                      }}
                      name={product.name}
                      connectNulls={false}
                      onClick={() => handleProductClick(product.productKey)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
