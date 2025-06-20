import React, { useState, useEffect } from 'react';

interface NewCategory {
  name: string;
}

interface CategoryModalProps {
  onClose: () => void;
  onSubmit: (category: NewCategory) => void;
  newCategory: NewCategory;
  setNewCategory: (category: NewCategory) => void;
  isEditing: boolean;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  onClose,
  onSubmit,
  newCategory,
  setNewCategory,
  isEditing
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialCategory, setInitialCategory] = useState(newCategory);

  // Update initial values when modal opens or newCategory changes
  useEffect(() => {
    setInitialCategory(newCategory);
  }, [newCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(newCategory);
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
    const hasChanges = newCategory.name.trim() !== initialCategory.name.trim();
    
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" 
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edytuj Kategorię' : 'Dodaj Nową Kategorię'}
            </h3>
          </div>
          <button
            onClick={handleCloseAttempt}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Nazwa Kategorii <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Wprowadź nazwę kategorii"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              </div>
            </div>
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
            disabled={loading || !newCategory.name.trim()}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{isEditing ? 'Aktualizowanie...' : 'Dodawanie...'}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{isEditing ? 'Aktualizuj Kategorię' : 'Dodaj Kategorię'}</span>
              </>
            )}
          </button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 rounded-xl">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900">Niezapisane zmiany</h4>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Masz niezapisane zmiany. Czy na pewno chcesz zamknąć bez zapisywania?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleConfirmClose}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Zamknij bez zapisywania
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryModal; 