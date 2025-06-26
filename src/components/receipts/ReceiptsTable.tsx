import React from 'react';
import { logger } from '../../utils/logger';
import { isErrorWithMessage } from '../../types/common';
import withErrorBoundary from '../withErrorBoundary';
import { Receipt, Client } from '../../types/receipt';

interface ReceiptsTableProps {
  receipts: Receipt[];
  clients: Client[];
  loading: boolean;
  searchTerm: string;
  expandedRows: Set<string>;
  onToggleRowExpansion: (receiptId: string) => void;
  onViewPDF: (receipt: Receipt) => void;
  onDownloadPDF: (receipt: Receipt) => void;
  onEditReceipt: (receiptId: string) => void;
  onDeleteReceipt: (receiptId: string, receiptNumber: string) => void;
}

const ReceiptsTable: React.FC<ReceiptsTableProps> = ({
  receipts,
  clients,
  loading,
  searchTerm,
  expandedRows,
  onToggleRowExpansion,
  onViewPDF,
  onDownloadPDF,
  onEditReceipt,
  onDeleteReceipt,
}) => {
  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount: number) => {
    // Force grouping for thousands by manually adding space separator
    if (amount >= 1000 && amount < 10000) {
      const parts = amount.toFixed(2).split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const thousands = integerPart.slice(0, -3);
      const hundreds = integerPart.slice(-3);
      return `${thousands} ${hundreds},${decimalPart} zł`;
    }

    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  };

  const getClientName = (receipt: Receipt): string => {
    if (receipt.clientName) {
      return receipt.clientName;
    }

    const client = clients.find(c => c.id === receipt.clientId);
    return client ? client.name : 'Nieznany klient';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
              Numer Kwitu
            </th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
              Data
            </th>
            <th className="text-left py-3 px-4 uppercase font-semibold text-sm">
              Klient
            </th>
            <th className="text-right py-3 px-4 uppercase font-semibold text-sm">
              Łączna Kwota
            </th>
            <th className="text-center py-3 px-4 uppercase font-semibold text-sm">
              Akcje
            </th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
                  <span className="ml-2">Ładowanie kwitów...</span>
                </div>
              </td>
            </tr>
          ) : (
            receipts.map(receipt => (
              <React.Fragment key={receipt.id}>
                <tr
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => onToggleRowExpansion(receipt.id)}
                >
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center">
                      <span className="mr-2">
                        {expandedRows.has(receipt.id) ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        ) : (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="9,18 15,12 9,6"></polyline>
                          </svg>
                        )}
                      </span>
                      {receipt.number}
                    </div>
                  </td>
                  <td className="py-3 px-4">{formatDate(receipt.date)}</td>
                  <td className="py-3 px-4">{getClientName(receipt)}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(receipt.totalAmount)}
                  </td>
                  <td
                    className="py-3 px-4 text-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => onViewPDF(receipt)}
                        className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                        aria-label="Zobacz PDF"
                        title="Zobacz PDF"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      <button
                        onClick={() => onDownloadPDF(receipt)}
                        className="text-gray-400 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50"
                        aria-label="Pobierz PDF"
                        title="Pobierz PDF"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                          <polyline points="9,15 12,18 15,15"></polyline>
                          <line x1="12" y1="18" x2="12" y2="10"></line>
                        </svg>
                      </button>
                      <button
                        onClick={() => onEditReceipt(receipt.id)}
                        className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                        aria-label="Edytuj kwit"
                        title="Edytuj kwit"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="m18.5 2.5 3 3L10 17l-4 1 1-4 11.5-11.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() =>
                          onDeleteReceipt(receipt.id, receipt.number)
                        }
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                        aria-label="Usuń kwit"
                        title="Usuń kwit"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path d="m19,6v14a2,2 0 0,1-2-2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedRows.has(receipt.id) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-0 bg-gray-50">
                      <div className="py-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white rounded-lg shadow-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Nazwa Towaru
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Kod
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ilość
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Cena Skupu
                                </th>
                                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Razem
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {receipt.items.map((item, index) => (
                                <tr key={index}>
                                  <td className="py-2 px-3 text-sm text-gray-900">
                                    {item.itemName}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-gray-500">
                                    {item.itemCode}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                    {item.quantity.toLocaleString('pl-PL', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {item.unit}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                    {formatCurrency(item.buy_price)}
                                  </td>
                                  <td className="py-2 px-3 text-sm font-medium text-gray-900 text-right">
                                    {formatCurrency(item.total_price)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
          {receipts.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-500">
                {searchTerm
                  ? `Nie znaleziono kwitów pasujących do "${searchTerm}".`
                  : 'Nie znaleziono kwitów. Kliknij "Dodaj Kwit", aby utworzyć swój pierwszy kwit.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default withErrorBoundary(ReceiptsTable, {
  context: 'Receipts Table',
  onError: (error, errorInfo) => {
    logger.error(
      'Receipts table error',
      isErrorWithMessage(error) ? error : undefined,
      {
        component: 'ReceiptsTable',
        operation: 'componentError',
        extra: {
          componentStack: errorInfo.componentStack,
        },
      }
    );
  },
});
