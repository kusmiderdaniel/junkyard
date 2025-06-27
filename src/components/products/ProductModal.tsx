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

interface CategoryDoc {
  id: string;
  name: string;
}

interface ProductModalProps {
  onClose: () => void;
  onSubmit: (product: Omit<Product, 'id'>) => void;
  onDelete?: () => void;
  newProduct: Omit<Product, 'id'>;
  setNewProduct: (product: Omit<Product, 'id'>) => void;
  categories: CategoryDoc[];
  isEditing: boolean;
}

const ProductModal: React.FC<ProductModalProps> = ({
  onClose,
  onSubmit,
  onDelete,
  newProduct,
  setNewProduct,
  categories,
  isEditing,
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [initialProduct, setInitialProduct] = useState(newProduct);

  // Price edit values (similar to ProductsTable approach)
  const [priceEdits, setPriceEdits] = useState<{ [key: string]: string }>({});

  // Update initial values when modal opens or newProduct changes
  useEffect(() => {
    setInitialProduct(newProduct);
    // Clear price edits when newProduct changes
    setPriceEdits({});
  }, [newProduct]);

  // Helper function to get price display value (similar to ProductsTable)
  const getPriceEditValue = (
    field: 'buy_price' | 'sell_price',
    originalValue: number
  ) => {
    return priceEdits[field] !== undefined
      ? priceEdits[field]
      : originalValue.toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(newProduct);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseAttempt();
    }
  };

  const handleCloseAttempt = () => {
    // Check if any data has changed from initial values
    const hasChanges =
      newProduct.name.trim() !== initialProduct.name.trim() ||
      newProduct.itemCode.trim() !== initialProduct.itemCode.trim() ||
      newProduct.categoryId !== initialProduct.categoryId ||
      newProduct.buy_price !== initialProduct.buy_price ||
      newProduct.sell_price !== initialProduct.sell_price ||
      newProduct.weightAdjustment !== initialProduct.weightAdjustment;

    if (hasChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      setLoading(true);
      try {
        await onDelete();
        setShowDeleteDialog(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
  };

  // Price change handlers (simplified like ProductsTable)
  const handleBuyPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPriceEdits(prev => ({ ...prev, buy_price: value }));
  };

  const handleSellPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPriceEdits(prev => ({ ...prev, sell_price: value }));
  };

  // Price blur handlers - update actual product values and format display
  const handleBuyPriceBlur = () => {
    const value = priceEdits.buy_price;
    if (value !== undefined) {
      const numericValue = parseFloat(value) || 0;
      setNewProduct({
        ...newProduct,
        buy_price: numericValue,
      });
      // Update display to show formatted value
      setPriceEdits(prev => ({
        ...prev,
        buy_price: numericValue.toFixed(2),
      }));
    }
  };

  const handleSellPriceBlur = () => {
    const value = priceEdits.sell_price;
    if (value !== undefined) {
      const numericValue = parseFloat(value) || 0;
      setNewProduct({
        ...newProduct,
        sell_price: numericValue,
      });
      // Update display to show formatted value
      setPriceEdits(prev => ({
        ...prev,
        sell_price: numericValue.toFixed(2),
      }));
    }
  };

  // Select all text on focus for better UX
  const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edytuj Produkt' : 'Dodaj Nowy Produkt'}
            </h3>
          </div>
          <button
            onClick={handleCloseAttempt}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Product Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nazwa Produktu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź nazwę produktu"
                  value={newProduct.name}
                  onChange={e =>
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Category Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Kategoria <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={newProduct.categoryId}
                  onChange={e =>
                    setNewProduct({ ...newProduct, categoryId: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                  required
                >
                  <option value="">Wybierz Kategorię</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Item Code Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Kod Produktu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź kod produktu"
                  value={newProduct.itemCode}
                  onChange={e =>
                    setNewProduct({ ...newProduct, itemCode: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Price Fields */}
            <div className="grid grid-cols-2 gap-4">
              {/* Buy Price Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cena Skupu <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={getPriceEditValue('buy_price', newProduct.buy_price)}
                    onChange={handleBuyPriceChange}
                    onBlur={handleBuyPriceBlur}
                    onFocus={handlePriceFocus}
                    className="flex-1 px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <span className="text-gray-500 text-sm">zł</span>
                </div>
              </div>

              {/* Sell Price Field */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cena Sprzedaży <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={getPriceEditValue(
                      'sell_price',
                      newProduct.sell_price
                    )}
                    onChange={handleSellPriceChange}
                    onBlur={handleSellPriceBlur}
                    onFocus={handlePriceFocus}
                    className="flex-1 px-3 py-2 text-right border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <span className="text-gray-500 text-sm">zł</span>
                </div>
              </div>
            </div>

            {/* Weight Adjustment Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Korekta Wagi
              </label>
              <div className="relative">
                {/* Custom arrows on the left */}
                <div className="absolute inset-y-0 left-0 pl-3 flex flex-col justify-center space-y-0.5 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = newProduct.weightAdjustment || 1;
                      const newValue = Math.min(9.99, currentValue + 0.01);
                      setNewProduct({
                        ...newProduct,
                        weightAdjustment: Math.round(newValue * 100) / 100,
                      });
                    }}
                    className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentValue = newProduct.weightAdjustment || 1;
                      const newValue = Math.max(0.01, currentValue - 0.01);
                      setNewProduct({
                        ...newProduct,
                        weightAdjustment: Math.round(newValue * 100) / 100,
                      });
                    }}
                    className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="1,00"
                  value={
                    newProduct.weightAdjustment
                      ? newProduct.weightAdjustment.toFixed(2).replace('.', ',')
                      : '1,00'
                  }
                  onChange={e => {
                    // Convert European format (comma) to dot format for parsing
                    const normalizedValue = e.target.value.replace(',', '.');
                    const numericValue = parseFloat(normalizedValue);

                    if (!isNaN(numericValue) && numericValue >= 0) {
                      setNewProduct({
                        ...newProduct,
                        weightAdjustment: Math.round(numericValue * 100) / 100,
                      });
                    } else if (e.target.value === '') {
                      setNewProduct({
                        ...newProduct,
                        weightAdjustment: 1,
                      });
                    }
                  }}
                  onBlur={() => {
                    // Ensure we always have a valid value
                    if (
                      !newProduct.weightAdjustment ||
                      newProduct.weightAdjustment <= 0
                    ) {
                      setNewProduct({
                        ...newProduct,
                        weightAdjustment: 1,
                      });
                    }
                  }}
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-center"
                />

                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l3-1m-3 1l-3-1"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Domyślnie 1,00 (bez korekty). Użyj np. 0,95 dla 5% redukcji
                wagi.
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          {/* Delete button - only show when editing */}
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Usuń</span>
            </button>
          )}

          {/* Right side buttons */}
          <div className="flex items-center space-x-3 ml-auto">
            <button
              type="button"
              onClick={handleCloseAttempt}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anuluj
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{isEditing ? 'Zaktualizuj' : 'Dodaj'} Produkt</span>
            </button>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Potwierdź zamknięcie
                  </h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Masz niezapisane zmiany. Czy na pewno chcesz zamknąć
                  formularz? Wszystkie zmiany zostaną utracone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCancelClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleConfirmClose}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200"
                  >
                    Tak, zamknij
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Usuń Produkt
                  </h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Czy na pewno chcesz usunąć produkt "
                  <strong>{newProduct.name}</strong>"? Ta operacja jest
                  nieodwracalna.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCancelDelete}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>Usuń Produkt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductModal;
