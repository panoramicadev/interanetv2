import { useEffect, useState, useRef } from "react";
import { Link, useSearch } from "wouter";
import { getNumericOrderId } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { clearAttachedOc } from "@/lib/attached-oc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  Package,
  Upload,
  FileCheck,
  AlertTriangle,
  Building2,
  Landmark,
  Copy,
  Loader2,
  FileImage,
  Truck,
} from "lucide-react";

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

const BANK_DETAILS = {
  empresa: "Pintureria Panoramica Limitada",
  rut: "78.652.260-9",
  banco: "Banco Santander",
  tipoCuenta: "Cuenta Corriente",
  numeroCuenta: "2592916-0",
  email: "contacto@pinturaspanoramica.cl",
};

export default function PedidoConfirmado() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderId = params.get('id');

  const { clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Clear cart on mount + drop any OC attachment that was carried over from the
  // SKU quick-order modal or checkout — the order already snapshotted the URL.
  useEffect(() => {
    clearCart();
    clearAttachedOc(user?.id);
  }, []);

  // Fetch order details to check payment condition
  const { data: orderData, isLoading: orderLoading } = useQuery<any>({
    queryKey: ['/api/ecommerce/orders', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await fetch(`/api/ecommerce/orders?id=${orderId}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orderId,
  });

  // Determine if payment is NOT credit based directly on the explicit order saving
  const paymentCondition = orderData?.paymentCondition || '';
  const isCredit = paymentCondition.toUpperCase().includes('CREDITO') || 
                   paymentCondition.toUpperCase().includes('CRÉDITO');
  const requiresReceipt = !!orderData && !isCredit;
  const hasReceipt = !!orderData?.paymentReceiptUrl;

  // Upload receipt handler
  const handleUploadReceipt = async (file: File) => {
    if (!orderId) return;
    setIsUploading(true);
    try {
      // Step 1: Upload file to /api/upload
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Error al subir archivo');
      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.url || uploadData.fileUrl;

      // Step 2: Attach receipt URL to order
      const patchRes = await fetch(`/api/ecommerce/orders/${orderId}/receipt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentReceiptUrl: fileUrl }),
      });
      if (!patchRes.ok) throw new Error('Error al asociar comprobante');

      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders', orderId] });

      toast({
        title: "¡Comprobante enviado!",
        description: "Hemos recibido tu comprobante. Revisaremos la transferencia y procesaremos tu pedido.",
      });
    } catch (error: any) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el comprobante. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadReceipt(file);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Texto copiado al portapapeles" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Success Animation */}
        <div className="text-center mb-4">
          <div className="relative inline-flex">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 bg-[#FF6E23] rounded-full flex items-center justify-center shadow-lg">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="bg-white shadow-xl border-0 rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-center space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Gracias por tu pedido!
              </h1>
              <p className="text-gray-500">
                {requiresReceipt
                  ? 'Tu pedido ha sido recibido. Para proceder con el despacho, debes subir tu comprobante de pago.'
                  : 'Tu pedido ha sido recibido y está siendo procesado. Un ejecutivo te contactará pronto.'}
              </p>
            </div>



            {/* --- Transfer Details (only if NOT credit) --- */}
            {requiresReceipt && (
              <>
                <Separator />
                {/* Alert Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-left">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Pago pendiente
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Tu pedido se comenzará a procesar <strong>únicamente</strong> cuando subas el comprobante de pago y nuestro equipo lo valide.
                    </p>
                  </div>
                </div>

                {/* Bank Details Card */}
                <div className="bg-[#FF6E23]/5 border-2 border-[#FF6E23]/40 shadow-sm rounded-xl p-6 text-left space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#FF6E23]"></div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-[#FF6E23] p-1.5 rounded-lg">
                      <Landmark className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-slate-800 text-lg">Datos para Transferencia</span>
                  </div>

                  {[
                    { label: 'Empresa', value: BANK_DETAILS.empresa },
                    { label: 'RUT', value: BANK_DETAILS.rut },
                    { label: 'Banco', value: BANK_DETAILS.banco },
                    { label: 'Tipo de Cuenta', value: BANK_DETAILS.tipoCuenta },
                    { label: 'N° Cuenta', value: BANK_DETAILS.numeroCuenta },
                    { label: 'Email', value: BANK_DETAILS.email },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-200/60 last:border-0 hover:bg-slate-50/50 rounded-md px-1 transition-colors">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.value}</span>
                        <button
                          onClick={() => copyToClipboard(item.value)}
                          className="text-slate-400 hover:text-[#FF6E23] bg-white border border-slate-200 shadow-sm rounded p-1 transition-all hover:scale-105 active:scale-95"
                          title="Copiar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {orderData?.total && (
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-300">
                      <span className="text-sm font-semibold text-slate-700">Monto a transferir</span>
                      <span className="text-lg font-bold text-[#FF6E23]">{formatPrice(Number(orderData.total))}</span>
                    </div>
                  )}
                </div>

                {/* Upload Receipt Section */}
                {!hasReceipt ? (
                  <div className="space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={onFileSelected}
                      accept="image/*,.pdf"
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold py-3 text-base gap-2"
                      size="lg"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Subiendo comprobante...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          Subir comprobante de pago
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-400">
                      Acepta imágenes (JPG, PNG) y PDF de tu comprobante de transferencia.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 text-left">
                    <FileCheck className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        Comprobante recibido
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Hemos recibido tu comprobante de pago. Nuestro equipo lo revisará y comenzaremos a procesar tu pedido a la brevedad.
                      </p>
                      <a
                        href={orderData.paymentReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium mt-2 underline"
                      >
                        <FileImage className="h-3.5 w-3.5" />
                        Ver comprobante enviado
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Código de seguimiento + acceso público */}
            {orderId && (
              <>
                <Separator />
                <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-base font-semibold text-gray-700 mb-1">
                    <Package className="h-5 w-5 text-[#FF6E23]" />
                    <span>{requiresReceipt && !hasReceipt ? 'Pedido Pendiente de Pago' : 'Estamos Procesando tu Pedido'}</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#FF6E23] tracking-wider">
                    {orderData?.trackingCode || `#${getNumericOrderId(orderId)}`}
                  </div>
                  <p className="text-xs text-gray-400">
                    Guarda este código para seguir tu pedido sin iniciar sesión.
                  </p>
                  {orderData?.trackingCode && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Link href={`/seguimiento/${orderData.trackingCode}`} className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                          <Truck className="h-4 w-4" />
                          Ver seguimiento
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => copyToClipboard(`${window.location.origin}/seguimiento/${orderData.trackingCode}`)}
                      >
                        <Copy className="h-4 w-4" />
                        Copiar link
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

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
        <p className="text-center text-xs text-gray-400">
          ¿Tienes consultas? Contáctanos y menciona tu código de seguimiento.
        </p>
      </div>
    </div>
  );
}
