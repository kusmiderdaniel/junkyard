import React, { Suspense, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import Login from './components/Login';
import MigrationHandler from './components/MigrationHandler';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import {
  preloadCriticalChunks,
  logBundleMetrics,
  optimizeResourceLoading,
} from './utils/bundleOptimizations';

// Lazy load pages for better performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const AddReceipt = React.lazy(() => import('./pages/AddReceipt'));
const Receipts = React.lazy(() => import('./pages/Receipts'));
const Clients = React.lazy(() => import('./pages/Clients'));
const ClientDetail = React.lazy(() => import('./pages/ClientDetail'));
const Products = React.lazy(() => import('./pages/Products'));
const Statistics = React.lazy(() => import('./pages/Statistics'));
const Settings = React.lazy(() => import('./pages/Settings'));
const OfflineData = React.lazy(() => import('./pages/OfflineData'));

function App() {
  // Initialize bundle optimizations
  useEffect(() => {
    // Optimize resource loading
    optimizeResourceLoading();

    // Preload critical chunks when browser is idle
    preloadCriticalChunks();

    // Log performance metrics in development
    logBundleMetrics();
  }, []);

  return (
    <ErrorBoundary context="Application Root">
      <AuthProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                <ErrorBoundary context="Authentication">
                  <Login />
                </ErrorBoundary>
              }
            />
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <ErrorBoundary context="Main Application">
                    <MigrationHandler>
                      <MainLayout />
                    </MigrationHandler>
                  </ErrorBoundary>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route
                  path="/dashboard"
                  element={
                    <ErrorBoundary context="Dashboard">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Dashboard />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/add-receipt"
                  element={
                    <ErrorBoundary context="Add Receipt">
                      <Suspense fallback={<LoadingSpinner />}>
                        <AddReceipt />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/edit-receipt/:id"
                  element={
                    <ErrorBoundary context="Edit Receipt">
                      <Suspense fallback={<LoadingSpinner />}>
                        <AddReceipt />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/receipts"
                  element={
                    <ErrorBoundary context="Receipts List">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Receipts />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ErrorBoundary context="Clients List">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Clients />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/clients/:clientId"
                  element={
                    <ErrorBoundary context="Client Detail">
                      <Suspense fallback={<LoadingSpinner />}>
                        <ClientDetail />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ErrorBoundary context="Products">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Products />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/statistics"
                  element={
                    <ErrorBoundary context="Statistics">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Statistics />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ErrorBoundary context="Settings">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Settings />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/offline-data"
                  element={
                    <ErrorBoundary context="Offline Data">
                      <Suspense fallback={<LoadingSpinner />}>
                        <OfflineData />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              style: {
                background: '#10b981',
              },
            },
            error: {
              duration: 5000,
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
