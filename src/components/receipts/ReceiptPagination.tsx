import React from 'react';

interface ReceiptPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  loading: boolean;
  user: any;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

const ReceiptPagination: React.FC<ReceiptPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  loading,
  user,
  onPageChange,
  onItemsPerPageChange
}) => {
  return (
    <div className="mt-4 flex justify-end">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="items-per-page-bottom" className="text-sm text-gray-700 whitespace-nowrap">
            Pokaż:
          </label>
          <select
            id="items-per-page-bottom"
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            disabled={!user}
            className="block w-24 pl-3 pr-8 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md disabled:opacity-50"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Page info and navigation */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700 whitespace-nowrap">
            {currentPage}/{totalPages}
          </span>
          <div className="flex">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900 disabled:opacity-50"
            >
              Poprzednia
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-r border-0 border-l border-gray-700 hover:bg-gray-900 disabled:opacity-50"
            >
              Następna
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPagination; 