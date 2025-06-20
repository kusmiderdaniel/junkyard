import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePDFReceipt } from '../components/PDFReceipt';
import ReceiptFilters from '../components/receipts/ReceiptFilters';
import ReceiptsTable from '../components/receipts/ReceiptsTable';
import DeleteReceiptModal from '../components/receipts/DeleteReceiptModal';
import ReceiptPagination from '../components/receipts/ReceiptPagination';
import { useReceiptData } from '../hooks/useReceiptData';
import { useReceiptExportActions } from '../components/receipts/ReceiptExportActions';
import { Receipt, DeleteReceiptData, PageSnapshots } from '../types/receipt';

const Receipts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { generatePDF, viewPDF } = usePDFReceipt();

  // Local state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pageSnapshots, setPageSnapshots] = useState<PageSnapshots>({
    1: null,
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [receiptToDelete, setReceiptToDelete] =
    useState<DeleteReceiptData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Use the extracted data hook
  const {
    receipts,
    clients,
    companyDetails,
    loading,
    totalPages,
    availableMonths,
    lastVisible,
    fetchReceipts,
    fetchClients,
    fetchCompanyDetails,
    fetchAvailableMonths,
    getClientName,
  } = useReceiptData({
    user,
    currentPage,
    itemsPerPage,
    pageSnapshots,
    selectedMonth,
    activeSearchTerm,
  });

  // Format month label helper
  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
  };

  // Use the export actions hook
  const { handleDownloadSummary, handleExportToExcel } =
    useReceiptExportActions({
      user,
      selectedMonth,
      searchTerm: activeSearchTerm,
      clients,
      companyDetails,
      getClientName,
      formatMonthLabel,
    });

  // Initialize data on component mount
  useEffect(() => {
    if (user) {
      fetchCompanyDetails();
      fetchClients();
      fetchAvailableMonths();
    }
  }, [user, fetchCompanyDetails, fetchClients, fetchAvailableMonths]);

  // Fetch receipts when dependencies change
  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Search handlers
  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  // PDF handlers
  const handleViewPDF = async (receipt: Receipt) => {
    if (!companyDetails) return;
    try {
      const client = clients.find(c => c.id === receipt.clientId) || {
        id: '',
        name: receipt.clientName || 'Nieznany Klient',
        address: '',
        documentNumber: '',
      };
      await viewPDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Wystąpił błąd podczas otwierania podglądu PDF.');
    }
  };

  const handleDownloadPDF = async (receipt: Receipt) => {
    if (!companyDetails) return;
    try {
      const client = clients.find(c => c.id === receipt.clientId) || {
        id: '',
        name: receipt.clientName || 'Nieznany Klient',
        address: '',
        documentNumber: '',
      };
      await generatePDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Wystąpił błąd podczas generowania PDF.');
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (page > currentPage && lastVisible) {
        setPageSnapshots(prev => ({ ...prev, [page]: lastVisible }));
      }
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    setPageSnapshots({ 1: null });
  };

  // Row expansion
  const toggleRowExpansion = (receiptId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receiptId)) {
        newSet.delete(receiptId);
      } else {
        newSet.add(receiptId);
      }
      return newSet;
    });
  };

  // Delete handlers
  const handleDeleteReceipt = async (
    receiptId: string,
    receiptNumber: string
  ) => {
    const receipt = receipts.find(r => r.id === receiptId);
    if (receipt) {
      const clientName = getClientName(receipt);
      setReceiptToDelete({
        id: receiptId,
        number: receiptNumber,
        clientName,
        totalAmount: receipt.totalAmount,
        date: receipt.date,
      });
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!receiptToDelete) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'receipts', receiptToDelete.id));

      // Refresh the receipts list
      await fetchReceipts();

      setShowDeleteModal(false);
      setReceiptToDelete(null);
      toast.success('Kwit został usunięty.');
    } catch (error) {
      toast.error('Wystąpił błąd podczas usuwania kwitu.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setReceiptToDelete(null);
  };

  const handleEditReceipt = (receiptId: string) => {
    navigate(`/edit-receipt/${receiptId}`);
  };

  // Filter the receipts for display (the hook handles the main filtering)
  const filteredReceipts = receipts;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">Kwity</h1>
      <p className="mt-4 text-gray-600">
        Przeglądaj i zarządzaj swoimi kwitami tutaj.
      </p>

      <div className="mt-8">
        <ReceiptFilters
          user={user}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          availableMonths={availableMonths}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={handleItemsPerPageChange}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          loading={loading}
          filteredReceiptsLength={filteredReceipts.length}
          onDownloadSummary={handleDownloadSummary}
          onExportToExcel={handleExportToExcel}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
          activeSearchTerm={activeSearchTerm}
        />

        <ReceiptsTable
          receipts={filteredReceipts}
          clients={clients}
          loading={loading}
          searchTerm={searchTerm}
          expandedRows={expandedRows}
          onToggleRowExpansion={toggleRowExpansion}
          onViewPDF={handleViewPDF}
          onDownloadPDF={handleDownloadPDF}
          onEditReceipt={handleEditReceipt}
          onDeleteReceipt={handleDeleteReceipt}
        />

        <ReceiptPagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          loading={loading}
          user={user}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      </div>

      <DeleteReceiptModal
        isVisible={showDeleteModal}
        receiptToDelete={receiptToDelete}
        deleting={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default Receipts;
