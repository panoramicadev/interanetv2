import { useState, useEffect, useRef } from "react";
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
import { X, Tag, MapPin, ShoppingBag, Package, CheckCircle2, Truck, Store, Landmark, Info, CreditCard, Banknote, FileUp, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getShippingKey } from "@shared/format-utils";
import { getAttachedOc, setAttachedOc, clearAttachedOc, OC_ATTACHED_EVENT, type AttachedOcMetadata } from "@/lib/attached-oc";
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

interface Warehouse {
  id: string;
  kobo: string;
  kosu: string;
  name: string;
  location: string | null;
}

const sanitizeAddress = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/\uFFFD/g, 'Ñ') // Fixes UOA to ÑUÑOA
    .replace(/\+U\+/g, '')   // Removes +U+
    .replace(/,\s*,/g, ',')  // Cleans empty commas
    .trim()
    .replace(/,$/, '');      // Removes trailing comma
};

interface BillingSummaryProps {
  onShippingChange?: (cost: number, method: 'retiro' | 'despacho') => void;
}

export default function BillingSummary({ onShippingChange }: BillingSummaryProps = {}) {
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'transfer' | 'credit'>('transfer');
  const [paymentMethodTouched, setPaymentMethodTouched] = useState(false);
  const [purchaseOrderPdfUrl, setPurchaseOrderPdfUrl] = useState<string | null>(() => {
    const attached = getAttachedOc(user?.id);
    return attached?.url || null;
  });
  const [purchaseOrderFileName, setPurchaseOrderFileName] = useState<string | null>(() => {
    const attached = getAttachedOc(user?.id);
    return attached?.fileName || null;
  });
  const [attachedOcMetadata, setAttachedOcMetadata] = useState<AttachedOcMetadata | null>(() => {
    const attached = getAttachedOc(user?.id);
    return attached?.metadata || null;
  });
  const [attachedOcSource, setAttachedOcSource] = useState<string | null>(() => {
    const attached = getAttachedOc(user?.id);
    return attached?.source || null;
  });
  const [isUploadingOC, setIsUploadingOC] = useState(false);

  // Keep local state in sync with localStorage updates (e.g. user attaches an OC from
  // the SKU quick-order modal while sitting on the cart page).
  useEffect(() => {
    const sync = () => {
      const attached = getAttachedOc(user?.id);
      setPurchaseOrderPdfUrl(attached?.url || null);
      setPurchaseOrderFileName(attached?.fileName || null);
      setAttachedOcMetadata(attached?.metadata || null);
      setAttachedOcSource(attached?.source || null);
    };
    window.addEventListener(OC_ATTACHED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(OC_ATTACHED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [user?.id]);

  // Pre-fill order notes from OC observaciones (only when user hasn't typed anything yet).
  useEffect(() => {
    if (attachedOcMetadata?.observaciones && !orderNotes.trim()) {
      const parts: string[] = [];
      if (attachedOcMetadata.ocNumber) parts.push(`OC ${attachedOcMetadata.ocNumber}`);
      if (attachedOcMetadata.observaciones) parts.push(attachedOcMetadata.observaciones);
      setOrderNotes(parts.join(' — '));
    }
    // Only run when metadata first becomes available; ignore subsequent edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedOcMetadata?.ocNumber]);

  // Delivery method: 'despacho' or 'retiro'
  const [deliveryMethod, setDeliveryMethod] = useState<'despacho' | 'retiro'>(() => {
    const saved = localStorage.getItem('cart_delivery_method');
    return (saved === 'retiro') ? 'retiro' : 'despacho';
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return localStorage.getItem('cart_selected_warehouse') || 'none';
  });

  // Persist delivery method to localStorage for FloatingCart to read
  useEffect(() => {
    localStorage.setItem('cart_delivery_method', deliveryMethod);
  }, [deliveryMethod]);
  useEffect(() => {
    localStorage.setItem('cart_selected_warehouse', selectedWarehouseId);
  }, [selectedWarehouseId]);

  // Fetch shipping rates from admin config
  const { data: rawShippingRates = {} } = useQuery<Record<string, any>>({
    queryKey: ['/api/ecommerce/shipping-rates'],
    queryFn: async () => {
      const res = await fetch('/api/ecommerce/shipping-rates', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 60000,
  });

  // Normalize: support both old { key: number } and new { key: { price, sku } } formats
  const shippingRates: Record<string, number> = {};
  const shippingSkus: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawShippingRates)) {
    if (typeof val === 'object' && val !== null) {
      shippingRates[key] = (val as any).price || 0;
      shippingSkus[key] = (val as any).sku || '';
    } else {
      shippingRates[key] = Number(val) || 0;
    }
  }

  const SHIPPING_LABELS: Record<string, string> = {
    '1_4_galon': 'Despacho 1/4 Galón',
    'galon': 'Despacho Galón',
    'bd_4gl': 'Despacho Balde 4GL',
    'bd_5gl': 'Despacho Balde 5GL',
  };

  // Fetch free shipping threshold
  const { data: freeShippingData } = useQuery<{ threshold: number }>({
    queryKey: ['/api/ecommerce/free-shipping-threshold'],
    retry: false,
  });
  const FREE_SHIPPING_THRESHOLD = freeShippingData?.threshold ?? 0;

  // Fetch store config for checkout settings
  const { data: storeConfig } = useQuery<any>({
    queryKey: ['/api/ecommerce/store-config'],
  });
  const shippingDiscountPercent = storeConfig?.checkoutSettings?.shippingDiscountPercentage || 0;
  const shippingDiscountMinAmount = storeConfig?.checkoutSettings?.shippingDiscountMinAmount || 0;

  // Fetch warehouses for pickup option
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['/api/warehouses'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/warehouses?type=ecommerce', { credentials: 'include' });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    staleTime: 300_000,
  });

  // Fetch client data to get addresses, payment condition and credit info
  const { data: clientData } = useQuery<{ dien?: string; cmen?: string; comuna?: string; cpen?: string; crlt?: string; cren?: string; crsd?: string; pickupWarehouseId?: string; nokoen?: string; gien?: string; parentNokoen?: string; freeShipping?: boolean }>({
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

  // Fetch user branches for branch-specific delivery addresses
  const { data: branchesData } = useQuery<{ branches: Array<{ id: string; name: string; branchLabel: string | null; address: string | null; isRoot: boolean }>; currentBranchId?: string | null }>({
    queryKey: ['/api/store/my-branches'],
    queryFn: async () => {
      const res = await fetch('/api/store/my-branches', { credentials: 'include' });
      if (!res.ok) return { branches: [], currentBranchId: null };
      return res.json();
    },
    enabled: !!user?.id && user?.role === 'client',
    staleTime: 300_000,
  });

  // Build list of available addresses
  const availableAddresses = [];
  if (clientData?.dien) {
    availableAddresses.push({
      value: 'default',
      label: 'Dirección principal',
      address: sanitizeAddress(clientData.dien),
      fullAddress: sanitizeAddress(clientData.dien)
    });
  }

  // Add branch addresses (only branches that have an address and are not the root/default)
  if (branchesData?.branches) {
    for (const branch of branchesData.branches) {
      if (branch.address) {
        // Skip if it's the same as the default address
        const branchAddr = sanitizeAddress(branch.address);
        const alreadyAdded = availableAddresses.some(a => a.address === branchAddr);
        if (!alreadyAdded) {
          availableAddresses.push({
            value: `branch-${branch.id}`,
            label: branch.branchLabel || branch.name || 'Sucursal',
            address: branchAddr,
            fullAddress: branchAddr,
          });
        }
      }
    }
  }

  // Set initial address option based on available addresses
  useEffect(() => {
    if (clientData !== undefined && availableAddresses.length === 0 && selectedAddressOption === "default") {
      setSelectedAddressOption("custom");
    }
  }, [availableAddresses.length, selectedAddressOption, clientData]);

  // Default the shipping address to the branch selected when building the cart
  // (persisted from the tienda page). Only runs once both branches and client data
  // have loaded, so we can resolve whether the branch has a distinct address.
  const didInitBranchAddressRef = useRef(false);
  useEffect(() => {
    if (didInitBranchAddressRef.current) return;
    if (clientData === undefined || !branchesData) return;

    didInitBranchAddressRef.current = true;

    // Prefer the explicitly-persisted branch (from the tienda page).
    // Fall back to the client's current branch from the API so existing carts
    // built before this feature shipped still pick up the right branch address
    // without having to rebuild the cart.
    const branchId =
      localStorage.getItem('cart_selected_branch_id') ||
      branchesData.currentBranchId ||
      null;
    if (!branchId) return;

    const branch = branchesData.branches.find(b => b.id === branchId);
    if (!branch?.address) return;

    const branchAddr = sanitizeAddress(branch.address);
    const mainAddr = clientData?.dien ? sanitizeAddress(clientData.dien) : '';

    if (branchAddr && branchAddr !== mainAddr) {
      setSelectedAddressOption(`branch-${branchId}`);
    }
  }, [branchesData, clientData]);

  // Auto-select the client's assigned pickup warehouse
  useEffect(() => {
    if (clientData?.pickupWarehouseId && selectedWarehouseId === 'none') {
      setSelectedWarehouseId(clientData.pickupWarehouseId);
    }
  }, [clientData?.pickupWarehouseId]);

  // Compute final shipping address based on selection
  const shippingAddress = selectedAddressOption === "custom" 
    ? customAddress 
    : availableAddresses.find(a => a.value === selectedAddressOption)?.fullAddress || "";

  // Validate coupon via API
  const validateCoupon = async (code: string): Promise<{
    isValid: boolean;
    discount: number;
    type: 'percentage' | 'fixed' | 'free_shipping';
    description?: string;
    appliesTo?: 'cart' | 'product';
    productSku?: string;
  }> => {
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          cartSubtotal: neto,
        }),
      });
      const data = await response.json();
      if (!data.isValid) {
        return { isValid: false, discount: 0, type: 'fixed', description: data.error };
      }
      return {
        isValid: true,
        discount: data.discount,
        type: data.type,
        description: data.description,
        appliesTo: data.appliesTo,
        productSku: data.productSku,
      };
    } catch {
      return { isValid: false, discount: 0, type: 'fixed', description: 'Error de conexión' };
    }
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
          validation.description,
          validation.appliesTo,
          validation.productSku
        );
        
        setCouponCode("");
        toast({
          title: "¡Cupón aplicado!",
          description: validation.type === 'free_shipping' 
            ? `🚚 Envío gratuito aplicado (${couponCode.toUpperCase()})` 
            : `${validation.description} aplicado correctamente`,
        });
      } else {
        toast({
          title: "Cupón inválido",
          description: validation.description || "El código de cupón ingresado no es válido",
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
    if (state.items.length === 0) {
      toast({
        title: "Error de validación",
        description: "No puedes confirmar un pedido sin productos en el carrito.",
        variant: "destructive",
      });
      return;
    }

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

    if (isMissingRequiredOC) {
      toast({
        title: "Orden de Compra obligatoria",
        description: "Los clientes MCT deben adjuntar la OC en PDF antes de confirmar el pedido.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const processOrder = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      // Build the delivery info
      let finalShippingAddress = "";
      if (deliveryMethod === 'despacho') {
        finalShippingAddress = shippingAddress.trim();
      } else {
        const wh = warehouses.find(w => w.id === selectedWarehouseId);
        finalShippingAddress = wh ? `RETIRO EN BODEGA: ${wh.name}${wh.location ? ' - ' + wh.location : ''}` : 'RETIRO EN BODEGA';
      }

      const mappedItems = state.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.productCode || item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        discountAmount: item.discountAmount || 0,
        unitPriceAfterDiscount: item.unitPriceAfterDiscount || item.unitPrice,
        totalPriceAfterDiscount: item.subtotalAfterDiscount || (item.quantity * item.unitPrice),
        imageUrl: item.imageUrl || null,
        selectedColor: item.selectedColor || null,
        selectedPackaging: item.selectedPackaging || null,
      }));

      // AÑADIR FLETE COMO PUNTO DE FACTURACIÓN
      // One despacho line per unit key (Galón, 1/4 Galón, Balde, …) so
      // downstream views can split "Subtotal Productos" vs "Subtotal Flete"
      // and the SKU (ZZFLETE001, etc.) matches the store config.
      if (deliveryMethod === 'despacho' && shippingCost > 0) {
        const shippingFactor = Math.max(0, 1 - effectiveShippingDiscountPercent / 100);
        const discountSuffix = effectiveShippingDiscountPercent > 0 ? ` (-${effectiveShippingDiscountPercent}%)` : '';
        shippingBreakdownMap.forEach((b, rateKey) => {
          const unitPrice = Math.round(b.cost * shippingFactor);
          if (unitPrice <= 0 || b.qty <= 0) return;
          const sku = shippingSkus[rateKey] || rateKey.toUpperCase();
          const label = `${SHIPPING_LABELS[rateKey] || `Despacho ${b.unit || rateKey}`}${discountSuffix}`;
          const lineTotal = unitPrice * b.qty;
          mappedItems.push({
            productId: sku,
            productName: label,
            sku,
            quantity: b.qty,
            unitPrice,
            totalPrice: lineTotal,
            discountAmount: 0,
            unitPriceAfterDiscount: unitPrice,
            totalPriceAfterDiscount: lineTotal,
            imageUrl: null,
            selectedColor: null,
            selectedPackaging: null,
          });
        });
      }

      // Branch actually used to shop (convenio/precio) — persistida por tienda.tsx.
      // Se envía al backend para que resuelva precios con la sucursal correcta
      // (lcen + branchDiscountPercent) y no con el registro-cliente por defecto.
      const checkoutBranchId = (typeof window !== 'undefined' ? localStorage.getItem('cart_selected_branch_id') : null) || null;

      const orderData = {
        items: mappedItems,
        subtotal: state.subtotal - state.discountAmount,
        tax: state.taxAmount,
        shipping: deliveryMethod === 'despacho' ? shippingCost : 0,
        total: deliveryMethod === 'despacho' ? state.total + shippingCost : state.total,
        discount: state.discountAmount,
        appliedCoupons: state.appliedCoupons.map(c => ({
          code: c.code,
          type: c.type,
          discount: c.discount,
          description: c.description || null,
          appliesTo: c.appliesTo || 'cart',
          productSku: c.productSku || null,
        })),
        notes: orderNotes.trim() || null,
        shippingAddress: finalShippingAddress || null,
        paymentCondition: clientData?.cpen || null,
        paymentMethod: selectedPaymentMethod,
        purchaseOrderPdfUrl: purchaseOrderPdfUrl || null,
        branchId: checkoutBranchId,
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

  // Shipping discount aplica solo si el neto del carrito alcanza el monto mínimo configurado
  const shippingDiscountActive = shippingDiscountPercent > 0 && neto >= shippingDiscountMinAmount;
  const effectiveShippingDiscountPercent = shippingDiscountActive ? shippingDiscountPercent : 0;

  // Aggregate branch (convenio) discount info from cart items.
  // Convenio discount is already applied to each item's unitPrice; we derive the
  // savings-vs-original purely for display in the billing breakdown.
  const convenioItems = state.items.filter(i => i.convenioPct && i.convenioPct > 0 && i.originalPrice && i.originalPrice > i.unitPrice);
  const convenioPct = convenioItems[0]?.convenioPct || 0;
  const convenioSavings = convenioItems.reduce(
    (sum, i) => sum + Math.round(((i.originalPrice || i.unitPrice) - i.unitPrice) * i.quantity),
    0
  );
  const hasOfferItems = state.items.some(i => i.isOffer);
  
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

  let originalShippingCost = shippingCost;
  
  // Apply free shipping if neto meets threshold OR a free_shipping coupon is applied
  // OR the client has the permanent "envío gratis" benefit enabled in su ficha comercial
  const hasCouponFreeShipping = state.appliedCoupons.some(c => c.type === 'free_shipping');
  const clientHasFreeShipping = !!clientData?.freeShipping;
  const hasFreeShipping = clientHasFreeShipping || hasCouponFreeShipping || (FREE_SHIPPING_THRESHOLD > 0 && neto >= FREE_SHIPPING_THRESHOLD);
  if (hasFreeShipping) {
    shippingCost = 0;
  } else if (effectiveShippingDiscountPercent > 0) {
    shippingCost = Math.round(shippingCost * (1 - effectiveShippingDiscountPercent / 100));
  }

  const shippingBreakdownText = Array.from(shippingBreakdownMap.values())
    .map(b => `${b.qty}x ${b.unit} a ${formatPrice(b.cost)}`)
    .join(' + ') + (effectiveShippingDiscountPercent > 0 ? ` (-${effectiveShippingDiscountPercent}%)` : "");
  
  // Calculate final subtotal after discounts
  const subtotalAfterDiscount = neto - state.discountAmount;
  
  // Tax calculation (IVA 19%)
  const taxAmount = state.taxAmount;
  
  // Final total (includes shipping only if despacho)
  const effectiveShipping = deliveryMethod === 'despacho' ? shippingCost : 0;

  // Inform parent of shipping cost and method changes
  useEffect(() => {
    if (onShippingChange) {
      onShippingChange(shippingCost, deliveryMethod);
    }
  }, [shippingCost, deliveryMethod, onShippingChange]);
  const total = state.total + effectiveShipping;

  // Determine payment instructions based on condition
  const isCredit = clientData?.cpen?.toUpperCase().includes('CREDITO') || clientData?.cpen?.toUpperCase().includes('CRÉDITO') || (Number(clientData?.crlt) > 0);
  const requiresReceipt = !isCredit; // Default to expecting receipt if not credit

  // Default to Crédito for clients with credit available (until user manually changes)
  useEffect(() => {
    if (isCredit && !paymentMethodTouched) {
      setSelectedPaymentMethod('credit');
    }
  }, [isCredit, paymentMethodTouched]);

  // Highlight OC upload for credit clients who haven't attached one yet
  const shouldHighlightOCUpload = isCredit && selectedPaymentMethod === 'credit' && !purchaseOrderPdfUrl && !isUploadingOC;

  // MCT clients deben adjuntar Orden de Compra obligatoriamente.
  // Identificamos MCT por el nombre del cliente o casa matriz (nomenclatura interna
  // "MCT <plaza>", ej. "MCT CONCEPCION"). El backend revalida.
  const mctTokens = `${clientData?.nokoen || ''} ${clientData?.gien || ''} ${clientData?.parentNokoen || ''}`.toUpperCase();
  const isMCT = /\bMCT\b/.test(mctTokens);
  const requiresOC = isMCT;
  const isMissingRequiredOC = requiresOC && !purchaseOrderPdfUrl;

  return (
    <>
    <Card className="bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-4 px-3 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Facturación
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 px-3 sm:px-6 pb-4 sm:pb-6">
        {/* Delivery Method Toggle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Método de entrega
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDeliveryMethod('despacho')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                deliveryMethod === 'despacho'
                  ? 'border-[#FF6E23] text-[#FF6E23] bg-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              Despacho
            </button>
            <button
              onClick={() => setDeliveryMethod('retiro')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                deliveryMethod === 'retiro'
                  ? 'border-[#FF6E23] text-[#FF6E23] bg-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <Store className="h-4 w-4" />
              Retiro en Bodega
            </button>
          </div>
        </div>

        <Separator />

        {/* Billing Breakdown */}
        <div className="space-y-3">
          {/* Neto */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Neto:</span>
            <span className="font-medium text-gray-900 dark:text-white" data-testid="text-billing-neto">
              {formatPrice(neto)}
            </span>
          </div>

          {/* Convenio (branch) discount — informational, already baked into neto */}
          {convenioPct > 0 && convenioSavings > 0 && (
            <div className="flex justify-between items-start gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0">
                  CONVENIO -{convenioPct}%
                </Badge>
                <span>Descuento ya aplicado{hasOfferItems ? ' (no se aplica sobre ofertas)' : ''}</span>
              </div>
              <span className="font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap" data-testid="text-billing-convenio">
                -{formatPrice(convenioSavings)}
              </span>
            </div>
          )}

          {/* Applied Coupons */}
          {state.appliedCoupons.length > 0 && (
            <div className="space-y-2">
              {state.appliedCoupons.map((coupon) => (
                <div key={coupon.code} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {coupon.type === 'free_shipping'
                        ? `🚚 Envío gratis (${coupon.code}):`
                        : `Descuento (${coupon.code})${coupon.appliesTo === 'product' && coupon.productSku ? ` • SKU ${coupon.productSku}` : ''}:`
                      }
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
                    {coupon.type === 'free_shipping'
                      ? '¡Gratis!'
                      : coupon.type === 'percentage'
                        ? `-${coupon.discount}%`
                        : `-${formatPrice(coupon.discount)}`
                    }
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

          {/* Shipping / Despacho — only if method is despacho */}
          {deliveryMethod === 'despacho' && (
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Despacho:
                </span>
                {hasFreeShipping && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    🎉 ¡Envío gratis aplicado!
                  </span>
                )}
                {!hasFreeShipping && effectiveShippingDiscountPercent > 0 && (
                  <span className="text-[10px] text-orange-600 font-bold mt-0.5">
                     ¡Descuento de envío aplicado ({effectiveShippingDiscountPercent}%)!
                  </span>
                )}
                {!hasFreeShipping && shippingDiscountPercent > 0 && !shippingDiscountActive && shippingDiscountMinAmount > 0 && (
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    Te faltan {formatPrice(shippingDiscountMinAmount - neto)} para activar el {shippingDiscountPercent}% de descuento en envío
                  </span>
                )}
                {!hasFreeShipping && shippingBreakdownText && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">
                    ({shippingBreakdownText})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hasFreeShipping && effectiveShippingDiscountPercent > 0 && originalShippingCost > shippingCost && (
                  <span className="text-sm line-through text-gray-400">
                    {formatPrice(originalShippingCost)}
                  </span>
                )}
                <span className={`font-medium ${hasFreeShipping ? 'text-emerald-600 line-through' : 'text-gray-900 dark:text-white'}`} data-testid="text-billing-shipping">
                  {hasFreeShipping ? 'Gratis' : formatPrice(shippingCost)}
                </span>
              </div>
            </div>
          )}

          {/* Retiro label */}
          {deliveryMethod === 'retiro' && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5" />
                Retiro en Bodega:
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 text-sm">
                Sin costo
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

        {/* Payment Method Selector */}
        {user?.role === 'client' && (
          <div className="space-y-3">
            <Separator />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Método de Pago
            </Label>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setPaymentMethodTouched(true); setSelectedPaymentMethod('transfer'); }}
                className={`flex items-center justify-start gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  selectedPaymentMethod === 'transfer'
                    ? 'border-orange-500 bg-orange-50/50 text-orange-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'
                }`}
              >
                <Banknote className={`h-4 w-4 ${selectedPaymentMethod === 'transfer' ? 'text-orange-500' : 'text-gray-400'}`} />
                <div>
                  <div className="text-left font-semibold">Transferencia Bancaria</div>
                </div>
              </button>

              <button
                onClick={() => { if (isCredit) { setPaymentMethodTouched(true); setSelectedPaymentMethod('credit'); } }}
                disabled={!isCredit}
                className={`flex items-center justify-start gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                  !isCredit
                    ? 'opacity-60 cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                    : selectedPaymentMethod === 'credit'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200'
                }`}
              >
                <CreditCard className={`h-4 w-4 ${
                  !isCredit ? 'text-gray-400' : selectedPaymentMethod === 'credit' ? 'text-blue-500' : 'text-gray-400'
                }`} />
                <div className="text-left">
                  <div className="font-semibold">Crédito</div>
                  {isCredit && clientData?.cpen && clientData.cpen.match(/\d+/) && (
                    <div className="text-[10px] text-blue-600 mt-0.5 leading-tight">Plazo: {clientData.cpen.match(/\d+/)?.[0]} días</div>
                  )}
                  {!isCredit && <div className="text-[10px] text-gray-400 leading-tight">No disponible</div>}
                </div>
              </button>
            </div>

            {/* Payment Method Details */}
            <div className="mt-2">
              {selectedPaymentMethod === 'credit' && isCredit ? (
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold">Aprobación Inmediata</span>
                  </div>
                  
                  {/* Credit Condition / Days */}
                  {clientData?.cpen && clientData.cpen.toUpperCase().includes('CREDITO') && clientData.cpen.match(/\d+/) && (
                    <div className="text-xs text-blue-800 dark:text-blue-200 font-medium bg-blue-100/50 dark:bg-blue-900/50 px-2 py-1 rounded inline-block">
                      Plazo de pago: {clientData.cpen.match(/\d+/)?.[0]} días
                    </div>
                  )}

                  {/* Credit Balance Breakdown */}
                  {(clientData?.crlt || clientData?.cren) && (
                    <div className="bg-white/60 dark:bg-blue-900/30 rounded-lg p-2.5 space-y-1.5 border border-blue-100 dark:border-blue-800">
                      {clientData?.crlt && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-600/70 dark:text-blue-400/70">Límite de crédito</span>
                          <span className="font-semibold text-blue-800 dark:text-blue-200">{formatPrice(Number(clientData.crlt))}</span>
                        </div>
                      )}
                      {clientData?.cren && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-600/70 dark:text-blue-400/70">Disponible actual</span>
                          <span className="font-semibold text-blue-800 dark:text-blue-200">{formatPrice(Number(clientData.cren))}</span>
                        </div>
                      )}
                      <Separator className="bg-blue-200/50 dark:bg-blue-700/50" />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-blue-600/70 dark:text-blue-400/70">Monto de esta compra</span>
                        <span className="font-bold text-orange-600">-{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-0.5">
                        <span className="font-semibold text-blue-700 dark:text-blue-300">Saldo después de compra</span>
                        {(() => {
                          const available = Number(clientData?.cren || clientData?.crlt || 0);
                          const remaining = available - total;
                          return (
                            <span className={`font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatPrice(remaining)}
                            </span>
                          );
                        })()}
                      </div>
                      {(() => {
                        const available = Number(clientData?.cren || clientData?.crlt || 0);
                        const remaining = available - total;
                        if (remaining < 0) {
                          return (
                            <div className="flex items-start gap-1.5 text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 p-1.5 rounded mt-1">
                              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>El monto excede tu crédito disponible. Tu ejecutivo deberá autorizarlo manualmente.</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                    Porcentaje a crédito según la condición estipulada en tu ficha. Tu pedido no requerirá que subas un recibo físico y quedará en lista de despacho automáticamente.
                  </p>
                </div>
              ) : selectedPaymentMethod === 'transfer' ? (
                <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">Requiere Validación</span>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                    Al confirmar el pedido, te facilitaremos los datos de la cuenta corriente. Tu pedido quedará <strong>Pendiente</strong> y comenzará a procesarse únicamente hasta que subas foto del comprobante de transferencia o depósito.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Shipping Address (only for despacho) */}
        {deliveryMethod === 'despacho' && (
          <div className="space-y-2">
            <Label htmlFor="shipping-address" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Dirección de despacho
            </Label>
            
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

            {selectedAddressOption !== "custom" && shippingAddress && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                {shippingAddress}
              </div>
            )}
          </div>
        )}

        {/* Warehouse Picker (only for retiro) */}
        {deliveryMethod === 'retiro' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Bodega de retiro
            </Label>
            <Select 
              value={selectedWarehouseId} 
              onValueChange={setSelectedWarehouseId}
            >
              <SelectTrigger className="w-full" data-testid="select-pickup-warehouse">
                <SelectValue placeholder="Selecciona una bodega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar bodega...</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-2">
                        {w.name}
                        {clientData?.pickupWarehouseId === w.id && (
                          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                            Por defecto
                          </Badge>
                        )}
                      </span>
                      {w.location && <span className="text-xs text-gray-500">{w.location}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWarehouseId !== 'none' && (
              <div className="text-sm text-gray-600 bg-emerald-50 p-2 rounded border border-emerald-200 flex items-center gap-2">
                <Store className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>
                  {warehouses.find(w => w.id === selectedWarehouseId)?.name}
                  {warehouses.find(w => w.id === selectedWarehouseId)?.location && (
                    <span className="text-gray-500"> — {warehouses.find(w => w.id === selectedWarehouseId)?.location}</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

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

        {/* Purchase Order PDF Upload — obligatorio para clientes MCT */}
        <div className={`space-y-2 rounded-xl transition-all ${isMissingRequiredOC ? 'p-3 -mx-1 bg-gradient-to-br from-red-50/70 to-transparent dark:from-red-950/30 ring-1 ring-red-300/70 dark:ring-red-800/60' : shouldHighlightOCUpload ? 'p-3 -mx-1 bg-gradient-to-br from-blue-50/60 to-transparent dark:from-blue-950/30 ring-1 ring-blue-200/60 dark:ring-blue-800/60' : ''}`}>
          <Label className={`text-sm font-medium flex items-center gap-2 ${isMissingRequiredOC ? 'text-red-700 dark:text-red-300' : shouldHighlightOCUpload ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
            <FileUp className={`h-4 w-4 ${isMissingRequiredOC ? 'text-red-500 animate-bounce-slow' : shouldHighlightOCUpload ? 'text-blue-500 animate-bounce-slow' : ''}`} />
            Orden de Compra {requiresOC ? (
              <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">Obligatorio</span>
            ) : shouldHighlightOCUpload ? (
              <span className="text-[10px] font-semibold bg-blue-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">Recomendado</span>
            ) : (
              <span className="text-xs font-normal text-gray-400">(opcional)</span>
            )}
          </Label>
          <p className={`text-[11px] -mt-1 ${isMissingRequiredOC ? 'text-red-600/90 dark:text-red-400/90' : shouldHighlightOCUpload ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-gray-400 dark:text-gray-500'}`}>
            {requiresOC
              ? 'Como cliente MCT debes adjuntar la Orden de Compra en PDF para confirmar el pedido.'
              : shouldHighlightOCUpload
              ? 'Al pagar a crédito te recomendamos adjuntar tu OC en PDF para agilizar el despacho.'
              : 'Puedes adjuntar tu OC en formato PDF para que acompañe el pedido.'}
          </p>
          
          {purchaseOrderPdfUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 truncate">
                  {purchaseOrderFileName || 'Orden de Compra.pdf'}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ Adjunto al pedido</p>
                  {attachedOcSource === 'sku-modal' && (
                    <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300 px-1.5 py-0.5 rounded">
                      desde Pedido Rápido
                    </span>
                  )}
                  {attachedOcMetadata?.ocNumber && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      OC {attachedOcMetadata.ocNumber}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setPurchaseOrderPdfUrl(null);
                  setPurchaseOrderFileName(null);
                  setAttachedOcMetadata(null);
                  setAttachedOcSource(null);
                  clearAttachedOc(user?.id);
                }}
                className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-500 hover:text-red-500 transition-colors flex-shrink-0"
                title="Eliminar archivo"
                data-testid="button-remove-purchase-order"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Aviso: OC + crédito → recepción debe revisar antes de aprobar */}
          {purchaseOrderPdfUrl && selectedPaymentMethod === 'credit' && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Tu pedido quedará <strong>pendiente de revisión</strong> por recepción para verificar los datos de la OC, aunque sea a crédito. Te avisaremos cuando sea aprobado.
              </span>
            </div>
          )}

          {!purchaseOrderPdfUrl && (
            <>
              <Label
                htmlFor="purchase-order-upload"
                className={`relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                  isUploadingOC
                    ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/30'
                    : shouldHighlightOCUpload
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40 animate-glow-ring hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    : 'border-gray-200 dark:border-gray-700 hover:border-[#FF6E23]/50 hover:bg-orange-50/30 dark:hover:bg-orange-950/20'
                }`}
              >
                {isUploadingOC ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Subiendo...</span>
                  </>
                ) : (
                  <>
                    <FileUp className={`w-4 h-4 ${shouldHighlightOCUpload ? 'text-blue-500 animate-bounce-slow' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${shouldHighlightOCUpload ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      Adjuntar PDF de Orden de Compra
                    </span>
                  </>
                )}
              </Label>
              <Input
                id="purchase-order-upload"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={isUploadingOC}
                data-testid="input-purchase-order-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast({ title: 'Archivo muy grande', description: 'El PDF no puede superar 10 MB.', variant: 'destructive' });
                    e.target.value = '';
                    return;
                  }
                  setIsUploadingOC(true);
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await fetch('/api/upload', {
                      method: 'POST',
                      credentials: 'include',
                      body: formData,
                    });
                    if (!res.ok) throw new Error('Error al subir archivo');
                    const data = await res.json();
                    setPurchaseOrderPdfUrl(data.url);
                    setPurchaseOrderFileName(file.name);
                    setAttachedOcSource('checkout');
                    setAttachedOc({
                      url: data.url,
                      fileName: file.name,
                      attachedAt: new Date().toISOString(),
                      source: 'checkout',
                      metadata: null,
                    }, user?.id);
                    toast({ title: '✓ OC adjuntada', description: `"${file.name}" será incluida en tu pedido.` });
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message || 'No se pudo subir el archivo', variant: 'destructive' });
                  } finally {
                    setIsUploadingOC(false);
                    e.target.value = '';
                  }
                }}
              />
            </>
          )}
        </div>

        {/* Confirm Order Button */}
        <div className="pt-4">
          <Button
            onClick={handleConfirmOrder}
            disabled={isSubmitting || state.items.length === 0 || isMissingRequiredOC}
            className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold py-3 text-lg"
            size="lg"
            data-testid="button-confirm-order"
          >
            {isSubmitting
              ? 'Procesando...'
              : isMissingRequiredOC
              ? 'Adjunta la OC para continuar'
              : 'Confirmar pedido'}
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
      <AlertDialogContent className="max-w-md max-h-[90vh] grid-rows-[minmax(0,1fr)_auto]">
        <AlertDialogHeader className="overflow-y-auto min-h-0">
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

                {/* Show delivery method in confirmation */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    {deliveryMethod === 'despacho' ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                    {deliveryMethod === 'despacho' ? 'Despacho' : 'Retiro en Bodega'}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {deliveryMethod === 'despacho' ? (
                      shippingCost > 0 ? (
                        <>
                          {formatPrice(shippingCost)}
                          {shippingBreakdownText && (
                            <span className="block text-[10px] text-gray-400 text-right">
                              ({shippingBreakdownText})
                            </span>
                          )}
                        </>
                      ) : 'Gratis'
                    ) : (
                      <span className="text-emerald-600">Sin costo</span>
                    )}
                  </span>
                </div>

                {/* Payment method row */}
                {clientData?.cpen && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 flex items-center gap-2">
                      {isCredit ? <CreditCard className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                      Método de pago
                    </span>
                    <Badge className={isCredit ? 'bg-blue-100 text-blue-700 border-0 text-xs' : 'bg-orange-100 text-orange-700 border-0 text-xs'}>
                      {isCredit ? 'Crédito' : 'Transferencia'}
                    </Badge>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-[#FF6E23]">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Show delivery destination */}
              {deliveryMethod === 'despacho' && shippingAddress && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{shippingAddress}</span>
                </div>
              )}
              {deliveryMethod === 'retiro' && selectedWarehouseId !== 'none' && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <Store className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Retiro en: {warehouses.find(w => w.id === selectedWarehouseId)?.name}
                    {warehouses.find(w => w.id === selectedWarehouseId)?.location && (
                      <span> — {warehouses.find(w => w.id === selectedWarehouseId)?.location}</span>
                    )}
                  </span>
                </div>
              )}

              {/* Payment Info */}
              {requiresReceipt && (
                <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                    <Landmark className="h-4 w-4" /> Datos de Transferencia
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-600">
                    <div><span className="text-slate-400 block mb-0.5">Empresa</span><span className="font-medium">Pintureria Panoramica Limitada</span></div>
                    <div><span className="text-slate-400 block mb-0.5">RUT</span><span className="font-medium">78.652.260-9</span></div>
                    <div><span className="text-slate-400 block mb-0.5">Banco</span><span className="font-medium">Banco Santander</span></div>
                    <div><span className="text-slate-400 block mb-0.5">Cuenta Corriente</span><span className="font-medium">2592916-0</span></div>
                    <div className="col-span-2"><span className="text-slate-400 block mb-0.5">Email</span><span className="font-medium">contacto@pinturaspanoramica.cl</span></div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-100/50 p-2 rounded flex-shrink-0">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <p>Al hacer clic en confirmar el pedido será creado. <strong>Serás redirigido a una nueva pantalla donde deberás subir el comprobante de pago.</strong></p>
                  </div>
                </div>
              )}

              {/* Credit Payment Info */}
              {isCredit && (
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <CreditCard className="h-4 w-4" /> Pago a Crédito
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-slate-500">Pago diferido</span>
                    </div>
                  </div>

                  {/* Credit Balance Summary in Confirmation */}
                  {(clientData?.crlt || clientData?.cren) && (
                    <div className="bg-white/80 rounded-lg p-3 space-y-1.5 border border-blue-100">
                      {clientData.cren && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Crédito disponible</span>
                          <span className="font-semibold text-blue-700">{formatPrice(Number(clientData.cren))}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Monto de esta compra</span>
                        <span className="font-bold text-orange-600">-{formatPrice(total)}</span>
                      </div>
                      <Separator className="bg-blue-200/50" />
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700">Saldo después de compra</span>
                        {(() => {
                          const available = Number(clientData.cren || clientData.crlt || 0);
                          const remaining = available - total;
                          return (
                            <span className={`font-bold text-sm ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatPrice(remaining)}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-100/50 p-2 rounded flex-shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <p>No necesitas subir comprobante de pago. La factura será emitida con plazo de pago según tu condición comercial.</p>
                  </div>
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