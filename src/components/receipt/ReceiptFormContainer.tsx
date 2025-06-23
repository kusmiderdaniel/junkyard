import React, { useEffect, useCallback, useRef } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useReceiptForm } from '../../hooks/useReceiptForm';
import ReceiptFormHeader, { ReceiptFormHeaderRef } from './ReceiptFormHeader';
import ReceiptItemsList from './ReceiptItemsList';
import ReceiptSummary from './ReceiptSummary';
import ReceiptFormActions from './ReceiptFormActions';
import LoadingSpinner from '../LoadingSpinner';

const ReceiptFormContainer: React.FC = () => {
  const receiptFormHeaderRef = useRef<ReceiptFormHeaderRef>(null);

  const {
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

    // State setters
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
    generateReceiptNumber,
  } = useReceiptForm();

  // Initialize component
  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await fetchData();

        if (isEditing) {
          await loadReceiptData();
        } else {
          initializeItems();
        }
      } catch (error) {
        console.error('Error initializing component:', error);
      }
    };

    initializeComponent();
  }, [fetchData, loadReceiptData, initializeItems, isEditing]);

  // Reset form for new receipt
  const resetFormForNewReceipt = useCallback(async () => {
    // Blur any currently focused element to prevent focus conflicts
    if (
      document.activeElement &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }

    setSelectedClient(null);
    initializeItems();
    setShowValidationErrors(false);

    // Generate new receipt number for current date
    const newReceiptNumber = await generateReceiptNumber(date);
    setReceiptNumber(newReceiptNumber);

    // Focus the client selector with multiple attempts to ensure it works
    const focusClientSelector = () => {
      receiptFormHeaderRef.current?.focusClientSelector();
    };

    // Try multiple timing strategies
    setTimeout(focusClientSelector, 100);
    setTimeout(focusClientSelector, 300);
    setTimeout(() => {
      requestAnimationFrame(focusClientSelector);
    }, 500);
  }, [
    initializeItems,
    setShowValidationErrors,
    generateReceiptNumber,
    date,
    setReceiptNumber,
    setSelectedClient,
  ]);

  // Handle save functionality
  const handleSave = async () => {
    if (!user) return;

    setShowValidationErrors(true);

    const { isValid } = validateReceiptForm(selectedClient, date, items);
    if (!isValid) {
      return;
    }

    // Editing not supported offline
    if (isEditing && isOffline) {
      toast.error('Edytowanie kwitów nie jest dostępne w trybie offline.');
      return;
    }

    setSaving(true);
    try {
      const localDate = new Date();

      const receiptData = {
        number: receiptNumber,
        date: localDate,
        clientId: selectedClient!.id,
        userID: user.uid,
        totalAmount,
        items: items.filter(item => item.productId !== ''),
      };

      if (isEditing && receiptId) {
        // Update existing receipt (only online)
        await updateDoc(doc(db, 'receipts', receiptId), {
          ...receiptData,
          date: Timestamp.fromDate(localDate),
        });

        toast.success('Kwit został zaktualizowany.');
        navigate('/receipts');
      } else {
        // Create new receipt
        if (isOffline) {
          const tempId = addOfflineReceipt(receiptData);

          if (tempId) {
            toast.success(
              'Kwit został dodany offline. Synchronizacja nastąpi po powrocie online.'
            );
            navigate('/receipts');
          } else {
            toast.error('Nie udało się dodać kwitu offline.');
          }
        } else {
          // Check for duplicates before creating
          const duplicateCheckQuery = query(
            collection(db, 'receipts'),
            where('userID', '==', user.uid),
            where('number', '==', receiptNumber)
          );

          const duplicateSnapshot = await getDocs(duplicateCheckQuery);

          if (!duplicateSnapshot.empty) {
            const newReceiptNumber = await generateReceiptNumber(date);
            setReceiptNumber(newReceiptNumber);
            receiptData.number = newReceiptNumber;
          }

          await addDoc(collection(db, 'receipts'), {
            ...receiptData,
            date: Timestamp.fromDate(localDate),
          });

          toast.success('Kwit został zapisany.');
          navigate('/receipts');
        }
      }
    } catch (error) {
      toast.error('Nie udało się zapisać kwitu. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  // Handle print and continue functionality (for new receipts)
  const handlePrintAndContinue = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;

      setShowValidationErrors(true);

      const { isValid } = validateReceiptForm(selectedClient, date, items);
      if (!isValid) {
        return;
      }

      if (!companyDetails) {
        toast.error('Dane firmy nie zostały załadowane. Spróbuj ponownie.');
        return;
      }

      setPrintingAndContinuing(true);
      try {
        const localDate = new Date();

        const receiptData = {
          number: receiptNumber,
          date: localDate,
          clientId: selectedClient!.id,
          userID: user.uid,
          totalAmount,
          items: items.filter(item => item.productId !== ''),
        };

        let savedReceipt;

        if (isOffline) {
          const tempId = addOfflineReceipt(receiptData);

          if (!tempId) {
            toast.error('Nie udało się dodać kwitu offline.');
            return;
          }

          savedReceipt = {
            id: tempId,
            ...receiptData,
            date: localDate,
          };

          toast.success(
            'Kwit został dodany offline. Synchronizacja nastąpi po powrocie online.'
          );
        } else {
          // Check for duplicates
          const duplicateCheckQuery = query(
            collection(db, 'receipts'),
            where('userID', '==', user.uid),
            where('number', '==', receiptNumber)
          );

          const duplicateSnapshot = await getDocs(duplicateCheckQuery);

          if (!duplicateSnapshot.empty) {
            const newReceiptNumber = await generateReceiptNumber(date);
            setReceiptNumber(newReceiptNumber);
            receiptData.number = newReceiptNumber;
          }

          const docRef = await addDoc(collection(db, 'receipts'), {
            ...receiptData,
            date: Timestamp.fromDate(localDate),
          });

          savedReceipt = {
            id: docRef.id,
            ...receiptData,
            date: localDate,
          };
        }

        // Open PDF in new tab
        await viewPDF(savedReceipt, selectedClient!, companyDetails);

        // Reset form for new receipt
        await resetFormForNewReceipt();

        // Additional focus handling after PDF is opened
        // Listen for when the window regains focus and re-focus the client selector
        const handleWindowFocus = () => {
          setTimeout(() => {
            receiptFormHeaderRef.current?.focusClientSelector();
          }, 100);
          window.removeEventListener('focus', handleWindowFocus);
        };

        window.addEventListener('focus', handleWindowFocus);

        // Remove the listener after 5 seconds as a fallback
        setTimeout(() => {
          window.removeEventListener('focus', handleWindowFocus);
        }, 5000);
      } catch (error) {
        toast.error('Nie udało się zapisać kwitu. Spróbuj ponownie.');
      } finally {
        setPrintingAndContinuing(false);
      }
    },
    [
      user,
      validateReceiptForm,
      companyDetails,
      receiptNumber,
      selectedClient,
      totalAmount,
      items,
      generateReceiptNumber,
      date,
      viewPDF,
      resetFormForNewReceipt,
      isOffline,
      addOfflineReceipt,
      setShowValidationErrors,
      setPrintingAndContinuing,
      setReceiptNumber,
    ]
  );

  // Handle print functionality for editing mode
  const handlePrint = useCallback(async () => {
    if (!user || !isEditing) return;

    setShowValidationErrors(true);

    const { isValid } = validateReceiptForm(selectedClient, date, items);
    if (!isValid) {
      return;
    }

    if (!companyDetails) {
      toast.error('Dane firmy nie zostały załadowane. Spróbuj ponownie.');
      return;
    }

    setPrintingAndContinuing(true);
    try {
      const currentReceipt = {
        id: receiptId!,
        number: receiptNumber,
        date: new Date(date),
        clientId: selectedClient!.id,
        userID: user.uid,
        totalAmount,
        items: items.filter(item => item.productId !== ''),
      };

      await viewPDF(currentReceipt, selectedClient!, companyDetails);
    } catch (error) {
      toast.error('Nie udało się wygenerować PDF. Spróbuj ponownie.');
    } finally {
      setPrintingAndContinuing(false);
    }
  }, [
    user,
    isEditing,
    validateReceiptForm,
    companyDetails,
    receiptId,
    receiptNumber,
    date,
    selectedClient,
    totalAmount,
    items,
    viewPDF,
    setShowValidationErrors,
    setPrintingAndContinuing,
  ]);

  // Keyboard shortcut for print (Cmd/Ctrl + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();

        if (!saving && !printingAndContinuing) {
          if (isEditing) {
            handlePrint();
          } else {
            const syntheticEvent = {
              preventDefault: () => {},
            } as React.FormEvent;

            handlePrintAndContinue(syntheticEvent);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isEditing,
    saving,
    printingAndContinuing,
    handlePrintAndContinue,
    handlePrint,
  ]);

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
        <LoadingSpinner />
        <span className="ml-2">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {isEditing ? 'Edytuj Kwit' : 'Dodaj Nowy Kwit'}
        </h1>
        <button
          onClick={() => navigate('/receipts')}
          className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
        >
          Anuluj
        </button>
      </div>

      {/* Validation Summary */}
      {showValidationErrors &&
        (validationErrors.client ||
          validationErrors.items ||
          validationErrors.date) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Proszę poprawić następujące błędy:
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {validationErrors.client && (
                      <li>{validationErrors.client}</li>
                    )}
                    {validationErrors.date && <li>{validationErrors.date}</li>}
                    {validationErrors.items && (
                      <li>{validationErrors.items}</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

      <div className="space-y-6">
        <ReceiptFormHeader
          ref={receiptFormHeaderRef}
          receiptNumber={receiptNumber}
          date={date}
          selectedClient={selectedClient}
          validationErrors={validationErrors}
          showValidationErrors={showValidationErrors}
          isEditing={isEditing}
          onDateChange={handleDateChange}
          onClientSelect={handleClientSelect}
        />

        <ReceiptItemsList
          items={items}
          products={products}
          validationErrors={validationErrors}
          showValidationErrors={showValidationErrors}
          onProductSelect={handleProductSelect}
          onQuantityChange={handleQuantityChange}
          onBuyPriceChange={handleBuyPriceChange}
          onAddItem={addNewItem}
          onRemoveItem={removeItem}
        />

        <ReceiptSummary totalAmount={totalAmount} />

        <ReceiptFormActions
          isEditing={isEditing}
          saving={saving}
          printingAndContinuing={printingAndContinuing}
          onCancel={() => navigate('/receipts')}
          onPrint={handlePrint}
          onPrintAndContinue={handlePrintAndContinue}
          onSave={handleSave}
        />
      </div>
    </div>
  );
};

export default ReceiptFormContainer;
