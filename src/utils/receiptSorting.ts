import { Receipt } from '../types/receipt';

/**
 * Extracts the numeric part and date part from receipt number format NN/DD/MM/YYYY
 * @param receiptNumber Receipt number in format NN/DD/MM/YYYY
 * @returns Object with numeric part and date for sorting
 */
const parseReceiptNumber = (
  receiptNumber: string
): { number: number; date: Date } => {
  const parts = receiptNumber.split('/');
  if (parts.length !== 4) {
    // Fallback for invalid format
    return { number: 0, date: new Date(0) };
  }

  const number = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10);
  const year = parseInt(parts[3], 10);

  // Create date object for comparison
  const date = new Date(year, month - 1, day); // month is 0-indexed in JS Date

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return { number, date: new Date(0) };
  }

  return { number, date };
};

/**
 * Sorts receipts by date part first (descending), then by receipt number (descending)
 * Receipt numbers are in format: NN/DD/MM/YYYY where NN is zero-padded
 *
 * @param receipts Array of receipts to sort
 * @returns Sorted array (does not mutate original)
 */
export const sortReceiptsByNumber = (receipts: Receipt[]): Receipt[] => {
  return [...receipts].sort((a, b) => {
    const aParsed = parseReceiptNumber(a.number);
    const bParsed = parseReceiptNumber(b.number);

    // First, sort by date (descending - newest date first)
    const dateComparison = bParsed.date.getTime() - aParsed.date.getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }

    // If dates are the same, sort by receipt number (descending - highest number first)
    return bParsed.number - aParsed.number;
  });
};

/**
 * Sorts receipts in place by date part first (descending), then by receipt number (descending)
 *
 * @param receipts Array of receipts to sort in place
 */
export const sortReceiptsInPlace = (receipts: Receipt[]): void => {
  receipts.sort((a, b) => {
    const aParsed = parseReceiptNumber(a.number);
    const bParsed = parseReceiptNumber(b.number);

    // First, sort by date (descending - newest date first)
    const dateComparison = bParsed.date.getTime() - aParsed.date.getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }

    // If dates are the same, sort by receipt number (descending - highest number first)
    return bParsed.number - aParsed.number;
  });
};
