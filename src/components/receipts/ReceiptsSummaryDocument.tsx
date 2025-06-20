import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Roboto font with better Polish character support
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.woff',
      fontWeight: 'bold',
    },
  ],
});

interface ReceiptItem {
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  total_price: number;
}

interface Receipt {
  id: string;
  number: string;
  date: Date;
  clientId: string;
  clientName?: string;
  userID: string;
  totalAmount: number;
  items: ReceiptItem[];
}

interface CompanyDetails {
  companyName: string;
  numberNIP: string;
  numberREGON: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phoneNumber: string;
}

interface ReceiptsSummaryDocumentProps {
  receipts: Receipt[];
  filterDescription: string;
  companyDetails: CompanyDetails | null;
  totalAmount: number;
}

const ReceiptsSummaryDocument: React.FC<ReceiptsSummaryDocumentProps> = ({ 
  receipts, 
  filterDescription, 
  companyDetails, 
  totalAmount 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const styles = StyleSheet.create({
    page: {
      flexDirection: 'column',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Roboto',
      fontSize: 10,
      padding: 30,
      paddingBottom: 60,
    },
    header: {
      fontSize: 20,
      marginBottom: 20,
      textAlign: 'center',
      fontFamily: 'Roboto',
      fontWeight: 'bold',
    },
    companyInfo: {
      marginBottom: 20,
      padding: 10,
      backgroundColor: '#f8f9fa',
      borderRadius: 5,
    },
    companyName: {
      fontSize: 14,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
      marginBottom: 5,
    },
    companyDetails: {
      fontSize: 9,
      lineHeight: 1.3,
    },
    filterInfo: {
      fontSize: 10,
      marginBottom: 15,
      padding: 8,
      backgroundColor: '#e9ecef',
      borderRadius: 3,
    },
    tableContainer: {
      marginBottom: 15,
      flexGrow: 1,
    },
    table: {
      width: 'auto',
      borderStyle: 'solid',
      borderWidth: 1,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderColor: '#bfbfbf',
    },
    tableRow: {
      margin: 'auto',
      flexDirection: 'row',
      minHeight: 20,
    },
    tableColHeader: {
      width: '25%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderLeftWidth: 0,
      borderColor: '#bfbfbf',
      backgroundColor: '#f1f3f4',
    },
    tableCol: {
      width: '25%',
      borderStyle: 'solid',
      borderWidth: 1,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      borderColor: '#bfbfbf',
    },
    tableCellHeader: {
      margin: 'auto',
      marginTop: 5,
      marginBottom: 5,
      fontSize: 8,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
    },
    tableCell: {
      margin: 'auto',
      marginTop: 3,
      marginBottom: 3,
      fontSize: 8,
    },
    summarySection: {
      marginTop: 'auto',
      padding: 10,
      backgroundColor: '#f8f9fa',
      borderRadius: 5,
      position: 'absolute',
      bottom: 60,
      left: 30,
      right: 30,
    },
    summaryTitle: {
      fontSize: 12,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
      marginBottom: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    summaryLabel: {
      fontSize: 10,
    },
    summaryValue: {
      fontSize: 10,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#bfbfbf',
    },
    totalLabel: {
      fontSize: 12,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
    },
    totalValue: {
      fontSize: 12,
      fontFamily: 'Roboto',
      fontWeight: 'bold',
      color: '#d97706',
    },
    footer: {
      position: 'absolute',
      bottom: 30,
      left: 30,
      right: 30,
      textAlign: 'center',
      fontSize: 8,
      color: '#6c757d',
    },
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Podsumowanie Kwitów</Text>
        
        {companyDetails && (
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{companyDetails.companyName}</Text>
            <Text style={styles.companyDetails}>
              {companyDetails.address && `${companyDetails.address}\n`}
              {companyDetails.postalCode && companyDetails.city && `${companyDetails.postalCode} ${companyDetails.city}\n`}
              {companyDetails.numberNIP && `NIP: ${companyDetails.numberNIP}\n`}
              {companyDetails.numberREGON && `REGON: ${companyDetails.numberREGON}\n`}
              {companyDetails.email && `Email: ${companyDetails.email}\n`}
              {companyDetails.phoneNumber && `Tel: ${companyDetails.phoneNumber}`}
            </Text>
          </View>
        )}

        <View style={styles.filterInfo}>
          <Text>Kryteria filtrowania: {filterDescription}</Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.table}>
            <View style={styles.tableRow} fixed>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Numer Kwitu</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Data</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Klient</Text>
              </View>
              <View style={styles.tableColHeader}>
                <Text style={styles.tableCellHeader}>Kwota</Text>
              </View>
            </View>
            {receipts.map((receipt, index) => (
              <View style={styles.tableRow} key={receipt.id} wrap={false}>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{receipt.number}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{formatDate(receipt.date)}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{receipt.clientName || 'Nieznany klient'}</Text>
                </View>
                <View style={styles.tableCol}>
                  <Text style={styles.tableCell}>{formatCurrency(receipt.totalAmount)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Łączna wartość:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Wygenerowano {new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Page>
    </Document>
  );
};

export default ReceiptsSummaryDocument; 