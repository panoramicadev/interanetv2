import { Fragment, useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNumericOrderId } from "@/lib/utils";
import { getShippingKey } from "@shared/format-utils";
import {
  Clock, CheckCircle, XCircle, Package, FileText,
  Phone, Mail, ArrowLeft, User, MapPin,
  Truck, DollarSign, Calendar, AlertCircle, MoreHorizontal,
  Pencil, Archive, Trash2, FileImage, Landmark,
  Upload, Download, X, Loader2, RefreshCw, Save, Inbox,
  AlertTriangle, RefreshCcw,
  Plus, Minus, Search, Ban, Eye, ChevronDown, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EcommerceQuoteModal } from "./ecommerce-quote-modal";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { QuotePDFDocument } from "@/pages/tomador-pedidos";
import { pdf } from "@react-pdf/renderer";
import { OrderTrackingTimeline } from "./order-tracking-timeline";
import { DocumentViewerModal, downloadDocumento, type ClientDocument } from "./client-documents";

// Export the types so order lists can use them
export interface OrderItem {
  productId?: string;
  productName: string;
  productCode?: string;
  sku?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  subtotal?: number;
  totalPrice?: number;
  imageUrl?: string;
  selectedColor?: string;
  selectedPackaging?: string;
  convenioPct?: number;
  originalUnitPrice?: number;
  isOffer?: boolean;
  priceTier?: string;
  tierPrices?: PriceTierOption[];
}

// Precios disponibles para un producto en la lista de precios (lista, descuentos, etc.)
export type PriceTierKey = 'lista' | 'desc10' | 'desc10_5' | 'desc10_5_3' | 'minimo' | 'canalDigital' | 'oferta';
export interface PriceTierOption {
  key: PriceTierKey;
  label: string;
  price: number;
}

export interface InvoiceFile {
  url: string;
  name: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface EcommerceOrder {
  id: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  shippingAddress?: string;
  status: string;
  total: string;
  subtotal?: string;
  tax?: string;
  items: OrderItem[] | string;
  notes?: string;
  quoteId?: string;
  paymentCondition?: string;
  paymentReceiptUrl?: string;
  purchaseOrderPdfUrl?: string;
  invoiceUrls?: InvoiceFile[];
  createdAt: string;
  approvedAt?: string;
  modifiedAt?: string;
  ingresadoAt?: string;
  ingresadoById?: string;
  ingresadoNotes?: string;
  rejectedAt?: string;
  rejectedById?: string;
  rejectedReason?: string;
  branchDiscountPercent?: string | number;
  priceListUsed?: string;
}

// Helpers
export const formatPrice = (price: string | number | undefined | null) => {
  if (price === undefined || price === null) return '$0';
  const numPrice = typeof price === 'string' ? parseFloat(price) || 0 : price;
  return `$${numPrice.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Deriva los precios disponibles (tramos) de una fila de la lista de precios.
// Solo incluye los que tienen valor > 0. Lista se reconstruye desde desc10 si viene vacía.
export const getProductTiers = (product: any): PriceTierOption[] => {
  const num = (v: any) => parseFloat(String(v ?? '0')) || 0;
  const desc10 = num(product?.desc10);
  const lista = num(product?.lista) > 0 ? num(product?.lista) : (desc10 > 0 ? Math.round(desc10 / 0.9) : 0);
  const mappings: { key: PriceTierKey; label: string; value: number }[] = [
    { key: 'lista', label: 'Lista', value: lista },
    { key: 'desc10', label: '10%', value: desc10 },
    { key: 'desc10_5', label: '10%+5%', value: num(product?.desc10_5) },
    { key: 'desc10_5_3', label: '10%+5%+3%', value: num(product?.desc10_5_3) },
    { key: 'minimo', label: 'Mínimo', value: num(product?.minimo) },
    { key: 'canalDigital', label: 'Digital', value: num(product?.canalDigital) },
    { key: 'oferta', label: 'Oferta', value: num(product?.offerPrice) },
  ];
  const tiers: PriceTierOption[] = [];
  for (const m of mappings) {
    if (m.value > 0) tiers.push({ key: m.key, label: m.label, price: Math.round(m.value) });
  }
  return tiers;
};

export const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateString;
  }
};

export const timeAgo = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

export const getOrderItems = (order: EcommerceOrder): OrderItem[] => {
  if (!order.items) return [];
  return typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
};

export const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  pendiente: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "Aprobado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  modified: { label: "Modificado", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Package },
  rejected: { label: "Rechazado", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
  suggested_pending: { label: "Sugerido pendiente", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: Clock },
  sent: { label: "Enviado", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Truck },
  // ERP Specific statuses mapping 
  ingresado: { label: "Ingresado ERP", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Package },
  despacho: { label: "En Despacho", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", icon: Truck },
  facturado: { label: "Facturado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  // Extra order states
  preparacion: { label: "En preparación", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Package },
  transito: { label: "En curso", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", icon: Truck },
  entregado: { label: "Entregado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
};

// Component props
interface OrderDetailViewProps {
  order: EcommerceOrder;
  onBack: () => void;
  onOrderDeleted?: () => void;
  onGenerateQuote?: () => void;
  isClientView?: boolean; // Determines if admin actions are hidden
}

export function OrderDetailView({ order, onBack, onOrderDeleted, onGenerateQuote, isClientView = false }: OrderDetailViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState<number | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);
  const statusKey = currentOrder.status?.toLowerCase() || 'pending';
  const status = statusConfig[statusKey] || statusConfig.pending;
  const StatusIcon = status.icon;
  const [showIngresarDialog, setShowIngresarDialog] = useState(false);
  const [isIngresando, setIsIngresando] = useState(false);
  const [ingresadoNotes, setIngresadoNotes] = useState('');
  const [showPaymentConditionDialog, setShowPaymentConditionDialog] = useState(false);
  const [paymentConditionValue, setPaymentConditionValue] = useState('');
  const [isSavingPaymentCondition, setIsSavingPaymentCondition] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const { user } = useAuth();
  const canIngresar = !!user && ['reception', 'admin', 'supervisor', 'encargado_area'].includes((user as any).role);
  const canEditPaymentCondition = !!user && ['reception', 'admin', 'supervisor', 'encargado_area'].includes((user as any).role);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const paymentConditionUpper = (currentOrder.paymentCondition || '').toUpperCase();
  const isCreditOrder = paymentConditionUpper.includes('CREDITO') || paymentConditionUpper.includes('CRÉDITO');
  const requiresReceipt = !!currentOrder.paymentCondition && !isCreditOrder;
  const hasReceipt = !!currentOrder.paymentReceiptUrl;
  const isModified = statusKey === 'modified';

  const handleClientUploadReceipt = async (file: File) => {
    setIsUploadingReceipt(true);
    try {
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

      const patchRes = await fetch(`/api/ecommerce/orders/${currentOrder.id}/receipt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentReceiptUrl: fileUrl }),
      });
      if (!patchRes.ok) throw new Error('Error al asociar comprobante');
      const updated = await patchRes.json();
      setCurrentOrder(prev => ({ ...prev, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/client/orders'] });
      toast({
        title: hasReceipt ? 'Comprobante actualizado' : 'Comprobante enviado',
        description: 'Nuestro equipo revisará la transferencia y procesará tu pedido.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'No se pudo subir el comprobante. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const onReceiptFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleClientUploadReceipt(file);
    e.target.value = '';
  };

  // Price/items editing state
  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Product picker (add new product to the order)
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [pickerExpandedCode, setPickerExpandedCode] = useState<string | null>(null);
  const [loadingTiers, setLoadingTiers] = useState(false);
  // Tarifas de despacho (formato → { precio, sku ZZFLETE }) para autocalcular las líneas de flete.
  const [shippingRates, setShippingRates] = useState<Record<string, { price: number; sku: string }>>({});

  // Discard / reject order dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const items = isEditingPrices ? editedItems : getOrderItems(currentOrder);
  const invoices: InvoiceFile[] = Array.isArray(currentOrder.invoiceUrls) ? currentOrder.invoiceUrls : [];

  // Líneas de despacho (flete): se reconocen por su SKU (ZZFLETE...) según la config de fletes.
  // Su cantidad se autocalcula a partir de las unidades de producto de cada formato.
  const despachoSkuToRate = new Map<string, string>();
  for (const [rate, cfg] of Object.entries(shippingRates)) {
    if (cfg.sku) despachoSkuToRate.set(cfg.sku.toUpperCase(), rate);
  }
  const isDespachoItem = (it: OrderItem) =>
    despachoSkuToRate.has(String(it.sku || it.productCode || '').toUpperCase());

  // Las líneas de despacho (flete) van siempre al final, agrupadas aparte de los productos.
  // Conservamos el índice original porque los handlers de edición operan por posición en `items`.
  const orderedItems = items
    .map((item, index) => ({ item, index, isDespacho: isDespachoItem(item) }))
    .sort((a, b) => Number(a.isDespacho) - Number(b.isDespacho));
  const firstDespachoPos = orderedItems.findIndex((o) => o.isDespacho);
  const hasProductsBeforeDespacho = firstDespachoPos > 0;

  // Seguimiento + documento (vista del cliente).
  // Un pedido web tiene UUID (con guiones); los pedidos ERP traen su documento adjunto.
  const isWebOrder = typeof currentOrder.id === "string" && currentOrder.id.includes("-");
  const erpDocument = (currentOrder as any)._document as ClientDocument | undefined;
  const [viewingDoc, setViewingDoc] = useState<ClientDocument | null>(null);
  const [isDownloadingDoc, setIsDownloadingDoc] = useState(false);

  // Factura (FCV) oficial asociada al pedido. Solo para la vista interna (admin) y pedidos web:
  // el backend la infiere por RUT + monto + fecha y devuelve el idmaeedo para descargar el mismo
  // PDF oficial que el botón de la ficha del cliente (/api/erp/facturas/:idmaeedo/pdf).
  const { data: facturaData } = useQuery<{ factura: { idmaeedo: string; nudo: string | null; fecha: string | null; total: number } | null }>({
    queryKey: [`/api/ecommerce/orders/${order.id}/factura`],
    queryFn: async () => {
      const res = await fetch(`/api/ecommerce/orders/${order.id}/factura`, { credentials: "include" });
      if (!res.ok) return { factura: null };
      return res.json();
    },
    enabled: !isClientView && isWebOrder,
  });
  const systemFactura = facturaData?.factura ?? null;

  const liveSubtotal = isEditingPrices
    ? editedItems.reduce((sum, i) => sum + Math.round((Number(i.unitPrice) || 0) * (Number(i.quantity) || 0)), 0)
    : null;
  const liveTax = liveSubtotal !== null ? Math.round(liveSubtotal * 0.19) : null;
  const liveTotal = liveSubtotal !== null && liveTax !== null ? liveSubtotal + liveTax : null;

  const subtotal = liveSubtotal ?? (parseFloat(currentOrder.subtotal || '0') || items.reduce((sum, i) => sum + (i.subtotal || (i.unitPrice || i.price || 0) * i.quantity), 0));
  const tax = liveTax ?? (parseFloat(currentOrder.tax || '0') || Math.round(subtotal * 0.19));
  const total = liveTotal ?? (parseFloat(currentOrder.total || '0') || Math.round(subtotal * 1.19));

  const startEditPrices = () => {
    const cloned = getOrderItems(currentOrder).map(it => ({ ...it, unitPrice: Number(it.unitPrice ?? it.price ?? 0) }));
    setEditedItems(cloned);
    setIsEditingPrices(true);
  };

  const cancelEditPrices = () => {
    setIsEditingPrices(false);
    setEditedItems([]);
  };

  const updateEditedItemPrice = (index: number, value: string) => {
    const num = Math.max(0, Number(value.replace(/[^\d]/g, '')) || 0);
    setEditedItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      // Si el valor escrito coincide con un tramo, lo marcamos; si no, queda "Personalizado".
      const matched = it.tierPrices?.find(t => t.price === num);
      return { ...it, unitPrice: num, priceTier: matched?.key };
    }));
  };

  const updateEditedItemTier = (index: number, tierKey: string) => {
    setEditedItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const tier = it.tierPrices?.find(t => t.key === tierKey);
      if (!tier) return it;
      return { ...it, priceTier: tier.key, unitPrice: tier.price };
    }));
  };

  const updateEditedItemQuantity = (index: number, value: string | number) => {
    const raw = typeof value === 'number' ? value : Number(String(value).replace(/[^\d]/g, '')) || 0;
    const qty = Math.max(0, Math.floor(raw));
    setEditedItems(prev => prev.map((it, i) => i === index ? { ...it, quantity: qty } : it));
  };

  const incrementEditedItemQuantity = (index: number, delta: number) => {
    setEditedItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const next = Math.max(0, Math.floor((Number(it.quantity) || 0) + delta));
      return { ...it, quantity: next };
    }));
  };

  const removeEditedItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const addProductToEditedItems = (product: any, tier?: PriceTierOption) => {
    const tiers = getProductTiers(product);
    const chosen = tier ?? tiers.find(t => t.key === 'lista') ?? tiers[0];
    const unitPrice = chosen ? chosen.price : Math.round(Number(product.lista ?? product.precio ?? 0) || 0);
    const newItem: OrderItem = {
      productId: product.id,
      productName: product.producto || product.nombre || 'Producto',
      productCode: product.codigo,
      sku: product.codigo,
      quantity: 1,
      unitPrice,
      price: unitPrice,
      totalPrice: unitPrice,
      subtotal: unitPrice,
      selectedPackaging: product.unidad || undefined,
      imageUrl: product.imageUrl || undefined,
      priceTier: chosen?.key,
      tierPrices: tiers.length ? tiers : undefined,
    };
    setEditedItems(prev => [...prev, newItem]);
    setShowProductPicker(false);
    setProductSearch('');
    setProductResults([]);
    setPickerExpandedCode(null);
  };

  // Al elegir un producto en el buscador: si tiene un solo precio, se agrega directo;
  // si tiene varios, se despliegan los tramos para que el usuario elija el precio.
  const handlePickProduct = (product: any) => {
    const tiers = getProductTiers(product);
    if (tiers.length <= 1) {
      addProductToEditedItems(product, tiers[0]);
      return;
    }
    setPickerExpandedCode(prev => (prev === product.codigo ? null : product.codigo));
  };

  // Debounce product search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [productSearch]);

  useEffect(() => {
    if (!showProductPicker) return;
    if (debouncedSearch.length < 2) {
      setProductResults([]);
      return;
    }
    let cancelled = false;
    setIsSearchingProducts(true);
    fetch(`/api/price-list?search=${encodeURIComponent(debouncedSearch)}&limit=20&withImages=1`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => { if (!cancelled) setProductResults(data.items || []); })
      .catch(() => { if (!cancelled) setProductResults([]); })
      .finally(() => { if (!cancelled) setIsSearchingProducts(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, showProductPicker]);

  // Al entrar en modo edición, traemos los tramos de la lista de precios para los
  // productos que ya estaban en el pedido, así cada fila ofrece el selector de precio.
  // No bloquea: si falla, la fila mantiene la edición manual. (Solo corre al abrir edición.)
  useEffect(() => {
    if (!isEditingPrices) return;
    const codes = Array.from(new Set(
      editedItems
        .filter(it => it.productCode && (!it.tierPrices || it.tierPrices.length === 0))
        .map(it => it.productCode as string)
    ));
    if (codes.length === 0) return;
    let cancelled = false;
    setLoadingTiers(true);
    (async () => {
      const tiersByCode = new Map<string, PriceTierOption[]>();
      await Promise.all(codes.map(async (code) => {
        try {
          const r = await fetch(`/api/price-list?search=${encodeURIComponent(code)}&limit=10`, { credentials: 'include' });
          if (!r.ok) return;
          const data = await r.json();
          const product = (data.items || []).find((p: any) => p.codigo === code);
          if (product) {
            const tiers = getProductTiers(product);
            if (tiers.length) tiersByCode.set(code, tiers);
          }
        } catch { /* fila queda en edición manual */ }
      }));
      if (cancelled || tiersByCode.size === 0) { if (!cancelled) setLoadingTiers(false); return; }
      // Solo adjuntamos metadata (tramos + tramo inferido); no tocamos cantidades ni precios escritos.
      setEditedItems(prev => prev.map(it => {
        if (it.tierPrices && it.tierPrices.length) return it;
        if (!it.productCode || !tiersByCode.has(it.productCode)) return it;
        const tiers = tiersByCode.get(it.productCode)!;
        const current = Math.round(Number(it.unitPrice ?? it.price ?? 0));
        const matched = tiers.find(t => t.price === current);
        return { ...it, tierPrices: tiers, priceTier: matched?.key ?? it.priceTier };
      }));
      setLoadingTiers(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingPrices]);

  // Cargamos las tarifas de despacho una vez (formato → { precio, sku ZZFLETE }).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ecommerce/shipping-rates', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : {}))
      .then((raw: Record<string, any>) => {
        if (cancelled) return;
        const norm: Record<string, { price: number; sku: string }> = {};
        for (const [k, v] of Object.entries(raw || {})) {
          if (v && typeof v === 'object') norm[k] = { price: Number((v as any).price) || 0, sku: String((v as any).sku || '') };
          else norm[k] = { price: Number(v) || 0, sku: '' };
        }
        setShippingRates(norm);
      })
      .catch(() => { /* sin config: las líneas de despacho quedan manuales */ });
    return () => { cancelled = true; };
  }, []);

  // Mientras se editan los productos, la cantidad de cada línea de despacho se mantiene
  // sincronizada con las unidades de producto de su formato (1/4 Galón, Galón, Balde...).
  useEffect(() => {
    if (!isEditingPrices) return;
    const skuToRate = new Map<string, string>();
    for (const [rate, cfg] of Object.entries(shippingRates)) {
      if (cfg.sku) skuToRate.set(cfg.sku.toUpperCase(), rate);
    }
    if (skuToRate.size === 0) return;

    const qtyByRate = new Map<string, number>();
    for (const it of editedItems) {
      const sku = String(it.sku || it.productCode || '').toUpperCase();
      if (skuToRate.has(sku)) continue; // saltamos las propias líneas de flete
      const rate = getShippingKey(it.selectedPackaging || (it as any).unit || (it as any).unidad);
      if (!rate) continue;
      qtyByRate.set(rate, (qtyByRate.get(rate) || 0) + (Number(it.quantity) || 0));
    }

    let changed = false;
    const next = editedItems.map(it => {
      const sku = String(it.sku || it.productCode || '').toUpperCase();
      const rate = skuToRate.get(sku);
      if (!rate) return it;
      const desired = qtyByRate.get(rate) || 0;
      if ((Number(it.quantity) || 0) === desired) return it;
      changed = true;
      const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
      return { ...it, quantity: desired, totalPrice: Math.round(unitPrice * desired), subtotal: Math.round(unitPrice * desired) };
    });
    if (changed) setEditedItems(next);
  }, [editedItems, isEditingPrices, shippingRates]);

  const saveEditedPrices = async () => {
    const cleaned = editedItems
      .map(({ tierPrices, ...it }) => ({ ...it, quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)) }))
      .filter(it => it.quantity > 0);

    if (cleaned.length === 0) {
      toast({
        title: 'El pedido no puede quedar vacío',
        description: 'Si querés cancelar el pedido, usá "Descartar pedido".',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingPrices(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${currentOrder.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: cleaned }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al guardar');
      }
      const updated = await res.json();
      setCurrentOrder(updated);
      setIsEditingPrices(false);
      setEditedItems([]);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/client/orders'] });
      toast({ title: 'Pedido actualizado' });
    } catch (err: any) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingPrices(false);
    }
  };

  const handleRejectOrder = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: 'Indicá un motivo del descarte', variant: 'destructive' });
      return;
    }
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${currentOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rejected', rejectedReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo descartar el pedido');
      }
      const updated = await res.json();
      setCurrentOrder(prev => ({ ...prev, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders/pending-count'] });
      toast({ title: 'Pedido descartado', description: `Motivo registrado por #${getNumericOrderId(currentOrder.id)}` });
      setShowRejectDialog(false);
      setRejectReason('');
      onBack();
    } catch (err: any) {
      toast({ title: 'Error al descartar', description: err.message, variant: 'destructive' });
    } finally {
      setIsRejecting(false);
    }
  };

  const recalculateFromClientList = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${currentOrder.id}/recalculate-prices`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al recalcular');
      }
      const data = await res.json();
      setCurrentOrder(data.order);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/client/orders'] });
      const warn = Array.isArray(data.warnings) && data.warnings.length
        ? ` (${data.warnings.length} SKU sin precio en la lista)`
        : '';
      toast({
        title: 'Precios recalculados',
        description: `Lista aplicada: ${data.priceListUsed}${data.branchDiscountPct ? ` (descuento sucursal ${data.branchDiscountPct}%)` : ''}${warn}`,
      });
    } catch (err: any) {
      toast({ title: 'Error al recalcular', description: err.message, variant: 'destructive' });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleMarkIngresado = async () => {
    if (isIngresando) return;
    setIsIngresando(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${currentOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'ingresado', ingresadoNotes: ingresadoNotes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Error' }));
        throw new Error(err.message || 'Error al marcar como ingresado');
      }
      const updated = await res.json();
      setCurrentOrder(prev => ({ ...prev, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders/pending-count'] });
      toast({ title: 'Pedido marcado como ingresado', description: `#${getNumericOrderId(currentOrder.id)} ingresado al ERP` });
      setShowIngresarDialog(false);
      setIngresadoNotes('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo marcar como ingresado', variant: 'destructive' });
    } finally {
      setIsIngresando(false);
    }
  };

  const openPaymentConditionDialog = () => {
    setPaymentConditionValue(currentOrder.paymentCondition || 'Transferencia');
    setShowPaymentConditionDialog(true);
  };

  const handleSavePaymentCondition = async () => {
    if (isSavingPaymentCondition) return;
    const value = paymentConditionValue.trim();
    if (!value) {
      toast({ title: 'Condición requerida', variant: 'destructive' });
      return;
    }
    setIsSavingPaymentCondition(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${currentOrder.id}/payment-condition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentCondition: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al actualizar');
      }
      const updated = await res.json();
      setCurrentOrder(prev => ({ ...prev, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders/pending-count'] });
      const wasPending = currentOrder.status === 'pending';
      const autoApproved = wasPending && updated.status === 'approved';
      const isCreditoNew = /cr[eé]dito/i.test(value);
      toast({
        title: 'Condición de pago actualizada',
        description: autoApproved
          ? (isCreditoNew
              ? 'Pedido aprobado automáticamente — cupo de crédito consumido'
              : 'Pedido aprobado automáticamente por transferencia')
          : undefined,
      });
      setShowPaymentConditionDialog(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSavingPaymentCondition(false);
    }
  };

  // Envía al cliente el correo de "pedido modificado / listo para pago" con link
  // directo a su pedido en el portal. El backend fuerza el envío (ignora el toggle global).
  const handleNotifyModified = async () => {
    if (isNotifying) return;
    setIsNotifying(true);
    try {
      const res = await fetch(`/api/ecommerce/orders/${order.id}/notify-modified`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'No se pudo enviar el correo');
      toast({ title: 'Correo enviado', description: `Se notificó al cliente${data?.to ? ` (${data.to})` : ''}.` });
      setShowNotifyDialog(false);
    } catch (e: any) {
      toast({ title: 'No se pudo enviar', description: e?.message || 'Error al enviar el correo', variant: 'destructive' });
    } finally {
      setIsNotifying(false);
    }
  };

  // One-click quote generation: server resolves the main-branch client by RUT,
  // creates the quote + items, and we download the PDF here.
  const handleAutoGenerateQuote = async () => {
    if (isGeneratingQuote) return;
    setIsGeneratingQuote(true);
    try {
      const res = await apiRequest(`/api/ecommerce/orders/${currentOrder.id}/generate-quote`, {
        method: 'POST',
      });
      const data = await res.json();
      const { quote, items, matchedClient } = data;

      // Download PDF
      const blob = await pdf(<QuotePDFDocument quote={quote} items={items} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cotizacion_${quote.quoteNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const branchInfo = matchedClient
        ? (matchedClient.isParent
            ? `Casa Matriz: ${matchedClient.nokoen}`
            : `${matchedClient.nokoen}${matchedClient.branchLabel ? ` — ${matchedClient.branchLabel}` : ''}`)
        : 'cliente del pedido';
      toast({
        title: 'Cotización generada',
        description: `${quote.quoteNumber} · ${branchInfo}`,
      });

      // Reflect quoteId in the local view
      setCurrentOrder(prev => ({ ...prev, quoteId: quote.id }));
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
    } catch (err: any) {
      toast({
        title: 'Error al generar cotización',
        description: err.message || 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              Pedido #{order.id?.includes('-') ? getNumericOrderId(order.id) : order.id}
            </h1>
            <span className={`inline-flex items-center flex-shrink-0 gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(order.createdAt)}
            <span className="text-gray-300">·</span>
            <span>{timeAgo(order.createdAt)}</span>
          </div>
        </div>
        
        {/* Admin Actions */}
        {!isClientView && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl shadow-sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={startEditPrices}
                  className="cursor-pointer"
                  disabled={isEditingPrices}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar productos y precios
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={recalculateFromClientList}
                  className="cursor-pointer"
                  disabled={isRecalculating || isEditingPrices}
                >
                  {isRecalculating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Recalcular con lista cliente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {statusKey === 'pending' && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ status: 'approved' }),
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                        toast({ title: 'Pedido aprobado' });
                        onBack();
                      } catch {
                        toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprobar Pedido
                  </DropdownMenuItem>
                )}
                {['ingresado', 'preparacion', 'sent', 'transito', 'entregado'].includes(statusKey) && (
                  <>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ status: 'preparacion' }),
                          });
                          if (!res.ok) throw new Error('No se pudo cambiar el estado');
                          queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                          toast({ title: 'Pedido en preparación' });
                          onBack();
                        } catch {
                          toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Marcar en Preparación
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ status: 'transito' }),
                          });
                          if (!res.ok) throw new Error('No se pudo cambiar el estado');
                          queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                          toast({ title: 'Pedido en tránsito' });
                          onBack();
                        } catch {
                          toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Marcar En curso
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ status: 'entregado' }),
                          });
                          if (!res.ok) throw new Error('No se pudo cambiar el estado');
                          queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                          toast({ title: 'Pedido entregado' });
                          onBack();
                        } catch {
                          toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marcar como Entregado
                    </DropdownMenuItem>
                  </>
                )}

                {statusKey !== 'pending' && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ status: 'pending' }),
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                        toast({ title: 'Pedido marcado como pendiente' });
                        onBack();
                      } catch {
                        toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Marcar Pendiente
                  </DropdownMenuItem>
                )}
                {statusKey !== 'rejected' && (
                  <DropdownMenuItem
                    onClick={() => {
                      setRejectReason(currentOrder.rejectedReason || '');
                      setShowRejectDialog(true);
                    }}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Descartar pedido
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: 'archived' }),
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                      toast({ title: 'Pedido archivado' });
                      onBack();
                    } catch {
                      toast({ title: 'Error al archivar', variant: 'destructive' });
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowQuoteModal(true)}
                  className="cursor-pointer"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Generar cotización (editar datos)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isModified && isWebOrder && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-sm"
                onClick={() => setShowNotifyDialog(true)}
                disabled={isNotifying}
                data-testid="button-notify-modified"
              >
                {isNotifying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Notificar al cliente</span>
              </Button>
            )}
            {canIngresar && statusKey !== 'ingresado' && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-sm"
                onClick={() => setShowIngresarDialog(true)}
                disabled={isIngresando}
                data-testid="button-mark-ingresado"
              >
                {isIngresando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Inbox className="w-4 h-4 mr-2" />
                )}
                <span className="hidden sm:inline">Marcar como ingresado</span>
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white shadow-sm"
              onClick={handleAutoGenerateQuote}
              disabled={isGeneratingQuote}
              data-testid="button-generate-quote-auto"
            >
              {isGeneratingQuote ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              <span className="hidden sm:inline">
                {isGeneratingQuote ? 'Generando...' : 'Generar Cotización'}
              </span>
            </Button>
          </div>
        )}

        {/* Ingresar confirmation dialog (recepción) */}
        {canIngresar && (
          <AlertDialog open={showIngresarDialog} onOpenChange={setShowIngresarDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar pedido como ingresado</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirmás que el pedido #{getNumericOrderId(order.id)} fue ingresado al ERP. Quedará registrado con tu usuario y la fecha actual.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="ingresado-notes" className="text-sm">Notas (opcional)</Label>
                <Textarea
                  id="ingresado-notes"
                  placeholder="Ej: N° de documento en ERP, observaciones..."
                  value={ingresadoNotes}
                  onChange={(e) => setIngresadoNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isIngresando}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleMarkIngresado(); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isIngresando}
                >
                  {isIngresando ? 'Marcando...' : 'Marcar como ingresado'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Notify client: order modified / ready for payment */}
        {!isClientView && (
          <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Notificar al cliente</AlertDialogTitle>
                <AlertDialogDescription>
                  Se enviará un correo a <strong>{currentOrder.clientEmail || 'el cliente'}</strong> avisando que el pedido #{getNumericOrderId(order.id)} fue modificado y está listo para pago, con un enlace directo a su pedido en el portal.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isNotifying}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleNotifyModified(); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={isNotifying}
                >
                  {isNotifying ? 'Enviando...' : 'Enviar correo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Payment condition edit dialog */}
        {canEditPaymentCondition && (
          <AlertDialog open={showPaymentConditionDialog} onOpenChange={setShowPaymentConditionDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Editar condición de pago</AlertDialogTitle>
                <AlertDialogDescription>
                  Si seleccionás "Transferencia" y el pedido está pendiente, será aprobado automáticamente sin consumir cupo de crédito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {['Transferencia', 'Crédito', 'Contado', 'Cheque'].map(opt => (
                    <Button
                      key={opt}
                      type="button"
                      variant={paymentConditionValue === opt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentConditionValue(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment-condition-input" className="text-xs">O ingresá una condición personalizada</Label>
                  <Input
                    id="payment-condition-input"
                    value={paymentConditionValue}
                    onChange={(e) => setPaymentConditionValue(e.target.value)}
                    placeholder="Ej: Transferencia, Crédito 30 días..."
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSavingPaymentCondition}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleSavePaymentCondition(); }}
                  disabled={isSavingPaymentCondition}
                >
                  {isSavingPaymentCondition ? 'Guardando...' : 'Guardar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Product Picker Dialog (add product while editing) */}
        {!isClientView && (
          <AlertDialog open={showProductPicker} onOpenChange={(o) => { setShowProductPicker(o); if (!o) { setProductSearch(''); setProductResults([]); setPickerExpandedCode(null); } }}>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Agregar producto al pedido</AlertDialogTitle>
                <AlertDialogDescription>
                  Buscá por código o nombre y elegí a qué precio de la lista lo vendés (Lista, descuentos, mínimo, etc.). Después podés ajustarlo en la fila.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    autoFocus
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ej: ESMALTE, PCA960..."
                    className="pl-9"
                    data-testid="input-product-search"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {debouncedSearch.length < 2 && (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Escribí al menos 2 caracteres para buscar
                    </div>
                  )}
                  {debouncedSearch.length >= 2 && isSearchingProducts && (
                    <div className="p-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Buscando productos...
                    </div>
                  )}
                  {debouncedSearch.length >= 2 && !isSearchingProducts && productResults.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Sin resultados para "{debouncedSearch}"
                    </div>
                  )}
                  {productResults.map((p: any) => {
                    const tiers = getProductTiers(p);
                    const expanded = pickerExpandedCode === p.codigo;
                    const multiTier = tiers.length > 1;
                    const listaPrice = tiers.find(t => t.key === 'lista')?.price ?? p.lista;
                    return (
                      <div key={p.id} data-testid={`product-result-${p.codigo}`}>
                        <button
                          type="button"
                          onClick={() => handlePickProduct(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-orange-50/50 transition-colors flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.producto} className="w-full h-full object-contain p-0.5" />
                            ) : (
                              <Package className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.producto}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {p.codigo}{p.unidad ? ` · ${p.unidad}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-700">{formatPrice(listaPrice)}</span>
                            {multiTier && (
                              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                        </button>
                        {expanded && multiTier && (
                          <div className="px-3 pb-3 pt-1 bg-orange-50/30">
                            <p className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                              <Tag className="w-3 h-3" /> Elegí el precio de venta:
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {tiers.map((t) => (
                                <button
                                  key={t.key}
                                  type="button"
                                  onClick={() => addProductToEditedItems(p, t)}
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-[#FF6E23] hover:bg-orange-50 transition-colors text-left"
                                  data-testid={`product-tier-${p.codigo}-${t.key}`}
                                >
                                  <span className="text-[11px] text-gray-600">{t.label}</span>
                                  <span className="text-xs font-bold text-gray-900">{formatPrice(t.price)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cerrar</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Discard / Reject Order Dialog */}
        {!isClientView && (
          <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Descartar pedido</AlertDialogTitle>
                <AlertDialogDescription>
                  El pedido #{getNumericOrderId(order.id)} quedará marcado como descartado. Indicá el motivo para dejar registro (lo verá tu equipo en la actividad).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="reject-reason" className="text-sm">Motivo del descarte</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Ej: cliente canceló por teléfono, stock no disponible, duplicado..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-reject-reason"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isRejecting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); handleRejectOrder(); }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isRejecting || !rejectReason.trim()}
                  data-testid="button-confirm-reject"
                >
                  {isRejecting ? 'Descartando...' : 'Descartar pedido'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete Confirmation Dialog */}
        {!isClientView && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente el pedido #{getNumericOrderId(order.id)}. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await fetch(`/api/ecommerce/orders/${order.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                      toast({ title: 'Pedido eliminado' });
                      onOrderDeleted?.();
                      onBack();
                    } catch {
                      toast({ title: 'Error al eliminar', variant: 'destructive' });
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Quick Quote Modal */}
        {showQuoteModal && (
          <EcommerceQuoteModal
            order={currentOrder}
            open={showQuoteModal}
            onOpenChange={setShowQuoteModal}
          />
        )}

        {/* Visor de documento (factura / guía) */}
        {viewingDoc && (
          <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
        )}
      </div>

      {/* Modified banner — visible to clients when the order was edited by the team */}
      {isClientView && isModified && (
        <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">Tu pedido fue modificado</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Nuestro equipo ajustó este pedido. Revisá el nuevo total
              {requiresReceipt
                ? ' y, si pagás por transferencia, actualizá el comprobante con el monto correcto desde la sección "Comprobante de pago".'
                : '.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Products + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products Card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Productos</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {items.length}
                </span>
                {isEditingPrices && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                    Editando precios
                  </span>
                )}
                {isEditingPrices && loadingTiers && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> cargando lista de precios…
                  </span>
                )}
              </div>
              {isEditingPrices ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductPicker(true)}
                    disabled={isSavingPrices}
                    className="rounded-xl"
                    data-testid="button-add-product"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Agregar producto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditPrices}
                    disabled={isSavingPrices}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEditedPrices}
                    disabled={isSavingPrices}
                    className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white"
                  >
                    {isSavingPrices ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1.5" />
                    )}
                    Guardar
                  </Button>
                </div>
              ) : (
                <span className={`text-xs font-bold ${status.color}`}>
                  {status.label}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {orderedItems.map(({ item, index, isDespacho }, pos) => {
                const itemPrice = Number(item.unitPrice ?? item.price ?? 0);
                const itemTotal = isEditingPrices
                  ? Math.round(itemPrice * (Number(item.quantity) || 0))
                  : (item.subtotal ?? item.totalPrice ?? itemPrice * item.quantity);
                return (
                  <Fragment key={index}>
                  {pos === firstDespachoPos && hasProductsBeforeDespacho && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-gray-50/70">
                      <Truck className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Despacho</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 overflow-hidden border border-gray-100 hidden sm:flex">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-2">{item.productName}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.selectedColor && (
                          <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedColor}
                          </span>
                        )}
                        {(item.selectedPackaging || item.sku || item.productCode) && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedPackaging || item.sku || item.productCode}
                          </span>
                        )}
                      </div>
                      {isEditingPrices ? (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">Precio unit.:</span>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={itemPrice.toLocaleString('es-CL')}
                                onChange={(e) => updateEditedItemPrice(index, e.target.value)}
                                className="h-8 w-28 pl-5 text-sm"
                              />
                            </div>
                          </div>
                          {item.tierPrices && item.tierPrices.length > 1 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Lista:</span>
                              <Select
                                value={item.priceTier && item.tierPrices.some(t => t.key === item.priceTier) ? item.priceTier : undefined}
                                onValueChange={(val) => updateEditedItemTier(index, val)}
                              >
                                <SelectTrigger className="h-8 w-[150px] text-xs" data-testid={`select-tier-${index}`}>
                                  <SelectValue placeholder="Personalizado" />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.tierPrices.map((t) => (
                                    <SelectItem key={t.key} value={t.key} className="text-xs">
                                      {t.label}: {formatPrice(t.price)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {isDespacho ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Cant.:</span>
                              <span className="text-sm font-semibold text-gray-700 tabular-nums">{Number(item.quantity) || 0}</span>
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium" title="Se calcula según las unidades de producto de este formato">auto</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Cant.:</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => incrementEditedItemQuantity(index, -1)}
                                data-testid={`button-qty-decrement-${index}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={Number(item.quantity) || 0}
                                onChange={(e) => updateEditedItemQuantity(index, e.target.value)}
                                className="h-8 w-14 text-center text-sm"
                                data-testid={`input-qty-${index}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() => incrementEditedItemQuantity(index, 1)}
                                data-testid={`button-qty-increment-${index}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeEditedItem(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Quitar
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1">
                          {item.convenioPct && item.originalUnitPrice && item.originalUnitPrice > itemPrice ? (
                            <>
                              <span className="line-through text-gray-300 mr-1">{formatPrice(item.originalUnitPrice)}</span>
                              <span className="text-emerald-600 font-medium">{formatPrice(itemPrice)}</span>
                              <span className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                                -{item.convenioPct}% sucursal
                              </span>
                              <span className="ml-1">× {item.quantity}</span>
                            </>
                          ) : (
                            <>{formatPrice(itemPrice)} × {item.quantity} unidades</>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Price */}
                    <div className="text-left sm:text-right flex-shrink-0 mt-2 sm:mt-0">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(itemTotal)}</span>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Resumen de Pago</h3>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(() => {
                const bdp = Number(currentOrder.branchDiscountPercent || 0);
                if (bdp > 0) {
                  return (
                    <div className="flex justify-between items-center text-sm bg-emerald-50 -mx-5 px-5 py-2 border-y border-emerald-100">
                      <span className="text-emerald-700 font-medium">
                        Descuento sucursal aplicado
                        {currentOrder.priceListUsed ? ` · Lista ${currentOrder.priceListUsed}` : ''}
                      </span>
                      <span className="font-bold text-emerald-700">-{bdp}%</span>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Subtotal ({items.length} producto{items.length !== 1 ? 's' : ''})</span>
                <span className="font-medium text-gray-700">{formatPrice(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">IVA (19%)</span>
                  <span className="font-medium text-gray-700">{formatPrice(tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-xl font-black text-[#FF6E23]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Notas</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Seguimiento del pedido (solo cliente, pedidos web) */}
          {isClientView && isWebOrder && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Seguimiento del pedido</h3>
              </div>
              <div className="px-5 py-4">
                <OrderTrackingTimeline orderId={currentOrder.id} />
              </div>
            </div>
          )}

          {/* Documento ERP del pedido (factura / guía de despacho) — vista del cliente */}
          {isClientView && erpDocument && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Documento del pedido</h3>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${erpDocument.kind === "factura" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
                    {erpDocument.kind === "factura" ? <FileText className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{erpDocument.tipoLabel} N° {erpDocument.numero}</p>
                    <p className="text-[10px] text-gray-400">{erpDocument.items.length} ítem{erpDocument.items.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewingDoc(erpDocument)}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Ver documento"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        try { setIsDownloadingDoc(true); await downloadDocumento(erpDocument); }
                        finally { setIsDownloadingDoc(false); }
                      }}
                      disabled={isDownloadingDoc}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      title="Descargar PDF"
                    >
                      {isDownloadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Documents Section */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FF6E23]" />
                  <h3 className="font-bold text-gray-900">Facturas</h3>
                  {(invoices.length > 0 || systemFactura) && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      {invoices.length + (systemFactura ? 1 : 0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Factura oficial del sistema (DTE) — vista interna, cuando hay una FCV asociada al
                  pedido. Mismo PDF oficial que el botón de la ficha del cliente. */}
              {!isClientView && systemFactura && (
                <button
                  type="button"
                  onClick={() => window.open(`/api/erp/facturas/${systemFactura.idmaeedo}/pdf`, "_blank", "noopener")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-300 hover:shadow-sm transition-all text-left group"
                  title="Descargar factura oficial en PDF"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 transition-colors">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">Factura N° {systemFactura.nudo ?? "—"}</p>
                    <p className="text-[10px] text-emerald-700/80">Documento tributario · descargar PDF oficial</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/70 border border-emerald-200 group-hover:bg-white transition-colors flex-shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </span>
                </button>
              )}

              {/* Existing invoices list */}
              {invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.map((invoice, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{invoice.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {invoice.uploadedAt ? new Date(invoice.uploadedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          {invoice.uploadedBy ? ` · ${invoice.uploadedBy}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={invoice.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Descargar factura"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {!isClientView && (
                          <button
                            onClick={async () => {
                              setIsDeletingInvoice(idx);
                              try {
                                const res = await fetch(`/api/ecommerce/orders/${order.id}/invoices/${idx}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                if (!res.ok) throw new Error('Error al eliminar');
                                const updated = await res.json();
                                setCurrentOrder(updated);
                                queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                                queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/client/orders'] });
                                toast({ title: 'Factura eliminada' });
                              } catch {
                                toast({ title: 'Error al eliminar factura', variant: 'destructive' });
                              } finally {
                                setIsDeletingInvoice(null);
                              }
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Eliminar factura"
                            disabled={isDeletingInvoice === idx}
                          >
                            {isDeletingInvoice === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : systemFactura ? null : (
                <div className="text-center py-3">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">
                    {isClientView ? 'No hay facturas disponibles aún' : 'No hay facturas adjuntas'}
                  </p>
                </div>
              )}

              {/* Upload area — admin only */}
              {!isClientView && (
                <div className="pt-2 border-t border-gray-100">
                  <Label
                    htmlFor="invoice-upload"
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                      isUploadingInvoice
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-gray-200 hover:border-[#FF6E23]/50 hover:bg-orange-50/30'
                    }`}
                  >
                    {isUploadingInvoice ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-sm text-blue-600 font-medium">Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500 font-medium">Adjuntar Factura PDF</span>
                      </>
                    )}
                  </Label>
                  <Input
                    id="invoice-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    disabled={isUploadingInvoice}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingInvoice(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await fetch(`/api/ecommerce/orders/${order.id}/invoices`, {
                          method: 'POST',
                          credentials: 'include',
                          body: formData,
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          throw new Error(err.message || 'Error al subir factura');
                        }
                        const updated = await res.json();
                        setCurrentOrder(updated);
                        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/client/orders'] });
                        toast({ title: 'Factura adjuntada', description: `"${file.name}" subida correctamente.` });
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message || 'No se pudo subir la factura', variant: 'destructive' });
                      } finally {
                        setIsUploadingInvoice(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Actividad</h3>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF6E23] mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Emisión documentada</p>
                    <p className="text-xs text-gray-500">{formatDate(currentOrder.createdAt)}</p>
                  </div>
                </div>
                {currentOrder.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Aprobación confirmada</p>
                      <p className="text-xs text-gray-500">{formatDate(currentOrder.approvedAt)}</p>
                    </div>
                  </div>
                )}
                {currentOrder.ingresadoAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Ingresado al ERP</p>
                      <p className="text-xs text-gray-500">{formatDate(currentOrder.ingresadoAt)}</p>
                      {currentOrder.ingresadoNotes && (
                        <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-1">Notas de recepción</p>
                          <p className="text-sm text-blue-900 whitespace-pre-wrap break-words">{currentOrder.ingresadoNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {currentOrder.rejectedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Pedido descartado</p>
                      <p className="text-xs text-gray-500">{formatDate(currentOrder.rejectedAt)}</p>
                      {currentOrder.rejectedReason && (
                        <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-100">
                          <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest mb-1">Motivo del descarte</p>
                          <p className="text-sm text-red-900 whitespace-pre-wrap break-words">{currentOrder.rejectedReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {statusKey === 'despacho' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Guía de despacho emitida</p>
                      <p className="text-xs text-gray-500">Registrado en sistema ERP</p>
                    </div>
                  </div>
                )}
                {statusKey === 'facturado' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Factura emitida</p>
                      <p className="text-xs text-gray-500">Transacción finalizada</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Customer Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Cliente</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6E23] to-amber-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {order.clientName?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName || 'Cliente Genérico'}</h4>
                  {order.clientCompany && (
                    <p className="text-xs text-gray-500 truncate">{order.clientCompany}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              {(order.clientEmail || order.clientPhone) && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contacto</h5>
                  {order.clientEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={order.clientEmail}>{order.clientEmail}</span>
                    </div>
                  )}
                  {order.clientPhone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{order.clientPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dirección de envío</h5>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="break-words">{order.shippingAddress}</span>
                  </div>
                </div>
              )}

              {/* Payment Condition & Receipt */}
              {(currentOrder.paymentCondition || canEditPaymentCondition) && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Condición de pago</h5>
                    {canEditPaymentCondition && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={openPaymentConditionDialog}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Landmark className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium truncate">{currentOrder.paymentCondition || '—'}</span>
                  </div>
                </div>
              )}

              {order.purchaseOrderPdfUrl && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Orden de Compra</h5>
                  <a
                    href={order.purchaseOrderPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">OC del Cliente</p>
                      <p className="text-[10px] text-blue-500 dark:text-blue-400">Clic para ver / descargar</p>
                    </div>
                    <Download className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </a>
                </div>
              )}

              {(hasReceipt || (isClientView && requiresReceipt)) && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comprobante de pago</h5>

                  {hasReceipt && (
                    <a
                      href={currentOrder.paymentReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[#FF6E23] hover:text-[#FF6E23]/80 transition-colors font-medium break-all"
                    >
                      <FileImage className="w-4 h-4 flex-shrink-0" />
                      Ver comprobante enviado
                    </a>
                  )}

                  {isClientView && requiresReceipt && (
                    <>
                      <input
                        type="file"
                        ref={receiptInputRef}
                        onChange={onReceiptFileSelected}
                        accept="image/*,.pdf"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={hasReceipt ? 'outline' : 'default'}
                        className={`w-full rounded-xl mt-1 ${hasReceipt ? '' : 'bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white'}`}
                        onClick={() => receiptInputRef.current?.click()}
                        disabled={isUploadingReceipt}
                      >
                        {isUploadingReceipt ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Subiendo...
                          </>
                        ) : hasReceipt ? (
                          <>
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Reemplazar comprobante
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Subir comprobante
                          </>
                        )}
                      </Button>
                      <p className="text-[10px] text-gray-400">
                        Acepta imágenes (JPG, PNG) y PDF.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Salesperson */}
          {!isClientView && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Vendedor Asignado</h3>
              </div>
              <div className="px-5 py-4">
                {order.assignedSalespersonName ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">{order.assignedSalespersonName}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Sin vendedor asignado
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
