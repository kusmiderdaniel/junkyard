import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { normalizePolishText, createSearchableText } from '../utils/textUtils';
import {
  sanitizeClientData,
  createSanitizedInputHandler,
  validateInputSafety,
} from '../utils/inputSanitizer';
import { useRateLimitedOperations } from '../utils/rateLimitedFirebase';
import toast from 'react-hot-toast';

type Client = {
  name: string;
  address: string;
  documentNumber: string;
  postalCode: string;
  city: string;
  fullAddress: string;
};

type AddClientModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: (client?: Client) => void;
  initialData?: Client;
};

const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onClientAdded,
  initialData,
}) => {
  const { user } = useAuth();
  const { isOffline } = useOfflineStatus();
  const { addOfflineClient } = useOfflineSync();
  const rateLimitedOps = useRateLimitedOperations(
    () => user?.uid || 'anonymous'
  );
  const [name, setName] = useState(initialData?.name || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [documentNumber, setDocumentNumber] = useState(
    initialData?.documentNumber || ''
  );
  const [postalCode, setPostalCode] = useState(initialData?.postalCode || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Create sanitized input handlers
  const handleNameChange = createSanitizedInputHandler(setName, {
    maxLength: 200,
  });
  const handleAddressChange = createSanitizedInputHandler(setAddress, {
    maxLength: 500,
  });
  const handleDocumentNumberChange = createSanitizedInputHandler(
    setDocumentNumber,
    {
      maxLength: 50,
      preserveWhitespace: false,
    }
  );
  const handlePostalCodeChange = createSanitizedInputHandler(setPostalCode, {
    maxLength: 20,
    preserveWhitespace: false,
  });
  const handleCityChange = createSanitizedInputHandler(setCity, {
    maxLength: 100,
  });

  useEffect(() => {
    if (initialData) {
      // Sanitize initial data when setting state
      setName(
        sanitizeClientData({ ...initialData, name: initialData.name }).name
      );
      setAddress(
        sanitizeClientData({ ...initialData, address: initialData.address })
          .address
      );
      setDocumentNumber(
        sanitizeClientData({
          ...initialData,
          documentNumber: initialData.documentNumber,
        }).documentNumber
      );
      setPostalCode(
        sanitizeClientData({
          ...initialData,
          postalCode: initialData.postalCode,
        }).postalCode
      );
      setCity(
        sanitizeClientData({ ...initialData, city: initialData.city }).city
      );
    } else {
      setName('');
      setAddress('');
      setDocumentNumber('');
      setPostalCode('');
      setCity('');
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input safety before processing
    const inputs = [name, address, documentNumber, postalCode, city];
    const unsafeInputs = inputs.filter(
      input => input && !validateInputSafety(input)
    );

    if (unsafeInputs.length > 0) {
      setError(
        'Wykryto potencjalnie niebezpieczne dane wejściowe. Proszę sprawdzić wprowadzone informacje.'
      );
      return;
    }

    if (!name.trim()) {
      setError('Pole nazwiska i imienia jest wymagane.');
      return;
    }
    if (!user) {
      setError('Użytkownik nie jest uwierzytelniony.');
      return;
    }

    // Check rate limits for client creation (only for new clients)
    if (!initialData) {
      const clientLimit = rateLimitedOps.checkClientCreate();
      if (!clientLimit.allowed) {
        setError(
          clientLimit.message ||
            'Zbyt wiele tworzonych klientów. Spróbuj ponownie później.'
        );
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // Sanitize all client data before processing
      const rawClientData = {
        name: name.trim(),
        address: address.trim(),
        documentNumber: documentNumber.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        fullAddress: '', // Will be calculated below
      };

      const sanitizedData = sanitizeClientData(rawClientData);

      // Create fullAddress field with sanitized data
      const addressParts = [];
      if (sanitizedData.address) addressParts.push(sanitizedData.address);
      if (sanitizedData.postalCode || sanitizedData.city) {
        const locationPart = [sanitizedData.postalCode, sanitizedData.city]
          .filter(Boolean)
          .join(' ');
        if (locationPart) addressParts.push(locationPart);
      }
      const fullAddress = addressParts.join(', ');

      const clientData = {
        ...sanitizedData,
        fullAddress: fullAddress,
      };

      if (initialData) {
        // Edit mode - call with client data (editing not supported offline)
        if (isOffline) {
          setError('Edytowanie klientów nie jest dostępne w trybie offline.');
          return;
        }
        onClientAdded(clientData);
      } else {
        // Add mode - create new client
        if (isOffline) {
          // Add to offline queue
          const tempId = await addOfflineClient({
            ...clientData,
            name_lowercase: clientData.name.toLowerCase(),
            name_normalized: normalizePolishText(clientData.name),
            address_normalized: normalizePolishText(clientData.address),
            documentNumber_normalized: normalizePolishText(
              clientData.documentNumber
            ),
            postalCode_normalized: normalizePolishText(clientData.postalCode),
            city_normalized: normalizePolishText(clientData.city),
            fullAddress_normalized: normalizePolishText(fullAddress),
            searchableText: createSearchableText([
              clientData.name,
              clientData.address,
              clientData.documentNumber,
              clientData.postalCode,
              clientData.city,
              fullAddress,
            ]),
          });

          if (tempId) {
            toast.success(
              'Klient został dodany offline. Synchronizacja nastąpi po powrocie online.'
            );
            onClientAdded();
          } else {
            setError('Nie udało się dodać klienta offline.');
            return;
          }
        } else {
          // Online mode - create directly in Firebase
          await addDoc(collection(db, 'clients'), {
            ...clientData,
            name_lowercase: clientData.name.toLowerCase(),
            name_normalized: normalizePolishText(clientData.name),
            address_normalized: normalizePolishText(clientData.address),
            documentNumber_normalized: normalizePolishText(
              clientData.documentNumber
            ),
            postalCode_normalized: normalizePolishText(clientData.postalCode),
            city_normalized: normalizePolishText(clientData.city),
            fullAddress_normalized: normalizePolishText(fullAddress),
            searchableText: createSearchableText([
              clientData.name,
              clientData.address,
              clientData.documentNumber,
              clientData.postalCode,
              clientData.city,
              fullAddress,
            ]),
            userID: user.uid,
          });
          onClientAdded();
        }
      }

      onClose();
      // Reset form
      setName('');
      setAddress('');
      setDocumentNumber('');
      setPostalCode('');
      setCity('');
    } catch (err) {
      setError(
        `Nie udało się ${initialData ? 'zaktualizować' : 'dodać'} klienta. Proszę spróbować ponownie.`
      );
      // Error already displayed to user via setError
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseAttempt();
    }
  };

  const handleCloseAttempt = () => {
    // Check if any data has changed from initial values
    const initialName = initialData?.name || '';
    const initialAddress = initialData?.address || '';
    const initialDocumentNumber = initialData?.documentNumber || '';
    const initialPostalCode = initialData?.postalCode || '';
    const initialCity = initialData?.city || '';

    const hasChanges =
      name.trim() !== initialName.trim() ||
      address.trim() !== initialAddress.trim() ||
      documentNumber.trim() !== initialDocumentNumber.trim() ||
      postalCode.trim() !== initialPostalCode.trim() ||
      city.trim() !== initialCity.trim();

    if (hasChanges) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-orange-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {initialData ? 'Edytuj Klienta' : 'Dodaj Nowego Klienta'}
            </h3>
          </div>
          <button
            onClick={handleCloseAttempt}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nazwisko i Imię <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź nazwisko i imię klienta"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Document Number Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Numer Dokumentu
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź numer dokumentu"
                  value={documentNumber}
                  onChange={handleDocumentNumberChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Address Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Adres
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź adres klienta"
                  value={address}
                  onChange={handleAddressChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Postal Code Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Kod Pocztowy
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź kod pocztowy"
                  value={postalCode}
                  onChange={handlePostalCodeChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* City Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Miasto
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź miasto"
                  value={city}
                  onChange={handleCityChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-red-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-between space-x-3 p-6 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleCloseAttempt}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
            disabled={loading}
          >
            Anuluj
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-2.5 bg-orange-700 text-white text-sm font-medium rounded-lg hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 disabled:bg-orange-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>
                  {initialData ? 'Aktualizowanie...' : 'Dodawanie...'}
                </span>
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>
                  {initialData ? 'Aktualizuj Klienta' : 'Dodaj Klienta'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm transform transition-all duration-200 scale-100">
            {/* Confirmation Header */}
            <div className="flex items-center space-x-3 p-6 border-b border-gray-200">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Niezapisane Zmiany
              </h3>
            </div>

            {/* Confirmation Body */}
            <div className="p-6">
              <p className="text-gray-600 text-sm leading-relaxed">
                Masz niezapisane zmiany które zostaną utracone. Czy na pewno
                chcesz zamknąć bez zapisywania informacji o kliencie?
              </p>
            </div>

            {/* Confirmation Footer */}
            <div className="flex justify-between space-x-3 p-6 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={handleCancelClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
              >
                Kontynuuj Edycję
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-2"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>Odrzuć Zmiany</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddClientModal;
