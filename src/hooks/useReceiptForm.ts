import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useOfflineStatus } from './useOfflineStatus';
import { useOfflineSync } from './useOfflineSync';
import { usePDFReceipt } from '../components/PDFReceipt';
import {
  Client,
  Product,
  ReceiptItem,
  ValidationErrors,
  CompanyDetails,
} from '../types/receipt';
import { generateReceiptNumber } from '../utils/receiptNumberGenerator';
import { validateReceiptForm } from '../utils/receiptFormValidator';
import { offlineStorage } from '../utils/offlineStorage';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
const INITIAL_ITEMS_COUNT = 5;
const MAX_ITEMS_COUNT = 15;

export const useReceiptForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: receiptId } = useParams<{ id: string }>();
  const isEditing = Boolean(receiptId);
  const { isOffline } = useOfflineStatus();
  const { addOfflineReceipt } = useOfflineSync();
  const { viewPDF } = usePDFReceipt();

  // Form state
  const [receiptNumber, setReceiptNumber] = useState('');
  const [isReceiptNumberManuallyEdited, setIsReceiptNumberManuallyEdited] =
    useState(false);
  const [date, setDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printingAndContinuing, setPrintingAndContinuing] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    client: '',
    items: '',
    date: '',
    receiptNumber: '',
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Helper function to check if date is today
  const isDateToday = useCallback((dateString: string) => {
    const today = new Date();
    const selectedDate = new Date(dateString);
    return (
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate()
    );
  }, []);

  // Check for duplicate receipt numbers
  const checkDuplicateReceiptNumber = useCallback(
    async (receiptNumber: string): Promise<boolean> => {
      if (!user || !receiptNumber.trim()) return false;

      try {
        // Check online receipts first (if online)
        if (!isOffline) {
          try {
            const duplicateCheckQuery = query(
              collection(db, 'receipts'),
              where('userID', '==', user.uid),
              where('number', '==', receiptNumber)
            );

            const duplicateSnapshot = await getDocs(duplicateCheckQuery);

            // If editing, exclude the current receipt from duplicate check
            const duplicates = isEditing
              ? duplicateSnapshot.docs.filter(doc => doc.id !== receiptId)
              : duplicateSnapshot.docs;

            if (duplicates.length > 0) {
              return true;
            }
          } catch (error) {
            logger.warn(
              'Failed to check online receipts for duplicates, checking cached data only',
              isErrorWithMessage(error) ? error : undefined,
              {
                component: 'useReceiptForm',
                operation: 'checkDuplicateReceiptNumber',
              }
            );
          }
        }

        // Always check cached receipts (both online cached and offline created)
        const cachedReceipts = await offlineStorage.getCachedReceipts();
        const pendingOperations = await offlineStorage.getPendingOperations();

        // Check cached receipts from Firebase
        const cachedDuplicate = cachedReceipts.some(receipt => {
          // If editing, exclude the current receipt from duplicate check
          if (isEditing && receipt.id === receiptId) return false;
          return receipt.number === receiptNumber;
        });

        if (cachedDuplicate) {
          return true;
        }

        // Check pending offline receipts
        const pendingDuplicate = pendingOperations
          .filter(op => op.type === 'CREATE_RECEIPT')
          .some(operation => {
            const receiptData = operation.data as any;
            return receiptData && receiptData.number === receiptNumber;
          });

        return pendingDuplicate;
      } catch (error) {
        logger.error(
          'Error checking for duplicate receipt numbers',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'useReceiptForm',
            operation: 'checkDuplicateReceiptNumber',
            userId: user.uid,
          }
        );
        return false;
      }
    },
    [user, isOffline, isEditing, receiptId]
  );

  // Debounced receipt number validation - runs immediately, not just after form submission
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (receiptNumber.trim()) {
        const isDuplicate = await checkDuplicateReceiptNumber(receiptNumber);
        if (isDuplicate) {
          setValidationErrors(prev => ({
            ...prev,
            receiptNumber:
              'Ten numer kwitu już istnieje. Proszę wybrać inny numer.',
          }));
        } else {
          setValidationErrors(prev => ({
            ...prev,
            receiptNumber: '',
          }));
        }
      } else {
        // Clear receipt number error if field is empty
        setValidationErrors(prev => ({
          ...prev,
          receiptNumber: '',
        }));
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [receiptNumber, checkDuplicateReceiptNumber]);

  // Immediate validation on receipt number blur (for instant feedback)
  const handleReceiptNumberBlur = useCallback(async () => {
    if (receiptNumber.trim()) {
      const isDuplicate = await checkDuplicateReceiptNumber(receiptNumber);
      if (isDuplicate) {
        setValidationErrors(prev => ({
          ...prev,
          receiptNumber:
            'Ten numer kwitu już istnieje. Proszę wybrać inny numer.',
        }));
      } else {
        setValidationErrors(prev => ({
          ...prev,
          receiptNumber: '',
        }));
      }
    }
  }, [receiptNumber, checkDuplicateReceiptNumber]);

  // Initialize empty items
  const initializeItems = useCallback(() => {
    const emptyItems: ReceiptItem[] = Array(INITIAL_ITEMS_COUNT)
      .fill(null)
      .map(() => ({
        productId: '',
        itemName: '',
        itemCode: '',
        quantity: 0,
        unit: 'kg',
        sell_price: 0,
        buy_price: 0,
        weightAdjustment: 1,
        total_price: 0,
      }));
    setItems(emptyItems);
  }, []);

  // Calculate totals when items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + item.total_price, 0);
    setTotalAmount(total);
  }, [items]);

  // Generate receipt number when date changes (only for new receipts and if not manually edited)
  useEffect(() => {
    if (user && date && !isEditing && !isReceiptNumberManuallyEdited) {
      generateReceiptNumber(date, user.uid, isOffline).then(setReceiptNumber);
    }
  }, [user, date, isEditing, isOffline, isReceiptNumberManuallyEdited]);

  // Reset manual editing flag when date changes to today
  useEffect(() => {
    if (isDateToday(date)) {
      setIsReceiptNumberManuallyEdited(false);
      // Clear receipt number validation errors when switching to today (auto-generation)
      setValidationErrors(prev => ({
        ...prev,
        receiptNumber: '',
      }));
    }
  }, [date, isDateToday]);

  // Immediate validation when date or receipt number changes and user is manually editing
  useEffect(() => {
    const validateImmediately = async () => {
      if (receiptNumber.trim() && isReceiptNumberManuallyEdited) {
        const isDuplicate = await checkDuplicateReceiptNumber(receiptNumber);
        if (isDuplicate) {
          setValidationErrors(prev => ({
            ...prev,
            receiptNumber:
              'Ten numer kwitu już istnieje. Proszę wybrać inny numer.',
          }));
        } else {
          setValidationErrors(prev => ({
            ...prev,
            receiptNumber: '',
          }));
        }
      }
    };

    validateImmediately();
  }, [
    date,
    receiptNumber,
    isReceiptNumberManuallyEdited,
    checkDuplicateReceiptNumber,
  ]);

  // Validation effect
  useEffect(() => {
    if (showValidationErrors) {
      const { errors } = validateReceiptForm(selectedClient, date, items);
      setValidationErrors(prev => ({
        ...prev,
        client: errors.client,
        items: errors.items,
        date: errors.date,
        // Keep existing receiptNumber error if any (will be handled by debounced effect)
      }));
    }
  }, [selectedClient, date, items, showValidationErrors]);

  // Fetch data from Firebase/cache
  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      if (isOffline) {
        const cachedProducts = await offlineStorage.getCachedProducts();
        const cachedCompanyDetails =
          await offlineStorage.getCachedCompanyDetails();

        setProducts(cachedProducts);
        setCompanyDetails(
          cachedCompanyDetails || {
            companyName: 'Your Company',
            numberNIP: '',
            numberREGON: '',
            address: '',
            postalCode: '',
            city: '',
            email: '',
            phoneNumber: '',
          }
        );
      } else {
        try {
          const productsQuery = query(
            collection(db, 'products'),
            where('userID', '==', user.uid),
            orderBy('name')
          );
          const productsSnapshot = await getDocs(productsQuery);
          const productsData = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[];
          setProducts(productsData);

          const companyDocRef = doc(db, 'companyDetails', user.uid);
          const companyDocSnap = await getDoc(companyDocRef);
          let companyData;
          if (companyDocSnap.exists()) {
            companyData = companyDocSnap.data() as CompanyDetails;
            setCompanyDetails(companyData);
          } else {
            companyData = {
              companyName: 'Your Company',
              numberNIP: '',
              numberREGON: '',
              address: '',
              postalCode: '',
              city: '',
              email: '',
              phoneNumber: '',
            };
            setCompanyDetails(companyData);
          }

          await offlineStorage.cacheProducts(productsData);
          if (companyData) {
            await offlineStorage.cacheCompanyDetails(companyData);
          }
        } catch (error) {
          const cachedProducts = await offlineStorage.getCachedProducts();
          const cachedCompanyDetails =
            await offlineStorage.getCachedCompanyDetails();

          setProducts(cachedProducts);
          setCompanyDetails(
            cachedCompanyDetails || {
              companyName: 'Your Company',
              numberNIP: '',
              numberREGON: '',
              address: '',
              postalCode: '',
              city: '',
              email: '',
              phoneNumber: '',
            }
          );
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logger.error(
          'Error fetching receipt form data',
          isErrorWithMessage(error) ? error : undefined,
          {
            component: 'useReceiptForm',
            operation: 'fetchData',
            userId: user?.uid,
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);

  // Load existing receipt data for editing
  const loadReceiptData = useCallback(async () => {
    if (!user || !receiptId) return;

    try {
      const receiptDoc = await getDoc(doc(db, 'receipts', receiptId));

      if (!receiptDoc.exists()) {
        toast.error('Kwit nie został znaleziony.');
        navigate('/receipts');
        return;
      }

      const receiptData = receiptDoc.data();

      if (receiptData.userID !== user.uid) {
        toast.error('Brak uprawnień do edycji tego kwitu.');
        navigate('/receipts');
        return;
      }

      setReceiptNumber(receiptData.number);
      setTotalAmount(receiptData.totalAmount);

      if (receiptData.date) {
        const receiptDate = receiptData.date.toDate
          ? receiptData.date.toDate()
          : new Date(receiptData.date);
        const formattedDate = receiptDate.toISOString().split('T')[0];
        setDate(formattedDate);
      }

      // Load client data
      if (receiptData.clientId) {
        try {
          const clientDoc = await getDoc(
            doc(db, 'clients', receiptData.clientId)
          );
          if (clientDoc.exists()) {
            setSelectedClient({
              id: clientDoc.id,
              ...clientDoc.data(),
            } as Client);
          }
        } catch (error) {
          logger.warn('Failed to load client data for editing', undefined, {
            component: 'useReceiptForm',
            operation: 'loadReceiptData',
            userId: user?.uid,
            extra: { receiptId },
          });
        }
      }

      if (receiptData.items && receiptData.items.length > 0) {
        // Ensure all items have weightAdjustment property (for backward compatibility)
        const itemsWithDefaults = receiptData.items.map((item: any) => ({
          ...item,
          weightAdjustment: item.weightAdjustment || 1,
        }));
        setItems(itemsWithDefaults);
      }
    } catch (error) {
      toast.error('Błąd ładowania danych kwitu.');
      navigate('/receipts');
    }
  }, [user, receiptId, navigate]);

  // Item management functions
  const addNewItem = useCallback(() => {
    if (items.length >= MAX_ITEMS_COUNT) return;

    const newItem: ReceiptItem = {
      productId: '',
      itemName: '',
      itemCode: '',
      quantity: 0,
      unit: 'kg',
      sell_price: 0,
      buy_price: 0,
      weightAdjustment: 1,
      total_price: 0,
    };

    setItems(prev => [...prev, newItem]);

    setTimeout(() => {
      const newIndex = items.length;
      const newProductInput = document.querySelector(
        `[data-product-input="${newIndex}"]`
      ) as HTMLInputElement;
      if (newProductInput) {
        newProductInput.focus();
      }
    }, 0);
  }, [items.length]);

  const removeItem = useCallback(
    (index: number) => {
      if (items.length <= 1) return;
      setItems(prev => prev.filter((_, i) => i !== index));
    },
    [items.length]
  );

  const handleProductSelect = useCallback((index: number, product: Product) => {
    setItems(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = {
        ...updatedItems[index],
        productId: product.id,
        itemName: product.name,
        itemCode: product.itemCode,
        sell_price: product.sell_price,
        buy_price: product.buy_price,
        weightAdjustment: product.weightAdjustment || 1,
      };

      const quantity = updatedItems[index].quantity;
      const safeWeightAdjustment = product.weightAdjustment || 1;
      updatedItems[index].total_price =
        quantity * safeWeightAdjustment * product.buy_price;

      return updatedItems;
    });
  }, []);

  const handleQuantityChange = useCallback(
    (index: number, quantity: number) => {
      setItems(prev => {
        const updatedItems = [...prev];
        updatedItems[index].quantity = quantity;

        const { weightAdjustment, buy_price } = updatedItems[index];
        const safeWeightAdjustment = weightAdjustment || 1;
        updatedItems[index].total_price =
          quantity * safeWeightAdjustment * buy_price;

        return updatedItems;
      });
    },
    []
  );

  const handleBuyPriceChange = useCallback(
    (index: number, buyPrice: number) => {
      setItems(prev => {
        const updatedItems = [...prev];
        updatedItems[index].buy_price = buyPrice;

        const { quantity, weightAdjustment } = updatedItems[index];
        const safeWeightAdjustment = weightAdjustment || 1;
        updatedItems[index].total_price =
          quantity * safeWeightAdjustment * buyPrice;

        return updatedItems;
      });
    },
    []
  );

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
  }, []);

  const handleClientSelect = useCallback((client: Client) => {
    setSelectedClient(client);
  }, []);

  const handleReceiptNumberChange = useCallback(
    (newReceiptNumber: string) => {
      setReceiptNumber(newReceiptNumber);
      // Mark as manually edited only if the date is not today
      if (!isDateToday(date)) {
        setIsReceiptNumberManuallyEdited(true);
      }
    },
    [date, isDateToday]
  );

  return {
    // State
    receiptNumber,
    date,
    selectedClient,
    items,
    totalAmount,
    products,
    companyDetails,
    loading,
    saving,
    printingAndContinuing,
    validationErrors,
    showValidationErrors,
    isEditing,
    isOffline,
    receiptId,

    // Actions
    handleDateChange,
    handleClientSelect,
    handleReceiptNumberChange,
    addNewItem,
    removeItem,
    handleProductSelect,
    handleQuantityChange,
    handleBuyPriceChange,
    handleReceiptNumberBlur,

    // State setters for form operations
    setSaving,
    setPrintingAndContinuing,
    setShowValidationErrors,
    setReceiptNumber,
    setSelectedClient,

    // Data fetching
    fetchData,
    loadReceiptData,
    initializeItems,

    // Utilities
    navigate,
    user,
    addOfflineReceipt,
    viewPDF,
    validateReceiptForm,
    checkDuplicateReceiptNumber,
    generateReceiptNumber: (date: string) =>
      generateReceiptNumber(date, user?.uid || '', isOffline),
  };
};
