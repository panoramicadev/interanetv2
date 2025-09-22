import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { X, ShoppingCart, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import CartItem from "./CartItem";

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

export default function FloatingCart({ isOpen, onClose, trigger }: FloatingCartProps) {
  const { state } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isEmpty = state.items.length === 0;

  // Mobile view - use Sheet as modal
  const MobileCart = () => (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold text-gray-900" data-testid="text-cart-header">
                Mi Carrito - {state.itemCount} Producto{state.itemCount !== 1 ? 's' : ''}
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                data-testid="button-close-cart"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Cart Content */}
          <div className="flex-1 flex flex-col">
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Tu carrito está vacío
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Agrega productos a tu carrito para comenzar tu compra
                </p>
                <Button
                  onClick={onClose}
                  className="bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                  data-testid="button-continue-shopping"
                >
                  Continuar comprando
                </Button>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <ScrollArea className="flex-1">
                  <div className="p-0">
                    {state.items.map((item) => (
                      <CartItem key={item.id} item={item} compact={true} />
                    ))}
                  </div>
                </ScrollArea>

                {/* Cart Footer */}
                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="text-lg font-semibold text-gray-900" data-testid="text-cart-subtotal">
                        {formatPrice(state.subtotal)}
                      </span>
                    </div>
                    
                    {/* Tax */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">IVA (19%):</span>
                      <span className="text-sm font-medium text-gray-900" data-testid="text-cart-tax">
                        {formatPrice(state.taxAmount)}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    {/* Total */}
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-900">Total:</span>
                      <span className="text-xl font-bold text-[#FF6E23]" data-testid="text-cart-total">
                        {formatPrice(state.total)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">
                      <Link href="/carrito">
                        <Button 
                          className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                          onClick={onClose}
                          data-testid="button-goto-cart"
                        >
                          Ir al carrito
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={onClose}
                        data-testid="button-continue-shopping-footer"
                      >
                        Continuar comprando
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Desktop view - custom sliding panel
  const DesktopCart = () => (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={onClose}
          data-testid="backdrop-cart"
        />
      )}

      {/* Sliding Cart Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        data-testid="floating-cart-panel"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900" data-testid="text-cart-header-desktop">
                Mi Carrito - {state.itemCount} Producto{state.itemCount !== 1 ? 's' : ''}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid="button-close-cart-desktop"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Cart Content */}
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Tu carrito está vacío
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Agrega productos a tu carrito para comenzar tu compra
              </p>
              <Button
                onClick={onClose}
                className="bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                data-testid="button-continue-shopping-desktop"
              >
                Continuar comprando
              </Button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <ScrollArea className="flex-1">
                <div className="p-0">
                  {state.items.map((item) => (
                    <CartItem key={item.id} item={item} compact={true} />
                  ))}
                </div>
              </ScrollArea>

              {/* Cart Footer */}
              <div className="border-t border-gray-200 p-4 bg-white">
                <div className="space-y-3">
                  {/* Subtotal */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Subtotal:</span>
                    <span className="text-lg font-semibold text-gray-900" data-testid="text-cart-subtotal-desktop">
                      {formatPrice(state.subtotal)}
                    </span>
                  </div>
                  
                  {/* Tax */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">IVA (19%):</span>
                    <span className="text-sm font-medium text-gray-900" data-testid="text-cart-tax-desktop">
                      {formatPrice(state.taxAmount)}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-gray-900">Total:</span>
                    <span className="text-xl font-bold text-[#FF6E23]" data-testid="text-cart-total-desktop">
                      {formatPrice(state.total)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <Link href="/carrito">
                      <Button 
                        className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                        onClick={onClose}
                        data-testid="button-goto-cart-desktop"
                      >
                        Ir al carrito
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={onClose}
                      data-testid="button-continue-shopping-footer-desktop"
                    >
                      Continuar comprando
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Render different views based on screen size
  return (
    <>
      <div className="md:hidden">
        <MobileCart />
      </div>
      <div className="hidden md:block">
        <DesktopCart />
      </div>
    </>
  );
}