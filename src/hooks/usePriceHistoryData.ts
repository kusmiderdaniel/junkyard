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
import {
  ensurePriceDataToYesterday,
  getCurrentProductPrices,
} from '../utils/priceHistoryProcessor';

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
          where('productId', '==', filters.selectedProductId.split('_')[1])
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
          entryType: data.entryType,
        };
      });

      // Get filtered products for fallback current prices
      const relevantProducts = productOptions.filter(product => {
        if (filters.selectedProductId && filters.selectedProductId !== '') {
          return (
            `${product.itemCode}_${product.productId}` ===
            filters.selectedProductId
          );
        } else {
          return product.itemCode === filters.selectedItemCode;
        }
      });

      // Use the new utility to ensure continuous price data up to yesterday
      const filledData = ensurePriceDataToYesterday(
        entries,
        relevantProducts,
        filters.startDate,
        filters.endDate,
        filters.priceType
      );

      setPriceHistoryData(filledData);

      // Generate colors and product info for chart
      const uniqueProducts = new Set<string>();
      filledData.forEach(dataPoint => {
        Object.keys(dataPoint).forEach(key => {
          if (
            key.includes(`${filters.priceType}_`) &&
            typeof dataPoint[key] === 'number'
          ) {
            const productKey = key.replace(`${filters.priceType}_`, '');
            uniqueProducts.add(productKey);
          }
        });
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
        const productData = relevantProducts.find(
          p => `${p.itemCode}_${p.productId}` === productKey
        );
        return {
          productKey,
          name: productData
            ? `${productData.itemCode} - ${productData.itemName}`
            : productKey,
          color: colors[index % colors.length],
        };
      });

      setChartProducts(products);

      // Calculate price changes from original entries (not filled data)
      const changes: PriceChangeEvent[] = [];
      const sortedEntries = [...entries].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      for (let i = 1; i < sortedEntries.length; i++) {
        const current = sortedEntries[i];
        const previous = sortedEntries[i - 1];

        if (current.productId === previous.productId) {
          const buyChange =
            previous.buy_price !== 0
              ? ((current.buy_price - previous.buy_price) /
                  previous.buy_price) *
                100
              : 0;
          const sellChange =
            previous.sell_price !== 0
              ? ((current.sell_price - previous.sell_price) /
                  previous.sell_price) *
                100
              : 0;

          if (Math.abs(buyChange) > 0.01 || Math.abs(sellChange) > 0.01) {
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
      }

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

      // If there's an error, try to show current prices as fallback
      const relevantProducts = productOptions.filter(product => {
        if (filters.selectedProductId && filters.selectedProductId !== '') {
          return (
            `${product.itemCode}_${product.productId}` ===
            filters.selectedProductId
          );
        } else {
          return product.itemCode === filters.selectedItemCode;
        }
      });

      if (relevantProducts.length > 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const fallbackData = getCurrentProductPrices(
          relevantProducts,
          yesterdayStr,
          filters.priceType
        );

        setPriceHistoryData(fallbackData);
        setError('Brak danych historycznych. Wyświetlana jest aktualna cena.');
      } else {
        setPriceHistoryData([]);
        setError('Błąd podczas pobierania historii cen');
      }

      setChartProducts([]);
      setPriceChanges([]);
    } finally {
      setLoading(false);
    }
  }, [user, filters, isOffline, productOptions]);

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
