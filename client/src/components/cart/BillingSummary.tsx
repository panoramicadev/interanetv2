import { useState, useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Tag, MapPin, ShoppingBag, Package, CheckCircle2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getShippingKey } from "@shared/format-utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const formatPrice = (price: number): string => {
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

export default function BillingSummary() {
  const { state, applyCoupon, removeCoupon } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedAddressOption, setSelectedAddressOption] = useState<string>("default");
  const [customAddress, setCustomAddress] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch shipping rates from admin config
  const { data: shippingRates = {} } = useQuery<Record<string, number>>({
    queryKey: ['/api/ecommerce/shipping-rates'],
    queryFn: async () => {
      const res = await fetch('/api/ecommerce/shipping-rates', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch client data to get addresses
  const { data: clientData } = useQuery<{ dien?: string; cmen?: string; comuna?: string }>({
    queryKey: ['/api/clients/by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/clients/by-user/${user.id}`, {
        credentials: 'include'
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id && user?.role === 'client',
  });

  // Build list of available addresses
  const availableAddresses = [];
  if (clientData?.dien) {
    availableAddresses.push({
      value: 'default',
      label: 'Dirección principal',
      address: clientData.dien,
      fullAddress: `${clientData.dien}${clientData.comuna ? ', ' + clientData.comuna : ''}${clientData.cmen ? ', ' + clientData.cmen : ''}`
    });
  }

  // Set initial address option based on available addresses
  useEffect(() => {
    if (availableAddresses.length === 0 && selectedAddressOption === "default") {
      // If no saved addresses, default to custom input
      setSelectedAddressOption("custom");
    }
  }, [availableAddresses.length, selectedAddressOption]);

  // Compute final shipping address based on selection
  const shippingAddress = selectedAddressOption === "custom" 
    ? customAddress 
    : availableAddresses.find(a => a.value === selectedAddressOption)?.fullAddress || "";

  // Mock coupon validation - replace with real API call
  const validateCoupon = async (code: string): Promise<{ isValid: boolean; discount: number; type: 'percentage' | 'fixed'; description?: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockCoupons: Record<string, { discount: number; type: 'percentage' | 'fixed'; description: string }> = {
      'DESCUENTO10': { discount: 10, type: 'percentage', description: '10% de descuento' },
      'DESCUENTO5000': { discount: 5000, type: 'fixed', description: '$5,000 de descuento' },
      'WELCOME15': { discount: 15, type: 'percentage', description: '15% descuento bienvenida' },
      'CLIENTE5': { discount: 5, type: 'percentage', description: '5% descuento cliente' },
    };

    const normalizedCode = code.toUpperCase().trim();
    const coupon = mockCoupons[normalizedCode];
    
    if (coupon) {
      return { isValid: true, ...coupon };
    }
    
    return { isValid: false, discount: 0, type: 'fixed' };
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de cupón",
        variant: "destructive",
      });
      return;
    }

    // Check if coupon is already applied
    const isAlreadyApplied = state.appliedCoupons.some(c => c.code.toLowerCase() === couponCode.toLowerCase());
    if (isAlreadyApplied) {
      toast({
        title: "Cupón ya aplicado",
        description: "Este cupón ya está aplicado a tu pedido",
        variant: "destructive",
      });
      return;
    }

    setIsApplyingCoupon(true);
    
    try {
      const validation = await validateCoupon(couponCode);
      
      if (validation.isValid) {
        applyCoupon(
          couponCode.toUpperCase().trim(),
          validation.discount,
          validation.type,
          validation.description
        );
        
        setCouponCode("");
        toast({
          title: "¡Cupón aplicado!",
          description: `${validation.description} aplicado correctamente`,
        });
      } else {
        toast({
          title: "Cupón inválido",
          description: "El código de cupón ingresado no es válido",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al validar el cupón. Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = (code: string) => {
    removeCoupon(code);
    toast({
      title: "Cupón removido",
      description: "El cupón ha sido removido de tu pedido",
    });
  };

  const handleConfirmOrder = async () => {
    // 1. Validate cart is not empty
    if (state.items.length === 0) {
      toast({
        title: "Error de validación",
        description: "No puedes confirmar un pedido sin productos en el carrito.",
        variant: "destructive",
      });
      return;
    }

    // 2. Validate quantities
    const validationErrors: string[] = [];
    for (const item of state.items) {
      if (item.quantity < item.minQuantity) {
        validationErrors.push(`${item.productName}: cantidad mínima ${item.minQuantity}`);
      }
    }

    if (validationErrors.length > 0) {
      toast({
        title: "Error de validación",
        description: validationErrors.slice(0, 2).join(', '),
        variant: "destructive",
      });
      return;
    }

    // 3. Show confirmation modal
    setShowConfirmDialog(true);
  };

  const processOrder = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      const orderData = {
        items: state.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.productCode || item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.subtotal,
          imageUrl: item.imageUrl || null,
          selectedColor: item.selectedColor || null,
          selectedPackaging: item.selectedPackaging || null,
        })),
        subtotal: state.subtotal - state.discountAmount,
        tax: state.taxAmount,
        shipping: shippingCost,
        total: state.total + shippingCost,
        notes: orderNotes.trim() || null,
        shippingAddress: shippingAddress.trim() || null
      };

      const response = await fetch('/api/ecommerce/orders/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al procesar el pedido');
      }
      const createdOrder = await response.json();

      toast({
        title: "¡Pedido confirmado!",
        description: `Tu pedido ha sido enviado correctamente.`,
      });

      // Redirect to thank you page
      setTimeout(() => {
        window.location.href = `/pedido-confirmado?id=${createdOrder.id || ''}`;
      }, 1000);

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error al confirmar pedido",
        description: error.message || "No se pudo procesar tu pedido. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate neto (subtotal without any discounts or taxes)
  const neto = state.subtotal;
  
  // Calculate shipping cost and breakdown based on item units
  let shippingCost = 0;
  const shippingBreakdownMap = new Map<string, { qty: number; cost: number; unit: string }>();

  state.items.forEach(item => {
    const rateKey = getShippingKey(item.unit);
    if (rateKey && shippingRates[rateKey]) {
      const cost = shippingRates[rateKey];
      shippingCost += Math.round(cost * item.quantity);
      
      const existing = shippingBreakdownMap.get(rateKey);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        shippingBreakdownMap.set(rateKey, { qty: item.quantity, cost, unit: item.unit || rateKey });
      }
    }
  });

  const shippingBreakdownText = Array.from(shippingBreakdownMap.values())
    .map(b => `${b.qty}x ${b.unit} a ${formatPrice(b.cost)}`)
    .join(' + ');
  
  // Calculate final subtotal after discounts
  const subtotalAfterDiscount = neto - state.discountAmount;
  
  // Tax calculation (IVA 19%)
  const taxAmount = state.taxAmount;
  
  // Final total (includes shipping)
  const total = state.total + shippingCost;

  return (
    <>
    <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Facturación
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Billing Breakdown */}
        <div className="space-y-3">
          {/* Neto */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Neto:</span>
            <span className="font-medium text-gray-900 dark:text-white" data-testid="text-billing-neto">
              {formatPrice(neto)}
            </span>
          </div>

          {/* Applied Coupons */}
          {state.appliedCoupons.length > 0 && (
            <div className="space-y-2">
              {state.appliedCoupons.map((coupon) => (
                <div key={coupon.code} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Descuento ({coupon.code}):
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCoupon(coupon.code)}
                      className="h-4 w-4 p-0 text-gray-400 hover:text-red-500"
                      data-testid={`button-remove-coupon-${coupon.code}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="font-medium text-green-600 dark:text-green-400" data-testid={`text-discount-${coupon.code}`}>
                    -{coupon.type === 'percentage' ? `${coupon.discount}%` : formatPrice(coupon.discount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Total Discount Amount */}
          {state.discountAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Descuento:</span>
              <span className="font-medium text-green-600 dark:text-green-400" data-testid="text-billing-discount">
                -{formatPrice(state.discountAmount)}
              </span>
            </div>
          )}

          {/* Subtotal after discount */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
            <span className="font-medium text-gray-900 dark:text-white" data-testid="text-billing-subtotal">
              {formatPrice(subtotalAfterDiscount)}
            </span>
          </div>

          {/* Taxes (IVA 19%) */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Impuestos (IVA 19%):</span>
            <span className="font-medium text-gray-900 dark:text-white" data-testid="text-billing-tax">
              {formatPrice(taxAmount)}
            </span>
          </div>

          {/* Shipping / Despacho */}
          {shippingCost > 0 && (
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Despacho:
                </span>
                {shippingBreakdownText && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                    ({shippingBreakdownText})
                  </span>
                )}
              </div>
              <span className="font-medium text-gray-900 dark:text-white" data-testid="text-billing-shipping">
                {formatPrice(shippingCost)}
              </span>
            </div>
          )}

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Total:</span>
            <span className="text-2xl font-bold text-[#FF6E23]" data-testid="text-billing-total">
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {/* Coupon Input Section */}
        <div className="space-y-3">
          <Separator />
          <div>
            <Label htmlFor="coupon-code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ingresar cupón
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="coupon-code"
                type="text"
                placeholder="Código de cupón"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                className="flex-1"
                data-testid="input-coupon-code"
              />
              <Button
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon || !couponCode.trim()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
                size="sm"
                data-testid="button-apply-coupon"
              >
                {isApplyingCoupon ? "..." : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Applied Coupons Display */}
          {state.appliedCoupons.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Cupones aplicados:</Label>
              <div className="flex flex-wrap gap-1">
                {state.appliedCoupons.map((coupon) => (
                  <Badge key={coupon.code} variant="outline" className="text-xs text-green-600 border-green-200">
                    {coupon.code}
                    {coupon.description && (
                      <span className="ml-1">- {coupon.description}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shipping Address */}
        <div className="space-y-2">
          <Label htmlFor="shipping-address" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Dirección de despacho
          </Label>
          
          {/* Address Selector */}
          <Select 
            value={selectedAddressOption} 
            onValueChange={setSelectedAddressOption}
          >
            <SelectTrigger className="w-full" data-testid="select-shipping-address">
              <SelectValue placeholder="Selecciona una dirección" />
            </SelectTrigger>
            <SelectContent>
              {availableAddresses.map((addr) => (
                <SelectItem key={addr.value} value={addr.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{addr.label}</span>
                    <span className="text-xs text-gray-500">{addr.address}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="custom">
                <span className="font-medium">✏️ Otra dirección (ingresar manualmente)</span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Address Input - Only shown when "custom" is selected */}
          {selectedAddressOption === "custom" && (
            <Textarea
              id="custom-shipping-address"
              placeholder="Ingresa la dirección completa de despacho..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              rows={2}
              className="resize-none mt-2"
              data-testid="textarea-custom-address"
            />
          )}

          {/* Show selected address preview if not custom */}
          {selectedAddressOption !== "custom" && shippingAddress && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
              {shippingAddress}
            </div>
          )}
        </div>

        {/* Order Notes */}
        <div className="space-y-2">
          <Label htmlFor="order-notes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Notas del pedido (opcional)
          </Label>
          <Textarea
            id="order-notes"
            placeholder="Instrucciones especiales de entrega, comentarios adicionales..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            rows={3}
            className="resize-none"
            data-testid="textarea-order-notes"
          />
        </div>

        {/* Confirm Order Button */}
        <div className="pt-4">
          <Button
            onClick={handleConfirmOrder}
            disabled={isSubmitting || state.items.length === 0}
            className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold py-3 text-lg"
            size="lg"
            data-testid="button-confirm-order"
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar pedido'}
          </Button>
        </div>

        {/* Cart Summary */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          <p>{state.itemCount} producto{state.itemCount !== 1 ? 's' : ''} • {state.unitCount} unidades</p>
          <p className="mt-1">Los precios incluyen IVA</p>
        </div>
      </CardContent>
    </Card>

    {/* Confirmation Dialog */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-[#FF6E23]/10 rounded-full flex items-center justify-center">
              <ShoppingBag className="h-7 w-7 text-[#FF6E23]" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Confirmar pedido
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Package className="h-4 w-4" />Productos</span>
                  <span className="text-sm font-semibold text-gray-800">{state.itemCount} producto{state.itemCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Unidades totales</span>
                  <span className="text-sm font-semibold text-gray-800">{state.unitCount}</span>
                </div>
                {state.discountAmount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600">Descuento</span>
                    <span className="text-sm font-semibold text-green-600">-{formatPrice(state.discountAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Impuestos (IVA 19%)</span>
                  <span className="text-sm font-medium text-gray-700">{formatPrice(state.taxAmount)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 flex items-center gap-2"><Truck className="h-4 w-4" />Despacho</span>
                      {shippingBreakdownText && (
                        <span className="text-[10px] text-gray-400 mt-0.5 ml-6">
                          ({shippingBreakdownText})
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{formatPrice(shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-[#FF6E23]">{formatPrice(total)}</span>
                </div>
              </div>
              {shippingAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{shippingAddress}</span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-3 pt-2">
          <AlertDialogCancel className="flex-1">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={processOrder}
            className="flex-1 bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}