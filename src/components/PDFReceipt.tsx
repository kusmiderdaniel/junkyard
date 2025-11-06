import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Font,
} from '@react-pdf/renderer';
import { Receipt, Client, CompanyDetails } from '../types/receipt';
import { logger } from '../utils/logger';
import { isErrorWithMessage } from '../types/common';
import withErrorBoundary from './withErrorBoundary';

// Register Roboto font which has excellent Polish character support
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 'bold',
    },
  ],
});

interface PDFReceiptProps {
  receipt: Receipt;
  client: Client;
  companyDetails: CompanyDetails;
}

// Create styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 15,
    fontSize: 8,
    fontFamily: 'Roboto',
  },
  half: {
    flex: 1,
    paddingHorizontal: 10,
  },
  divider: {
    width: 1,
    backgroundColor: '#000000',
    marginHorizontal: 8,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leftSection: {
    width: '45%',
    alignItems: 'center',
  },
  companyInfo: {
    fontSize: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  rightSection: {
    width: '55%',
    alignItems: 'flex-end',
  },
  rightInfo: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  companyText: {
    fontSize: 8,
    marginBottom: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  receiptNumber: {
    fontSize: 9,
    textAlign: 'right',
    marginBottom: 2,
  },
  dateLocation: {
    fontSize: 8,
    textAlign: 'right',
    marginBottom: 8,
  },
  clientSection: {
    marginBottom: 8,
  },
  clientLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  clientText: {
    fontSize: 8,
    marginBottom: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    backgroundColor: '#f0f0f0',
    minHeight: 18,
  },
  tableColHeader: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCol: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCellHeader: {
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 7,
    textAlign: 'center',
  },
  tableCellRight: {
    fontSize: 7,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    minHeight: 14,
  },
  summaryCell: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disclaimer: {
    marginTop: 10,
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 7,
    lineHeight: 1.1,
    textAlign: 'justify',
    marginBottom: 2,
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  signatureBox: {
    width: '45%',
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  signatureLine: {
    fontSize: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: '100%',
    textAlign: 'center',
    paddingBottom: 2,
    paddingTop: 15,
  },
});

// PDF Document Component
const PDFReceiptDocument: React.FC<PDFReceiptProps> = ({
  receipt,
  client,
  companyDetails,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    })
      .format(amount)
      .replace(/\s/g, ' ');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Create 15 rows always (fill empty ones if needed)
  const createTableRows = () => {
    const rows = [];
    const maxRows = 15;

    // Add actual items
    for (let i = 0; i < maxRows; i++) {
      const item = receipt.items[i];
      rows.push(
        <View key={i} style={styles.tableRow}>
          <View style={[styles.tableCol, { width: '35%' }]}>
            <Text style={styles.tableCell}>{item ? item.itemName : ''}</Text>
          </View>
          <View style={[styles.tableCol, { width: '15%' }]}>
            <Text style={styles.tableCell}>{item ? item.itemCode : ''}</Text>
          </View>
          <View style={[styles.tableCol, { width: '12%' }]}>
            <Text style={styles.tableCell}>
              {item ? `${item.quantity.toFixed(2)} kg` : ''}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: '18%' }]}>
            <Text style={styles.tableCellRight}>
              {item ? formatCurrency(item.buy_price) : ''}
            </Text>
          </View>
          <View style={[styles.tableCol, { width: '20%' }]}>
            <Text style={styles.tableCellRight}>
              {item ? formatCurrency(item.total_price) : ''}
            </Text>
          </View>
        </View>
      );
    }
    return rows;
  };

  const renderHalf = () => (
    <View style={styles.half}>
      {/* Company Details Section - Positioned in Red Box Area */}
      <View style={styles.leftSection}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyText}>
            {companyDetails.companyName || 'Demo Złom'}
          </Text>
          <Text style={styles.companyText}>
            {companyDetails.address || '00-000 Demowo, Demowa 15'}
          </Text>
          <Text style={styles.companyText}>
            NIP: {companyDetails.numberNIP || '000-000-00-00'}, REGON:{' '}
            {companyDetails.numberREGON || '000000000'}
          </Text>
          <Text style={styles.companyText}>
            tel.: {companyDetails.phoneNumber || '000 000 000'}
          </Text>
        </View>
      </View>

      {/* Header Information - Below Company Details */}
      <View style={styles.rightInfo}>
        <Text style={styles.title}>FORMULARZ PRZYJĘCIA ODPADÓW METALI</Text>
        <Text style={styles.receiptNumber}>KWIT NR: {receipt.number}</Text>
        <Text style={styles.dateLocation}>
          {companyDetails.city || 'Demowo'}, dnia: {formatDate(receipt.date)}
        </Text>
      </View>

      {/* Client Section */}
      <View style={styles.clientSection}>
        <Text style={styles.clientText}>
          <Text style={styles.clientLabel}>SPRZEDAJĄCY: </Text>
          {client.name}
        </Text>
        <Text style={styles.clientText}>
          <Text style={styles.clientLabel}>ADRES: </Text>
          {client.fullAddress || client.address}
        </Text>
        <Text style={styles.clientText}>
          <Text style={styles.clientLabel}>NR DOKUMENTU: </Text>
          {client.documentNumber}
        </Text>
      </View>

      {/* Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <View style={[styles.tableColHeader, { width: '35%' }]}>
            <Text style={styles.tableCellHeader}>Rodzaj towaru</Text>
          </View>
          <View style={[styles.tableColHeader, { width: '15%' }]}>
            <Text style={styles.tableCellHeader}>Kod odpadu</Text>
          </View>
          <View style={[styles.tableColHeader, { width: '12%' }]}>
            <Text style={styles.tableCellHeader}>Ilość</Text>
          </View>
          <View style={[styles.tableColHeader, { width: '18%' }]}>
            <Text style={styles.tableCellHeader}>Cena jedn.</Text>
          </View>
          <View style={[styles.tableColHeader, { width: '20%' }]}>
            <Text style={styles.tableCellHeader}>Wartość</Text>
          </View>
        </View>

        {/* Table Rows */}
        {createTableRows()}

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          <View
            style={[styles.summaryCell, { width: '35%', borderRightWidth: 0 }]}
          >
            <Text style={styles.summaryText}>DO WYPŁATY</Text>
          </View>
          <View
            style={[styles.summaryCell, { width: '45%', borderRightWidth: 0 }]}
          >
            <Text style={styles.summaryText}></Text>
          </View>
          <View style={[styles.summaryCell, { width: '20%' }]}>
            <Text style={[styles.summaryText, { textAlign: 'right' }]}>
              {formatCurrency(receipt.totalAmount)}
            </Text>
          </View>
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={[styles.disclaimerText, { fontWeight: 'bold' }]}>
          Kopia formularza przyjęcia odpadów metali będzie przechowywana w
          zamkniętym pomieszczeniu, a po 5 LATACH ulegnie zniszczeniu. Dane
          osobowe nie będą udostępnione osobom niepowolanym.
        </Text>
        <Text style={styles.disclaimerText}>
          Sprzedający oświadcza, że przekazane złom metałowy, nie podchodzi z
          kradzieży i nie jest zajęty przez komornika. Sprzedający jest
          poinformowany o odpowiedzialności w przypadku składania fałszywego
          oświadczenia. Sprzedający wie, że cena skupu jest ceną umowną. Kwotę
          powyższą otrzymuję. Sprzedający oświadcza, że nie jest podatnikiem
          vat. Sprzedający zgadza się na przetwarzanie danych osobowych przez{' '}
          {companyDetails.companyName || 'Demo'}.
        </Text>
        <Text style={styles.disclaimerText}>
          Sprzedający został poinformowany o odjęciu 2% na zanieczyszczenia od
          wagi w przypadku złomu stalowego.
        </Text>
      </View>

      {/* Signatures */}
      <View style={styles.signatures}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>SPRZEDAJĄCY</Text>
          <Text style={styles.signatureLine}></Text>
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>KUPUJĄCY</Text>
          <Text style={styles.signatureLine}></Text>
        </View>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {renderHalf()}
        <View style={styles.divider} />
        {renderHalf()}
      </Page>
    </Document>
  );
};

// Hook to generate and download PDF
export const usePDFReceipt = () => {
  const generatePDF = async (
    receipt: Receipt,
    client: Client,
    companyDetails: CompanyDetails
  ) => {
    const doc = (
      <PDFReceiptDocument
        receipt={receipt}
        client={client}
        companyDetails={companyDetails}
      />
    );
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();

    // Use browser's native download functionality
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kwit_${receipt.number}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const viewPDF = async (
    receipt: Receipt,
    client: Client,
    companyDetails: CompanyDetails
  ) => {
    const doc = (
      <PDFReceiptDocument
        receipt={receipt}
        client={client}
        companyDetails={companyDetails}
      />
    );
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return { generatePDF, viewPDF };
};

export default withErrorBoundary(PDFReceiptDocument, {
  context: 'PDF Generation',
  onError: (error, errorInfo) => {
    logger.error(
      'PDF generation error',
      isErrorWithMessage(error) ? error : undefined,
      {
        component: 'PDFReceiptDocument',
        operation: 'componentError',
        extra: {
          componentStack: errorInfo.componentStack,
        },
      }
    );
  },
});
