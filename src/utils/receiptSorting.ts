import { Receipt } from '../types/receipt';

/**
 * Extracts the numeric part from receipt number format NN/DD/MM/YYYY
 * @param receiptNumber Receipt number in format NN/DD/MM/YYYY
 * @returns The numeric part as a number
 */
const extractReceiptNumber = (receiptNumber: string): number => {
  const parts = receiptNumber.split('/');
  return parseInt(parts[0], 10);
};

/**
 * Sorts receipts by receipt number (descending)
 * Receipt numbers are in format: NN/DD/MM/YYYY where NN is zero-padded
 *
 * @param receipts Array of receipts to sort
 * @returns Sorted array (does not mutate original)
 */
export const sortReceiptsByDateAndNumber = (receipts: Receipt[]): Receipt[] => {
  return [...receipts].sort((a, b) => {
    // Sort by receipt number (descending - highest number first)
    const aNumber = extractReceiptNumber(a.number);
    const bNumber = extractReceiptNumber(b.number);
    return bNumber - aNumber;
  });
};

/**
 * Sorts receipts in place by receipt number (descending)
 *
 * @param receipts Array of receipts to sort in place
 */
export const sortReceiptsInPlace = (receipts: Receipt[]): void => {
  receipts.sort((a, b) => {
    // Sort by receipt number (descending - highest number first)
    const aNumber = extractReceiptNumber(a.number);
    const bNumber = extractReceiptNumber(b.number);
    return bNumber - aNumber;
  });
};
