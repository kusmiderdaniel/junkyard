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

  const isValid = !errors.client && !errors.items && !errors.date;

  return { isValid, errors };
};
