/**
 * Excel Export Utility
 * Code-split to reduce main bundle size
 */

import { Workbook } from 'exceljs';

export interface ExcelExportOptions {
  filename: string;
  worksheetName: string;
  headers: string[];
  data: Record<string, any>[];
  title?: string;
  subtitle?: string;
  filters?: Record<string, string>;
  summary?: Record<string, any>;
}

export class ExcelExportUtility {
  static async exportToExcel(options: ExcelExportOptions): Promise<void> {
    const {
      filename,
      worksheetName,
      headers,
      data,
      title,
      subtitle,
      filters,
      summary,
    } = options;

    if (data.length === 0) {
      throw new Error('Brak danych do eksportu.');
    }

    // Create workbook and worksheet
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(worksheetName);

    let currentRow = 1;

    // Add title if provided
    if (title) {
      const currentDate = new Date().toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      worksheet.getCell(`A${currentRow}`).value = `${title}: ${currentDate}`;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;
    }

    // Add subtitle if provided
    if (subtitle) {
      worksheet.getCell(`A${currentRow}`).value = subtitle;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow += 2;
    }

    // Add filters if provided
    if (filters && Object.keys(filters).length > 0) {
      worksheet.getCell(`A${currentRow}`).value = 'Zastosowane filtry:';
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;

      Object.entries(filters).forEach(([key, value]) => {
        worksheet.getCell(`A${currentRow}`).value = `• ${key}: ${value}`;
        currentRow++;
      });

      currentRow++; // Extra spacing
    }

    // Add summary if provided
    if (summary) {
      Object.entries(summary).forEach(([key, value]) => {
        worksheet.getCell(`A${currentRow}`).value = `${key}: ${value}`;
        currentRow++;
      });
      currentRow++;
    }

    // Add table headers
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
    data.forEach(rowData => {
      const row = worksheet.getRow(currentRow);
      row.values = headers.map(header => rowData[header] || '');
      currentRow++;
    });

    // Auto-fit column widths based on content
    headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      let maxLength = header.length;

      data.forEach(row => {
        const cellValue = String(row[header] || '');
        if (cellValue.length > maxLength) {
          maxLength = Math.min(cellValue.length, 50); // Cap at 50 chars
        }
      });

      column.width = Math.max(10, maxLength + 2); // Minimum 10, add padding
    });

    // Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  }

  static formatDate(date: Date): string {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
