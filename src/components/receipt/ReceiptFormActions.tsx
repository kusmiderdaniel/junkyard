import React from 'react';

interface ReceiptFormActionsProps {
  isEditing: boolean;
  saving: boolean;
  printingAndContinuing: boolean;
  onCancel: () => void;
  onPrint: () => void;
  onPrintAndContinue: (e: React.FormEvent) => void;
  onSave: () => void;
}

const ReceiptFormActions: React.FC<ReceiptFormActionsProps> = ({
  isEditing,
  saving,
  printingAndContinuing,
  onCancel,
  onPrint,
  onPrintAndContinue,
  onSave,
}) => {
  const handlePrintClick = isEditing ? onPrint : onPrintAndContinue;

  return (
    <div className="flex justify-end space-x-4">
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        Anuluj
      </button>

      {/* Print Button - Show for both new and edit modes */}
      <button
        type="button"
        onClick={handlePrintClick}
        disabled={printingAndContinuing || saving}
        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        title={
          isEditing
            ? 'Drukuj (Cmd/Ctrl + D)'
            : 'Drukuj i kontynuuj (Cmd/Ctrl + D)'
        }
      >
        {printingAndContinuing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Drukowanie...</span>
          </>
        ) : (
          <>
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            <span>Drukuj</span>
            <span className="text-xs opacity-75">(⌘D)</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving || printingAndContinuing}
        className="px-6 py-2 bg-orange-700 text-white rounded-md hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving
          ? isEditing
            ? 'Aktualizowanie...'
            : 'Zapisywanie...'
          : isEditing
            ? 'Aktualizuj Kwit'
            : 'Zapisz Kwit'}
      </button>
    </div>
  );
};

export default ReceiptFormActions;
