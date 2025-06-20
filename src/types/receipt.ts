import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

export interface ReceiptItem {
  itemName: string;
  itemCode: string;
  quantity: number;
  unit: string;
  sell_price: number;
  buy_price: number;
  total_price: number;
}

export interface Receipt {
  id: string;
  number: string;
  date: Date;
  clientId: string;
  clientName?: string;
  userID: string;
  totalAmount: number;
  items: ReceiptItem[];
}

export interface Client {
  id: string;
  name: string;
  address: string;
  documentNumber: string;
  postalCode?: string;
  city?: string;
  fullAddress?: string;
  searchableText?: string;
}

export interface CompanyDetails {
  companyName: string;
  numberNIP: string;
  numberREGON: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phoneNumber: string;
}

export interface ExcelRowData {
  'Numer kwitu': string;
  'Data': string;
  'Klient': string;
  'Nazwa towaru': string;
  'Kod towaru': string;
  'Ilość': number;
  'Jednostka': string;
  'Cena zakupu': number;
  'Wartość pozycji': number;
}

export interface DeleteReceiptData {
  id: string;
  number: string;
  clientName: string;
  totalAmount: number;
  date: Date;
}

export interface Product {
  id: string;
  name: string;
  itemCode: string;
  categoryId: string;
  buy_price: number;
  sell_price: number;
  weightAdjustment: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface PageSnapshots {
  [page: number]: QueryDocumentSnapshot<DocumentData> | null;
} 