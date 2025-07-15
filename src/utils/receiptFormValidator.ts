import { ValidationErrors, Client, ReceiptItem } from '../types/receipt';

export const validateReceiptForm = (
  selectedClient: Client | null,
  date: string,
  items: ReceiptItem[]
): { isValid: boolean; errors: ValidationErrors } => {
  const errors: ValidationErrors = {
    client: '',
    items: '',
    date: '',
    receiptNumber: '',
  };

  // Validate client selection
  if (!selectedClient) {
    errors.client = 'Proszę wybrać klienta';
  }

  // Validate date
  if (!date) {
    errors.date = 'Proszę wybrać datę';
  } else {
    const selectedDate = new Date(date);
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);

    if (selectedDate > oneYearFromNow) {
      errors.date = 'Data nie może być więcej niż rok w przyszłości';
    }
  }

  // Validate items
  const validItems = items.filter(item => item.productId !== '');
  if (validItems.length === 0) {
    errors.items = 'Proszę dodać co najmniej jeden produkt';
  } else {
    // Check for items with invalid quantities or prices
    const invalidItems = validItems.filter(
      item => item.quantity <= 0 || item.buy_price <= 0
    );

    if (invalidItems.length > 0) {
      errors.items =
        'Wszystkie produkty muszą mieć prawidłową ilość i cenę skupu';
    }
  }

  const isValid =
    !errors.client && !errors.items && !errors.date && !errors.receiptNumber;

  return { isValid, errors };
};

// Async version that includes duplicate receipt number checking
export const validateReceiptFormAsync = async (
  selectedClient: Client | null,
  date: string,
  items: ReceiptItem[],
  receiptNumber: string,
  checkDuplicateReceiptNumber: (receiptNumber: string) => Promise<boolean>
): Promise<{ isValid: boolean; errors: ValidationErrors }> => {
  // First run basic validation
  const basicValidation = validateReceiptForm(selectedClient, date, items);

  // If basic validation failed, return early
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  // Check for duplicate receipt number
  if (!receiptNumber.trim()) {
    basicValidation.errors.receiptNumber = 'Numer kwitu jest wymagany';
    basicValidation.isValid = false;
  } else {
    const isDuplicate = await checkDuplicateReceiptNumber(receiptNumber);
    if (isDuplicate) {
      basicValidation.errors.receiptNumber =
        'Ten numer kwitu już istnieje. Proszę wybrać inny numer.';
      basicValidation.isValid = false;
    }
  }

  return {
    isValid:
      !basicValidation.errors.client &&
      !basicValidation.errors.items &&
      !basicValidation.errors.date &&
      !basicValidation.errors.receiptNumber,
    errors: basicValidation.errors,
  };
};
