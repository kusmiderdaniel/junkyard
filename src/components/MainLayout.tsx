import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUsers,
  FaBox,
  FaFileInvoice,
  FaChartBar,
  FaCog,
  FaPlus,
} from 'react-icons/fa';
import { IconType } from 'react-icons';
import { useAuth } from '../contexts/AuthContext';
import OfflineIndicator from './OfflineIndicator';
import OfflineDataHandler from './OfflineDataHandler';
import SyncIndicator from './SyncIndicator';
import ErrorBoundary from './ErrorBoundary';

const NavItem = ({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: IconType;
  label: string;
}) => {
  const commonClasses =
    'flex items-center justify-center p-4 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors duration-200 group relative';
  const activeClasses = 'bg-gray-600 text-white shadow-md';

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${commonClasses} ${isActive ? activeClasses : ''}`
      }
    >
      {Icon && Icon({ className: 'h-6 w-6' })}
      <span
        className="absolute left-full ml-4 px-2 py-1 text-sm text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {label}
      </span>
    </NavLink>
  );
};

const MainLayout: React.FC = () => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Error is already handled in AuthContext
      // No need to log again here
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <ErrorBoundary context="Offline Indicators" showReload={false}>
        <OfflineIndicator />
        <OfflineDataHandler />
        <SyncIndicator />
      </ErrorBoundary>

      <ErrorBoundary context="Navigation Sidebar">
        <div
          className="w-20 shadow-md transition-all duration-300 flex flex-col"
          style={{ backgroundColor: '#2D2D2D' }}
        >
          <div className="p-4 flex justify-center">
            <img
              src={`${process.env.PUBLIC_URL}/icon-192x192.png`}
              alt="ScrapYard Logo"
              className="h-12 w-12 object-contain rounded-lg shadow-sm"
            />
          </div>

          {/* Add Receipt Shortcut Button */}
          <div className="px-3 mb-6">
            <NavLink
              to="/add-receipt"
              className="w-14 h-14 bg-orange-700 hover:bg-orange-800 text-white rounded-lg flex items-center justify-center transition-colors duration-200 group relative shadow-lg"
              aria-label="Add New Receipt"
            >
              {FaPlus({ className: 'h-6 w-6' })}
              <span
                className="absolute left-full ml-4 px-2 py-1 text-sm text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50"
                style={{ backgroundColor: '#2D2D2D' }}
              >
                Dodaj Kwit
              </span>
            </NavLink>
          </div>

          <nav className="mt-2 flex flex-col items-center flex-1">
            <NavItem to="/dashboard" icon={FaTachometerAlt} label="Dashboard" />
            <NavItem to="/clients" icon={FaUsers} label="Klienci" />
            <NavItem to="/products" icon={FaBox} label="Produkty" />
            <NavItem to="/receipts" icon={FaFileInvoice} label="Kwity" />
            <NavItem to="/statistics" icon={FaChartBar} label="Statystyki" />
            <NavItem to="/settings" icon={FaCog} label="Ustawienia" />

            {/* Logout button at the bottom */}
            <div className="mt-auto mb-4">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center p-4 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors duration-200 group relative rounded-md"
                aria-label="Logout"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3l-3 3"
                  />
                </svg>
                <span
                  className="absolute left-full ml-4 px-2 py-1 text-sm text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50"
                  style={{ backgroundColor: '#2D2D2D' }}
                >
                  Wyloguj
                </span>
              </button>
            </div>
          </nav>
        </div>
      </ErrorBoundary>

      <ErrorBoundary context="Main Content Area">
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </ErrorBoundary>
    </div>
  );
};

export default MainLayout;
