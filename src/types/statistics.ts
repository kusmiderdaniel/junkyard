export interface ReceiptItem {
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  total_price: number;
}

export interface Receipt {
  id: string;
  number: string;
  date: Date;
  clientId: string;
  userID: string;
  totalAmount: number;
  items: ReceiptItem[];
}

export interface StatisticsSummary {
  itemCode: string;
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
  averagePrice: number;
  transactionCount: number;
}

export interface ClientStatistics {
  clientId: string;
  clientName: string;
  receiptCount: number;
  totalQuantity: number;
  totalAmount: number;
}

export interface MonthlyData {
  month: string;
  displayMonth: string;
  totalQuantity: number;
  totalAmount: number;
}

export interface ExcelStatisticsData {
  'Kod produktu': string;
  'Nazwa produktu': string;
  Ilość: number;
  Kwota: number;
}

export type DateFilterType =
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export type ReportTab =
  | 'products'
  | 'clients'
  | 'trends'
  | 'monthly'
  | 'priceHistory';

export type SortField = keyof StatisticsSummary | keyof ClientStatistics;
export type SortDirection = 'asc' | 'desc';

export type MonthlyViewType = 'quantity' | 'amount';

// Price History Types
export interface PriceHistoryEntry {
  id: string;
  userID: string;
  productId: string;
  itemCode: string;
  itemName: string;
  buy_price: number;
  sell_price: number;
  timestamp: Date;
  dateKey: string; // Format: "2024-01-15" for efficient date queries
  createdAt: Date;
  entryType?: 'initial' | 'change' | 'snapshot'; // Track entry type
}

export interface PriceHistoryFilters {
  selectedProductId: string;
  selectedItemCode: string;
  startDate: string;
  endDate: string;
  priceType: 'buy_price' | 'sell_price';
}

export interface ChartDataPoint {
  date: string;
  buy_price?: number;
  sell_price?: number;
  timestamp: number;
  formattedDate: string;
}

// Enhanced chart data point with metadata about data source
export interface ProcessedChartDataPoint extends ChartDataPoint {
  isFilled?: boolean; // Indicates if this data point was filled/interpolated
  dataSource?: 'history' | 'current' | 'interpolated'; // Source of the data
}

export interface ProductOption {
  productId: string;
  itemCode: string;
  itemName: string;
  currentBuyPrice: number;
  currentSellPrice: number;
}

export interface PriceChangeEvent {
  date: string;
  oldBuyPrice: number;
  newBuyPrice: number;
  oldSellPrice: number;
  newSellPrice: number;
  changePercentage: {
    buy: number;
    sell: number;
  };
}
