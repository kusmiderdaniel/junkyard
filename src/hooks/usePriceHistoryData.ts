import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from './useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
import {
  PriceHistoryEntry,
  PriceHistoryFilters,
  ChartDataPoint,
  ProductOption,
  PriceChangeEvent,
} from '../types/statistics';

interface UsePriceHistoryDataReturn {
  priceHistoryData: ChartDataPoint[];
  productOptions: ProductOption[];
  priceChanges: PriceChangeEvent[];
  chartProducts: Array<{ productKey: string; name: string; color: string }>;
  loading: boolean;
  error: string | null;
  fetchPriceHistory: () => Promise<void>;
  getDateRange: () => { start: Date; end: Date };
}

export const usePriceHistoryData = (
  filters: PriceHistoryFilters
): UsePriceHistoryDataReturn => {
  const { user } = useAuth();
  const { isOffline } = useOfflineStatus();

  const [priceHistoryData, setPriceHistoryData] = useState<ChartDataPoint[]>(
    []
  );
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [priceChanges, setPriceChanges] = useState<PriceChangeEvent[]>([]);
  const [chartProducts, setChartProducts] = useState<
    Array<{ productKey: string; name: string; color: string }>
  >([]);
  const [loading, setLoading] = useState(() => {
    // Only start loading if we have a valid itemCode OR productId to fetch
    return !!(
      (filters.selectedItemCode && filters.selectedItemCode !== '') ||
      (filters.selectedProductId && filters.selectedProductId !== '')
    );
  });
  const [error, setError] = useState<string | null>(null);

  // Get date range for filtering
  const getDateRange = useCallback(() => {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999); // Include full end date
    return { start, end };
  }, [filters.startDate, filters.endDate]);

  // Fetch available products for the dropdown
  const fetchProductOptions = useCallback(async () => {
    if (!user) return;

    try {
      if (isOffline) {
        const cachedProducts = await offlineStorage.getCachedProducts();
        const options: ProductOption[] = cachedProducts.map(product => ({
          productId: product.id,
          itemCode: product.itemCode,
          itemName: product.name,
          currentBuyPrice: product.buy_price,
          currentSellPrice: product.sell_price,
        }));
        setProductOptions(options);
      } else {
        const productsQuery = query(
          collection(db, 'products'),
          where('userID', '==', user.uid)
        );

        const querySnapshot = await getDocs(productsQuery);

        const options: ProductOption[] = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              productId: doc.id,
              itemCode: data.itemCode,
              itemName: data.name,
              currentBuyPrice: data.buy_price,
              currentSellPrice: data.sell_price,
            };
          })
          .sort((a, b) => a.itemCode.localeCompare(b.itemCode));

        setProductOptions(options);
      }
    } catch (error) {
      logger.error(
        'Error fetching product options',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'usePriceHistoryData',
          operation: 'fetchProductOptions',
          userId: user.uid,
        }
      );
      setError('Błąd podczas pobierania listy produktów');
    }
  }, [user, isOffline]);

  // Generate sample data for demonstration
  const generateSamplePriceHistory = useCallback(
    (filters: PriceHistoryFilters): ChartDataPoint[] => {
      const { start, end } = getDateRange();
      const data: ChartDataPoint[] = [];
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      let currentBuyPrice = 10.0;
      let currentSellPrice = 15.0;

      for (
        let i = 0;
        i <= Math.min(daysDiff, 30);
        i += Math.ceil(daysDiff / 15)
      ) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);

        // Add some random price variation
        currentBuyPrice += (Math.random() - 0.5) * 2;
        currentSellPrice += (Math.random() - 0.5) * 3;

        // Ensure prices don't go below reasonable values
        currentBuyPrice = Math.max(5, currentBuyPrice);
        currentSellPrice = Math.max(currentBuyPrice + 2, currentSellPrice);

        data.push({
          date: date.toISOString().split('T')[0],
          buy_price:
            filters.priceType === 'sell_price'
              ? undefined
              : Number(currentBuyPrice.toFixed(2)),
          sell_price:
            filters.priceType === 'buy_price'
              ? undefined
              : Number(currentSellPrice.toFixed(2)),
          timestamp: date.getTime(),
          formattedDate: date.toLocaleDateString('pl-PL'),
        });
      }

      return data;
    },
    [getDateRange]
  );

  // Fetch price history data
  const fetchPriceHistory = useCallback(async () => {
    // Only fetch if user exists AND either itemCode OR specific product is selected
    if (
      !user ||
      ((!filters.selectedItemCode || filters.selectedItemCode === '') &&
        (!filters.selectedProductId || filters.selectedProductId === ''))
    ) {
      setPriceHistoryData([]);
      setPriceChanges([]);
      setChartProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, we'll simulate price history data since the collection doesn't exist yet
      // This will be replaced with actual Firestore queries once the Cloud Function is set up

      if (isOffline) {
        // In offline mode, we'll return empty data for now
        setPriceHistoryData([]);
        setPriceChanges([]);
        setChartProducts([]);
        setLoading(false);
        return;
      }

      // Query price history data - either by itemCode or specific productId
      let priceHistoryQuery;
      if (filters.selectedProductId && filters.selectedProductId !== '') {
        // Query for specific product
        priceHistoryQuery = query(
          collection(db, 'priceHistory'),
          where('userID', '==', user.uid),
          where('productId', '==', filters.selectedProductId.split('_')[1]) // Extract productId from the key
        );
      } else {
        // Query for itemCode
        priceHistoryQuery = query(
          collection(db, 'priceHistory'),
          where('userID', '==', user.uid),
          where('itemCode', '==', filters.selectedItemCode)
        );
      }

      const querySnapshot = await getDocs(priceHistoryQuery);

      const entries: PriceHistoryEntry[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userID: data.userID,
          productId: data.productId,
          itemCode: data.itemCode,
          itemName: data.itemName,
          buy_price: data.buy_price,
          sell_price: data.sell_price,
          timestamp: data.timestamp.toDate(),
          dateKey: data.dateKey,
          createdAt: data.createdAt.toDate(),
        };
      });

      // Group entries by date and create chart data for multiple products
      const dataByDate = new Map<string, any>();

      entries.forEach(entry => {
        const dateKey = entry.dateKey;
        if (!dataByDate.has(dateKey)) {
          dataByDate.set(dateKey, {
            date: dateKey,
            timestamp: entry.timestamp.getTime(),
            formattedDate: entry.timestamp.toLocaleDateString('pl-PL'),
          });
        }

        const dayData = dataByDate.get(dateKey);
        const productKey = `${entry.itemCode}_${entry.productId}`;

        if (
          filters.priceType === 'buy_price' ||
          filters.priceType === 'sell_price'
        ) {
          const priceKey = `${filters.priceType}_${productKey}`;
          dayData[priceKey] = entry[filters.priceType];
          dayData[`${productKey}_name`] =
            `${entry.itemCode} - ${entry.itemName}`;
        }
      });

      const chartData: ChartDataPoint[] = Array.from(dataByDate.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );

      // Generate colors and product info for chart
      const uniqueProducts = new Set<string>();
      entries.forEach(entry => {
        const productKey = `${entry.itemCode}_${entry.productId}`;
        uniqueProducts.add(productKey);
      });

      const colors = [
        '#f59e0b',
        '#3b82f6',
        '#ef4444',
        '#10b981',
        '#8b5cf6',
        '#f97316',
        '#06b6d4',
        '#84cc16',
        '#ec4899',
        '#6366f1',
      ];

      const products = Array.from(uniqueProducts).map((productKey, index) => {
        const entry = entries.find(
          e => `${e.itemCode}_${e.productId}` === productKey
        );
        return {
          productKey,
          name: entry ? `${entry.itemCode} - ${entry.itemName}` : productKey,
          color: colors[index % colors.length],
        };
      });

      setChartProducts(products);

      // Calculate price changes
      const changes: PriceChangeEvent[] = [];
      for (let i = 1; i < entries.length; i++) {
        const current = entries[i];
        const previous = entries[i - 1];

        const buyChange =
          ((current.buy_price - previous.buy_price) / previous.buy_price) * 100;
        const sellChange =
          ((current.sell_price - previous.sell_price) / previous.sell_price) *
          100;

        if (buyChange !== 0 || sellChange !== 0) {
          changes.push({
            date: current.dateKey,
            oldBuyPrice: previous.buy_price,
            newBuyPrice: current.buy_price,
            oldSellPrice: previous.sell_price,
            newSellPrice: current.sell_price,
            changePercentage: {
              buy: buyChange,
              sell: sellChange,
            },
          });
        }
      }

      setPriceHistoryData(chartData);
      setPriceChanges(changes);
    } catch (error) {
      logger.error(
        'Error fetching price history',
        isErrorWithMessage(error) ? error : undefined,
        {
          component: 'usePriceHistoryData',
          operation: 'fetchPriceHistory',
          userId: user.uid,
          extra: { productId: filters.selectedProductId },
        }
      );

      // If collection doesn't exist yet, create sample data for demonstration
      if (error instanceof Error && error.message.includes('collection')) {
        const sampleData = generateSamplePriceHistory(filters);
        setPriceHistoryData(sampleData);
        setChartProducts([]);
        setError('Brak danych historycznych. Wyświetlane są dane przykładowe.');
      } else {
        setError('Błąd podczas pobierania historii cen');
        setChartProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, filters, isOffline, generateSamplePriceHistory]);

  // Effect to fetch data when filters change
  useEffect(() => {
    fetchProductOptions();
  }, [fetchProductOptions]);

  useEffect(() => {
    fetchPriceHistory();
  }, [fetchPriceHistory]);

  return {
    priceHistoryData,
    productOptions,
    priceChanges,
    chartProducts,
    loading,
    error,
    fetchPriceHistory,
    getDateRange,
  };
};
