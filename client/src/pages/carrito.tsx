import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";
import { CartPageItem, BillingSummary } from "@/components/cart";

export default function Carrito() {
  const { state, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state on SSR
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
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mi carrito</h1>
          </div>

          {/* Empty State */}
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/tienda">
              <Button variant="ghost" size="sm" data-testid="button-back-to-shop-header">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-cart-title">
                Mi carrito
              </h1>
              <p className="text-gray-500 dark:text-gray-400" data-testid="text-cart-count">
                {state.itemCount} Producto{state.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={handleClearCart}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 border-red-200 dark:border-red-800"
            data-testid="button-clear-cart"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar todos
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Products Section (2/3 width on desktop) */}
          <div className="lg:col-span-2">
            <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Productos en tu carrito
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {state.items.map((item, index) => (
                    <div key={item.id} className="p-6">
                      <CartPageItem 
                        item={item} 
                        showDivider={index < state.items.length - 1}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Billing Summary (1/3 width on desktop) */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <BillingSummary />
            </div>
          </div>
        </div>

        {/* Continue Shopping Section */}
        <div className="mt-12 text-center">
          <Separator className="mb-8" />
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              ¿Necesitas algo más?
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Continúa explorando nuestros productos y encuentra todo lo que necesitas
            </p>
            <Link href="/tienda">
              <Button 
                variant="outline" 
                className="mt-4"
                data-testid="button-continue-shopping-bottom"
              >
                Continuar comprando
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}