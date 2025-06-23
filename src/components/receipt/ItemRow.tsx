import React, { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  itemCode: string;
  categoryId: string;
  buy_price: number;
  sell_price: number;
  weightAdjustment: number;
}

interface ReceiptItem {
  productId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  weightAdjustment: number;
  total_price: number;
}

interface ItemRowProps {
  item: ReceiptItem;
  index: number;
  products: Product[];
  onProductSelect: (index: number, product: Product) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onBuyPriceChange: (index: number, buyPrice: number) => void;
  onRemoveItem: (index: number) => void;
  canRemove: boolean;
  showValidationErrors: boolean;
}

// Custom currency formatter that always shows thousands separator for numbers >= 1000
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

const ItemRow: React.FC<ItemRowProps> = ({
  item,
  index,
  products,
  onProductSelect,
  onQuantityChange,
  onBuyPriceChange,
  onRemoveItem,
  canRemove,
  showValidationErrors,
}) => {
  const [productSearchTerm, setProductSearchTerm] = useState(item.itemName);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>(
    'down'
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Check if this item has validation errors
  const hasProduct = item.productId !== '';
  const hasValidQuantity = item.quantity > 0;
  const hasValidBuyPrice = item.buy_price > 0;
  const hasErrors =
    showValidationErrors &&
    hasProduct &&
    (!hasValidQuantity || !hasValidBuyPrice);

  const handleProductSelect = (product: Product) => {
    setProductSearchTerm(product.name);
    setIsProductDropdownOpen(false);
    setSelectedIndex(-1);
    onProductSelect(index, product);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isProductDropdownOpen || filteredProducts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredProducts.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredProducts.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredProducts.length) {
          handleProductSelect(filteredProducts[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsProductDropdownOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const rect = inputElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Find the table container to avoid scrolling it
    const tableContainer = inputElement.closest('.overflow-x-auto');
    let containerBottom = viewportHeight;

    if (tableContainer) {
      const containerRect = tableContainer.getBoundingClientRect();
      containerBottom = containerRect.bottom;
    }

    // Calculate actual available space considering container boundaries
    const spaceBelow = containerBottom - rect.bottom - 20; // 20px margin
    const spaceAbove =
      rect.top - (tableContainer?.getBoundingClientRect().top || 0) - 20; // 20px margin

    // More conservative threshold - if less than 160px below, try going up
    if (spaceBelow < 160 && spaceAbove > 100) {
      setDropdownDirection('up');
    } else {
      setDropdownDirection('down');
    }

    setIsProductDropdownOpen(true);
    setSelectedIndex(-1);
  };

  // Update local state when prop changes (for form resets)
  useEffect(() => {
    setProductSearchTerm(item.itemName);
  }, [item.itemName]);

  return (
    <tr className={hasErrors ? 'bg-red-50' : ''}>
      <td className="px-4 py-4">
        <div className="relative">
          <input
            type="text"
            value={productSearchTerm}
            data-product-input={index}
            onChange={e => {
              setProductSearchTerm(e.target.value);
              setSelectedIndex(-1); // Reset selection when typing
              if (!isProductDropdownOpen) {
                // Trigger focus logic to recalculate position
                const fakeEvent = {
                  target: e.target,
                } as React.FocusEvent<HTMLInputElement>;
                handleFocus(fakeEvent);
              }
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay hiding to allow clicking on dropdown items
              setTimeout(() => {
                setIsProductDropdownOpen(false);
                setSelectedIndex(-1);
              }, 150);
            }}
            placeholder="Szukaj produktu..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-600"
          />

          {isProductDropdownOpen && (
            <div
              className={`absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg overflow-y-auto ${
                dropdownDirection === 'up'
                  ? 'bottom-full mb-1 h-52'
                  : 'top-full mt-1 h-52'
              }`}
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    onMouseDown={e => {
                      // Prevent blur event when clicking on dropdown item
                      e.preventDefault();
                      handleProductSelect(product);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      idx === selectedIndex
                        ? 'bg-orange-100 text-orange-900'
                        : 'hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-sm">
                      {product.name} | {product.itemCode}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  Nie znaleziono produktów
                </div>
              )}
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center space-x-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={item.quantity || ''}
            onChange={e =>
              onQuantityChange(index, parseFloat(e.target.value) || 0)
            }
            className={`w-full px-2 py-2 border rounded-md focus:outline-none focus:ring-2 text-right ${
              hasErrors && !hasValidQuantity
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-orange-600'
            }`}
          />
          <span className="text-xs text-gray-500">{item.unit}</span>
        </div>
      </td>

      <td className="px-4 py-4">
        <input
          type="text"
          value={item.buy_price > 0 ? formatCurrency(item.buy_price) : ''}
          onChange={e => {
            // Extract numeric value from formatted currency string
            const numericValue = e.target.value
              .replace(/[^\d,]/g, '')
              .replace(',', '.');
            const parsedValue = parseFloat(numericValue) || 0;
            onBuyPriceChange(index, parsedValue);
          }}
          className={`w-full px-2 py-2 border rounded-md focus:outline-none focus:ring-2 text-right text-sm ${
            hasErrors && !hasValidBuyPrice
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 focus:ring-orange-600'
          }`}
          placeholder="0,00 zł"
        />
      </td>

      <td className="px-4 py-4">
        <input
          type="text"
          value={formatCurrency(item.sell_price)}
          readOnly
          tabIndex={-1}
          className="w-full px-2 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 text-right text-sm"
        />
      </td>

      <td className="px-4 py-4 text-right">
        <div className="font-medium text-sm">
          {item.total_price > 0 ? formatCurrency(item.total_price) : '0,00 zł'}
        </div>
      </td>

      <td className="px-4 py-4 text-center">
        <button
          type="button"
          onClick={() => onRemoveItem(index)}
          disabled={!canRemove}
          tabIndex={-1}
          className="text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors p-1 rounded-full hover:bg-red-50 disabled:hover:bg-transparent"
          title={
            canRemove
              ? 'Usuń pozycję'
              : 'Nie można usunąć - wymagana jest co najmniej jedna pozycja'
          }
        >
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
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </button>
      </td>
    </tr>
  );
};

export default ItemRow;
