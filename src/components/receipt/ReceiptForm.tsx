import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy, addDoc, Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { offlineStorage } from '../../utils/offlineStorage';
import { usePDFReceipt } from '../PDFReceipt';
import ClientSelector from './ClientSelector';
import ItemRow from './ItemRow';

interface Client {
  id: string;
  name: string;
  address: string;
  documentNumber: string;
  postalCode?: string;
  city?: string;
  fullAddress?: string;
}

interface Product {
  id: string;
  name: string;
  itemCode: string;
  categoryId: string;
  buy_price: number;
  sell_price: number;
  weightAdjustment: number;
}

interface ReceiptItem {
  productId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  weightAdjustment: number;
  total_price: number;
}

interface ValidationErrors {
  client: string;
  items: string;
  date: string;
}

// Custom currency formatter that always shows thousands separator for numbers >= 1000
const formatCurrency = (amount: number) => {
  // Force grouping for thousands by manually adding space separator
  if (amount >= 1000 && amount < 10000) {
    const parts = amount.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const thousands = integerPart.slice(0, -3);
    const hundreds = integerPart.slice(-3);
    return `${thousands} ${hundreds},${decimalPart} zł`;
  }
  
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  }).format(amount);
};

const ReceiptForm: React.FC = () => {
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
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printingAndContinuing, setPrintingAndContinuing] = useState(false);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({
    client: '',
    items: '',
    date: ''
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Initialize 5 empty items
  const initializeItems = useCallback(() => {
    const emptyItems: ReceiptItem[] = Array(5).fill(null).map(() => ({
      productId: '',
      itemName: '',
      itemCode: '',
      quantity: 0,
      unit: 'kg',
      sell_price: 0,
      buy_price: 0,
      weightAdjustment: 1,
      total_price: 0
    }));
    setItems(emptyItems);
  }, []);

  // Generate receipt number based on date and existing receipts (including offline ones)
  const generateReceiptNumber = useCallback(async (selectedDate: string) => {
    if (!user) return '';

    try {
      const [day, month, year] = selectedDate.split('-').reverse();
      const datePrefix = `${day}/${month}/${year}`;
      
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
            where('userID', '==', user.uid),
            where('date', '>=', Timestamp.fromDate(startOfDay)),
            where('date', '<=', Timestamp.fromDate(endOfDay))
          );

          const querySnapshot = await getDocs(receiptsQuery);
          
          querySnapshot.docs.forEach(doc => {
            const receiptData = doc.data();
            const receiptNumber = receiptData.number;
            
            if (receiptNumber && receiptNumber.includes('/')) {
              const parts = receiptNumber.split('/');
              if (parts.length === 4 && parts[1] === day && parts[2] === month && parts[3] === year) {
                const numberPart = parseInt(parts[0]);
                if (!isNaN(numberPart) && numberPart > maxNumber) {
                  maxNumber = numberPart;
                }
              }
            }
          });
        } catch (error) {
          console.warn('Failed to fetch online receipts for numbering, using cached data only');
        }
      }
      
      // Always check cached receipts (both online cached and offline created)
      const cachedReceipts = offlineStorage.getCachedReceipts();
      const pendingOperations = offlineStorage.getPendingOperations();
      
      // Check cached receipts from Firebase
      cachedReceipts.forEach(receipt => {
        const receiptDate = new Date(receipt.date);
        const receiptDay = receiptDate.getDate().toString().padStart(2, '0');
        const receiptMonth = (receiptDate.getMonth() + 1).toString().padStart(2, '0');
        const receiptYear = receiptDate.getFullYear().toString();
        
        if (receiptDay === day && receiptMonth === month && receiptYear === year) {
          const receiptNumber = receipt.number;
          if (receiptNumber && receiptNumber.includes('/')) {
            const parts = receiptNumber.split('/');
            if (parts.length === 4 && parts[1] === day && parts[2] === month && parts[3] === year) {
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
            const receiptMonth = (receiptDate.getMonth() + 1).toString().padStart(2, '0');
            const receiptYear = receiptDate.getFullYear().toString();
            
            if (receiptDay === day && receiptMonth === month && receiptYear === year) {
              const receiptNumber = receiptData.number;
              if (receiptNumber && receiptNumber.includes('/')) {
                const parts = receiptNumber.split('/');
                if (parts.length === 4 && parts[1] === day && parts[2] === month && parts[3] === year) {
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
      return `${paddedNumber}/${datePrefix}`;
    } catch (error) {
      // Return default receipt number if generation fails
      return '01/' + new Date().toLocaleDateString('pl-PL');
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
      
      // Check if the receipt belongs to the current user
      if (receiptData.userID !== user.uid) {
        toast.error('Brak uprawnień do edycji tego kwitu.');
        navigate('/receipts');
        return;
      }

      // Set form data
      setReceiptNumber(receiptData.number);
      setDate(receiptData.date.toDate().toISOString().split('T')[0]);
      setTotalAmount(receiptData.totalAmount);
      
      // Load client data
      if (receiptData.clientId) {
        try {
          const clientDoc = await getDoc(doc(db, 'clients', receiptData.clientId));
          if (clientDoc.exists()) {
            const clientData = { id: clientDoc.id, ...clientDoc.data() } as Client;
            setSelectedClient(clientData);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error loading client data:', error);
          }
        }
      }
      
      // Set items
      if (receiptData.items && receiptData.items.length > 0) {
        setItems(receiptData.items);
      }

      return receiptData;
    } catch (error) {
      toast.error('Błąd ładowania danych kwitu.');
      navigate('/receipts');
      return null;
    }
  }, [user, receiptId, navigate]);

  // Fetch products and company details (with offline support)
  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      if (isOffline) {
        // Load from offline cache only
        console.log('📱 Loading receipt form data from offline cache');
        const cachedProducts = offlineStorage.getCachedProducts();
        const cachedCompanyDetails = offlineStorage.getCachedCompanyDetails();
        
        setProducts(cachedProducts);
        setCompanyDetails(cachedCompanyDetails || {
          companyName: 'Your Company',
          numberNIP: '',
          numberREGON: '',
          address: '',
          postalCode: '',
          city: '',
          email: '',
          phoneNumber: ''
        });
      } else {
        // Load from Firebase and update cache
        try {
          // Fetch products
          const productsQuery = query(
            collection(db, 'products'),
            where('userID', '==', user.uid),
            orderBy('name')
          );
          const productsSnapshot = await getDocs(productsQuery);
          const productsData = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          setProducts(productsData);

          // Fetch company details for PDF generation
          const companyDocRef = doc(db, 'companyDetails', user.uid);
          const companyDocSnap = await getDoc(companyDocRef);
          let companyData;
          if (companyDocSnap.exists()) {
            companyData = companyDocSnap.data();
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
              phoneNumber: ''
            };
            setCompanyDetails(companyData);
          }

          // Update offline cache
          offlineStorage.cacheProducts(productsData);
          if (companyData) {
            offlineStorage.cacheCompanyDetails(companyData as any);
          }
        } catch (error) {
          // If online fetch fails, fall back to cached data
          console.warn('Failed to fetch receipt form data online, using cached data:', error);
          const cachedProducts = offlineStorage.getCachedProducts();
          const cachedCompanyDetails = offlineStorage.getCachedCompanyDetails();
          
          setProducts(cachedProducts);
          setCompanyDetails(cachedCompanyDetails || {
            companyName: 'Your Company',
            numberNIP: '',
            numberREGON: '',
            address: '',
            postalCode: '',
            city: '',
            email: '',
            phoneNumber: ''
          });
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

  // Initialize receipt number when date changes (only for new receipts)
  useEffect(() => {
    if (user && date && !isEditing) {
      generateReceiptNumber(date).then(setReceiptNumber);
    }
  }, [user, date, generateReceiptNumber, isEditing]);

  // Fetch data on component mount
  useEffect(() => {
    const initializeComponent = async () => {
      setLoading(true);
      try {
        await fetchData();
        
        if (isEditing) {
          await loadReceiptData();
        } else {
          initializeItems();
        }
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();
  }, [fetchData, initializeItems, loadReceiptData, isEditing]);

  // Calculate total amount when items change
  useEffect(() => {
    const total = items.reduce((sum, item) => sum + item.total_price, 0);
    setTotalAmount(total);
  }, [items]);

  // Handle client selection
  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  // Add a new empty item (max 15 items)
  const addNewItem = () => {
    if (items.length >= 15) return;
    
    const newItem: ReceiptItem = {
      productId: '',
      itemName: '',
      itemCode: '',
      quantity: 0,
      unit: 'kg',
      sell_price: 0,
      buy_price: 0,
      weightAdjustment: 1,
      total_price: 0
    };
    
    setItems([...items, newItem]);
    
    // Focus on the new item's product field after state update
    setTimeout(() => {
      const newIndex = items.length; // This will be the index of the newly added item
      const newProductInput = document.querySelector(`[data-product-input="${newIndex}"]`) as HTMLInputElement;
      if (newProductInput) {
        newProductInput.focus();
      }
    }, 0);
  };

  // Remove an item (minimum 1 item)
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
  };

  // Handle product selection for an item
  const handleProductSelect = (index: number, product: Product) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      productId: product.id,
      itemName: product.name,
      itemCode: product.itemCode,
      sell_price: product.sell_price,
      buy_price: product.buy_price,
      weightAdjustment: product.weightAdjustment
    };
    
    // Recalculate total for this item
    const quantity = updatedItems[index].quantity;
    updatedItems[index].total_price = quantity * product.weightAdjustment * product.buy_price;
    
    setItems(updatedItems);
  };

  // Handle quantity change
  const handleQuantityChange = (index: number, quantity: number) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    
    // Recalculate total for this item
    const { weightAdjustment, buy_price } = updatedItems[index];
    updatedItems[index].total_price = quantity * weightAdjustment * buy_price;
    
    setItems(updatedItems);
  };

  // Handle buy price change
  const handleBuyPriceChange = (index: number, buyPrice: number) => {
    const updatedItems = [...items];
    updatedItems[index].buy_price = buyPrice;
    
    // Recalculate total for this item
    const { quantity, weightAdjustment } = updatedItems[index];
    updatedItems[index].total_price = quantity * weightAdjustment * buyPrice;
    
    setItems(updatedItems);
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
  };

  // Validation function
  const validateForm = useCallback(() => {
    const errors: ValidationErrors = {
      client: '',
      items: '',
      date: ''
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
      const invalidItems = validItems.filter(item => 
        item.quantity <= 0 || item.buy_price <= 0
      );
      
      if (invalidItems.length > 0) {
        errors.items = 'Wszystkie produkty muszą mieć prawidłową ilość i cenę skupu';
      }
    }

    setValidationErrors(errors);
    return !errors.client && !errors.items && !errors.date;
  }, [selectedClient, date, items]);

  // Update validation when form data changes
  useEffect(() => {
    if (showValidationErrors) {
      validateForm();
    }
  }, [selectedClient, date, items, showValidationErrors, validateForm]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setShowValidationErrors(true);
    
    if (!validateForm()) {
      return;
    }

    // Editing not supported offline
    if (isEditing && isOffline) {
      toast.error('Edytowanie kwitów nie jest dostępne w trybie offline.');
      return;
    }

    setSaving(true);
    try {
      // Always use current timestamp for receipt date
      const localDate = new Date();
      
      const receiptData = {
        number: receiptNumber,
        date: localDate, // Use Date object for offline, will be converted to Timestamp when syncing
        clientId: selectedClient!.id,
        userID: user.uid,
        totalAmount,
        items: items.filter(item => item.productId !== '') // Only include items with selected products
      };

      if (isEditing && receiptId) {
        // Update existing receipt (only online)
        await updateDoc(doc(db, 'receipts', receiptId), {
          ...receiptData,
          date: Timestamp.fromDate(localDate)
        });
      } else {
        // Create new receipt
        if (isOffline) {
          // Add to offline queue
          const tempId = addOfflineReceipt(receiptData);
          
          if (tempId) {
            toast.success('Kwit został dodany offline. Synchronizacja nastąpi po powrocie online.');
            navigate('/receipts');
          } else {
            toast.error('Nie udało się dodać kwitu offline.');
            return;
          }
        } else {
          // Online mode - check for duplicates and create directly in Firebase
          const duplicateCheckQuery = query(
            collection(db, 'receipts'),
            where('userID', '==', user.uid),
            where('number', '==', receiptNumber)
          );
          
          const duplicateSnapshot = await getDocs(duplicateCheckQuery);
          
          if (!duplicateSnapshot.empty) {
            // Receipt number already exists, generate a new one
            const newReceiptNumber = await generateReceiptNumber(date);
            setReceiptNumber(newReceiptNumber);
            receiptData.number = newReceiptNumber;
          }

          await addDoc(collection(db, 'receipts'), {
            ...receiptData,
            date: Timestamp.fromDate(localDate)
          });
          navigate('/receipts');
        }
      }
    } catch (error) {
      toast.error(`Nie udało się ${isEditing ? 'zaktualizować' : 'zapisać'} kwitu. Spróbuj ponownie.`);
    } finally {
      setSaving(false);
    }
  };

  // Reset form for new receipt
  const resetFormForNewReceipt = useCallback(async () => {
    // Reset form state
    setSelectedClient(null);
    setValidationErrors({ client: '', items: '', date: '' });
    setShowValidationErrors(false);
    
    // Reset items to 5 empty items
    initializeItems();
    
    // Generate new receipt number for today's date
    const newReceiptNumber = await generateReceiptNumber(date);
    setReceiptNumber(newReceiptNumber);
  }, [date, generateReceiptNumber, initializeItems]);

  // Handle print and continue functionality (for new receipts)
  const handlePrintAndContinue = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setShowValidationErrors(true);
    
    if (!validateForm()) {
      return;
    }

    // Additional check for company details after validation
    if (!companyDetails) {
      toast.error('Dane firmy nie zostały załadowane. Spróbuj ponownie.');
      return;
    }

    setPrintingAndContinuing(true);
    try {
      // Always use current timestamp for receipt date
      const localDate = new Date();
      
      const receiptData = {
        number: receiptNumber,
        date: localDate, // Use Date object for offline
        clientId: selectedClient!.id,
        userID: user.uid,
        totalAmount,
        items: items.filter(item => item.productId !== '') // Only include items with selected products
      };

      let savedReceipt;

      if (isOffline) {
        // Add to offline queue
        const tempId = addOfflineReceipt(receiptData);
        
        if (!tempId) {
          toast.error('Nie udało się dodać kwitu offline.');
          return;
        }

        // Create receipt object for PDF generation with temp ID
        savedReceipt = {
          id: tempId,
          ...receiptData,
          date: localDate
        };

        toast.success('Kwit został dodany offline. Synchronizacja nastąpi po powrocie online.');
      } else {
        // Online mode - check for duplicates and create directly in Firebase
        const duplicateCheckQuery = query(
          collection(db, 'receipts'),
          where('userID', '==', user.uid),
          where('number', '==', receiptNumber)
        );
        
        const duplicateSnapshot = await getDocs(duplicateCheckQuery);
        
        if (!duplicateSnapshot.empty) {
          // Receipt number already exists, generate a new one
          const newReceiptNumber = await generateReceiptNumber(date);
          setReceiptNumber(newReceiptNumber);
          receiptData.number = newReceiptNumber;
        }

        // Save the receipt
        const docRef = await addDoc(collection(db, 'receipts'), {
          ...receiptData,
          date: Timestamp.fromDate(localDate)
        });
        
        // Create receipt object for PDF generation
        savedReceipt = {
          id: docRef.id,
          ...receiptData,
          date: localDate
        };
      }

      // Open PDF in new tab (selectedClient is guaranteed to be non-null after validation)
      await viewPDF(savedReceipt, selectedClient!, companyDetails);
      
      // Reset form for new receipt
      await resetFormForNewReceipt();
      
    } catch (error) {
      toast.error('Nie udało się zapisać kwitu. Spróbuj ponownie.');
    } finally {
      setPrintingAndContinuing(false);
    }
  }, [user, validateForm, companyDetails, receiptNumber, selectedClient, totalAmount, items, generateReceiptNumber, date, viewPDF, resetFormForNewReceipt, isOffline, addOfflineReceipt]);

  // Handle print functionality for editing mode
  const handlePrint = useCallback(async () => {
    if (!user || !isEditing) return;

    setShowValidationErrors(true);
    
    if (!validateForm()) {
      return;
    }

    // Additional check for company details after validation
    if (!companyDetails) {
      toast.error('Dane firmy nie zostały załadowane. Spróbuj ponownie.');
      return;
    }

    setPrintingAndContinuing(true);
    try {
      // Create receipt object for PDF generation using current form data
      const currentReceipt = {
        id: receiptId!,
        number: receiptNumber,
        date: new Date(date),
        clientId: selectedClient!.id,
        userID: user.uid,
        totalAmount,
        items: items.filter(item => item.productId !== '') // Only include items with selected products
      };

      // Open PDF in new tab (selectedClient is guaranteed to be non-null after validation)
      await viewPDF(currentReceipt, selectedClient!, companyDetails);
      
    } catch (error) {
      toast.error('Nie udało się wygenerować PDF. Spróbuj ponownie.');
    } finally {
      setPrintingAndContinuing(false);
    }
  }, [user, isEditing, validateForm, companyDetails, receiptId, receiptNumber, date, selectedClient, totalAmount, items, viewPDF]);

  // Keyboard shortcut for print (Cmd/Ctrl + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + D
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault(); // Prevent browser's default bookmark action
        
        // Only trigger if not already processing
        if (!saving && !printingAndContinuing) {
          if (isEditing) {
            // For editing mode, just print
            handlePrint();
          } else {
            // For new receipt mode, print and continue
            const syntheticEvent = {
              preventDefault: () => {}
            } as React.FormEvent;
            
            handlePrintAndContinue(syntheticEvent);
          }
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditing, saving, printingAndContinuing, handlePrintAndContinue, handlePrint]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Zaloguj się, aby tworzyć kwity.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
        <span className="ml-2">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{isEditing ? 'Edytuj Kwit' : 'Dodaj Nowy Kwit'}</h1>
        <button
          onClick={() => navigate('/receipts')}
          className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Anuluj
        </button>
      </div>

      {/* Validation Summary */}
      {showValidationErrors && (validationErrors.client || validationErrors.items || validationErrors.date) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Proszę poprawić następujące błędy:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc space-y-1 pl-5">
                  {validationErrors.client && <li>{validationErrors.client}</li>}
                  {validationErrors.date && <li>{validationErrors.date}</li>}
                  {validationErrors.items && <li>{validationErrors.items}</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Receipt Header */}
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
                onChange={(e) => handleDateChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  showValidationErrors && validationErrors.date
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-orange-600'
                }`}
                required
              />
              {showValidationErrors && validationErrors.date && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.date}</p>
              )}
            </div>
          </div>

          {/* Client Selection */}
          <div className="mt-4">
            <ClientSelector
              selectedClient={selectedClient}
              onClientSelect={handleClientSelect}
              showValidationError={showValidationErrors}
              validationError={validationErrors.client}
              autoFocus={!isEditing}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Pozycje Kwitu</h2>
            {showValidationErrors && validationErrors.items && (
              <p className="text-sm text-red-600">{validationErrors.items}</p>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <colgroup>
                <col style={{width: '30%'}} />
                <col style={{width: '16%'}} />
                <col style={{width: '16%'}} />
                <col style={{width: '16%'}} />
                <col style={{width: '14%'}} />
                <col style={{width: '8%'}} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produkt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ilość
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cena Skupu
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cena Sprzedaży
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Razem
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <ItemRow
                    key={index}
                    item={item}
                    index={index}
                    products={products}
                    onProductSelect={handleProductSelect}
                    onQuantityChange={handleQuantityChange}
                    onBuyPriceChange={handleBuyPriceChange}
                    onRemoveItem={removeItem}
                    canRemove={items.length > 1}
                    showValidationErrors={showValidationErrors}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Add Product Button */}
          <div className="mt-4 px-4">
            <button
              type="button"
              onClick={addNewItem}
              disabled={items.length >= 15}
              className="px-4 py-2 bg-orange-700 text-white rounded-md hover:bg-orange-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-600 flex items-center space-x-2"
            >
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                />
              </svg>
              <span>Dodaj Produkt</span>
              <span className="text-xs opacity-75">({items.length}/15)</span>
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Łączna Kwota</h2>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/receipts')}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Anuluj
          </button>
          
          {/* Print Button - Show for both new and edit modes */}
          <button
            type="button"
            onClick={isEditing ? handlePrint : handlePrintAndContinue}
            disabled={printingAndContinuing || saving}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            title={isEditing ? "Drukuj (Cmd/Ctrl + D)" : "Drukuj i kontynuuj (Cmd/Ctrl + D)"}
          >
            {printingAndContinuing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Drukowanie...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Drukuj</span>
                <span className="text-xs opacity-75">(⌘D)</span>
              </>
            )}
          </button>
          
          <button
            type="submit"
            disabled={saving || printingAndContinuing}
            className="px-6 py-2 bg-orange-700 text-white rounded-md hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (isEditing ? 'Aktualizowanie...' : 'Zapisywanie...') : (isEditing ? 'Aktualizuj Kwit' : 'Zapisz Kwit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReceiptForm; 