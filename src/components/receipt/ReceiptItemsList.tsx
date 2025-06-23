import React from 'react';
import { ReceiptItem, Product, ValidationErrors } from '../../types/receipt';
import ItemRow from './ItemRow';

interface ReceiptItemsListProps {
  items: ReceiptItem[];
  products: Product[];
  validationErrors: ValidationErrors;
  showValidationErrors: boolean;
  onProductSelect: (index: number, product: Product) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onBuyPriceChange: (index: number, buyPrice: number) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

const ReceiptItemsList: React.FC<ReceiptItemsListProps> = ({
  items,
  products,
  validationErrors,
  showValidationErrors,
  onProductSelect,
  onQuantityChange,
  onBuyPriceChange,
  onAddItem,
  onRemoveItem,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Pozycje Kwitu</h2>
        {showValidationErrors && validationErrors.items && (
          <p className="text-sm text-red-600">{validationErrors.items}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produkt
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ilość
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cena Skupu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cena Sprzedaży
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Razem
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => (
              <ItemRow
                key={index}
                item={item}
                index={index}
                products={products}
                onProductSelect={onProductSelect}
                onQuantityChange={onQuantityChange}
                onBuyPriceChange={onBuyPriceChange}
                onRemoveItem={onRemoveItem}
                canRemove={items.length > 1}
                showValidationErrors={showValidationErrors}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Product Button */}
      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={onAddItem}
          disabled={items.length >= 15}
          className="px-4 py-2 bg-orange-700 text-white rounded-md hover:bg-orange-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-600 flex items-center space-x-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Dodaj Produkt</span>
          <span className="text-xs opacity-75">({items.length}/15)</span>
        </button>
      </div>
    </div>
  );
};

export default ReceiptItemsList;
