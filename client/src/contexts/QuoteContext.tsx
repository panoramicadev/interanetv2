/**
 * QuoteContext — State management for B2C quotation list
 * Independent from CartContext (B2B). No prices, no tax, no coupons.
 * Persists to localStorage under a separate key.
 */

import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';

// ── Types ──

export interface QuoteItem {
  id: string; // sku + color + format
  sku: string;
  productName: string;
  color?: string;
  format?: string;
  quantity: number;
  imageUrl?: string;
  minUnit: number;
  stepSize: number;
}

interface QuoteState {
  items: QuoteItem[];
  itemCount: number;
}

type QuoteAction =
  | { type: 'ADD_ITEM'; payload: Omit<QuoteItem, 'id'> }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_QUOTE' }
  | { type: 'LOAD_QUOTE'; payload: QuoteState };

// ── Helpers ──

function generateQuoteItemId(sku: string, color?: string, format?: string): string {
  return [sku, color || '', format || ''].join('__').toUpperCase();
}

const STORAGE_KEY = 'b2c_quote_items';

function loadFromStorage(): QuoteState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { items: parsed.items || [], itemCount: parsed.items?.length || 0 };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { items: [], itemCount: 0 };
}

function saveToStorage(state: QuoteState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ── Reducer ──

function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { payload } = action;
      const id = generateQuoteItemId(payload.sku, payload.color, payload.format);
      const existingIndex = state.items.findIndex(item => item.id === id);

      if (existingIndex >= 0) {
        const updated = [...state.items];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + payload.quantity,
        };
        return { items: updated, itemCount: updated.length };
      }

      const newItems = [...state.items, { ...payload, id }];
      return { items: newItems, itemCount: newItems.length };
    }

    case 'REMOVE_ITEM': {
      const items = state.items.filter(item => item.id !== action.payload.id);
      return { items, itemCount: items.length };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        const items = state.items.filter(item => item.id !== id);
        return { items, itemCount: items.length };
      }
      const items = state.items.map(item =>
        item.id === id ? { ...item, quantity } : item
      );
      return { items, itemCount: items.length };
    }

    case 'CLEAR_QUOTE':
      return { items: [], itemCount: 0 };

    case 'LOAD_QUOTE':
      return action.payload;

    default:
      return state;
  }
}

// ── Context ──

interface QuoteContextType {
  state: QuoteState;
  addItem: (item: Omit<QuoteItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearQuote: () => void;
  isItemInQuote: (sku: string, color?: string, format?: string) => boolean;
  getItemQuantity: (sku: string, color?: string, format?: string) => number;
}

export const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

// ── Provider ──

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, { items: [], itemCount: 0 }, loadFromStorage);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const addItem = useCallback((item: Omit<QuoteItem, 'id'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const clearQuote = useCallback(() => {
    dispatch({ type: 'CLEAR_QUOTE' });
  }, []);

  const isItemInQuote = useCallback((sku: string, color?: string, format?: string) => {
    const id = generateQuoteItemId(sku, color, format);
    return state.items.some(item => item.id === id);
  }, [state.items]);

  const getItemQuantity = useCallback((sku: string, color?: string, format?: string) => {
    const id = generateQuoteItemId(sku, color, format);
    return state.items.find(item => item.id === id)?.quantity || 0;
  }, [state.items]);

  return (
    <QuoteContext.Provider value={{
      state, addItem, removeItem, updateQuantity, clearQuote, isItemInQuote, getItemQuantity,
    }}>
      {children}
    </QuoteContext.Provider>
  );
}

// ── Hook ──

export function useQuote(): QuoteContextType {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error('useQuote must be used within QuoteProvider');
  return ctx;
}
