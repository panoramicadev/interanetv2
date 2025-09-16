import { createContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  CartItem, 
  CartState, 
  CartAction, 
  CART_CONFIG,
  cartStateSchema 
} from '@shared/schema';

// ================================
// CART CALCULATION UTILITIES
// ================================

/**
 * Get quantity validation rules based on unit type
 * Enhanced with better regex patterns and normalization
 */
export const getQuantityRules = (unit: string | undefined) => {
  if (!unit) return CART_CONFIG.QUANTITY_RULES.DEFAULT;
  
  // Normalize unit: trim, uppercase, remove extra spaces
  const normalizedUnit = unit.toUpperCase().trim().replace(/\s+/g, ' ');
  
  // BD4 and BD5 (Baldes) - individual units - Enhanced pattern matching
  if (/(?:BD|BALDE)\s*[-_\s]*[45]|\bBALDE\s*(?:DE\s*)?[45]\s*GAL[ÓO]N(?:ES)?|\b[45]\s*GAL[ÓO]N(?:ES)?\s*BALDE/i.test(normalizedUnit)) {
    return normalizedUnit.includes('4') ? CART_CONFIG.QUANTITY_RULES.BD4 : CART_CONFIG.QUANTITY_RULES.BD5;
  }
  
  // 1/4 (1/4 de Galón) - multiples of 6 - Enhanced pattern matching
  if (/(?:1\s*[\/\-]\s*4|UN\s*CUARTO|CUARTO(?:\s*(?:DE\s*)?GAL[ÓO]N)?|(?:0[\.,])?25\s*GAL[ÓO]N)/i.test(normalizedUnit)) {
    return CART_CONFIG.QUANTITY_RULES['1/4'];
  }
  
  // GL (Galones) - multiples of 4 - Enhanced pattern matching  
  if (/(?:^|\b)(?:GL|GAL[ÓO]N(?:ES)?)(?:\b|$)|LITRO/i.test(normalizedUnit) && 
      !/(?:BD|BALDE|1\s*\/\s*4|CUARTO)/i.test(normalizedUnit)) {
    return CART_CONFIG.QUANTITY_RULES.GL;
  }
  
  return CART_CONFIG.QUANTITY_RULES.DEFAULT;
};

/**
 * Validate and correct quantity based on unit rules
 * Enhanced with MAX limits enforcement
 */
export const validateQuantity = (quantity: number, unit: string): { 
  isValid: boolean; 
  validQuantity: number; 
  minQuantity: number; 
  stepQuantity: number;
  maxQuantity: number;
  error?: string;
} => {
  // Input validation
  if (typeof quantity !== 'number' || !isFinite(quantity) || quantity < 0) {
    return {
      isValid: false,
      validQuantity: 1,
      minQuantity: 1,
      stepQuantity: 1,
      maxQuantity: CART_CONFIG.MAX_QUANTITY_PER_ITEM,
      error: 'Cantidad inválida'
    };
  }

  const rules = getQuantityRules(unit);
  const { minQuantity, stepQuantity } = rules;
  const maxQuantity = CART_CONFIG.MAX_QUANTITY_PER_ITEM;
  
  // Check maximum limit
  if (quantity > maxQuantity) {
    return {
      isValid: false,
      validQuantity: maxQuantity,
      minQuantity,
      stepQuantity,
      maxQuantity,
      error: `Cantidad máxima: ${maxQuantity} unidades`
    };
  }
  
  // Check minimum limit
  if (quantity < minQuantity) {
    return {
      isValid: false,
      validQuantity: minQuantity,
      minQuantity,
      stepQuantity,
      maxQuantity,
      error: `Cantidad mínima: ${minQuantity} ${rules.displayName.toLowerCase()}`
    };
  }
  
  // For step-based validation (GL=4, 1/4=6)
  if (stepQuantity > 1) {
    const remainder = quantity % stepQuantity;
    if (remainder !== 0) {
      const validQuantity = Math.max(minQuantity, Math.floor(quantity / stepQuantity) * stepQuantity);
      return {
        isValid: false,
        validQuantity,
        minQuantity,
        stepQuantity,
        maxQuantity,
        error: `Debe ser múltiplo de ${stepQuantity} (ej: ${validQuantity})`
      };
    }
  }
  
  return {
    isValid: true,
    validQuantity: quantity,
    minQuantity,
    stepQuantity,
    maxQuantity
  };
};

/**
 * Generate unique cart item ID based on product and variations
 * Enhanced with normalization for consistent ID generation
 */
export const generateCartItemId = (productId: string, variations?: Record<string, string>): string => {
  if (!productId?.trim()) {
    throw new Error('Product ID is required for cart item');
  }
  
  const normalizedProductId = productId.trim();
  
  const variationString = variations ? 
    Object.entries(variations)
      .filter(([_, value]) => value != null && value.trim() !== '') // Filter out null/empty values
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key.trim()}:${value.trim().toUpperCase()}`)
      .join('|') : '';
  
  return `${normalizedProductId}${variationString ? `_${variationString}` : ''}`;
};

/**
 * Calculate item subtotal
 */
export const calculateItemSubtotal = (unitPrice: number, quantity: number): number => {
  return Math.round(unitPrice * quantity);
};

/**
 * Calculate cart subtotal
 */
export const calculateCartSubtotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + item.subtotal, 0);
};

/**
 * Calculate tax amount (IVA 19%)
 */
export const calculateTax = (subtotal: number, taxRate = CART_CONFIG.TAX_RATE): number => {
  return Math.round(subtotal * taxRate);
};

/**
 * Calculate total discount from applied coupons
 */
export const calculateDiscount = (subtotal: number, coupons: CartState['appliedCoupons']): number => {
  return coupons.reduce((total, coupon) => {
    if (coupon.type === 'percentage') {
      return total + Math.round(subtotal * (coupon.discount / 100));
    }
    return total + coupon.discount;
  }, 0);
};

/**
 * Calculate final total
 */
export const calculateTotal = (subtotal: number, taxAmount: number, discountAmount: number): number => {
  return Math.max(0, subtotal + taxAmount - discountAmount);
};

/**
 * Recalculate all cart totals
 */
export const recalculateCartTotals = (state: CartState): CartState => {
  // Recalculate item subtotals
  const updatedItems = state.items.map(item => ({
    ...item,
    subtotal: calculateItemSubtotal(item.unitPrice, item.quantity)
  }));
  
  const subtotal = calculateCartSubtotal(updatedItems);
  const taxAmount = calculateTax(subtotal);
  const discountAmount = calculateDiscount(subtotal, state.appliedCoupons);
  const total = calculateTotal(subtotal, taxAmount, discountAmount);
  
  return {
    ...state,
    items: updatedItems,
    subtotal,
    taxAmount,
    discountAmount,
    total,
    itemCount: updatedItems.length,
    unitCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
    lastUpdated: new Date().toISOString(),
    version: state.version || '1.0.0'
  };
};

// ================================
// CART REDUCER
// ================================

export const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { payload } = action;
      const rules = getQuantityRules(payload.unit);
      const validationResult = validateQuantity(payload.quantity, payload.unit);
      
      // Generate unique ID for cart item (allows same product with different variations)
      const variations = {
        ...(payload.selectedPackaging && { packaging: payload.selectedPackaging }),
        ...(payload.selectedColor && { color: payload.selectedColor }),
        ...(payload.selectedFinish && { finish: payload.selectedFinish })
      };
      
      const itemId = generateCartItemId(payload.productId, variations);
      
      // Check if item already exists
      const existingItemIndex = state.items.findIndex(item => item.id === itemId);
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        const existingItem = state.items[existingItemIndex];
        const newQuantity = existingItem.quantity + validationResult.validQuantity;
        const updatedQuantity = validateQuantity(newQuantity, payload.unit);
        
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: updatedQuantity.validQuantity,
          subtotal: calculateItemSubtotal(existingItem.unitPrice, updatedQuantity.validQuantity),
          updatedAt: new Date().toISOString()
        };
        
        return recalculateCartTotals({
          ...state,
          items: updatedItems
        });
      } else {
        // Check MAX_ITEMS limit before adding new item
        if (state.items.length >= CART_CONFIG.MAX_ITEMS) {
          console.warn(`Cart limit reached: ${CART_CONFIG.MAX_ITEMS} items maximum`);
          return state; // Return state unchanged
        }
        
        // Add new item
        const now = new Date().toISOString();
        const newItem: CartItem = {
          ...payload,
          id: itemId,
          quantity: validationResult.validQuantity,
          subtotal: calculateItemSubtotal(payload.unitPrice, validationResult.validQuantity),
          minQuantity: rules.minQuantity,
          quantityStep: rules.stepQuantity,
          addedAt: now,
          updatedAt: now
        };
        
        return recalculateCartTotals({
          ...state,
          items: [...state.items, newItem]
        });
      }
    }
    
    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => item.id !== action.payload.id);
      return recalculateCartTotals({
        ...state,
        items: updatedItems
      });
    }
    
    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      const itemIndex = state.items.findIndex(item => item.id === id);
      
      if (itemIndex === -1) return state;
      
      const item = state.items[itemIndex];
      const validationResult = validateQuantity(quantity, item.unit);
      
      const updatedItems = [...state.items];
      updatedItems[itemIndex] = {
        ...item,
        quantity: validationResult.validQuantity,
        subtotal: calculateItemSubtotal(item.unitPrice, validationResult.validQuantity),
        updatedAt: new Date().toISOString()
      };
      
      return recalculateCartTotals({
        ...state,
        items: updatedItems
      });
    }
    
    case 'UPDATE_ITEM': {
      const { id, updates } = action.payload;
      const itemIndex = state.items.findIndex(item => item.id === id);
      
      if (itemIndex === -1) return state;
      
      const updatedItems = [...state.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      return recalculateCartTotals({
        ...state,
        items: updatedItems
      });
    }
    
    case 'CLEAR_CART': {
      return {
        ...getInitialCartState(),
        lastUpdated: new Date().toISOString()
      };
    }
    
    case 'APPLY_COUPON': {
      const { code, discount, type, description } = action.payload;
      
      // Check if coupon already applied
      const existingCouponIndex = state.appliedCoupons.findIndex(c => c.code === code);
      if (existingCouponIndex >= 0) return state;
      
      const newCoupon = { code, discount, type, description };
      return recalculateCartTotals({
        ...state,
        appliedCoupons: [...state.appliedCoupons, newCoupon]
      });
    }
    
    case 'REMOVE_COUPON': {
      const updatedCoupons = state.appliedCoupons.filter(c => c.code !== action.payload.code);
      return recalculateCartTotals({
        ...state,
        appliedCoupons: updatedCoupons
      });
    }
    
    case 'LOAD_CART': {
      return action.payload;
    }
    
    case 'CALCULATE_TOTALS': {
      return recalculateCartTotals(state);
    }
    
    default:
      return state;
  }
};

// ================================
// CART CONTEXT SETUP
// ================================

/**
 * Get initial cart state
 */
export const getInitialCartState = (): CartState => ({
  items: [],
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  total: 0,
  itemCount: 0,
  unitCount: 0,
  appliedCoupons: [],
  lastUpdated: new Date().toISOString(),
  version: '1.0.0',
});

/**
 * Local storage key for cart persistence
 */
const CART_STORAGE_KEY = 'panoramica_cart_state';

/**
 * Load cart from localStorage with version migration support
 */
const loadCartFromStorage = (): CartState => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Handle version migration if needed
      if (!parsed.version) {
        parsed.version = '1.0.0';
        console.info('Migrated cart to version 1.0.0');
      }
      
      // Validate with Zod schema
      const validated = cartStateSchema.parse(parsed);
      return validated;
    }
  } catch (error) {
    console.warn('Error loading cart from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem(CART_STORAGE_KEY);
  }
  
  return getInitialCartState();
};

/**
 * Save cart to localStorage
 */
const saveCartToStorage = (cartState: CartState): void => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  } catch (error) {
    console.warn('Error saving cart to localStorage:', error);
  }
};

// Cart Context Interface
export interface CartContextType {
  // State
  state: CartState;
  
  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'subtotal' | 'addedAt' | 'updatedAt'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number, type: 'percentage' | 'fixed', description?: string) => void;
  removeCoupon: (code: string) => void;
  
  // Utilities
  isItemInCart: (productId: string, variations?: Record<string, string>) => boolean;
  getCartItemQuantity: (productId: string, variations?: Record<string, string>) => number;
  getItemById: (id: string) => CartItem | undefined;
  validateItemQuantity: (quantity: number, unit: string) => ReturnType<typeof validateQuantity>;
}

// Create Cart Context
export const CartContext = createContext<CartContextType | undefined>(undefined);

// ================================
// CART PROVIDER COMPONENT
// ================================

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, getInitialCartState(), (initial) => {
    // Load from localStorage on initialization
    const stored = loadCartFromStorage();
    return stored;
  });
  
  // Save to localStorage whenever state changes
  useEffect(() => {
    saveCartToStorage(state);
  }, [state]);
  
  // Action functions
  const addItem = (item: Omit<CartItem, 'id' | 'subtotal' | 'addedAt' | 'updatedAt'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };
  
  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };
  
  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };
  
  const updateItem = (id: string, updates: Partial<CartItem>) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, updates } });
  };
  
  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };
  
  const applyCoupon = (code: string, discount: number, type: 'percentage' | 'fixed', description?: string) => {
    dispatch({ type: 'APPLY_COUPON', payload: { code, discount, type, description } });
  };
  
  const removeCoupon = (code: string) => {
    dispatch({ type: 'REMOVE_COUPON', payload: { code } });
  };
  
  // Utility functions
  const isItemInCart = (productId: string, variations?: Record<string, string>): boolean => {
    const itemId = generateCartItemId(productId, variations);
    return state.items.some(item => item.id === itemId);
  };
  
  const getCartItemQuantity = (productId: string, variations?: Record<string, string>): number => {
    const itemId = generateCartItemId(productId, variations);
    const item = state.items.find(item => item.id === itemId);
    return item?.quantity || 0;
  };
  
  const getItemById = (id: string): CartItem | undefined => {
    return state.items.find(item => item.id === id);
  };
  
  const validateItemQuantity = (quantity: number, unit: string) => {
    return validateQuantity(quantity, unit);
  };
  
  const value: CartContextType = {
    state,
    addItem,
    removeItem,
    updateQuantity,
    updateItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    isItemInCart,
    getCartItemQuantity,
    getItemById,
    validateItemQuantity
  };
  
  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}