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
import { X, Tag, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    // Comprehensive checkout validation
    const validationErrors: string[] = [];

    // 1. Validate cart state (non-empty cart)
    if (state.items.length === 0) {
      validationErrors.push("El carrito está vacío");
      toast({
        title: "Error de validación",
        description: "No puedes confirmar un pedido sin productos en el carrito.",
        variant: "destructive",
      });
      return;
    }

    // 2. Validate each cart item's quantities
    for (const item of state.items) {
      // Check minimum quantity
      if (item.quantity < item.minQuantity) {
        validationErrors.push(`${item.productName}: cantidad mínima ${item.minQuantity}`);
      }
      
      // Check quantity step compliance
      if (item.quantity % item.quantityStep !== 0) {
        validationErrors.push(`${item.productName}: debe ser múltiplo de ${item.quantityStep}`);
      }
    }

    // 3. Validate required selections
    for (const item of state.items) {
      if (!item.selectedPackaging) {
        validationErrors.push(`${item.productName}: selecciona un envase`);
      }
      if (!item.selectedColor) {
        validationErrors.push(`${item.productName}: selecciona un color`);
      }
    }

    // 4. Validate coupon integrity
    if (state.appliedCoupons.length > 0) {
      // Basic coupon validation - in real app, this would be server-side
      const totalDiscountExpected = state.appliedCoupons.reduce((acc, coupon) => {
        if (coupon.type === 'fixed') {
          return acc + coupon.discount;
        } else {
          return acc + (state.subtotal * coupon.discount / 100);
        }
      }, 0);

      if (Math.abs(state.discountAmount - totalDiscountExpected) > 0.01) {
        validationErrors.push("Error en cálculo de descuentos");
      }
    }

    // 5. Validate total calculation
    const expectedTotal = (state.subtotal - state.discountAmount) * 1.19; // 19% IVA
    if (Math.abs(state.total - expectedTotal) > 0.01) {
      validationErrors.push("Error en cálculo del total");
    }

    // Show validation errors if any
    if (validationErrors.length > 0) {
      toast({
        title: "Error de validación",
        description: `Se encontraron ${validationErrors.length} error(es): ${validationErrors.slice(0, 2).join(', ')}${validationErrors.length > 2 ? '...' : ''}`,
        variant: "destructive",
      });
      return;
    }

    // 6. Final confirmation before proceeding
    const confirmationMessage = `
      ¿Confirmar pedido por ${formatPrice(state.total)}?
      
      • ${state.itemCount} producto(s)
      • ${state.unitCount} unidades totales
      • Incluye IVA (19%)
      ${state.appliedCoupons.length > 0 ? `• ${state.appliedCoupons.length} cupón(es) aplicado(s)` : ''}
      ${orderNotes.trim() ? `• Notas: ${orderNotes.slice(0, 50)}...` : ''}
    `.trim();

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    // 7. Process order - send to server
    try {
      const orderData = {
        items: state.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.productCode || item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.subtotal
        })),
        subtotal: state.subtotal - state.discountAmount,
        tax: state.taxAmount,
        total: state.total,
        notes: orderNotes.trim() || null,
        shippingAddress: shippingAddress.trim() || null
      };

      const response = await fetch('/api/ecommerce/orders/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        description: `Tu pedido por ${formatPrice(state.total)} ha sido enviado correctamente. Un vendedor lo revisará pronto.`,
      });

      // Clear cart and reset notes after successful order
      setTimeout(() => {
        window.location.reload(); // Reload to clear cart
      }, 2000);

    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error al confirmar pedido",
        description: error.message || "No se pudo procesar tu pedido. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  // Calculate neto (subtotal without any discounts or taxes)
  const neto = state.subtotal;
  
  // Calculate final subtotal after discounts
  const subtotalAfterDiscount = neto - state.discountAmount;
  
  // Tax calculation (IVA 19%)
  const taxAmount = state.taxAmount;
  
  // Final total
  const total = state.total;

  return (
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
            className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold py-3 text-lg"
            size="lg"
            data-testid="button-confirm-order"
          >
            Confirmar pedido
          </Button>
        </div>

        {/* Cart Summary */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          <p>{state.itemCount} producto{state.itemCount !== 1 ? 's' : ''} • {state.unitCount} unidades</p>
          <p className="mt-1">Los precios incluyen IVA</p>
        </div>
      </CardContent>
    </Card>
  );
}