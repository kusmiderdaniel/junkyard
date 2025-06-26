import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  sanitizeCompanyData,
  createSanitizedInputHandler,
  validateInputSafety,
} from '../../utils/inputSanitizer';
import { logger } from '../../utils/logger';

interface CompanyDetails {
  companyName: string;
  numberNIP: string;
  numberREGON: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phoneNumber: string;
}

interface CompanyDetailsFormProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const CompanyDetailsForm: React.FC<CompanyDetailsFormProps> = ({
  onSuccess,
  onError,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [companyDetails, setCompanyDetails] = useState<CompanyDetails>({
    companyName: '',
    numberNIP: '',
    numberREGON: '',
    address: '',
    postalCode: '',
    city: '',
    email: '',
    phoneNumber: '',
  });

  // Create sanitized input handlers
  const handleCompanyNameChange = createSanitizedInputHandler(
    value => handleInputChange('companyName', value),
    { maxLength: 200 }
  );
  const handleNIPChange = createSanitizedInputHandler(
    value => handleInputChange('numberNIP', value),
    { maxLength: 20, preserveWhitespace: false }
  );
  const handleREGONChange = createSanitizedInputHandler(
    value => handleInputChange('numberREGON', value),
    { maxLength: 20, preserveWhitespace: false }
  );
  const handleAddressChange = createSanitizedInputHandler(
    value => handleInputChange('address', value),
    { maxLength: 500 }
  );
  const handlePostalCodeChange = createSanitizedInputHandler(
    value => handleInputChange('postalCode', value),
    { maxLength: 20, preserveWhitespace: false }
  );
  const handleCityChange = createSanitizedInputHandler(
    value => handleInputChange('city', value),
    { maxLength: 100 }
  );
  const handleEmailChange = createSanitizedInputHandler(
    value => handleInputChange('email', value),
    { maxLength: 200, preserveWhitespace: false }
  );
  const handlePhoneChange = createSanitizedInputHandler(
    value => handleInputChange('phoneNumber', value),
    { maxLength: 50, preserveWhitespace: false }
  );

  // Load existing company details on mount
  useEffect(() => {
    const loadCompanyDetails = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const docRef = doc(db, 'companyDetails', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as CompanyDetails;
          // Sanitize data when loading from database
          const sanitizedData = sanitizeCompanyData(data);
          setCompanyDetails(sanitizedData);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('Error loading company details', err, {
            component: 'CompanyDetailsForm',
            operation: 'fetchCompanyDetails',
            userId: user?.uid,
          });
        }
        const errorMessage = 'Nie udało się załadować danych firmy';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadCompanyDetails();
  }, [user, onError]); // Include user and onError in dependencies

  const handleInputChange = (field: keyof CompanyDetails, value: string) => {
    setCompanyDetails(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear messages when user starts typing
    if (error) {
      setError(null);
    }
    if (success) {
      setSuccess(null);
    }
  };

  const validateForm = (): boolean => {
    // Validate input safety before processing
    const inputs = Object.values(companyDetails);
    const unsafeInputs = inputs.filter(
      input => input && !validateInputSafety(input)
    );

    if (unsafeInputs.length > 0) {
      setError(
        'Wykryto potencjalnie niebezpieczne dane wejściowe. Proszę sprawdzić wprowadzone informacje.'
      );
      return false;
    }

    if (!companyDetails.companyName.trim()) {
      setError('Nazwa firmy jest wymagana');
      return false;
    }
    if (!companyDetails.numberNIP.trim()) {
      setError('Numer NIP jest wymagany');
      return false;
    }
    if (!companyDetails.numberREGON.trim()) {
      setError('Numer REGON jest wymagany');
      return false;
    }
    if (!companyDetails.address.trim()) {
      setError('Adres jest wymagany');
      return false;
    }
    if (!companyDetails.postalCode.trim()) {
      setError('Kod pocztowy jest wymagany');
      return false;
    }
    if (!companyDetails.city.trim()) {
      setError('Miasto jest wymagane');
      return false;
    }
    if (!companyDetails.email.trim()) {
      setError('Email jest wymagany');
      return false;
    }
    if (!companyDetails.phoneNumber.trim()) {
      setError('Numer telefonu jest wymagany');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyDetails.email)) {
      setError('Wprowadź prawidłowy adres email');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      const errorMessage = 'Użytkownik nie uwierzytelniony';
      setError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    if (!validateForm()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Sanitize all data before saving
      const sanitizedData = sanitizeCompanyData(companyDetails);

      const docRef = doc(db, 'companyDetails', user.uid);
      await setDoc(docRef, {
        ...sanitizedData,
        userID: user.uid,
      });
      const successMessage = 'Dane firmy zapisane pomyślnie!';
      setSuccess(successMessage);
      onSuccess?.(successMessage);
    } catch (err) {
      const errorMessage =
        'Nie udało się zapisać danych firmy. Spróbuj ponownie.';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
        <span className="ml-2">Ładowanie danych firmy...</span>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Dane Firmy</h2>
        <p className="text-gray-600 mt-1">
          Zarządzaj informacjami o swojej firmie
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-md">
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nazwa Firmy *
            </label>
            <input
              type="text"
              value={companyDetails.companyName}
              onChange={handleCompanyNameChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIP *
            </label>
            <input
              type="text"
              value={companyDetails.numberNIP}
              onChange={handleNIPChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              REGON *
            </label>
            <input
              type="text"
              value={companyDetails.numberREGON}
              onChange={handleREGONChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adres *
            </label>
            <input
              type="text"
              value={companyDetails.address}
              onChange={handleAddressChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kod Pocztowy *
            </label>
            <input
              type="text"
              value={companyDetails.postalCode}
              onChange={handlePostalCodeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Miasto *
            </label>
            <input
              type="text"
              value={companyDetails.city}
              onChange={handleCityChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={companyDetails.email}
              onChange={handleEmailChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numer Telefonu *
            </label>
            <input
              type="tel"
              value={companyDetails.phoneNumber}
              onChange={handlePhoneChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto px-6 py-2 bg-orange-700 text-white rounded-md hover:bg-orange-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Zapisywanie...
              </>
            ) : (
              'Zapisz Dane Firmy'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyDetailsForm;
