import React, { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Client,
  Receipt,
  CompanyDetails,
  Product,
  Category,
} from '../types/receipt';

const OfflineDataHandler: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();

  // Function to cache all user data when online
  const cacheUserData = useCallback(async () => {
    if (!user || !isOnline) return;

    try {
      // Cache clients
      const clientsQuery = query(
        collection(db, 'clients'),
        where('userID', '==', user.uid)
      );
      const clientsSnapshot = await getDocs(clientsQuery);
      const clients = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];
      offlineStorage.cacheClients(clients);

      // Cache recent receipts (last 100)
      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid)
      );
      const receiptsSnapshot = await getDocs(receiptsQuery);
      const receipts = receiptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];
      offlineStorage.cacheReceipts(receipts);

      // Cache company details
      const companyDocRef = doc(db, 'companyDetails', user.uid);
      const companyDoc = await getDoc(companyDocRef);
      if (companyDoc.exists()) {
        const companyDetails = companyDoc.data() as CompanyDetails;
        offlineStorage.cacheCompanyDetails(companyDetails);
      }

      // Cache products
      const productsQuery = query(
        collection(db, 'products'),
        where('userID', '==', user.uid)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      offlineStorage.cacheProducts(products);

      // Cache categories
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('userID', '==', user.uid)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categories = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
      })) as Category[];
      offlineStorage.cacheCategories(categories);

      console.log(
        '✅ User data cached successfully for offline use (clients, receipts, company details, products, categories)'
      );
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to cache user data:', error);
      }
    }
  }, [user, isOnline]);

  // Cache data when user comes online
  useEffect(() => {
    if (user && isOnline) {
      // Add a small delay to avoid caching immediately on app load
      const timeoutId = setTimeout(cacheUserData, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [user, isOnline, cacheUserData]);

  return null; // This component doesn't render anything
};

export default OfflineDataHandler;
