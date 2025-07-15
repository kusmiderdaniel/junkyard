import { useImperativeHandle, forwardRef, useRef } from 'react';
import { ValidationErrors, Client } from '../../types/receipt';
import ClientSelector from './ClientSelector';

interface ReceiptFormHeaderProps {
  receiptNumber: string;
  date: string;
  selectedClient: Client | null;
  validationErrors: ValidationErrors;
  showValidationErrors: boolean;
  isEditing: boolean;
  onDateChange: (date: string) => void;
  onClientSelect: (client: Client) => void;
  onReceiptNumberChange: (receiptNumber: string) => void;
  onReceiptNumberBlur: () => void;
}

export interface ReceiptFormHeaderRef {
  focusClientSelector: () => void;
  focusReceiptNumber: () => void;
}

const ReceiptFormHeader = forwardRef<
  ReceiptFormHeaderRef,
  ReceiptFormHeaderProps
>(
  (
    {
      receiptNumber,
      date,
      selectedClient,
      validationErrors,
      showValidationErrors,
      isEditing: _isEditing, // Renamed to indicate intentionally unused
      onDateChange,
      onClientSelect,
      onReceiptNumberChange,
      onReceiptNumberBlur,
    },
    ref
  ) => {
    const clientSelectorRef = useRef<{ focus: () => void }>(null);
    const receiptNumberRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusClientSelector: () => {
        clientSelectorRef.current?.focus();
      },
      focusReceiptNumber: () => {
        receiptNumberRef.current?.focus();
        receiptNumberRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      },
    }));

    // Check if the selected date is today
    const isToday = (() => {
      const today = new Date();
      const selectedDate = new Date(date);
      return (
        selectedDate.getFullYear() === today.getFullYear() &&
        selectedDate.getMonth() === today.getMonth() &&
        selectedDate.getDate() === today.getDate()
      );
    })();

    const canEditReceiptNumber = !isToday;

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Informacje o Kwicie</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Receipt Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numer Kwitu
              {canEditReceiptNumber && (
                <span className="text-xs text-orange-600 ml-1">
                  (edytowalny)
                </span>
              )}
            </label>
            <input
              ref={receiptNumberRef}
              type="text"
              value={receiptNumber}
              onChange={e => onReceiptNumberChange(e.target.value)}
              onBlur={onReceiptNumberBlur}
              readOnly={!canEditReceiptNumber}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                validationErrors.receiptNumber
                  ? 'border-red-300 focus:ring-red-500'
                  : canEditReceiptNumber
                    ? 'border-gray-300 bg-white text-gray-900 focus:ring-orange-600'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
              }`}
              placeholder={
                canEditReceiptNumber ? 'Wprowadź numer kwitu...' : ''
              }
            />
            {validationErrors.receiptNumber && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.receiptNumber}
              </p>
            )}
            {canEditReceiptNumber && !validationErrors.receiptNumber && (
              <p className="mt-1 text-xs text-gray-500">
                Możesz ręcznie edytować numer kwitu, gdy data nie jest
                dzisiejsza
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                showValidationErrors && validationErrors.date
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-orange-600'
              }`}
              required
            />
            {showValidationErrors && validationErrors.date && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.date}
              </p>
            )}
          </div>
        </div>

        {/* Client Selection */}
        <div className="mt-4">
          <ClientSelector
            ref={clientSelectorRef}
            selectedClient={selectedClient}
            onClientSelect={onClientSelect}
            showValidationError={showValidationErrors}
            validationError={validationErrors.client}
            autoFocus={false}
          />
        </div>
      </div>
    );
  }
);

ReceiptFormHeader.displayName = 'ReceiptFormHeader';

export default ReceiptFormHeader;
