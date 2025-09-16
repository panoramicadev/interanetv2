import { useContext } from 'react';
import { CartContext, CartContextType } from '@/contexts/CartContext';

/**
 * Custom hook to access cart context
 * Provides type-safe access to all cart functionality
 * 
 * @throws Error if used outside of CartProvider
 * @returns CartContextType with all cart state and actions
 */
export function useCart(): CartContextType {
  const context = useContext(CartContext);
  
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
}

/**
 * Convenience hook to get cart item count for UI badges
 * @returns number of items in cart
 */
export function useCartItemCount(): number {
  const { state } = useCart();
  return state.itemCount;
}

/**
 * Convenience hook to get cart unit count (total quantity of all items)
 * @returns total quantity of all items in cart
 */
export function useCartUnitCount(): number {
  const { state } = useCart();
  return state.unitCount;
}

/**
 * Convenience hook to get cart total
 * @returns total amount of cart in CLP
 */
export function useCartTotal(): number {
  const { state } = useCart();
  return state.total;
}

/**
 * Convenience hook to check if a specific product is in cart
 * @param productId - Product ID to check
 * @param variations - Product variations (packaging, color, etc.)
 * @returns boolean indicating if product is in cart
 */
export function useIsItemInCart(productId: string, variations?: Record<string, string>): boolean {
  const { isItemInCart } = useCart();
  return isItemInCart(productId, variations);
}

/**
 * Convenience hook to get quantity of a specific product in cart
 * @param productId - Product ID to check
 * @param variations - Product variations (packaging, color, etc.)
 * @returns quantity of product in cart (0 if not in cart)
 */
export function useCartItemQuantity(productId: string, variations?: Record<string, string>): number {
  const { getCartItemQuantity } = useCart();
  return getCartItemQuantity(productId, variations);
}