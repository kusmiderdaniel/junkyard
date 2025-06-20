import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { offlineStorage } from '../utils/offlineStorage';
import { Product, Category } from '../types/receipt';
import CategoryModal from '../components/products/CategoryModal';
import ProductModal from '../components/products/ProductModal';
import ProductsTable from '../components/products/ProductsTable';

interface NewCategory {
  name: string;
}

const Products: React.FC = () => {
  const { user } = useAuth();
  const { isOffline } = useOfflineStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceEdits, setPriceEdits] = useState<{
    [key: string]: {
      buy_price?: { value: string };
      sell_price?: { value: string };
    };
  }>({});
  const [updating, setUpdating] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newCategory, setNewCategory] = useState<NewCategory>({ name: '' });
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    name: '',
    itemCode: '',
    categoryId: '',
    buy_price: 0,
    sell_price: 0,
    weightAdjustment: 1,
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // If offline, use cached data
      if (isOffline) {
        const cachedCategories = offlineStorage.getCachedCategories();
        const cachedProducts = offlineStorage.getCachedProducts();

        setCategories(cachedCategories);
        setProducts(cachedProducts);
        return;
      }

      // Online mode - fetch from Firebase
      // Fetch categories for current user
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('userID', '==', user.uid)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
      })) as Category[];

      // Cache categories for offline use
      offlineStorage.cacheCategories(categoriesData);
      setCategories(categoriesData);

      // Fetch products for current user
      const productsQuery = query(
        collection(db, 'products'),
        where('userID', '==', user.uid)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];

      // Cache products for offline use
      offlineStorage.cacheProducts(productsData);
      setProducts(productsData);
    } catch (error) {
      // If online fetch fails, try to use cached data as fallback
      if (!isOffline) {
        console.warn(
          'Online products/categories fetch failed, trying cached data:',
          error
        );
        const cachedCategories = offlineStorage.getCachedCategories();
        const cachedProducts = offlineStorage.getCachedProducts();

        if (cachedCategories.length > 0 || cachedProducts.length > 0) {
          setCategories(cachedCategories);
          setProducts(cachedProducts);
          toast.error(
            'Błąd połączenia z serwerem. Wyświetlane są dane z cache.'
          );
        } else {
          setCategories([]);
          setProducts([]);
        }
      } else {
        setCategories([]);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isOffline]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePriceChange = (
    productId: string,
    field: 'buy_price' | 'sell_price',
    value: string
  ) => {
    setPriceEdits(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: { value },
      },
    }));
  };

  const handlePriceBlur = async (
    productId: string,
    field: 'buy_price' | 'sell_price'
  ) => {
    if (isOffline) {
      toast.error('Nie można edytować cen w trybie offline.');
      // Reset the edit to the original value
      setPriceEdits(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          [field]: undefined,
        },
      }));
      return;
    }

    const edit = priceEdits[productId]?.[field];
    if (!edit || !edit.value) return;

    const newValue = parseFloat(edit.value);
    if (isNaN(newValue)) return;

    setUpdating(prev => [...prev, productId]);

    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, { [field]: newValue });

      setProducts(prev =>
        prev.map(product =>
          product.id === productId ? { ...product, [field]: newValue } : product
        )
      );

      setPriceEdits(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          [field]: undefined,
        },
      }));
    } catch (error) {
      toast.error('Błąd podczas aktualizacji ceny. Spróbuj ponownie.');
    } finally {
      setUpdating(prev => prev.filter(id => id !== productId));
    }
  };

  const handleDeleteCategory = async (
    categoryId: string,
    categoryName: string
  ) => {
    if (isOffline) {
      toast.error('Nie można usuwać kategorii w trybie offline.');
      return;
    }

    // Check if any products use this category
    const productsUsingCategory = products.filter(
      product => product.categoryId === categoryId
    );

    if (productsUsingCategory.length > 0) {
      toast.error(
        `Nie można usunąć kategorii "${categoryName}" ponieważ jest używana przez ${productsUsingCategory.length} produktów. Usuń najpierw produkty lub zmień ich kategorię.`
      );
      return;
    }

    if (
      !window.confirm(`Czy na pewno chcesz usunąć kategorię "${categoryName}"?`)
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      await fetchData();
    } catch (error) {
      toast.error('Błąd podczas usuwania kategorii. Spróbuj ponownie.');
    }
  };

  const handleEditCategory = (category: Category) => {
    if (isOffline) {
      toast.error('Nie można edytować kategorii w trybie offline.');
      return;
    }

    setEditingCategory(category);
    setNewCategory({ name: category.name });
    setShowCategoryModal(true);
  };

  const handleAddCategory = async (category: NewCategory) => {
    if (!user) return;

    if (isOffline) {
      toast.error('Nie można dodawać/edytować kategorii w trybie offline.');
      setShowCategoryModal(false);
      setNewCategory({ name: '' });
      setEditingCategory(null);
      return;
    }

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          name: category.name,
        });
      } else {
        await addDoc(collection(db, 'categories'), {
          name: category.name,
          userID: user.uid,
        });
      }
      setShowCategoryModal(false);
      setNewCategory({ name: '' });
      setEditingCategory(null);
      await fetchData();
      toast.success(
        editingCategory
          ? 'Kategoria została zaktualizowana.'
          : 'Kategoria została dodana.'
      );
    } catch (error) {
      toast.error('Błąd podczas zarządzania kategorią. Spróbuj ponownie.');
    }
  };

  const handleAddProduct = async (product: Omit<Product, 'id'>) => {
    if (!user) return;

    if (isOffline) {
      toast.error('Nie można dodawać/edytować produktów w trybie offline.');
      setShowProductModal(false);
      setNewProduct({
        name: '',
        itemCode: '',
        categoryId: '',
        buy_price: 0,
        sell_price: 0,
        weightAdjustment: 1,
      });
      setEditingProduct(null);
      return;
    }

    try {
      if (editingProduct) {
        // Update existing product
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...product,
          userID: user.uid,
        });
      } else {
        // Add new product
        await addDoc(collection(db, 'products'), {
          ...product,
          userID: user.uid,
        });
      }
      setShowProductModal(false);
      setNewProduct({
        name: '',
        itemCode: '',
        categoryId: '',
        buy_price: 0,
        sell_price: 0,
        weightAdjustment: 1,
      });
      setEditingProduct(null);
      await fetchData();
      toast.success(
        editingProduct
          ? 'Produkt został zaktualizowany.'
          : 'Produkt został dodany.'
      );
    } catch (error) {
      toast.error('Błąd podczas zarządzania produktem. Spróbuj ponownie.');
    }
  };

  const handleDeleteProduct = async () => {
    if (!editingProduct) return;

    if (isOffline) {
      toast.error('Nie można usuwać produktów w trybie offline.');
      setShowProductModal(false);
      setNewProduct({
        name: '',
        itemCode: '',
        categoryId: '',
        buy_price: 0,
        sell_price: 0,
        weightAdjustment: 1,
      });
      setEditingProduct(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', editingProduct.id));
      setShowProductModal(false);
      setNewProduct({
        name: '',
        itemCode: '',
        categoryId: '',
        buy_price: 0,
        sell_price: 0,
        weightAdjustment: 1,
      });
      setEditingProduct(null);
      await fetchData();
      toast.success('Produkt został usunięty.');
    } catch (error) {
      toast.error('Błąd podczas usuwania produktu. Spróbuj ponownie.');
    }
  };

  const handleEditProduct = (product: Product) => {
    if (isOffline) {
      toast.error('Nie można edytować produktów w trybie offline.');
      return;
    }

    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      itemCode: product.itemCode,
      categoryId: product.categoryId,
      buy_price: product.buy_price,
      sell_price: product.sell_price,
      weightAdjustment: product.weightAdjustment,
    });
    setShowProductModal(true);
  };

  // Convert priceEdits format for ProductsTable
  const convertedPriceEdits = Object.entries(priceEdits).reduce<{
    [key: string]: string;
  }>((acc, [productId, edits]) => {
    if (edits.buy_price?.value) {
      acc[`${productId}-buy_price`] = edits.buy_price.value;
    }
    if (edits.sell_price?.value) {
      acc[`${productId}-sell_price`] = edits.sell_price.value;
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">Produkty</h1>
      <p className="mt-4 text-gray-600">
        Zarządzaj produktami i kategoriami tutaj.
      </p>

      <div className="mt-6 flex justify-between items-center">
        <div></div>
        <div className="space-x-4">
          <button
            onClick={() => {
              if (isOffline) {
                toast.error('Nie można dodawać kategorii w trybie offline.');
                return;
              }
              setEditingCategory(null);
              setNewCategory({ name: '' });
              setShowCategoryModal(true);
            }}
            disabled={isOffline}
            className={`px-4 py-2 text-white rounded transition-colors ${
              isOffline
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-700 hover:bg-orange-800'
            }`}
          >
            Dodaj Kategorię
          </button>
          <button
            onClick={() => {
              if (isOffline) {
                toast.error('Nie można dodawać produktów w trybie offline.');
                return;
              }
              setEditingProduct(null);
              setNewProduct({
                name: '',
                itemCode: '',
                categoryId: '',
                buy_price: 0,
                sell_price: 0,
                weightAdjustment: 1,
              });
              setShowProductModal(true);
            }}
            disabled={isOffline}
            className={`px-4 py-2 text-white rounded transition-colors ${
              isOffline
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-700 hover:bg-orange-800'
            }`}
          >
            Dodaj Produkt
          </button>
        </div>
      </div>

      <ProductsTable
        products={products}
        categories={categories}
        updating={updating}
        priceEdits={convertedPriceEdits}
        onPriceChange={handlePriceChange}
        onPriceBlur={handlePriceBlur}
        onEditProduct={handleEditProduct}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {showCategoryModal && (
        <CategoryModal
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
          onSubmit={handleAddCategory}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          isEditing={!!editingCategory}
        />
      )}
      {showProductModal && (
        <ProductModal
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSubmit={handleAddProduct}
          onDelete={editingProduct ? handleDeleteProduct : undefined}
          newProduct={newProduct}
          setNewProduct={setNewProduct}
          categories={categories}
          isEditing={!!editingProduct}
        />
      )}
    </div>
  );
};

export default Products;
