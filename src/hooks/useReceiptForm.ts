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
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);

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

  // Generate receipt number when date changes (only for new receipts)
  useEffect(() => {
    if (user && date && !isEditing) {
      generateReceiptNumber(date, user.uid, isOffline).then(setReceiptNumber);
    }
  }, [user, date, isEditing, isOffline]);

  // Validation effect
  useEffect(() => {
    if (showValidationErrors) {
      const { errors } = validateReceiptForm(selectedClient, date, items);
      setValidationErrors(errors);
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
        console.error('Error fetching data:', error);
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
          console.warn('Failed to load client data for editing');
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
    addNewItem,
    removeItem,
    handleProductSelect,
    handleQuantityChange,
    handleBuyPriceChange,

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
    generateReceiptNumber: (date: string) =>
      generateReceiptNumber(date, user?.uid || '', isOffline),
  };
};
