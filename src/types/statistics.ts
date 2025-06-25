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

export type ReportTab = 'products' | 'clients' | 'trends' | 'monthly';

export type SortField = keyof StatisticsSummary | keyof ClientStatistics;
export type SortDirection = 'asc' | 'desc';

export type MonthlyViewType = 'quantity' | 'amount';
