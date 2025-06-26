import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, setDoc, doc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  normalizePolishText,
  createSearchableText,
} from '../../utils/textUtils';
import { logger } from '../../utils/logger';

type ImportCollection = 'clients' | 'products' | 'categories' | 'receipts';

interface DataImportSectionProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const DataImportSection: React.FC<DataImportSectionProps> = ({
  onSuccess,
  onError,
}) => {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importCollection, setImportCollection] =
    useState<ImportCollection>('clients');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentItem: string;
  }>({ current: 0, total: 0, currentItem: '' });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setImportError('Proszę wybrać plik CSV');
        return;
      }
      setImportFile(file);
      setImportError(null);
      setImportSuccess(null);
    }
  };

  const handleImportFromCSV = async () => {
    if (!user) {
      const errorMessage = 'Użytkownik nie jest uwierzytelniony';
      setImportError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    if (!importFile) {
      setImportError('Proszę wybrać plik CSV do importu');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    setImportProgress({
      current: 0,
      total: 0,
      currentItem: 'Przygotowywanie...',
    });

    try {
      const fileContent = await importFile.text();
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        setImportError(
          'Plik CSV musi zawierać co najmniej nagłówek i jeden wiersz danych'
        );
        return;
      }

      // Robust CSV parser that handles multiple columns with quoted fields containing commas
      const parseCSVLine = (
        line: string,
        expectedFields?: number
      ): string[] => {
        // Clean the line more thoroughly
        line = line.replace(/\r?\n$/g, '').trim();

        // Remove any trailing semicolons and tabs
        line = line.replace(/[;\t]+$/g, '');

        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        let i = 0;

        while (i < line.length) {
          const char = line[i];

          if (!inQuotes) {
            // We're outside of quotes
            if (char === '"') {
              // Starting a quoted field - check if it's single, double, or triple quotes
              let quoteCount = 0;
              let j = i;
              while (j < line.length && line[j] === '"') {
                quoteCount++;
                j++;
              }

              if (quoteCount >= 2) {
                // This is a multi-quote field (""field"" or """field""")
                inQuotes = true;
                quoteChar = '"'.repeat(quoteCount);
                i = j - 1; // Move to the last quote character
              } else {
                // Single quote field
                inQuotes = true;
                quoteChar = '"';
              }
            } else if (char === ',') {
              // Field separator
              result.push(current.trim());
              current = '';
            } else {
              // Regular character
              current += char;
            }
          } else {
            // We're inside quotes
            if (char === '"') {
              // Check if this matches our closing quote pattern
              let endQuoteCount = 0;
              let j = i;
              while (j < line.length && line[j] === '"') {
                endQuoteCount++;
                j++;
              }

              if (endQuoteCount >= quoteChar.length) {
                // This closes the quoted field
                inQuotes = false;
                quoteChar = '';
                i = j - 1; // Move to the last quote character
              } else {
                // This is a quote inside the field
                current += char;
              }
            } else {
              // Regular character inside quotes
              current += char;
            }
          }

          i++;
        }

        // Add the final field
        result.push(current.trim());

        // Clean up each field by removing any remaining surrounding quotes and unwanted characters
        const cleanedResult = result.map(field => {
          // Remove leading/trailing quotes but preserve internal content
          field = field.replace(/^"+|"+$/g, '');

          // Remove any trailing semicolons and tabs from each field
          field = field.replace(/[;\t]+$/g, '');

          return field.trim();
        });

        // Ensure we have the expected number of fields by padding with empty strings if needed
        if (expectedFields && cleanedResult.length < expectedFields) {
          while (cleanedResult.length < expectedFields) {
            cleanedResult.push('');
          }
        }

        return cleanedResult;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.trim());
      const dataLines = lines.slice(1);
      const expectedFieldCount = headers.length;

      let importedCount = 0;
      let skippedCount = 0;

      // Initialize progress
      setImportProgress({
        current: 0,
        total: dataLines.length,
        currentItem: 'Rozpoczynanie importu...',
      });

      // For receipts, we need to group items by receipt before importing
      if (importCollection === 'receipts') {
        const receiptGroups = new Map<string, any>();

        // First pass: group all rows by receipt
        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i];

          try {
            if (!line.trim()) {
              skippedCount++;
              continue;
            }

            const values = parseCSVLine(line, expectedFieldCount).map(v =>
              v.trim()
            );
            const recordData: any = {};
            headers.forEach((header, index) => {
              recordData[header] = values[index] || '';
            });

            // Get receipt identifier
            const receiptId = recordData['ID Kwitu'] || '';
            const receiptNumber = recordData['Numer Kwitu'] || '';
            const receiptKey = receiptId || receiptNumber;

            if (!receiptKey || !receiptKey.trim()) {
              skippedCount++;
              continue;
            }

            // Initialize receipt if not exists
            if (!receiptGroups.has(receiptKey)) {
              const receiptDate = recordData['Data'] || '';
              const clientId = recordData['ID Klienta'] || '';
              const clientName = recordData['Nazwa Klienta'] || '';
              const totalAmount = recordData['Łączna Kwota Kwitu'] || 0;

              let processedDate;
              if (receiptDate) {
                try {
                  processedDate = Timestamp.fromDate(new Date(receiptDate));
                } catch (e) {
                  processedDate = Timestamp.now();
                }
              } else {
                processedDate = Timestamp.now();
              }

              receiptGroups.set(receiptKey, {
                userID: user.uid,
                number: receiptNumber || receiptKey,
                date: processedDate,
                clientId: clientId,
                clientName: clientName,
                totalAmount: parseFloat(totalAmount.toString()) || 0,
                items: [],
              });
            }

            // Add item to receipt if it has content
            const itemName = recordData['Nazwa Produktu'] || '';
            const itemCode = recordData['Kod Produktu'] || '';
            const quantity = recordData['Ilość'] || 0;

            if (itemName || itemCode || quantity > 0) {
              const unit = recordData['Jednostka'] || '';
              const sellPrice = recordData['Cena Sprzedaży'] || 0;
              const buyPrice = recordData['Cena Zakupu'] || 0;
              const totalPrice = recordData['Wartość Pozycji'] || 0;

              const item = {
                itemName: itemName,
                itemCode: itemCode,
                quantity: parseFloat(quantity.toString()) || 0,
                unit: unit,
                sell_price: parseFloat(sellPrice.toString()) || 0,
                buy_price: parseFloat(buyPrice.toString()) || 0,
                total_price: parseFloat(totalPrice.toString()) || 0,
              };
              receiptGroups.get(receiptKey)!.items.push(item);
            }
          } catch (error) {
            logger.error('Error processing receipt line', error, {
              component: 'DataImportSection',
              operation: 'importReceipts',
              userId: user.uid,
              extra: { lineIndex: i },
            });
            skippedCount++;
          }
        }

        // Second pass: import grouped receipts
        const groupedReceipts = Array.from(receiptGroups.entries());
        setImportProgress({
          current: 0,
          total: groupedReceipts.length,
          currentItem: 'Importowanie zgrupowanych kwitów...',
        });

        for (let i = 0; i < groupedReceipts.length; i++) {
          const [receiptKey, receiptData] = groupedReceipts[i];

          try {
            setImportProgress({
              current: i + 1,
              total: groupedReceipts.length,
              currentItem: `Importowanie kwitu: ${receiptData.number}`,
            });

            // Use the receipt key as document ID
            await setDoc(doc(db, 'receipts', receiptKey), receiptData);
            importedCount++;
          } catch (error) {
            logger.error('Error importing receipt', error, {
              component: 'DataImportSection',
              operation: 'importGroupedReceipts',
              userId: user.uid,
              extra: { receiptNumber: receiptData.number },
            });
            skippedCount++;
          }
        }
      } else {
        // Original logic for non-receipt collections
        for (let i = 0; i < dataLines.length; i++) {
          const line = dataLines[i];

          try {
            if (!line.trim()) {
              skippedCount++;
              setImportProgress({
                current: i + 1,
                total: dataLines.length,
                currentItem: `Pomijanie pustego wiersza ${i + 1}`,
              });
              continue;
            }

            const values = parseCSVLine(line, expectedFieldCount).map(v =>
              v.trim()
            );

            // Debug: Check field count for clients specifically
            if (
              importCollection === 'clients' &&
              values.length !== headers.length
            ) {
              logger.warn(
                `Client import - Line ${i + 2}: Expected ${headers.length} fields, got ${values.length}`,
                undefined,
                {
                  component: 'DataImportSection',
                  operation: 'importClients',
                  userId: user.uid,
                  extra: {
                    lineNumber: i + 2,
                    expectedFields: headers.length,
                    actualFields: values.length,
                    headers,
                    values,
                  },
                }
              );
            }

            const recordData: any = {};
            headers.forEach((header, index) => {
              recordData[header] = values[index] || '';
            });

            // Add userID to all records
            recordData.userID = user.uid;

            // Update progress with current item info
            const itemName =
              recordData.name ||
              recordData.companyName ||
              recordData.number ||
              `Wiersz ${i + 1}`;
            setImportProgress({
              current: i + 1,
              total: dataLines.length,
              currentItem: `Przetwarzanie: ${itemName}`,
            });

            // Handle different collection types with more lenient validation and Polish column support
            let isValid = false;
            switch (importCollection) {
              case 'clients':
                // Support Polish column names only (exact match with guide)
                const clientName = recordData['Nazwa'] || '';
                const clientAddress = recordData['Adres'] || '';
                const clientDocNumber = recordData['Numer Dokumentu'] || '';
                const postalCode = recordData['Kod Pocztowy'] || '';
                const city = recordData['Miasto'] || '';

                if (clientName && clientName.trim()) {
                  isValid = true;
                  // Update recordData with normalized field names
                  recordData.name = clientName;
                  recordData.address = clientAddress;
                  recordData.documentNumber = clientDocNumber;
                  recordData.postalCode = postalCode;
                  recordData.city = city;

                  // Create fullAddress field
                  const addressParts = [];
                  if (clientAddress.trim())
                    addressParts.push(clientAddress.trim());
                  if (postalCode.trim() || city.trim()) {
                    const locationPart = [postalCode.trim(), city.trim()]
                      .filter(Boolean)
                      .join(' ');
                    if (locationPart) addressParts.push(locationPart);
                  }
                  recordData.fullAddress = addressParts.join(', ');

                  // Add normalized search fields for optimal search performance
                  recordData.name_lowercase = recordData.name.toLowerCase();
                  recordData.name_normalized = normalizePolishText(
                    recordData.name
                  );
                  recordData.address_normalized = normalizePolishText(
                    recordData.address
                  );
                  recordData.documentNumber_normalized = normalizePolishText(
                    recordData.documentNumber
                  );
                  recordData.postalCode_normalized = normalizePolishText(
                    recordData.postalCode
                  );
                  recordData.city_normalized = normalizePolishText(
                    recordData.city
                  );
                  recordData.fullAddress_normalized = normalizePolishText(
                    recordData.fullAddress
                  );
                  recordData.searchableText = createSearchableText([
                    recordData.name,
                    recordData.address,
                    recordData.documentNumber,
                    recordData.postalCode,
                    recordData.city,
                    recordData.fullAddress,
                  ]);
                }
                break;
              case 'products':
                // Support Polish column names only (exact match with guide)
                const productName = recordData['Nazwa'] || '';
                const itemCode = recordData['Kod Produktu'] || '';
                const categoryId = recordData['ID Kategorii'] || '';
                const buyPrice = recordData['Cena Zakupu'] || 0;
                const sellPrice = recordData['Cena Sprzedazy'] || 0;
                const weightAdj = recordData['Korekta Wagi'] || 1;

                if (
                  productName &&
                  productName.trim() &&
                  itemCode &&
                  itemCode.trim()
                ) {
                  isValid = true;
                  // Update recordData with normalized field names
                  recordData.name = productName;
                  recordData.itemCode = itemCode;
                  recordData.categoryId = categoryId;
                  recordData.buy_price = parseFloat(buyPrice.toString()) || 0;
                  recordData.sell_price = parseFloat(sellPrice.toString()) || 0;
                  recordData.weightAdjustment =
                    parseFloat(weightAdj.toString()) || 1;
                }
                break;
              case 'categories':
                // Support Polish column names only (exact match with guide)
                const categoryName = recordData['Nazwa'] || '';

                if (categoryName && categoryName.trim()) {
                  isValid = true;
                  recordData.name = categoryName;
                }
                break;
            }

            if (!isValid) {
              const itemName =
                recordData.name ||
                recordData.companyName ||
                recordData.number ||
                `Wiersz ${i + 2}`;
              logger.warn(
                `Pominięto rekord (wiersz ${i + 2}): "${itemName}" - nie spełnia wymagań walidacji dla typu "${importCollection}"`,
                undefined,
                {
                  component: 'DataImportSection',
                  operation: 'validateRecord',
                  userId: user.uid,
                  extra: {
                    lineNumber: i + 2,
                    itemName,
                    importCollection,
                    parsedValues: values,
                  },
                }
              );
              skippedCount++;
              continue;
            }

            // Use the ID from CSV if provided, otherwise generate one
            const documentId = recordData.ID || recordData.id;
            if (documentId && documentId.trim()) {
              // Remove the ID field from the data since it will be the document ID
              const { ID, id, ...dataWithoutId } = recordData;
              // Add document with specified ID
              await setDoc(
                doc(db, importCollection, documentId.trim()),
                dataWithoutId
              );
            } else {
              // If no ID provided, let Firestore auto-generate
              await addDoc(collection(db, importCollection), recordData);
            }
            importedCount++;
          } catch (error) {
            logger.error('Error adding document', error, {
              component: 'DataImportSection',
              operation: 'addDocument',
              userId: user.uid,
              extra: { importCollection, lineNumber: i + 2 },
            });
            skippedCount++;
            continue;
          }
        }
      }

      // Final progress update
      setImportProgress({
        current: dataLines.length,
        total: dataLines.length,
        currentItem: 'Import zakończony!',
      });

      const successMessage = `Import zakończony: ${importedCount} rekordów zaimportowano, ${skippedCount} pominiętych.`;
      setImportSuccess(successMessage);
      onSuccess?.(successMessage);

      // Reset form
      setImportFile(null);
      const fileInput = document.getElementById(
        'import-file-input'
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      const errorMessage =
        'Błąd podczas importu z CSV. Sprawdź format pliku i spróbuj ponownie.';
      setImportError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setImporting(false);
      // Reset progress after a short delay
      setTimeout(() => {
        setImportProgress({ current: 0, total: 0, currentItem: '' });
      }, 2000);
    }
  };

  const downloadSampleCSV = (type: 'clients' | 'products' | 'receipts') => {
    let csvContent = '';

    switch (type) {
      case 'clients':
        csvContent = 'Nazwa,Adres,Numer Dokumentu,Kod Pocztowy,Miasto\n';
        csvContent += 'Jan Kowalski,ul. Przykładowa 1,ABC123,00-001,Warszawa\n';
        csvContent += 'Anna Nowak,ul. Testowa 2,DEF456,30-002,Kraków\n';
        break;
      case 'products':
        csvContent =
          'Nazwa,Kod,Cena Sprzedaży,Cena Zakupu,Jednostka,Kategoria\n';
        csvContent += 'Produkt A,PRD001,10.50,8.00,szt,Kategoria A\n';
        csvContent += 'Produkt B,PRD002,25.99,20.00,kg,Kategoria B\n';
        break;
      case 'receipts':
        csvContent = 'Numer Kwitu,Data,Klient,Łączna Kwota\n';
        csvContent += '001/2024,2024-01-15,Jan Kowalski,150.00\n';
        csvContent += '002/2024,2024-01-16,Anna Nowak,275.50\n';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}_sample.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    logger.info('Sample CSV downloaded', {
      component: 'DataImportSection',
      operation: 'downloadSampleCSV',
      extra: { type },
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Import Danych</h2>
        <p className="text-gray-600 mt-1">Importuj dane z pliku CSV</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Typ Danych do Importu
          </label>
          <select
            value={importCollection}
            onChange={e =>
              setImportCollection(e.target.value as ImportCollection)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="clients">Klienci</option>
            <option value="products">Produkty</option>
            <option value="categories">Kategorie</option>
            <option value="receipts">Kwity</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plik CSV
          </label>
          <div className="relative">
            <input
              id="import-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-8 h-8 mb-4 text-gray-500"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 20 16"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                  />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Kliknij aby wybrać plik</span>{' '}
                  lub przeciągnij go tutaj
                </p>
                <p className="text-xs text-gray-500">CSV (MAX. 10MB)</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Wybierz plik CSV z danymi do importu. Pierwszy wiersz powinien
            zawierać nagłówki kolumn.
          </p>
        </div>

        {importFile && (
          <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-600 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-green-700 text-sm font-medium">
                  Plik wybrany: <strong>{importFile.name}</strong>
                </p>
                <p className="text-green-600 text-xs">
                  Rozmiar: {(importFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {importing && importProgress.total > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-300 rounded-lg">
            <div className="mb-2">
              <div className="flex justify-between text-sm font-medium text-blue-700">
                <span>Postęp importu</span>
                <span>
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {importProgress.currentItem}
              </div>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <div className="text-xs text-blue-600 mt-1 text-right">
              {importProgress.total > 0
                ? Math.round(
                    (importProgress.current / importProgress.total) * 100
                  )
                : 0}
              %
            </div>
          </div>
        )}

        {/* Import Messages */}
        {importError && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-md">
            <p className="text-red-700">{importError}</p>
          </div>
        )}

        {importSuccess && (
          <div className="p-4 bg-green-50 border border-green-300 rounded-md">
            <p className="text-green-700">{importSuccess}</p>
          </div>
        )}

        <div className="pt-4">
          <button
            onClick={handleImportFromCSV}
            disabled={importing || !importFile}
            className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importowanie...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                Importuj z CSV
              </>
            )}
          </button>
        </div>

        {/* Sample CSV Downloads */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Pobierz przykładowe pliki CSV:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => downloadSampleCSV('clients')}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Klienci
            </button>
            <button
              onClick={() => downloadSampleCSV('products')}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Produkty
            </button>
            <button
              onClick={() => downloadSampleCSV('receipts')}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Kwity
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Format CSV:</h3>
        <div className="text-xs text-gray-600 space-y-2">
          <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-blue-700 font-medium">
              💡 Wskazówka: Dodaj kolumnę "ID" aby określić identyfikator
              dokumentu w bazie danych.
            </p>
          </div>

          <div>
            <p>
              <strong>Klienci:</strong>
            </p>
            <p className="ml-2 text-gray-600">
              ID, Nazwa, Adres, Numer Dokumentu, Kod Pocztowy, Miasto
            </p>
          </div>

          <div>
            <p>
              <strong>Produkty:</strong>
            </p>
            <p className="ml-2 text-gray-600">
              ID, Nazwa, Kod Produktu, ID Kategorii, Cena Zakupu, Cena
              Sprzedazy, Korekta Wagi
            </p>
          </div>

          <div>
            <p>
              <strong>Kategorie:</strong>
            </p>
            <p className="ml-2 text-gray-600">ID, Nazwa</p>
          </div>

          <div>
            <p>
              <strong>Kwity:</strong>
            </p>
            <p className="ml-2 text-gray-600">
              ID Kwitu, Numer Kwitu, Data, ID Klienta, Nazwa Klienta, Łączna
              Kwota Kwitu, Nazwa Produktu, Kod Produktu, Ilość,Jednostka, Cena
              Sprzedaży, Cena Zakupu, Wartość Pozycji
            </p>
            <p className="text-gray-500 italic ml-2">
              Uwaga: Format eksportu zawiera jeden wiersz na każdą pozycję
              kwitu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataImportSection;
