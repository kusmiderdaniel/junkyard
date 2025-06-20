import React, { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';

interface PasswordChangeFormProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ onSuccess, onError }) => {
  const { user } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handlePasswordChange = (field: keyof typeof passwordData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear messages when user starts typing
    if (passwordError) {
      setPasswordError(null);
    }
    if (passwordSuccess) {
      setPasswordSuccess(null);
    }
  };

  const validatePasswordForm = (): boolean => {
    if (!passwordData.currentPassword) {
      setPasswordError('Obecne hasło jest wymagane');
      return false;
    }
    if (!passwordData.newPassword) {
      setPasswordError('Nowe hasło jest wymagane');
      return false;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Nowe hasło musi mieć co najmniej 6 znaków');
      return false;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Hasła nie są identyczne');
      return false;
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('Nowe hasło musi być różne od obecnego');
      return false;
    }
    return true;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) {
      const errorMessage = 'Użytkownik nie uwierzytelniony';
      setPasswordError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    if (!validatePasswordForm()) return;

    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      // Reauthenticate the user with current password
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, passwordData.newPassword);
      
      const successMessage = 'Hasło zostało zmienione pomyślnie!';
      setPasswordSuccess(successMessage);
      onSuccess?.(successMessage);
      
      // Reset form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      let errorMessage = 'Nie udało się zmienić hasła. Spróbuj ponownie.';
      
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'Obecne hasło jest nieprawidłowe';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Nowe hasło jest zbyt słabe';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'Wymagane jest ponowne zalogowanie';
      }
      
      setPasswordError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Zmiana Hasła</h2>
        <p className="text-gray-600 mt-1">Zaktualizuj swoje hasło dostępu</p>
      </div>

      {passwordError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-md">
          <p className="text-red-700">{passwordError}</p>
        </div>
      )}

      {passwordSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-md">
          <p className="text-green-700">{passwordSuccess}</p>
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Obecne Hasło *
          </label>
          <input
            type="password"
            value={passwordData.currentPassword}
            onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nowe Hasło *
          </label>
          <input
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
            minLength={6}
            autoComplete="new-password"
          />
          <p className="text-sm text-gray-500 mt-1">Hasło musi mieć co najmniej 6 znaków</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Potwierdź Nowe Hasło *
          </label>
          <input
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={changingPassword}
            className="w-full md:w-auto px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {changingPassword ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Zmienianie hasła...
              </>
            ) : (
              'Zmień Hasło'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordChangeForm; 