import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { X, ShoppingCart, ArrowRight, Minus, Plus, Trash2, Package, Truck, Store, Palette } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";

interface FloatingCartProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: React.ReactNode;
}

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

// Modern cart item component with image
function ModernCartItem({ item }: { item: any }) {
  const { updateQuantity, removeItem } = useCart();

  const incrementQuantity = () => {
    updateQuantity(item.id, item.quantity + item.quantityStep);
  };

  const decrementQuantity = () => {
    const newQty = item.quantity - item.quantityStep;
    if (newQty < item.minQuantity) {
      removeItem(item.id);
    } else {
      updateQuantity(item.id, newQty);
    }
  };

  return (
    <div
      className={`flex gap-3 p-3 transition-colors group ${
        item.isCustomColor
          ? 'bg-fuchsia-50/60 hover:bg-fuchsia-50 border-l-2 border-fuchsia-400'
          : 'hover:bg-gray-50/50'
      }`}
    >
      {/* Product Image — en un color a medida no hay foto del tono, así que la
          muestra es el swatch del hex cotizado */}
      <div
        className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 overflow-hidden border border-gray-100 flex items-center justify-center"
        style={item.isCustomColor && item.customColorHex ? { background: item.customColorHex } : undefined}
      >
        {item.isCustomColor ? (
          <Palette className="w-6 h-6 text-white drop-shadow" />
        ) : item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            className="w-full h-full object-contain p-1"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-gray-800 line-clamp-1 uppercase">
          {item.productName}
        </h4>
        {item.isCustomColor && (
          <span
            className="inline-flex items-center gap-1 mt-0.5 text-[9px] bg-fuchsia-600 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
            title={`Color a medida ${item.customColorCode || ''}${item.customColorBrand ? ` (${item.customColorBrand})` : ''} — precio cotizado para ti`}
          >
            <Palette className="w-2.5 h-2.5" />
            Personalizado
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.selectedColor && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              item.isCustomColor ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-orange-50 text-orange-600'
            }`}>
              {item.selectedColor}
            </span>
          )}
          {item.selectedPackaging && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
              {item.selectedPackaging}
            </span>
          )}
        </div>
        
        {/* Price row */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex flex-col">
            {item.originalPrice && item.originalPrice > item.unitPrice ? (
              <>
                {item.isOffer ? (
                  <span className="inline-flex items-center self-start bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase mb-0.5">
                    Oferta
                  </span>
                ) : item.convenioPct ? (
                  <span
                    className="inline-flex items-center self-start bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase mb-0.5"
                    title={`Descuento convenio ${item.convenioPct}% sobre lista asignada`}
                  >
                    Convenio -{item.convenioPct}%
                  </span>
                ) : null}
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-bold ${item.isOffer ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatPrice(item.subtotal)}
                  </span>
                  <span className="text-[10px] text-gray-400 line-through">
                    {formatPrice(item.originalPrice * item.quantity)}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-sm font-bold text-gray-900">
                {formatPrice(item.subtotal)}
              </span>
            )}
          </div>
          
          {/* Compact quantity control */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={decrementQuantity}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 text-center text-xs font-bold text-gray-800">
              {item.quantity}
            </span>
            <button
              onClick={incrementQuantity}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeItem(item.id)}
              className="w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors ml-1 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// The cart content (shared between mobile and desktop)
function CartContent({ state, onClose }: { state: any; onClose: () => void }) {
  const isEmpty = state.items.length === 0;
  const { user } = useAuth();
  const { data: thresholdData } = useQuery<{ threshold: number }>({
    queryKey: ['/api/ecommerce/free-shipping-threshold'],
    retry: false,
  });
  const { data: clientData } = useQuery<{ freeShipping?: boolean }>({
    queryKey: ['/api/clients/by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/clients/by-user/${user.id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && user?.role === 'client',
  });
  const clientHasFreeShipping = !!clientData?.freeShipping;
  const FREE_SHIPPING_THRESHOLD = thresholdData?.threshold ?? 250000;
  const progress = clientHasFreeShipping ? 100 : Math.min(100, (state.subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remaining = clientHasFreeShipping ? 0 : FREE_SHIPPING_THRESHOLD - state.subtotal;

  // Read delivery method from localStorage (set by BillingSummary)
  const [deliveryMethod, setDeliveryMethod] = useState<'despacho' | 'retiro'>(() => {
    const saved = localStorage.getItem('cart_delivery_method');
    return (saved === 'retiro') ? 'retiro' : 'despacho';
  });

  // Re-read on each render when cart opens
  useEffect(() => {
    const saved = localStorage.getItem('cart_delivery_method');
    setDeliveryMethod((saved === 'retiro') ? 'retiro' : 'despacho');
  }, [state.items]);

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <ShoppingCart className="h-9 w-9 text-[#FF6E23]" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Tu carrito está vacío
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Explora nuestro catálogo y agrega productos
        </p>
        <Button
          onClick={onClose}
          className="bg-[#FF6E23] hover:bg-[#E55E13] text-white rounded-xl px-6 shadow-md shadow-orange-200"
        >
          Seguir comprando
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Free shipping progress */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
        {remaining > 0 ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                Envío gratis
              </span>
              <span className="text-[10px] font-bold text-[#FF6E23]">
                Faltan {formatPrice(remaining)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF6E23] to-amber-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-bold text-emerald-600">🎉 ¡Envío gratis aplicado!</span>
          </div>
        )}
      </div>

      {/* Delivery method indicator */}
      <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
        {deliveryMethod === 'despacho' ? (
          <>
            <Truck className="h-3.5 w-3.5 text-[#FF6E23]" />
            <span className="text-[11px] font-semibold text-gray-600">Despacho a domicilio</span>
          </>
        ) : (
          <>
            <Store className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-gray-600">Retiro en bodega</span>
            <span className="text-[10px] text-emerald-600 font-bold ml-auto">Sin costo</span>
          </>
        )}
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-gray-100">
          {state.items.map((item: any) => (
            <ModernCartItem key={item.id} item={item} />
          ))}
        </div>
      </ScrollArea>

      {/* Cart Footer */}
      <div className="border-t-2 border-gray-100 p-4 bg-white">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Subtotal ({state.itemCount} prod.)</span>
            <span className="text-sm font-semibold text-gray-700">
              {formatPrice(state.subtotal)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">IVA (19%)</span>
            <span className="text-sm font-medium text-gray-600">
              {formatPrice(state.taxAmount)}
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-xl font-black text-[#FF6E23]">
              {formatPrice(state.total)}
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <Link href="/carrito">
              <Button 
                className="w-full bg-[#FF6E23] hover:bg-[#E55E13] text-white rounded-xl shadow-md shadow-orange-200 font-bold"
                onClick={onClose}
              >
                Ir al carrito
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full text-gray-500 hover:text-gray-700 text-sm"
              onClick={onClose}
            >
              Seguir comprando
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FloatingCart({ isOpen, onClose, trigger }: FloatingCartProps) {
  const { state } = useCart();
  const isMobile = useIsMobile();

  // Mobile view using Sheet component
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="border-b border-gray-200 p-4 flex flex-row items-center justify-between">
            <div>
              <SheetTitle className="text-base font-bold text-gray-900">
                🛒 Carrito · {state.itemCount}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Carrito de compras con {state.itemCount} productos
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex flex-col h-full">
            <CartContent state={state} onClose={onClose} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop view using fixed positioned panel
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b-2 border-gray-100 px-5 py-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6E23] to-amber-400 flex items-center justify-center shadow-sm">
                <ShoppingCart className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Mi Carrito</h2>
                <span className="text-[10px] text-gray-400 font-medium">
                  {state.itemCount} producto{state.itemCount !== 1 ? 's' : ''} · {state.unitCount} unidad{state.unitCount !== 1 ? 'es' : ''}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <CartContent state={state} onClose={onClose} />
        </div>
      </div>
    </>
  );
}