import React, { useImperativeHandle, forwardRef, useRef } from 'react';
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
}

export interface ReceiptFormHeaderRef {
  focusClientSelector: () => void;
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
      isEditing,
      onDateChange,
      onClientSelect,
    },
    ref
  ) => {
    const clientSelectorRef = useRef<{ focus: () => void }>(null);

    useImperativeHandle(ref, () => ({
      focusClientSelector: () => {
        clientSelectorRef.current?.focus();
      },
    }));

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Informacje o Kwicie</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Receipt Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numer Kwitu
            </label>
            <input
              type="text"
              value={receiptNumber}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            />
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
