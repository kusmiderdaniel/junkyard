import React, { useMemo } from 'react';
import { logger } from '../../utils/logger';
import { isErrorWithMessage } from '../../types/common';
import withErrorBoundary from '../withErrorBoundary';

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

interface ProductsTableProps {
  products: Product[];
  categories: CategoryDoc[];
  updating: string[];
  priceEdits: { [key: string]: string };
  onPriceChange: (
    productId: string,
    field: 'buy_price' | 'sell_price',
    value: string
  ) => void;
  onPriceBlur: (productId: string, field: 'buy_price' | 'sell_price') => void;
  onEditProduct: (product: Product) => void;
  onEditCategory: (category: CategoryDoc) => void;
  onDeleteCategory: (categoryId: string, categoryName: string) => void;
}

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  categories,
  updating,
  priceEdits,
  onPriceChange,
  onPriceBlur,
  onEditProduct,
  onEditCategory,
  onDeleteCategory,
}) => {
  const getPriceEditValue = (
    productId: string,
    field: 'buy_price' | 'sell_price',
    originalValue: number
  ) => {
    const editKey = `${productId}-${field}`;
    return priceEdits[editKey] !== undefined
      ? priceEdits[editKey]
      : originalValue.toFixed(2);
  };

  // Group products by category and include empty categories
  const groupedProducts = categories.reduce<{
    [key: string]: { category: CategoryDoc; products: Product[] };
  }>((acc, category) => {
    acc[category.id] = {
      category,
      products: products.filter(product => product.categoryId === category.id),
    };
    return acc;
  }, {});

  // Also add any products that might have categories not in the categories list (orphaned products)
  products.forEach(product => {
    if (product.categoryId && !groupedProducts[product.categoryId]) {
      groupedProducts[product.categoryId] = {
        category: { id: product.categoryId, name: 'Unknown Category' },
        products: products.filter(p => p.categoryId === product.categoryId),
      };
    }
  });

  // Create masonry layout: distribute items into two columns
  const masonryColumns = useMemo(() => {
    const items = Object.entries(groupedProducts);
    const column1: Array<
      [string, { category: CategoryDoc; products: Product[] }]
    > = [];
    const column2: Array<
      [string, { category: CategoryDoc; products: Product[] }]
    > = [];

    // Simple distribution: alternate items between columns
    items.forEach((item, index) => {
      if (index % 2 === 0) {
        column1.push(item);
      } else {
        column2.push(item);
      }
    });

    return { column1, column2 };
  }, [groupedProducts]);

  const renderCategorySection = (
    categoryId: string,
    {
      category,
      products: categoryProducts,
    }: { category: CategoryDoc; products: Product[] }
  ) => (
    <div key={categoryId} className="w-full">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-700">
              {category.name}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEditCategory(category)}
                className="text-gray-400 hover:text-primary-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                aria-label="Edytuj kategorię"
              >
                <svg
                  width="18"
                  height="18"
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
                onClick={() => onDeleteCategory(category.id, category.name)}
                className={`p-1 rounded-full transition-colors ${
                  categoryProducts.length > 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                }`}
                aria-label={
                  categoryProducts.length > 0
                    ? 'Nie można usunąć kategorii z produktami'
                    : 'Usuń kategorię'
                }
                title={
                  categoryProducts.length > 0
                    ? 'Nie można usunąć kategorii z produktami'
                    : 'Usuń kategorię'
                }
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produkt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kod odpadu
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Cena skupu
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Cena sprzedaży
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categoryProducts.length > 0 ? (
                categoryProducts.map(product => (
                  <tr
                    key={product.id}
                    className={
                      updating.includes(product.id)
                        ? 'bg-gray-50'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.itemCode}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex justify-end items-center">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={getPriceEditValue(
                              product.id,
                              'buy_price',
                              product.buy_price
                            )}
                            onChange={e =>
                              onPriceChange(
                                product.id,
                                'buy_price',
                                e.target.value
                              )
                            }
                            onBlur={() => onPriceBlur(product.id, 'buy_price')}
                            className="w-20 px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            disabled={updating.includes(product.id)}
                          />
                          <span className="text-gray-500 text-xs">zł</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex justify-end items-center">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            value={getPriceEditValue(
                              product.id,
                              'sell_price',
                              product.sell_price
                            )}
                            onChange={e =>
                              onPriceChange(
                                product.id,
                                'sell_price',
                                e.target.value
                              )
                            }
                            onBlur={() => onPriceBlur(product.id, 'sell_price')}
                            className="w-20 px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            disabled={updating.includes(product.id)}
                          />
                          <span className="text-gray-500 text-xs">zł</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={() => onEditProduct(product)}
                        className="text-gray-400 hover:text-primary-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                        aria-label="Edytuj produkt"
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
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500 italic"
                  >
                    Brak produktów w tej kategorii
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-8">
      <div className="flex gap-6">
        {/* Column 1 */}
        <div className="flex-1 space-y-6">
          {masonryColumns.column1.map(([categoryId, data]) =>
            renderCategorySection(categoryId, data)
          )}
        </div>

        {/* Column 2 */}
        <div className="flex-1 space-y-6">
          {masonryColumns.column2.map(([categoryId, data]) =>
            renderCategorySection(categoryId, data)
          )}
        </div>
      </div>

      {products.length === 0 && (
        <p className="text-gray-600 text-center">Nie znaleziono produktów.</p>
      )}
    </div>
  );
};

export default withErrorBoundary(ProductsTable, {
  context: 'Products Table',
  onError: (error, errorInfo) => {
    logger.error(
      'Products table error',
      isErrorWithMessage(error) ? error : undefined,
      {
        component: 'ProductsTable',
        operation: 'componentError',
        extra: {
          componentStack: errorInfo.componentStack,
        },
      }
    );
  },
});
