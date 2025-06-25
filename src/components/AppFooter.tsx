import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const APP_VERSION = '2.25062025h';

const AppFooter: React.FC = () => {
  const { user } = useAuth();

  return (
    <footer className="fixed bottom-0 right-0 left-20 bg-gray-50 border-t border-gray-200 px-4 py-2 z-10">
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          {user && (
            <span>
              Zalogowany: <span className="font-medium">{user.email}</span>
            </span>
          )}
        </div>
        <div>
          Wersja: <span className="font-medium">{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
