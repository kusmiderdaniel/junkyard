import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Receipt, Client, CompanyDetails } from '../types/receipt';
import { sortReceiptsInPlace } from '../utils/receiptSorting';
import { usePDFReceipt } from '../components/PDFReceipt';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { generatePDF, viewPDF } = usePDFReceipt();

  const [todaysReceipts, setTodaysReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // KPI calculations
  const totalCollected = todaysReceipts.reduce(
    (sum, receipt) => sum + receipt.totalAmount,
    0
  );

  const totalQuantity = todaysReceipts.reduce(
    (sum, receipt) =>
      sum + receipt.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  const distinctClients = new Set(
    todaysReceipts.map(receipt => receipt.clientId)
  ).size;

  const totalReceipts = todaysReceipts.length;

  // Fetch company details
  const fetchCompanyDetails = useCallback(async () => {
    if (!user) return;

    try {
      const docRef = doc(db, 'companyDetails', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setCompanyDetails(docSnap.data() as CompanyDetails);
      } else {
        setCompanyDetails({
          companyName: 'Your Company',
          numberNIP: '',
          numberREGON: '',
          address: '',
          postalCode: '',
          city: '',
          email: '',
          phoneNumber: '',
        });
      }
    } catch (error) {
      // Fallback to default company details if fetch fails
      setCompanyDetails({
        companyName: 'Your Company',
        numberNIP: '',
        numberREGON: '',
        address: '',
        postalCode: '',
        city: '',
        email: '',
        phoneNumber: '',
      });
    }
  }, [user]);

  // Fetch clients
  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const clientsQuery = query(
        collection(db, 'clients'),
        where('userID', '==', user.uid)
      );
      const clientsSnapshot = await getDocs(clientsQuery);
      const clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];

      setClients(clientsData);
    } catch (error) {
      // Clients list will remain empty if fetch fails
      setClients([]);
    }
  }, [user]);

  // Fetch today's receipts
  const fetchTodaysReceipts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get start and end of today
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999
      );

      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('userID', '==', user.uid),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(receiptsQuery);
      const receiptsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      })) as Receipt[];

      // Sort by date descending (newest first)
      sortReceiptsInPlace(receiptsData);

      setTodaysReceipts(receiptsData);
    } catch (error) {
      // Today's receipts will remain empty if fetch fails
      setTodaysReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get client name by ID
  const getClientName = useCallback(
    (receipt: Receipt) => {
      if (receipt.clientId) {
        const client = clients.find(c => c.id === receipt.clientId);
        return client ? client.name : 'Unknown Client';
      }
      return receipt.clientName || 'Unknown Client';
    },
    [clients]
  );

  useEffect(() => {
    fetchCompanyDetails();
    fetchClients();
    fetchTodaysReceipts();
  }, [fetchCompanyDetails, fetchClients, fetchTodaysReceipts]);

  // PDF Handlers
  const handleViewPDF = async (receipt: Receipt) => {
    if (!companyDetails) {
      toast.error(
        'Szczegóły firmy nie zostały załadowane. Proszę spróbować ponownie.'
      );
      return;
    }

    const client = clients.find(c => c.id === receipt.clientId);
    if (!client) {
      toast.error('Informacje o kliencie nie zostały znalezione.');
      return;
    }

    try {
      await viewPDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Błąd generowania PDF. Proszę spróbować ponownie.');
    }
  };

  const handleDownloadPDF = async (receipt: Receipt) => {
    if (!companyDetails) {
      toast.error(
        'Szczegóły firmy nie zostały załadowane. Proszę spróbować ponownie.'
      );
      return;
    }

    const client = clients.find(c => c.id === receipt.clientId);
    if (!client) {
      toast.error('Informacje o kliencie nie zostały znalezione.');
      return;
    }

    try {
      await generatePDF(receipt, client, companyDetails);
    } catch (error) {
      toast.error('Błąd generowania PDF. Proszę spróbować ponownie.');
    }
  };

  const handleEditReceipt = (receiptId: string) => {
    navigate(`/edit-receipt/${receiptId}`);
  };

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

  // const formatDate = (date: Date) => {
  //   return date.toLocaleDateString('pl-PL', {
  //     day: '2-digit',
  //     month: '2-digit',
  //     year: 'numeric'
  //   });
  // };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000 && amount < 10000) {
      const parts = amount.toFixed(2).split('.');
      const integerPart = parts[0];
      const decimalPart = parts[1];
      const thousands = integerPart.slice(0, -3);
      const hundreds = integerPart.slice(-3);
      return `${thousands} ${hundreds},${decimalPart} zł`;
    }

    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  };

  const formatQuantity = (quantity: number) => {
    return new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    })
      .format(quantity)
      .replace(/\u00A0/g, ' '); // Replace non-breaking space with regular space
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">
          Proszę się zalogować aby zobaczyć panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Dzisiejszy przegląd -{' '}
          {new Date().toLocaleDateString('pl-PL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Wydano
          </h3>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {formatCurrency(totalCollected)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Zebrano
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-700">
            {formatQuantity(totalQuantity)} kg
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Klienci
          </h3>
          <p className="mt-2 text-3xl font-bold text-purple-600">
            {distinctClients}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Kwity
          </h3>
          <p className="mt-2 text-3xl font-bold text-orange-600">
            {totalReceipts}
          </p>
        </div>
      </div>

      {/* Today's Receipts Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Dzisiejsze Kwity
          </h2>
          <p className="text-sm text-gray-600">
            {todaysReceipts.length} kwit
            {todaysReceipts.length === 1
              ? ''
              : todaysReceipts.length < 5
                ? 'y'
                : 'ów'}{' '}
            dzisiaj
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numer Kwitu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Godzina
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Klient
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Łączna Kwota
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-700"></div>
                      <span className="ml-2">
                        Ładowanie dzisiejszych kwitów...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : todaysReceipts.length > 0 ? (
                todaysReceipts.map(receipt => (
                  <React.Fragment key={receipt.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRowExpansion(receipt.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span className="mr-2">
                            {expandedRows.has(receipt.id) ? (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6,9 12,15 18,9"></polyline>
                              </svg>
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9,18 15,12 9,6"></polyline>
                              </svg>
                            )}
                          </span>
                          {receipt.number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(receipt.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getClientName(receipt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(receipt.totalAmount)}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleViewPDF(receipt)}
                            className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                            aria-label="View PDF"
                            title="View PDF"
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(receipt)}
                            className="text-gray-400 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50"
                            aria-label="Download PDF"
                            title="Download PDF"
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                              <polyline points="9,15 12,18 15,15"></polyline>
                              <line x1="12" y1="18" x2="12" y2="10"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEditReceipt(receipt.id)}
                            className="text-gray-400 hover:text-orange-700 transition-colors p-1 rounded-full hover:bg-orange-50"
                            aria-label="Edit receipt"
                            title="Edit receipt"
                          >
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="m18.5 2.5 3 3L10 17l-4 1 1-4 11.5-11.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(receipt.id) && (
                      <tr>
                        <td colSpan={5} className="px-4 py-0 bg-gray-50">
                          <div className="py-4">
                            <div className="overflow-x-auto">
                              <table className="min-w-full bg-white rounded-lg shadow-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Nazwa Towaru
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Kod
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ilość
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Cena Skupu
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Cena Sprzedaży
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Razem
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {receipt.items.map((item, index) => (
                                    <tr key={index}>
                                      <td className="py-2 px-3 text-sm text-gray-900">
                                        {item.itemName}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-500">
                                        {item.itemCode}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                        {item.quantity.toLocaleString('pl-PL', {
                                          minimumFractionDigits: 1,
                                          maximumFractionDigits: 1,
                                        })}{' '}
                                        {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                        {formatCurrency(item.buy_price)}
                                      </td>
                                      <td className="py-2 px-3 text-sm text-gray-900 text-right">
                                        {formatCurrency(item.sell_price)}
                                      </td>
                                      <td className="py-2 px-3 text-sm font-medium text-gray-900 text-right">
                                        {formatCurrency(item.total_price)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    Nie utworzono dzisiaj żadnych kwitów. Kliknij "Dodaj Kwit"
                    aby utworzyć pierwszy kwit dzisiaj.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
