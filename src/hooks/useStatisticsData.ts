import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
  Receipt,
  StatisticsSummary,
  ClientStatistics,
  MonthlyData,
  DateFilterType,
} from '../types/statistics';

export const useStatisticsData = (
  dateFilter: DateFilterType,
  startDate: string,
  endDate: string,
  selectedItemCode: string
) => {
  const { user } = useAuth();

  // Data state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [statisticsSummary, setStatisticsSummary] = useState<
    StatisticsSummary[]
  >([]);
  const [availableItemCodes, setAvailableItemCodes] = useState<string[]>([]);
  const [clientStatistics, setClientStatistics] = useState<ClientStatistics[]>(
    []
  );
  const [clients, setClients] = useState<{ [key: string]: string }>({});
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(false);

  // Date range calculation
  const getDateRange = useCallback(
    (filterType: DateFilterType): { start: Date; end: Date } => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (filterType) {
        case 'thisWeek': {
          const dayOfWeek = today.getDay();
          const monday = new Date(today);
          monday.setDate(
            today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
          );
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          sunday.setHours(23, 59, 59, 999);
          return { start: monday, end: sunday };
        }

        case 'lastWeek': {
          const dayOfWeek = today.getDay();
          const lastMonday = new Date(today);
          lastMonday.setDate(
            today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - 7
          );
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          lastSunday.setHours(23, 59, 59, 999);
          return { start: lastMonday, end: lastSunday };
        }

        case 'thisMonth': {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'lastMonth': {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'thisYear': {
          const start = new Date(now.getFullYear(), 0, 1);
          const end = new Date(now.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        case 'custom': {
          const start = startDate
            ? new Date(startDate)
            : new Date(now.getFullYear(), now.getMonth(), 1);
          const end = endDate ? new Date(endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }

        default:
          return { start: today, end: today };
      }
    },
    [startDate, endDate]
  );

  // Fetch receipts based on filters
  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { start, end } = getDateRange(dateFilter);

      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end))
      );

      const querySnapshot = await getDocs(receiptsQuery);
      const receiptsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      setReceipts(receiptsData);
    } catch (error) {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [user, dateFilter, getDateRange]);

  // Fetch clients data
  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const clientsQuery = query(
        collection(db, 'clients'),
        where('userID', '==', user.uid)
      );

      const querySnapshot = await getDocs(clientsQuery);
      const clientsData: { [key: string]: string } = {};

      querySnapshot.docs.forEach(doc => {
        clientsData[doc.id] = doc.data().name || 'Nieznany klient';
      });

      setClients(clientsData);
    } catch (error) {
      setClients({});
    }
  }, [user]);

  // Process receipts to create statistics summary
  const processStatistics = useCallback(() => {
    const itemMap = new Map<string, StatisticsSummary>();

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        if (selectedItemCode && item.itemCode !== selectedItemCode) {
          return;
        }

        const key = `${item.itemCode}-${item.itemName}`;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.totalQuantity += item.quantity;
          existing.totalAmount += item.total_price;
          existing.transactionCount += 1;
          existing.averagePrice = existing.totalAmount / existing.totalQuantity;
        } else {
          itemMap.set(key, {
            itemCode: item.itemCode,
            itemName: item.itemName,
            totalQuantity: item.quantity,
            totalAmount: item.total_price,
            averagePrice: item.total_price / item.quantity,
            transactionCount: 1,
          });
        }
      });
    });

    const summaryArray = Array.from(itemMap.values());
    setStatisticsSummary(summaryArray);
  }, [receipts, selectedItemCode]);

  // Process receipts to create client statistics
  const processClientStatistics = useCallback(() => {
    const clientMap = new Map<string, ClientStatistics>();

    receipts.forEach(receipt => {
      const clientId = receipt.clientId;
      const clientName = clients[clientId] || 'Nieznany klient';

      const receiptQuantity = receipt.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      if (clientMap.has(clientId)) {
        const existing = clientMap.get(clientId)!;
        existing.receiptCount += 1;
        existing.totalQuantity += receiptQuantity;
        existing.totalAmount += receipt.totalAmount;
      } else {
        clientMap.set(clientId, {
          clientId,
          clientName,
          receiptCount: 1,
          totalQuantity: receiptQuantity,
          totalAmount: receipt.totalAmount,
        });
      }
    });

    const clientArray = Array.from(clientMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 20);

    setClientStatistics(clientArray);
  }, [receipts, clients]);

  // Process receipts to create monthly statistics
  const processMonthlyStatistics = useCallback(() => {
    const monthlyMap = new Map<string, MonthlyData>();

    receipts.forEach(receipt => {
      const date = receipt.date;
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;

      const monthNames = [
        'Sty',
        'Lut',
        'Mar',
        'Kwi',
        'Maj',
        'Cze',
        'Lip',
        'Sie',
        'Wrz',
        'Paź',
        'Lis',
        'Gru',
      ];
      const displayMonth = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      let receiptQuantity = 0;
      let receiptAmount = 0;

      receipt.items.forEach(item => {
        if (selectedItemCode && item.itemCode !== selectedItemCode) {
          return;
        }
        receiptQuantity += item.quantity;
        receiptAmount += item.total_price;
      });

      if (receiptQuantity > 0) {
        if (monthlyMap.has(monthKey)) {
          const existing = monthlyMap.get(monthKey)!;
          existing.totalQuantity += receiptQuantity;
          existing.totalAmount += receiptAmount;
        } else {
          monthlyMap.set(monthKey, {
            month: monthKey,
            displayMonth,
            totalQuantity: receiptQuantity,
            totalAmount: receiptAmount,
          });
        }
      }
    });

    const monthlyArray = Array.from(monthlyMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    setMonthlyData(monthlyArray);
  }, [receipts, selectedItemCode]);

  // Extract unique item codes from receipts
  const extractItemCodes = useCallback(() => {
    const itemCodesSet = new Set<string>();

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        if (item.itemCode) {
          itemCodesSet.add(item.itemCode);
        }
      });
    });

    const sortedItemCodes = Array.from(itemCodesSet).sort();
    setAvailableItemCodes(sortedItemCodes);
  }, [receipts]);

  // Effects
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    processStatistics();
    extractItemCodes();
  }, [processStatistics, extractItemCodes]);

  useEffect(() => {
    processClientStatistics();
  }, [processClientStatistics]);

  useEffect(() => {
    processMonthlyStatistics();
  }, [processMonthlyStatistics]);

  return {
    receipts,
    statisticsSummary,
    availableItemCodes,
    clientStatistics,
    clients,
    monthlyData,
    loading,
    getDateRange,
  };
};
