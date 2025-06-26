import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { offlineStorage } from './offlineStorage';
import { logger } from './logger';

export const generateReceiptNumber = async (
  selectedDate: string,
  userUID: string,
  isOffline: boolean
): Promise<string> => {
  try {
    const [day, month, year] = selectedDate.split('-').reverse();
    let maxNumber = 0;

    // Check online receipts first (if online)
    if (!isOffline) {
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const receiptsQuery = query(
          collection(db, 'receipts'),
          where('userID', '==', userUID),
          where('date', '>=', Timestamp.fromDate(startOfDay)),
          where('date', '<=', Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(receiptsQuery);

        querySnapshot.docs.forEach(doc => {
          const receiptData = doc.data();
          const receiptNumber = receiptData.number;

          if (receiptNumber && receiptNumber.includes('/')) {
            const parts = receiptNumber.split('/');
            if (
              parts.length === 4 &&
              parts[1] === day &&
              parts[2] === month &&
              parts[3] === year
            ) {
              const numberPart = parseInt(parts[0]);
              if (!isNaN(numberPart) && numberPart > maxNumber) {
                maxNumber = numberPart;
              }
            }
          }
        });
      } catch (error) {
        logger.warn(
          'Failed to fetch online receipts for numbering, using cached data only',
          error,
          {
            component: 'ReceiptNumberGenerator',
            operation: 'generateReceiptNumber',
          }
        );
      }
    }

    // Always check cached receipts (both online cached and offline created)
    const cachedReceipts = await offlineStorage.getCachedReceipts();
    const pendingOperations = await offlineStorage.getPendingOperations();

    // Check cached receipts from Firebase
    cachedReceipts.forEach(receipt => {
      const receiptDate = new Date(receipt.date);
      const receiptDay = receiptDate.getDate().toString().padStart(2, '0');
      const receiptMonth = (receiptDate.getMonth() + 1)
        .toString()
        .padStart(2, '0');
      const receiptYear = receiptDate.getFullYear().toString();

      if (
        receiptDay === day &&
        receiptMonth === month &&
        receiptYear === year
      ) {
        const receiptNumber = receipt.number;
        if (receiptNumber && receiptNumber.includes('/')) {
          const parts = receiptNumber.split('/');
          if (
            parts.length === 4 &&
            parts[1] === day &&
            parts[2] === month &&
            parts[3] === year
          ) {
            const numberPart = parseInt(parts[0]);
            if (!isNaN(numberPart) && numberPart > maxNumber) {
              maxNumber = numberPart;
            }
          }
        }
      }
    });

    // Check pending offline receipts
    pendingOperations
      .filter(op => op.type === 'CREATE_RECEIPT')
      .forEach(operation => {
        const receiptData = operation.data;
        if (receiptData && receiptData.date) {
          const receiptDate = new Date(receiptData.date);
          const receiptDay = receiptDate.getDate().toString().padStart(2, '0');
          const receiptMonth = (receiptDate.getMonth() + 1)
            .toString()
            .padStart(2, '0');
          const receiptYear = receiptDate.getFullYear().toString();

          if (
            receiptDay === day &&
            receiptMonth === month &&
            receiptYear === year
          ) {
            const receiptNumber = receiptData.number;
            if (receiptNumber && receiptNumber.includes('/')) {
              const parts = receiptNumber.split('/');
              if (
                parts.length === 4 &&
                parts[1] === day &&
                parts[2] === month &&
                parts[3] === year
              ) {
                const numberPart = parseInt(parts[0]);
                if (!isNaN(numberPart) && numberPart > maxNumber) {
                  maxNumber = numberPart;
                }
              }
            }
          }
        }
      });

    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(2, '0');
    return `${paddedNumber}/${day}/${month}/${year}`;
  } catch (error) {
    // Return default receipt number if generation fails
    return '01/' + new Date().toLocaleDateString('pl-PL');
  }
};
