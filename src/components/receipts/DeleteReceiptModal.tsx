import React from 'react';

interface DeleteReceiptModalProps {
  isVisible: boolean;
  receiptToDelete: {
    id: string;
    number: string;
    clientName: string;
    totalAmount: number;
    date: Date;
  } | null;
  deleting: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const DeleteReceiptModal: React.FC<DeleteReceiptModalProps> = ({
  isVisible,
  receiptToDelete,
  deleting,
  onConfirm,
  onCancel
}) => {
  if (!isVisible || !receiptToDelete) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) {
          onCancel();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !deleting) {
          onCancel();
        }
      }}
      tabIndex={-1}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Usuń Kwit</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Czy na pewno chcesz usunąć następujący kwit? Ta operacja jest nieodwracalna.
          </p>
          
          {/* Receipt Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">Numer kwitu:</span>
              <span className="text-sm text-gray-900 font-mono">{receiptToDelete.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">Data:</span>
              <span className="text-sm text-gray-900">
                {receiptToDelete.date.toLocaleDateString('pl-PL', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">Klient:</span>
              <span className="text-sm text-gray-900">{receiptToDelete.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-700">Kwota:</span>
              <span className="text-sm text-gray-900 font-semibold">
                {receiptToDelete.totalAmount.toFixed(2)} zł
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Usuwanie...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Usuń Kwit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteReceiptModal; 