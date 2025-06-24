import React from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { pdf } from '@react-pdf/renderer';
import toast from 'react-hot-toast';
import { Workbook } from 'exceljs';
import ReceiptsSummaryDocument from './ReceiptsSummaryDocument';
import {
  Receipt,
  Client,
  CompanyDetails,
  ExcelRowData,
} from '../../types/receipt';

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
        console.error('Error generating summary PDF:', error);
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

      // Create workbook and worksheet
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Szczegóły kwitów');

      const currentDate = new Date().toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      let currentRow = 1;

      // Add report header
      worksheet.getCell(`A${currentRow}`).value =
        `Raport wygenerowany: ${currentDate}`;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;

      // Add filter context
      if (selectedMonth || searchTerm) {
        worksheet.getCell(`A${currentRow}`).value = 'Zastosowane filtry:';
        worksheet.getCell(`A${currentRow}`).font = { bold: true };
        currentRow++;

        if (selectedMonth) {
          const monthLabel = formatMonthLabel(selectedMonth);
          worksheet.getCell(`A${currentRow}`).value =
            `• Miesiąc: ${monthLabel}`;
          currentRow++;
        }

        if (searchTerm) {
          worksheet.getCell(`A${currentRow}`).value =
            `• Wyszukiwanie: "${searchTerm}"`;
          currentRow++;
        }

        currentRow++; // Extra spacing
      } else {
        worksheet.getCell(`A${currentRow}`).value = 'Filtry: Wszystkie kwity';
        currentRow += 2;
      }

      worksheet.getCell(`A${currentRow}`).value =
        `Łączna liczba pozycji: ${excelData.length}`;
      currentRow += 3;

      // Add table headers
      const headers = [
        'Numer kwitu',
        'Data',
        'Klient',
        'Nazwa towaru',
        'Kod towaru',
        'Ilość',
        'Jednostka',
        'Cena zakupu',
        'Wartość pozycji',
      ];
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = headers;
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF366092' },
      };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      currentRow++;

      // Add data rows
      excelData.forEach(rowData => {
        const row = worksheet.getRow(currentRow);
        row.values = [
          rowData['Numer kwitu'],
          rowData['Data'],
          rowData['Klient'],
          rowData['Nazwa towaru'],
          rowData['Kod towaru'],
          rowData['Ilość'],
          rowData['Jednostka'],
          rowData['Cena zakupu'],
          rowData['Wartość pozycji'],
        ];
        currentRow++;
      });

      // Set column widths
      worksheet.columns = [
        { width: 15 }, // Numer kwitu
        { width: 12 }, // Data
        { width: 25 }, // Klient
        { width: 30 }, // Nazwa towaru
        { width: 15 }, // Kod towaru
        { width: 10 }, // Ilość
        { width: 10 }, // Jednostka
        { width: 12 }, // Cena zakupu
        { width: 15 }, // Wartość pozycji
      ];

      // Generate filename
      const filename = `kwity.xlsx`;

      // Download the file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Wystąpił błąd podczas eksportowania do Excel.');
    }
  };

  return {
    handleDownloadSummary,
    handleExportToExcel,
  };
};
