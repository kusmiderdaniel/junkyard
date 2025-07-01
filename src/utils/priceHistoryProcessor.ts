import { PriceHistoryEntry } from '../types/statistics';
import { logger } from './logger';

interface PriceHistoryDataPoint {
  date: string;
  timestamp: number;
  formattedDate: string;
  [key: string]: any; // For dynamic price fields like 'buy_price_PRODUCT_KEY'
}

/**
 * Fills gaps in price history data to ensure continuous price information.
 * When prices don't change, carries forward the last known price for each day.
 */
export const fillPriceHistoryGaps = (
  entries: PriceHistoryEntry[],
  startDate: string,
  endDate: string,
  priceType: 'buy_price' | 'sell_price'
): PriceHistoryDataPoint[] => {
  if (!entries.length) {
    return [];
  }

  // Sort entries by timestamp to ensure chronological order
  const sortedEntries = [...entries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Group entries by product and date
  const entriesByProduct = new Map<string, Map<string, PriceHistoryEntry>>();

  sortedEntries.forEach(entry => {
    const productKey = `${entry.itemCode}_${entry.productId}`;

    if (!entriesByProduct.has(productKey)) {
      entriesByProduct.set(productKey, new Map());
    }

    const productEntries = entriesByProduct.get(productKey)!;
    productEntries.set(entry.dateKey, entry);
  });

  // Get all unique products
  const allProducts = Array.from(entriesByProduct.keys());

  // Generate continuous date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Don't go beyond yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (end > yesterday) {
    end.setTime(yesterday.getTime());
  }

  const dateRange: string[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    dateRange.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Build complete dataset with gaps filled
  const completeData: PriceHistoryDataPoint[] = [];

  dateRange.forEach(dateKey => {
    const date = new Date(dateKey);
    const dataPoint: PriceHistoryDataPoint = {
      date: dateKey,
      timestamp: date.getTime(),
      formattedDate: date.toLocaleDateString('pl-PL'),
    };

    // For each product, fill in the price data
    allProducts.forEach(productKey => {
      const productEntries = entriesByProduct.get(productKey)!;

      // Get the price for this date or carry forward from the last known price
      let priceEntry = productEntries.get(dateKey);

      if (!priceEntry) {
        // Find the most recent price before this date
        priceEntry = findLastKnownPrice(productEntries, dateKey);
      }

      if (priceEntry) {
        const priceKey = `${priceType}_${productKey}`;
        dataPoint[priceKey] = priceEntry[priceType];
        dataPoint[`${productKey}_name`] =
          `${priceEntry.itemCode} - ${priceEntry.itemName}`;
      }
    });

    // Only add data point if it has at least one price value
    const hasPriceData = Object.keys(dataPoint).some(
      key => key.includes(`${priceType}_`) && typeof dataPoint[key] === 'number'
    );

    if (hasPriceData) {
      completeData.push(dataPoint);
    }
  });

  logger.debug(
    'Price history gaps filled',
    {
      originalEntries: entries.length,
      filledDataPoints: completeData.length,
      dateRange: `${startDate} to ${endDate}`,
      products: allProducts.length,
    },
    {
      component: 'PriceHistoryProcessor',
      operation: 'fillPriceHistoryGaps',
    }
  );

  return completeData;
};

/**
 * Finds the last known price entry before or on the given date
 */
const findLastKnownPrice = (
  productEntries: Map<string, PriceHistoryEntry>,
  targetDate: string
): PriceHistoryEntry | undefined => {
  const targetTimestamp = new Date(targetDate).getTime();
  let lastEntry: PriceHistoryEntry | undefined = undefined;
  let lastTimestamp = 0;

  for (const [dateKey, entry] of Array.from(productEntries.entries())) {
    const entryTimestamp = new Date(dateKey).getTime();

    if (entryTimestamp <= targetTimestamp && entryTimestamp > lastTimestamp) {
      lastEntry = entry;
      lastTimestamp = entryTimestamp;
    }
  }

  return lastEntry;
};

/**
 * Gets the current prices for products from the products collection
 * This is used as a fallback when no price history exists yet
 */
export const getCurrentProductPrices = (
  products: Array<{
    productId: string;
    itemCode: string;
    itemName: string;
    currentBuyPrice: number;
    currentSellPrice: number;
  }>,
  selectedDate: string,
  priceType: 'buy_price' | 'sell_price'
): PriceHistoryDataPoint[] => {
  const date = new Date(selectedDate);

  return [
    {
      date: selectedDate,
      timestamp: date.getTime(),
      formattedDate: date.toLocaleDateString('pl-PL'),
      ...products.reduce(
        (acc, product) => {
          const productKey = `${product.itemCode}_${product.productId}`;
          const priceKey = `${priceType}_${productKey}`;
          const priceValue =
            priceType === 'buy_price'
              ? product.currentBuyPrice
              : product.currentSellPrice;

          acc[priceKey] = priceValue;
          acc[`${productKey}_name`] =
            `${product.itemCode} - ${product.itemName}`;

          return acc;
        },
        {} as Record<string, any>
      ),
    },
  ];
};

/**
 * Ensures price data exists up to yesterday by filling gaps and adding current prices if needed
 */
export const ensurePriceDataToYesterday = (
  entries: PriceHistoryEntry[],
  products: Array<{
    productId: string;
    itemCode: string;
    itemName: string;
    currentBuyPrice: number;
    currentSellPrice: number;
  }>,
  startDate: string,
  endDate: string,
  priceType: 'buy_price' | 'sell_price'
): PriceHistoryDataPoint[] => {
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Adjust end date to not go beyond yesterday
  const actualEndDate = endDate > yesterdayStr ? yesterdayStr : endDate;

  if (entries.length === 0) {
    // No price history exists, use current prices for yesterday
    logger.info('No price history found, using current prices', {
      component: 'PriceHistoryProcessor',
      operation: 'ensurePriceDataToYesterday',
      extra: { products: products.length },
    });

    return getCurrentProductPrices(products, actualEndDate, priceType);
  }

  // Fill gaps in existing data
  const filledData = fillPriceHistoryGaps(
    entries,
    startDate,
    actualEndDate,
    priceType
  );

  // Check if we have data for yesterday
  const hasYesterdayData = filledData.some(
    point => point.date === yesterdayStr
  );

  if (!hasYesterdayData && actualEndDate === yesterdayStr) {
    // Filter products that don't already have data in the filled dataset
    const existingProducts = new Set<string>();
    filledData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key.includes(`${priceType}_`) && typeof point[key] === 'number') {
          const productKey = key.replace(`${priceType}_`, '');
          existingProducts.add(productKey);
        }
      });
    });

    // Only add yesterday data for products that have no price history
    const newProducts = products.filter(product => {
      const productKey = `${product.itemCode}_${product.productId}`;
      return !existingProducts.has(productKey);
    });

    if (newProducts.length > 0) {
      const newYesterdayData = getCurrentProductPrices(
        newProducts,
        yesterdayStr,
        priceType
      );
      filledData.push(...newYesterdayData);
    }
  }

  // Sort by timestamp
  return filledData.sort((a, b) => a.timestamp - b.timestamp);
};
