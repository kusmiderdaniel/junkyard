import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  checkMigrationNeeded,
  migrateClientSearchFields,
} from '../utils/dataMigration';
// Encryption utility will be lazy loaded
import LoadingSpinner from './LoadingSpinner';

interface MigrationHandlerProps {
  children: React.ReactNode;
}

const MigrationHandler: React.FC<MigrationHandlerProps> = ({ children }) => {
  const { user } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState<
    'checking' | 'migrating' | 'completed' | 'error' | 'not-needed'
  >('checking');
  const [migrationResults, setMigrationResults] = useState<{
    updated: number;
    errors: string[];
  } | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);

  useEffect(() => {
    if (!user) {
      setMigrationStatus('completed');
      return;
    }

    const handleMigration = async () => {
      try {
        // Check if migration is needed
        const needsMigration = await checkMigrationNeeded(user.uid);

        if (!needsMigration) {
          setMigrationStatus('not-needed');
          return;
        }

        // Show dialog to user
        setShowMigrationDialog(true);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error checking migration status:', error);
        }
        setMigrationStatus('error');
      }
    };

    handleMigration();
  }, [user]);

  const runMigration = async () => {
    if (!user) return;

    setMigrationStatus('migrating');
    setShowMigrationDialog(false);

    try {
      const results = await migrateClientSearchFields(user.uid);
      setMigrationResults(results);
      setMigrationStatus('completed');

      if (results.errors.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('Migration completed with errors:', results.errors);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Migration failed:', error);
      }
      setMigrationStatus('error');
    }
  };

  const skipMigration = () => {
    setShowMigrationDialog(false);
    setMigrationStatus('completed');
  };

  useEffect(() => {
    const migrate = async () => {
      if (!user) return;

      const migrationKey = `migration_complete_${user.uid}`;
      const encryptionKey = `encryption_migration_complete_${user.uid}`;
      const hasMigrated = localStorage.getItem(migrationKey);
      const hasEncrypted = localStorage.getItem(encryptionKey);

      if (!hasMigrated) {
        setMigrating(true);
        try {
          await migrateClientSearchFields(user.uid);
          localStorage.setItem(migrationKey, 'true');
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Migration failed:', error);
          }
        }
      }

      // Run encryption migration
      if (!hasEncrypted) {
        try {
          // Lazy load encryption utility
          const { migrateUnencryptedData } = await import(
            '../utils/encryption'
          );
          await migrateUnencryptedData(user.uid);
          localStorage.setItem(encryptionKey, 'true');
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Encryption migration failed:', error);
          }
        }
      }

      setMigrating(false);
      setMigrationComplete(true);
    };

    migrate();
  }, [user]);

  // Show migration dialog
  if (showMigrationDialog) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Ulepszenie Wyszukiwania
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              Wykryliśmy, że Twoje dane klientów mogą zostać zoptymalizowane dla
              lepszego wyszukiwania z polskimi znakami. Czy chcesz przeprowadzić
              automatyczną aktualizację? Proces zajmie tylko chwilę.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={runMigration}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tak, ulepsz wyszukiwanie
              </button>
              <button
                onClick={skipMigration}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Pomiń
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show migration progress
  if (migrationStatus === 'migrating') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="animate-spin w-6 h-6 text-blue-600"
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
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Optymalizowanie danych...
            </h3>
            <p className="text-gray-600">
              Proszę czekać, trwa ulepszanie wyszukiwania.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show migration success
  if (
    migrationStatus === 'completed' &&
    migrationResults &&
    migrationResults.updated > 0
  ) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-green-600"
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
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Wyszukiwanie zostało ulepszone!
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              Zaktualizowano {migrationResults.updated} rekordów klientów.
              Wyszukiwanie z polskimi znakami będzie teraz działać szybciej i
              dokładniej.
            </p>

            {migrationResults.errors.length > 0 && (
              <p className="text-sm text-orange-600 mb-4">
                Uwaga: {migrationResults.errors.length} rekordów nie zostało
                zaktualizowanych, ale nie wpłynie to na działanie aplikacji.
              </p>
            )}

            <button
              onClick={() => setMigrationStatus('completed')}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Kontynuuj
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (migrationStatus === 'error') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-red-600"
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
                Błąd podczas optymalizacji
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              Nie udało się przeprowadzić optymalizacji wyszukiwania. Aplikacja
              będzie działać normalnie, ale wyszukiwanie może być nieco
              wolniejsze.
            </p>

            <button
              onClick={() => setMigrationStatus('completed')}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Kontynuuj
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (migrating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Migracja danych...</p>
        </div>
      </div>
    );
  }

  if (!migrationComplete && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Render children when migration is complete or not needed
  return <>{children}</>;
};

export default MigrationHandler;
