import React from 'react';
import { formatCurrency } from '../../utils/currencyFormatter';

interface ReceiptSummaryProps {
  totalAmount: number;
}

const ReceiptSummary: React.FC<ReceiptSummaryProps> = ({ totalAmount }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Łączna Kwota</h2>
        <div className="text-2xl font-bold text-orange-700">
          {formatCurrency(totalAmount)}
        </div>
      </div>
    </div>
  );
};

export default ReceiptSummary;
