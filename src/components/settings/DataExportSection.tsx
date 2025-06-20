import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

type ExportCollection = 'clients' | 'products' | 'categories' | 'receipts';
type DateFilterType = 'all' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

interface ExportFilters {
  collection: ExportCollection;
  dateFilter: DateFilterType;
  startDate: string;
  endDate: string;
}

interface DataExportSectionProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const DataExportSection: React.FC<DataExportSectionProps> = ({ onSuccess, onError }) => {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportFilters, setExportFilters] = useState<ExportFilters>({
    collection: 'clients',
    dateFilter: 'thisMonth',
    startDate: '',
    endDate: ''
  });

  const getDateRange = (filterType: DateFilterType, startDate?: string, endDate?: string): { start: Date; end: Date } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case 'thisWeek': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case 'lastWeek': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() - 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case 'thisMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      case 'lastMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      case 'thisYear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        endOfYear.setHours(23, 59, 59, 999);
        return { start: startOfYear, end: endOfYear };
      }
      case 'custom': {
        if (!startDate || !endDate) {
          throw new Error('Daty początkowa i końcowa są wymagane dla zakresu niestandardowego');
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      default:
        throw new Error('Nieznany typ filtra daty');
    }
  };

  const handleExportToCSV = async () => {
    if (!user) {
      const errorMessage = 'Użytkownik nie jest uwierzytelniony';
      setExportError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    setExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      let data: any[] = [];
      let headers: string[] = [];
      let filename = '';

      const { collection: collectionName, dateFilter, startDate, endDate } = exportFilters;

      switch (collectionName) {
        case 'clients': {
          const clientsQuery = query(
            collection(db, 'clients'),
            where('userID', '==', user.uid),
            orderBy('name')
          );
          const snapshot = await getDocs(clientsQuery);
          data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          headers = ['ID', 'Nazwa', 'Adres', 'Numer Dokumentu', 'Kod Pocztowy', 'Miasto', 'Pełny Adres'];
          data = data.map(item => ({
            'ID': item.id,
            'Nazwa': item.name || '',
            'Adres': item.address || '',
            'Numer Dokumentu': item.documentNumber || '',
            'Kod Pocztowy': item.postalCode || '',
            'Miasto': item.city || '',
            'Pełny Adres': item.fullAddress || ''
          }));
          filename = 'clients';
          break;
        }

        case 'products': {
          const productsQuery = query(
            collection(db, 'products'),
            where('userID', '==', user.uid),
            orderBy('name')
          );
          const snapshot = await getDocs(productsQuery);
          data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          headers = ['ID', 'Nazwa', 'Kod Produktu', 'ID Kategorii', 'Cena Zakupu', 'Cena Sprzedaży', 'Korekta Wagi'];
          data = data.map(item => ({
            'ID': item.id,
            'Nazwa': item.name || '',
            'Kod Produktu': item.itemCode || '',
            'ID Kategorii': item.categoryId || '',
            'Cena Zakupu': item.buy_price || 0,
            'Cena Sprzedaży': item.sell_price || 0,
            'Korekta Wagi': item.weightAdjustment || 1
          }));
          filename = 'products';
          break;
        }

        case 'categories': {
          const categoriesQuery = query(
            collection(db, 'categories'),
            where('userID', '==', user.uid),
            orderBy('name')
          );
          const snapshot = await getDocs(categoriesQuery);
          data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          headers = ['ID', 'Nazwa'];
          data = data.map(item => ({
            'ID': item.id,
            'Nazwa': item.name || ''
          }));
          filename = 'categories';
          break;
        }

        case 'receipts': {
          let receiptsQuery;
          if (dateFilter === 'all') {
            receiptsQuery = query(
              collection(db, 'receipts'),
              where('userID', '==', user.uid),
              orderBy('date', 'desc')
            );
          } else {
            const { start, end } = getDateRange(dateFilter, startDate, endDate);
            receiptsQuery = query(
              collection(db, 'receipts'),
              where('userID', '==', user.uid),
              where('date', '>=', Timestamp.fromDate(start)),
              where('date', '<=', Timestamp.fromDate(end)),
              orderBy('date', 'desc')
            );
          }
          const snapshot = await getDocs(receiptsQuery);
          const receipts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
          
          // Flatten receipt items
          data = [];
          receipts.forEach((receipt: any) => {
            if (receipt.items && receipt.items.length > 0) {
              receipt.items.forEach((item: any) => {
                data.push({
                  'ID Kwitu': receipt.id,
                  'Numer Kwitu': receipt.number || '',
                  'Data': receipt.date ? new Date(receipt.date.seconds * 1000).toISOString() : '',
                  'ID Klienta': receipt.clientId || '',
                  'Nazwa Klienta': receipt.clientName || '',
                  'Łączna Kwota Kwitu': receipt.totalAmount || 0,
                  'Nazwa Produktu': item.itemName || '',
                  'Kod Produktu': item.itemCode || '',
                  'Ilość': item.quantity || 0,
                  'Jednostka': item.unit || '',
                  'Cena Sprzedaży': item.sell_price || 0,
                  'Cena Zakupu': item.buy_price || 0,
                  'Wartość Pozycji': item.total_price || 0
                });
              });
            } else {
              data.push({
                'ID Kwitu': receipt.id,
                'Numer Kwitu': receipt.number || '',
                'Data': receipt.date ? new Date(receipt.date.seconds * 1000).toISOString() : '',
                'ID Klienta': receipt.clientId || '',
                'Nazwa Klienta': receipt.clientName || '',
                'Łączna Kwota Kwitu': receipt.totalAmount || 0,
                'Nazwa Produktu': '',
                'Kod Produktu': '',
                'Ilość': 0,
                'Jednostka': '',
                'Cena Sprzedaży': 0,
                'Cena Zakupu': 0,
                'Wartość Pozycji': 0
              });
            }
          });
          headers = ['ID Kwitu', 'Numer Kwitu', 'Data', 'ID Klienta', 'Nazwa Klienta', 'Łączna Kwota Kwitu', 'Nazwa Produktu', 'Kod Produktu', 'Ilość', 'Jednostka', 'Cena Sprzedaży', 'Cena Zakupu', 'Wartość Pozycji'];
          filename = dateFilter === 'all' ? 'receipts-all' : `receipts-${dateFilter}`;
          break;
        }


      }

      if (data.length === 0) {
        setExportError('Brak danych do eksportu dla wybranych filtrów.');
        return;
      }

      // Convert to CSV
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Add BOM for proper UTF-8 encoding in Excel
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with date
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${filename}-${today}.csv`);
      
      // Trigger download
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const successMessage = `Pomyślnie wyeksportowano ${data.length} rekordów do pliku CSV.`;
      setExportSuccess(successMessage);
      onSuccess?.(successMessage);
    } catch (error) {
      const errorMessage = 'Błąd podczas eksportu do CSV. Spróbuj ponownie.';
      setExportError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Eksport Danych</h2>
        <p className="text-gray-600 mt-1">Eksportuj swoje dane do pliku CSV</p>
      </div>

      {exportError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-md">
          <p className="text-red-700">{exportError}</p>
        </div>
      )}

      {exportSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-md">
          <p className="text-green-700">{exportSuccess}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Typ Danych
          </label>
          <select
            value={exportFilters.collection}
            onChange={(e) => setExportFilters(prev => ({ ...prev, collection: e.target.value as ExportCollection }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="clients">Klienci</option>
            <option value="products">Produkty</option>
            <option value="categories">Kategorie</option>
            <option value="receipts">Kwity</option>
          </select>
        </div>

        {exportFilters.collection === 'receipts' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtr Daty
              </label>
              <select
                value={exportFilters.dateFilter}
                onChange={(e) => setExportFilters(prev => ({ ...prev, dateFilter: e.target.value as DateFilterType }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Wszystkie</option>
                <option value="thisWeek">Ten Tydzień</option>
                <option value="lastWeek">Ostatni Tydzień</option>
                <option value="thisMonth">Ten Miesiąc</option>
                <option value="lastMonth">Ostatni Miesiąc</option>
                <option value="thisYear">Ten Rok</option>
                <option value="custom">Zakres Niestandardowy</option>
              </select>
            </div>

            {exportFilters.dateFilter === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Początkowa
                  </label>
                  <input
                    type="date"
                    value={exportFilters.startDate}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Końcowa
                  </label>
                  <input
                    type="date"
                    value={exportFilters.endDate}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4">
          <button
            onClick={handleExportToCSV}
            disabled={exporting}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Eksportowanie...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Eksportuj do CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataExportSection; 