/**
 * Shared types for sales/transaction data across the frontend
 * These types align with the backend API contract from getSalesTransactions
 */

export interface Transaction {
  id: string;
  idmaeedo?: number;
  idmaeddo?: number;
  tido?: string;
  nudo: string;
  feemdo: string | null;
  nokoen: string | null;
  nokofu: string | null;
  noruen: string | null;
  nokopr: string | null; // Product name (mapped from fact_ventas.nokoprct)
  caprco2?: string | null;
  caprad2?: string | null;
  vanedo?: string | null;
  monto: string | null;
  esdo?: string | null;
  
  // Additional fields for transaction details
  koprct?: string; // SKU
  endo?: string;
  modo?: string;
  vabrdo?: number;
  vaivdo?: number;
  ppprne?: number;
  ppprbr?: number;
  udtrpr?: number;
}

export interface GroupedSale {
  nudo: string;
  customerName: string;
  salesperson: string;
  date: string;
  totalAmount: number;
  transactionCount: number;
  transactions: Transaction[];
  isExpanded?: boolean;
}
