import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ShoppingBag, ArrowRight, Package, Home } from "lucide-react";

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

export default function PedidoConfirmado() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderId = params.get('id');

  const { clearCart } = useCart();

  // Clear cart on mount
  useEffect(() => {
    clearCart();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative inline-flex">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-[#FF6E23] rounded-full flex items-center justify-center shadow-lg">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-center space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Gracias por tu pedido!
              </h1>
              <p className="text-gray-500">
                Tu pedido ha sido recibido y está siendo procesado.
                Un ejecutivo te contactará pronto.
              </p>
            </div>

            {/* Order ID */}
            {orderId && (
              <>
                <Separator />
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1">
                    <Package className="h-4 w-4" />
                    <span>Código de seguimiento</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#FF6E23] tracking-wider">
                    #{orderId}
                  </div>
                  <p className="text-xs text-gray-400">
                    Guarda este código para consultar el estado de tu pedido
                  </p>
                </div>
              </>
            )}

            {/* Status Timeline */}
            <div className="text-left space-y-3 py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Pedido recibido</p>
                  <p className="text-xs text-gray-400">Ahora</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Revisión por vendedor</p>
                  <p className="text-xs text-gray-300">Pendiente</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Presupuesto enviado</p>
                  <p className="text-xs text-gray-300">Pendiente</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/mis-pedidos" className="flex-1">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                >
                  <Package className="h-4 w-4" />
                  Mis Pedidos
                </Button>
              </Link>
              <Link href="/tienda" className="flex-1">
                <Button 
                  className="w-full gap-2 bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                >
                  Seguir comprando
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Tienes consultas? Contáctanos y menciona tu código de seguimiento.
        </p>
      </div>
    </div>
  );
}
