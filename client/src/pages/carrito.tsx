import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, ArrowLeft, Trash2, Minus, Plus, Package } from "lucide-react";
import { BillingSummary } from "@/components/cart";
import { useToast } from "@/hooks/use-toast";

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

// Extract color from product code
const extractColor = (code: string): string | null => {
  const upperCode = (code || '').toUpperCase();
  const colorMap: Record<string, string> = {
    'BLANC': 'Blanco', 'NEGRO': 'Negro', 'GRIS': 'Gris', 'AZUL': 'Azul',
    'ROJO': 'Rojo', 'VERDE': 'Verde', 'AMARI': 'Amarillo', 'CAFE': 'Café',
    'NAT': 'Natural', 'MAPLE': 'Maple', 'CAOBA': 'Caoba', 'NOGL': 'Nogal',
    'CASTA': 'Castaño', 'CEDER': 'Cedro', 'ROBLE': 'Roble', 'ALMEN': 'Almendra',
    'CREMA': 'Crema', 'MARFI': 'Marfil', 'CORAL': 'Coral', 'TERRA': 'Terracota',
    'POLCA': 'Caoba', 'POLNA': 'Natural', 'POLNO': 'Nogal',
  };
  for (const [key, val] of Object.entries(colorMap)) {
    if (upperCode.includes(key)) return val;
  }
  return null;
};

export default function Carrito() {
  const { state, clearCart, updateQuantity, removeItem } = useCart();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  const isEmpty = state.items.length === 0;

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mi carrito</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <ShoppingBag className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Tu carrito está vacío
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
              No tienes productos en tu carrito. Explora nuestra tienda y encuentra los productos que necesitas.
            </p>
            <Link href="/tienda">
              <Button 
                className="bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white px-8 py-3"
                size="lg"
                data-testid="button-browse-products"
              >
                Explorar productos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleClearCart = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar todos los productos del carrito?')) {
      clearCart();
    }
  };

  const handleRemove = (item: typeof state.items[0]) => {
    removeItem(item.id);
  };

  const startEdit = (item: typeof state.items[0]) => {
    setEditingId(item.id);
    setEditValue(item.quantity.toString());
  };

  const commitEdit = (item: typeof state.items[0]) => {
    const numValue = parseInt(editValue) || item.minQuantity;
    let newQty = numValue;
    if (newQty < item.minQuantity) newQty = item.minQuantity;
    if (newQty % item.quantityStep !== 0) {
      newQty = Math.ceil(newQty / item.quantityStep) * item.quantityStep;
    }
    updateQuantity(item.id, newQty);
    setEditingId(null);
  };

  const increment = (item: typeof state.items[0]) => {
    updateQuantity(item.id, item.quantity + item.quantityStep);
  };

  const decrement = (item: typeof state.items[0]) => {
    const newQty = Math.max(item.minQuantity, item.quantity - item.quantityStep);
    updateQuantity(item.id, newQty);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop-header">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-cart-title">
                Mi carrito
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-cart-count">
                {state.itemCount} Producto{state.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCart}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-200 dark:border-red-800"
            data-testid="button-clear-cart"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar todos
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Products Table (2/3 width on desktop) */}
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Desktop Table Header */}
              <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <div>Producto</div>
                <div className="w-28 text-center">Precio Unit.</div>
                <div className="w-36 text-center">Cantidad</div>
                <div className="w-28 text-right">Subtotal</div>
                <div className="w-8"></div>
              </div>

              {/* Product Rows */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {state.items.map((item) => {
                  const color = item.selectedColor || extractColor(item.productCode);
                  
                  return (
                    <div
                      key={item.id}
                      className="group hover:bg-gray-50/50 dark:hover:bg-gray-750/50 transition-colors"
                      data-testid={`cart-page-item-${item.productId}`}
                    >
                      {/* Desktop Row */}
                      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3">
                        {/* Product Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Small thumbnail */}
                          <div className="w-10 h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden border border-gray-200">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" data-testid={`text-cart-page-item-name-${item.productId}`}>
                              {item.productName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.productCode}</span>
                              {item.unit && (
                                <span className="text-[11px] text-gray-400">{item.unit}</span>
                              )}
                              {color && (
                                <span className="text-[11px] text-gray-400">• {color}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Unit Price */}
                        <div className="w-28 text-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300" data-testid={`text-unit-price-${item.productId}`}>
                            {formatPrice(item.unitPrice)}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="w-36 flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => decrement(item)}
                            disabled={item.quantity <= item.minQuantity}
                            className="h-7 w-7 p-0 rounded-md hover:bg-gray-200"
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          
                          {editingId === item.id ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(item)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(item);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              className="w-16 h-7 text-center text-sm px-1 font-mono"
                              min={item.minQuantity}
                              step={item.quantityStep}
                              data-testid={`input-quantity-${item.productId}`}
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              className="w-16 h-7 text-center text-sm font-mono font-semibold rounded-md border border-gray-200 bg-white hover:border-[#FF6E23] hover:text-[#FF6E23] transition-colors cursor-text"
                              data-testid={`input-quantity-${item.productId}`}
                            >
                              {item.quantity}
                            </button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => increment(item)}
                            className="h-7 w-7 p-0 rounded-md hover:bg-gray-200"
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Subtotal */}
                        <div className="w-28 text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-white" data-testid={`text-subtotal-${item.productId}`}>
                            {formatPrice(item.subtotal)}
                          </span>
                        </div>

                        {/* Remove */}
                        <div className="w-8">
                          <button
                            onClick={() => handleRemove(item)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            data-testid={`button-remove-${item.productId}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Mobile Row - Compact Card */}
                      <div className="md:hidden px-4 py-3">
                        <div className="flex items-start gap-3">
                          {/* Small thumbnail */}
                          <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden border border-gray-200">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded">{item.productCode}</span>
                                  {item.unit && <span className="text-[10px] text-gray-400">{item.unit}</span>}
                                  {color && <span className="text-[10px] text-gray-400">• {color}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemove(item)}
                                className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            
                            {/* Price + Qty row */}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">{formatPrice(item.unitPrice)} c/u</span>
                              
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => decrement(item)} disabled={item.quantity <= item.minQuantity} className="h-6 w-6 p-0">
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-sm font-mono font-semibold w-10 text-center">{item.quantity}</span>
                                <Button variant="ghost" size="sm" onClick={() => increment(item)} className="h-6 w-6 p-0">
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>

                              <span className="text-sm font-bold text-gray-900">{formatPrice(item.subtotal)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table Footer */}
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-500">{state.items.length} líneas • {state.itemCount} unidades</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  Neto: {formatPrice(state.items.reduce((sum, item) => sum + item.subtotal, 0))}
                </span>
              </div>
            </Card>
          </div>

          {/* Right Side - Billing Summary (1/3 width on desktop) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BillingSummary />
            </div>
          </div>
        </div>

        {/* Continue Shopping */}
        <div className="mt-8 text-center">
          <Link href="/tienda">
            <Button 
              variant="outline" 
              className="mt-2"
              data-testid="button-continue-shopping-bottom"
            >
              Continuar comprando
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}