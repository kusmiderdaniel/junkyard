import React from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { pdf } from '@react-pdf/renderer';
import toast from 'react-hot-toast';
// ExcelJS will be lazy loaded
import ReceiptsSummaryDocument from './ReceiptsSummaryDocument';
import {
  Receipt,
  Client,
  CompanyDetails,
  ExcelRowData,
} from '../../types/receipt';
import { logger } from '../../utils/logger';

interface ReceiptExportActionsProps {
  user: any;
  selectedMonth: string;
  searchTerm: string;
  clients: Client[];
  companyDetails: CompanyDetails | null;
  getClientName: (receipt: Receipt) => string;
  formatMonthLabel: (monthKey: string) => string;
}

export const useReceiptExportActions = ({
  user,
  selectedMonth,
  searchTerm,
  clients,
  companyDetails,
  getClientName,
  formatMonthLabel,
}: ReceiptExportActionsProps) => {
  const handleDownloadSummary = async () => {
    if (!user || !companyDetails) return;

    try {
      // Fetch receipts based on current filter context
      const receiptsCollection = collection(db, 'receipts');

      let summaryQuery = query(
        receiptsCollection,
        where('userID', '==', user.uid),
        orderBy('date', 'desc')
      );

      // Add month filter if selected
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(
          parseInt(year),
          parseInt(month),
          0,
          23,
          59,
          59,
          999
        );

        summaryQuery = query(
          receiptsCollection,
          where('userID', '==', user.uid),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'desc')
        );
      }

      const querySnapshot = await getDocs(summaryQuery);
      const allFilteredReceipts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      // Apply search filter if present
      const finalFilteredReceipts = allFilteredReceipts.filter(receipt => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();

        if (receipt.number.toLowerCase().includes(searchLower)) {
          return true;
        }

        const clientName = getClientName(receipt);
        if (clientName.toLowerCase().includes(searchLower)) {
          return true;
        }

        if (
          receipt.items.some(
            item =>
              item.itemName.toLowerCase().includes(searchLower) ||
              item.itemCode.toLowerCase().includes(searchLower)
          )
        ) {
          return true;
        }

        return false;
      });

      // Generate filter description
      const getFilterDescription = () => {
        const parts = [];
        if (selectedMonth) {
          const monthLabel = formatMonthLabel(selectedMonth);
          parts.push(`Miesiąc: ${monthLabel}`);
        }
        if (searchTerm) {
          parts.push(`Wyszukiwanie: "${searchTerm}"`);
        }
        return parts.length > 0 ? parts.join(' | ') : 'Wszystkie kwity';
      };

      // Calculate total amount
      const totalAmount = finalFilteredReceipts.reduce(
        (sum, receipt) => sum + receipt.totalAmount,
        0
      );

      const doc = (
        <ReceiptsSummaryDocument
          receipts={finalFilteredReceipts}
          companyDetails={companyDetails}
          filterDescription={getFilterDescription()}
          totalAmount={totalAmount}
        />
      );

      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `podsumowanie_kwitów.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('Error generating summary PDF', error, {
          component: 'ReceiptExportActions',
          operation: 'handlePrintSummary',
        });
      }
      toast.error('Wystąpił błąd podczas generowania podsumowania PDF.');
    }
  };

  const handleExportToExcel = async () => {
    if (!user) return;

    try {
      // Fetch ALL receipts that match the current filter context
      const receiptsCollection = collection(db, 'receipts');

      let exportQuery = query(
        receiptsCollection,
        where('userID', '==', user.uid),
        orderBy('date', 'desc')
      );

      // Add month filter if selected
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(
          parseInt(year),
          parseInt(month),
          0,
          23,
          59,
          59,
          999
        );

        exportQuery = query(
          receiptsCollection,
          where('userID', '==', user.uid),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'desc')
        );
      }

      const querySnapshot = await getDocs(exportQuery);
      const allFilteredReceipts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      // Apply search filter if present
      const finalFilteredReceipts = allFilteredReceipts.filter(receipt => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();

        if (receipt.number.toLowerCase().includes(searchLower)) {
          return true;
        }

        const clientName = getClientName(receipt);
        if (clientName.toLowerCase().includes(searchLower)) {
          return true;
        }

        if (
          receipt.items.some(
            item =>
              item.itemName.toLowerCase().includes(searchLower) ||
              item.itemCode.toLowerCase().includes(searchLower)
          )
        ) {
          return true;
        }

        return false;
      });

      // Create detailed data with one row per item
      const excelData: ExcelRowData[] = [];

      finalFilteredReceipts.forEach(receipt => {
        const clientName = getClientName(receipt);
        const receiptDate = receipt.date.toLocaleDateString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        receipt.items.forEach(item => {
          excelData.push({
            'Numer kwitu': receipt.number,
            Data: receiptDate,
            Klient: clientName,
            'Nazwa towaru': item.itemName,
            'Kod towaru': item.itemCode,
            Ilość: item.quantity,
            Jednostka: item.unit,
            'Cena zakupu': item.buy_price,
            'Wartość pozycji': item.total_price,
          });
        });
      });

      if (excelData.length === 0) {
        toast.error('Brak danych do eksportu.');
        return;
      }

      // Lazy load Excel export utility
      const { ExcelExportUtility } = await import('../../utils/excelExport');

      // Prepare filters
      const filters: Record<string, string> = {};
      if (selectedMonth) {
        const monthLabel = formatMonthLabel(selectedMonth);
        filters['Miesiąc'] = monthLabel;
      }
      if (searchTerm) {
        filters['Wyszukiwanie'] = `"${searchTerm}"`;
      }
      if (!selectedMonth && !searchTerm) {
        filters['Zakres'] = 'Wszystkie kwity';
      }

      // Prepare summary
      const summary = {
        'Łączna liczba pozycji': excelData.length.toString(),
      };

      // Export using the utility
      await ExcelExportUtility.exportToExcel({
        filename: 'kwity',
        worksheetName: 'Szczegóły kwitów',
        headers: [
          'Numer kwitu',
          'Data',
          'Klient',
          'Nazwa towaru',
          'Kod towaru',
          'Ilość',
          'Jednostka',
          'Cena zakupu',
          'Wartość pozycji',
        ],
        data: excelData,
        title: 'Raport wygenerowany',
        filters,
        summary,
      });
    } catch (error) {
      toast.error('Wystąpił błąd podczas eksportowania do Excel.');
    }
  };

  return {
    handleDownloadSummary,
    handleExportToExcel,
  };
};
