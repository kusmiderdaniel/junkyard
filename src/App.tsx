import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import Login from './components/Login';
import MigrationHandler from './components/MigrationHandler';
import LoadingSpinner from './components/LoadingSpinner';

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
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={
              <MigrationHandler>
                <MainLayout />
              </MigrationHandler>
            }>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Dashboard />
                </Suspense>
              } />
              <Route path="/add-receipt" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <AddReceipt />
                </Suspense>
              } />
              <Route path="/edit-receipt/:id" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <AddReceipt />
                </Suspense>
              } />
              <Route path="/receipts" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Receipts />
                </Suspense>
              } />
              <Route path="/clients" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Clients />
                </Suspense>
              } />
              <Route path="/clients/:clientId" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <ClientDetail />
                </Suspense>
              } />
              <Route path="/products" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Products />
                </Suspense>
              } />
              <Route path="/statistics" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Statistics />
                </Suspense>
              } />
              <Route path="/settings" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Settings />
                </Suspense>
              } />
              <Route path="/offline-data" element={
                <Suspense fallback={<LoadingSpinner />}>
                  <OfflineData />
                </Suspense>
              } />
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
  );
}

export default App;
