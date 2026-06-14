import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, 
  ShoppingCart,
  Phone, 
  Mail, 
  MapPin, 
  ImageIcon,
  Star,
  ChevronDown,
  Menu,
  X,
  Plus,
  Minus,
  Check,
  Grid3X3,
  Percent,
  Award,
  ChevronLeft,
  ChevronRight,
  User,
  LayoutDashboard,
  LogOut,
  Palette,
  Box,
  Package,
  Info,
  Play,
  FileText,
  Ruler,
  HelpCircle,
  Loader2,
  LockKeyhole,
  UserPlus,
  Truck,
  Tag,
  Zap,
  Barcode,
  ArrowRight,
  Building,
  GitBranch,
  ChevronsUpDown,
  Sparkles,
  PieChart,
  Rocket,
  Share2,
  FileUp,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { validateQuantity as validateCartQuantity } from "@/contexts/CartContext";
import { setAttachedOc } from "@/lib/attached-oc";
import { FloatingCart, CartToggle } from "@/components/cart";
import ProductCardExpandable from "@/components/shared/ProductCardExpandable";
import CustomColorButton from "@/components/shared/CustomColorButton";
import { getFormatQuantityRules } from "@shared/format-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import bannerCopper from "@assets/Desktop Banner 02_1758045959229.png";
import bannerStain from "@assets/Desktop Banner 03 (1)_1758047457407.png";
import bannerDespacho from "@assets/Desktop Banner 01_1758047466193.png";

// Types for store data
interface StoreConfig {
  siteName?: string;
  logoUrl?: string;
  primaryColor?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface StoreBanner {
  id: string;
  titulo: string;
  subtitulo?: string;
  descripcion?: string;
  imagenDesktop: string;
  imagenMobile?: string;
  colorFondo: string;
  colorTexto: string;
  linkUrl?: string;
  activo: boolean;
  tipoVisualizacion?: string;
  orden?: number;
  offerPrice?: number;
}

interface StoreProduct {
  id: string;
  kopr: string; // Product code from API
  name: string; // Product name from API
  category?: string;
  ud02pr?: string; // Unit presentation from API
  precio?: number; // Price field from API (number format)
  ecomPrice?: string; // Legacy field name
  primaryImageUrl?: string; // Primary image URL from API
  description?: string;
  active: boolean;
  slug?: string;
  // Product grouping fields
  groupId?: string | null;
  variantLabel?: string | null;
  isMainVariant?: boolean;
  // Legacy compatibility fields
  codigo?: string;
  producto?: string;
  unidad?: string;
  canalDigital?: number;
  imagenUrl?: string;
  descripcion?: string;
  activo?: boolean;
  orden?: number;
  offerPrice?: number;
}

interface ProductGroup {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  activo: boolean;
  productos: StoreProduct[];
}

// Grouped catalog types (same structure as salesperson catalog)
interface StoreFormatVariant {
  ecomId: string;
  sku: string;
  name: string;
  color: string;
  format: string;
  groupName: string | null;
  price: number | null;
  originalPrice?: number | null; // Price before branch discount
  offerPrice?: number | null; // Promotional/offer price
  stock: number;
  minUnit: number;
  stepSize: number;
  description: string | null;
  imageUrl?: string | null;
  dimensions?: {
    weight?: string | null; weightUnit?: string | null;
    length?: string | null; lengthUnit?: string | null;
    width?: string | null; widthUnit?: string | null;
    height?: string | null; heightUnit?: string | null;
    volume?: string | null; volumeUnit?: string | null;
  };
  packaging?: {
    packageName?: string | null; packageUnit?: string | null; amountPerPackage?: number | null;
    boxName?: string | null; boxUnit?: string | null; amountPerBox?: number | null;
    palletName?: string | null; palletUnit?: string | null; amountPerPallet?: number | null;
    // Venta por pallet (Opción B): el botón aparece sólo si palletEnabled && amountPerPallet>0.
    // El precio del pallet se define por UNO de dos modos (mutuamente excluyentes):
    //   - palletDiscountPct: % de descuento sobre precio de lista (precio unitario rebajado)
    //   - palletPrice: precio total fijo del pallet en $ (precio unitario = palletPrice/units)
    // Si ambos vienen (no debería), gana palletPrice.
    // REEMPLAZA la oferta activa (no se suma).
    palletEnabled?: boolean;
    palletDiscountPct?: number | null;
    palletPrice?: number | null;
  };
}

interface StoreGenericProduct {
  genericName: string;
  groupName: string | null;
  tags?: string[];
  breveResena?: string | null;
  imageUrl?: string | null;
  colors: { [color: string]: StoreFormatVariant[] };
}

interface StoreCatalogResponse {
  catalog: StoreGenericProduct[];
  totalProducts: number;
  branchDiscountPercent?: number;
}


const formatPrice = (price: number | string | null | undefined): string => {
  if (!price || price === 0 || price === "0") return "";
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return "";
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice)}`;
};

// Compatibility helper functions to map between old and new field names
const getProductCode = (product: StoreProduct): string => {
  return product.kopr || product.codigo || '';
};

const getProductName = (product: StoreProduct): string => {
  return product.name || product.producto || '';
};

const getProductUnit = (product: StoreProduct): string | undefined => {
  return product.ud02pr || product.unidad;
};

const getProductPrice = (product: StoreProduct): number => {
  // Priority: offerPrice -> precio -> ecomPrice -> canalDigital -> 0
  if (product.offerPrice && product.offerPrice > 0) {
    return product.offerPrice;
  }
  if (product.precio && product.precio > 0) {
    return product.precio;
  }
  if (product.ecomPrice) {
    const price = parseFloat(product.ecomPrice);
    return isNaN(price) ? 0 : price;
  }
  return product.canalDigital || 0;
};

const getProductImageUrl = (product: StoreProduct): string | undefined => {
  return product.primaryImageUrl || product.imagenUrl;
};

const getProductCategory = (product: StoreProduct): string | undefined => {
  return product.category;
};

const isProductActive = (product: StoreProduct): boolean => {
  return product.active !== undefined ? product.active : (product.activo || false);
};

const getProductDescription = (product: StoreProduct): string | undefined => {
  return product.description || product.descripcion;
};

// Quantity logic using centralized format-utils
const getQuantityJumpRule = (unidad: string | undefined): number => {
  return getFormatQuantityRules(unidad).stepQuantity;
};

const getMinimumQuantity = (unidad: string | undefined): number => {
  return getFormatQuantityRules(unidad).minQuantity;
};

const getQuantityLabel = (unidad: string | undefined): string => {
  const rules = getFormatQuantityRules(unidad);
  if (rules.minQuantity === 1) return "Mín: 1 unidad";
  return `Mín: ${rules.minQuantity} unidades`;
};

const validateQuantity = (quantity: number, unidad: string | undefined): number => {
  const rules = getFormatQuantityRules(unidad);
  if (quantity < rules.minQuantity) return rules.minQuantity;
  return Math.max(rules.minQuantity, Math.floor(quantity / rules.stepQuantity) * rules.stepQuantity);
};

// ═══════════════════════════════════════════════════════
// SKU QUICK ORDER MODAL — for clients who know their SKUs
// ═══════════════════════════════════════════════════════

// Branch type for branch selector
interface StoreBranch {
  id: string;
  name: string;
  branchLabel: string | null;
  isRoot: boolean;
  address: string | null;
  discountPercent: number;
  priceList: string | null;
}

interface SkuQuickOrderModalProps {
  onClose: () => void;
  clientPriceList: string | null;
  offersMap: Map<string, number>;
  isClient: boolean;
  selectedBranchId: string | null;
  branchDiscountPct: number;
  addItem: (item: any) => void;
  setShowFloatingCart: (show: boolean) => void;
}

function SkuQuickOrderModal({ onClose, clientPriceList, offersMap, isClient, selectedBranchId, branchDiscountPct, addItem, setShowFloatingCart }: SkuQuickOrderModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const ocFileInputRef = useRef<HTMLInputElement>(null);
  const [skuSearch, setSkuSearch] = useState('');
  const [debouncedSku, setDebouncedSku] = useState('');
  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({});
  const [addedItems, setAddedItems] = useState<Array<{ sku: string; name: string; color: string; format: string; qty: number; price: number }>>([]);
  const [isParsingOc, setIsParsingOc] = useState(false);
  const [ocResult, setOcResult] = useState<{
    fileName: string;
    metadata: {
      ocNumber?: string | null;
      rut?: string | null;
      razonSocial?: string | null;
      fecha?: string | null;
      observaciones?: string | null;
      total?: string | null;
    } | null;
    matchedCount: number;
    unmatched: Array<{ sku: string; quantity: number; rawLine?: string }>;
    parseError?: string | null;
  } | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Debounce SKU search — faster than catalog (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSku(skuSearch.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [skuSearch]);

  // Fetch grouped data filtered by SKU search
  const { data: searchResults, isLoading } = useQuery<StoreCatalogResponse>({
    queryKey: ['/api/store/products/grouped', debouncedSku, '', clientPriceList, 'sku-modal'],
    queryFn: async () => {
      if (!debouncedSku) return { catalog: [], totalProducts: 0 };
      const params = new URLSearchParams();
      params.append('search', debouncedSku);
      if (clientPriceList) params.append('priceList', clientPriceList);
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const response = await fetch(`/api/store/products/grouped?${params.toString()}`);
      if (!response.ok) throw new Error('Error al buscar');
      return response.json();
    },
    enabled: debouncedSku.length >= 2,
    staleTime: 15_000,
  });

  // Extract matching variants from the grouped results (exact SKU matches first)
  const matchedVariants = useMemo(() => {
    if (!searchResults?.catalog || !debouncedSku) return [];

    const searchUpper = debouncedSku.toUpperCase();
    const results: Array<{
      genericName: string;
      variant: StoreFormatVariant;
      imageUrl: string | null | undefined;
      isExactMatch: boolean;
    }> = [];

    searchResults.catalog.forEach(product => {
      Object.values(product.colors).flat().forEach((variant: StoreFormatVariant) => {
        const skuUpper = (variant.sku || '').toUpperCase();
        const isExact = skuUpper === searchUpper;
        const isPartial = skuUpper.includes(searchUpper) || searchUpper.includes(skuUpper);

        if (isExact || isPartial) {
          // Apply offer price from offersMap (skip for client users — server already applied discount)
          const offerPrice = isClient ? (variant.offerPrice || null) : (offersMap.get(skuUpper) || variant.offerPrice || null);

          results.push({
            genericName: product.genericName,
            variant: { ...variant, offerPrice },
            imageUrl: product.imageUrl,
            isExactMatch: isExact,
          });
        }
      });
    });

    // Sort: exact matches first, then partial
    return results.sort((a, b) => {
      if (a.isExactMatch && !b.isExactMatch) return -1;
      if (!a.isExactMatch && b.isExactMatch) return 1;
      return 0;
    }).slice(0, 10); // Limit to 10 results
  }, [searchResults, debouncedSku, offersMap]);

  // ── Código oculto / personalizado ────────────────────────────────────────
  // Si la vitrina no tiene una coincidencia EXACTA, intentamos resolver el SKU
  // como código personalizado de la lista del cliente: no aparece en el catálogo
  // pero el cliente lo puede insertar a mano. Solo para clientes autenticados.
  const hasExactCatalogMatch = matchedVariants.some(m => m.isExactMatch);
  const { data: hiddenResult, isFetching: hiddenFetching } = useQuery<any>({
    queryKey: ['/api/store/products/sku-lookup', debouncedSku, selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('sku', debouncedSku);
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const r = await fetch(`/api/store/products/sku-lookup?${params.toString()}`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: isClient && debouncedSku.length >= 3 && !isLoading && !hasExactCatalogMatch,
    staleTime: 15_000,
    retry: false,
  });

  // El resultado oculto se mapea a la MISMA forma que una variante del catálogo,
  // así el render y handleAddVariant lo manejan sin lógica especial.
  const hiddenVariant = useMemo(() => {
    if (!hiddenResult?.sku) return null;
    const skuUpper = String(hiddenResult.sku).toUpperCase();
    // No duplicar si el SKU ya vino en las coincidencias del catálogo.
    if (matchedVariants.some(m => (m.variant.sku || '').toUpperCase() === skuUpper)) return null;
    return {
      genericName: hiddenResult.productName || hiddenResult.sku,
      variant: {
        sku: hiddenResult.sku,
        format: hiddenResult.format,
        color: hiddenResult.color,
        price: hiddenResult.price,
        offerPrice: hiddenResult.offerPrice ?? null,
        originalPrice: hiddenResult.originalPrice,
        minUnit: hiddenResult.minUnit ?? 1,
        stepSize: hiddenResult.stepSize ?? 1,
        imageUrl: hiddenResult.imageUrl ?? null,
      } as any,
      imageUrl: hiddenResult.imageUrl ?? null,
      isExactMatch: true,
      isHidden: true,
    };
  }, [hiddenResult, matchedVariants]);

  // Lista combinada que renderiza el modal (oculto primero, luego catálogo).
  const displayVariants = useMemo(
    () => (hiddenVariant ? [hiddenVariant, ...matchedVariants] : matchedVariants),
    [hiddenVariant, matchedVariants]
  );

  // Add a variant to cart from the SKU modal
  const handleAddVariant = (variant: StoreFormatVariant, genericName: string) => {
    const qty = skuQuantities[variant.sku] || variant.minUnit || 1;
    const basePrice = variant.price || 0;
    const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;

    if (effectivePrice === 0) {
      toast({
        title: "Error",
        description: "Producto sin precio disponible",
        variant: "destructive"
      });
      return;
    }

    const validation = validateCartQuantity(qty, variant.format);
    const validatedQuantity = validation.validQuantity;

    const isOfferItem = !!(variant.offerPrice && variant.offerPrice > 0 && basePrice > effectivePrice);
    try {
      addItem({
        productId: variant.sku,
        productCode: variant.sku,
        productName: genericName,
        selectedPackaging: variant.format,
        selectedColor: variant.color,
        unit: variant.format,
        unitPrice: effectivePrice,
        originalPrice: isOfferItem
          ? basePrice
          : (variant.originalPrice && variant.originalPrice > effectivePrice ? variant.originalPrice : undefined),
        isOffer: isOfferItem,
        convenioPct: !isOfferItem && branchDiscountPct > 0 ? branchDiscountPct : undefined,
        quantity: validatedQuantity,
        minQuantity: validation.minQuantity,
        quantityStep: validation.stepQuantity,
        imageUrl: variant.imageUrl || undefined,
      });

      // Track in session added items
      setAddedItems(prev => [...prev, {
        sku: variant.sku,
        name: genericName,
        color: variant.color,
        format: variant.format,
        qty: validatedQuantity,
        price: effectivePrice * validatedQuantity,
      }]);

      toast({
        title: "✓ Agregado al carrito",
        description: `${validatedQuantity}x ${genericName} (${variant.color}, ${variant.format})`,
      });

      // Reset only quantities after adding — keep search for continued browsing
      setSkuQuantities({});
      setTimeout(() => inputRef.current?.focus(), 50);

    } catch {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto",
        variant: "destructive"
      });
    }
  };

  // Session total
  const sessionTotal = addedItems.reduce((sum, item) => sum + item.price, 0);

  // Upload an Orden de Compra PDF, parse SKUs + header data, push matched items
  // to the cart and persist the OC URL so checkout auto-attaches it.
  const handleOcUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'El PDF no puede superar 10 MB.', variant: 'destructive' });
      return;
    }
    if (file.type && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'Formato no soportado', description: 'Adjunta un PDF de la Orden de Compra.', variant: 'destructive' });
      return;
    }

    setIsParsingOc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/oc/upload-and-parse', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'No se pudo procesar la OC');
      }
      const data = await res.json();

      // 1) Persist the OC so BillingSummary auto-attaches it at checkout.
      setAttachedOc({
        url: data.url,
        fileName: data.fileName || file.name,
        attachedAt: new Date().toISOString(),
        source: 'sku-modal',
        metadata: data.metadata || null,
      }, user?.id);

      // 2) Add matched items to cart (skipping items already added in this session).
      const alreadyAdded = new Set(addedItems.map(it => it.sku));
      const newlyAdded: Array<{ sku: string; name: string; color: string; format: string; qty: number; price: number }> = [];
      for (const m of (data.matched || []) as Array<any>) {
        if (alreadyAdded.has(m.sku)) continue;
        const basePrice = Number(m.price) || 0;
        // Apply offers using the same logic as manual SKU adds.
        const offerPrice = isClient
          ? 0 // for client users the server already applied discount; offersMap is not used here
          : (offersMap.get(String(m.sku).toUpperCase()) || 0);
        const effectivePrice = offerPrice > 0 && offerPrice < basePrice ? offerPrice : basePrice;
        if (effectivePrice <= 0) continue;

        const validation = validateCartQuantity(m.validQuantity, m.format);
        const validatedQuantity = validation.validQuantity;
        const isOfferItem = offerPrice > 0 && offerPrice < basePrice;

        try {
          addItem({
            productId: m.sku,
            productCode: m.sku,
            productName: m.genericName || m.productName,
            selectedPackaging: m.format,
            selectedColor: m.color,
            unit: m.format,
            unitPrice: effectivePrice,
            originalPrice: isOfferItem ? basePrice : undefined,
            isOffer: isOfferItem,
            convenioPct: !isOfferItem && branchDiscountPct > 0 ? branchDiscountPct : undefined,
            quantity: validatedQuantity,
            minQuantity: validation.minQuantity,
            quantityStep: validation.stepQuantity,
            imageUrl: m.imageUrl || undefined,
          });

          newlyAdded.push({
            sku: m.sku,
            name: m.genericName || m.productName,
            color: m.color,
            format: m.format,
            qty: validatedQuantity,
            price: effectivePrice * validatedQuantity,
          });
        } catch {
          // Skip individual failures; surface aggregate result below.
        }
      }
      if (newlyAdded.length > 0) {
        setAddedItems(prev => [...prev, ...newlyAdded]);
      }

      const unmatched = (data.unmatched || []) as Array<{ sku: string; quantity: number; rawLine?: string }>;
      setOcResult({
        fileName: data.fileName || file.name,
        metadata: data.metadata || null,
        matchedCount: newlyAdded.length,
        unmatched,
        parseError: data.parseError || null,
      });

      const skipped = (data.matched?.length || 0) - newlyAdded.length;
      const lines: string[] = [];
      if (newlyAdded.length > 0) lines.push(`${newlyAdded.length} producto${newlyAdded.length !== 1 ? 's' : ''} agregado${newlyAdded.length !== 1 ? 's' : ''}`);
      if (skipped > 0) lines.push(`${skipped} ya estaba${skipped !== 1 ? 'n' : ''} en el carrito`);
      if (unmatched.length > 0) lines.push(`${unmatched.length} sin coincidencia`);

      toast({
        title: data.parseError ? 'OC adjuntada (sin lectura)' : '✓ OC procesada',
        description: data.parseError
          ? 'Se adjuntó al pedido. Te llevamos al checkout para que revises y confirmes.'
          : (lines.join(' · ') ? `${lines.join(' · ')} · Vamos al checkout` : 'OC adjuntada al pedido.'),
      });

      // Auto-navigate to the cart/checkout when the OC produced at least one item
      // (or even when parsing failed but the PDF is attached — the user still wants
      // to confirm the order). Stay in the modal only when nothing useful happened,
      // so the user can search manually using the unmatched SKU chips as a hint.
      const shouldGoToCheckout = newlyAdded.length > 0 || skipped > 0 || data.parseError;
      if (shouldGoToCheckout) {
        onClose();
        setTimeout(() => setLocation('/carrito'), 50);
      }
    } catch (err: any) {
      toast({
        title: 'Error al procesar OC',
        description: err.message || 'Intenta nuevamente o adjúntala en el checkout.',
        variant: 'destructive',
      });
    } finally {
      setIsParsingOc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 mt-[5vh] md:mt-[10vh] max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6E23] to-[#E55E13] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Pedido Rápido por SKU</h2>
              <p className="text-white/70 text-xs">Busca un código SKU para agregar productos directamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            {skuSearch !== debouncedSku && debouncedSku ? (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={skuSearch}
              onChange={e => setSkuSearch(e.target.value.toUpperCase())}
              placeholder="Ingresa un código SKU (ej: EP-001-BL-GL)"
              className="w-full pl-12 pr-24 py-3.5 text-base font-mono rounded-xl border-2 border-gray-200 focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 bg-gray-50 hover:bg-white transition-all outline-none placeholder:text-gray-400 placeholder:font-sans"
              data-testid="input-sku-search"
              autoComplete="off"
              spellCheck={false}
            />
            {skuSearch && (
              <button
                onClick={() => { setSkuSearch(''); setSkuQuantities({}); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-[11px] font-semibold"
                title="Limpiar búsqueda"
              >
                <X className="h-3 w-3" />
                Limpiar
              </button>
            )}
          </div>
          {debouncedSku && displayVariants.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 pl-1">
              {displayVariants.length} resultado{displayVariants.length !== 1 ? 's' : ''} encontrado{displayVariants.length !== 1 ? 's' : ''}
              {displayVariants.some(m => m.isExactMatch) && (
                <span className="text-emerald-600 font-semibold ml-1">• Coincidencia exacta</span>
              )}
            </p>
          )}

          {/* Orden de Compra upload — auto-adds matched SKUs and attaches the PDF to checkout */}
          <div className="mt-3">
            <input
              ref={ocFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={isParsingOc}
              data-testid="input-oc-upload"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await handleOcUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => ocFileInputRef.current?.click()}
              disabled={isParsingOc}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed transition-all text-sm font-semibold ${
                isParsingOc
                  ? 'border-blue-300 bg-blue-50 text-blue-600 cursor-wait'
                  : ocResult
                  ? 'border-emerald-300 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50'
                  : 'border-orange-200 bg-orange-50/60 text-[#FF6E23] hover:bg-orange-50 hover:border-orange-300'
              }`}
            >
              {isParsingOc ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Leyendo Orden de Compra...
                </>
              ) : ocResult ? (
                <>
                  <FileCheck2 className="h-4 w-4" />
                  Reemplazar OC adjuntada
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" />
                  Subir Orden de Compra (PDF)
                </>
              )}
            </button>
            {!ocResult && !isParsingOc && (
              <p className="text-[10px] text-gray-400 mt-1.5 pl-1 leading-snug">
                Detectamos automáticamente SKUs, cantidades y datos del cliente. La OC queda adjunta al checkout.
              </p>
            )}
          </div>

          {/* OC processed summary */}
          {ocResult && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-emerald-800 truncate">{ocResult.fileName}</p>
                    {ocResult.metadata?.ocNumber && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        OC {ocResult.metadata.ocNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700/90 mt-0.5">
                    {ocResult.parseError
                      ? 'PDF adjunto al pedido. No pudimos leer los SKUs automáticamente.'
                      : `${ocResult.matchedCount} producto${ocResult.matchedCount !== 1 ? 's' : ''} agregado${ocResult.matchedCount !== 1 ? 's' : ''} al carrito${ocResult.unmatched.length > 0 ? ` · ${ocResult.unmatched.length} sin coincidencia` : ''}`}
                  </p>
                  {ocResult.metadata && (ocResult.metadata.razonSocial || ocResult.metadata.rut || ocResult.metadata.fecha) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {ocResult.metadata.razonSocial && (
                        <span className="text-[10px] bg-white border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[180px]">
                          {ocResult.metadata.razonSocial}
                        </span>
                      )}
                      {ocResult.metadata.rut && (
                        <span className="text-[10px] bg-white border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded font-mono">
                          {ocResult.metadata.rut}
                        </span>
                      )}
                      {ocResult.metadata.fecha && (
                        <span className="text-[10px] bg-white border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">
                          {ocResult.metadata.fecha}
                        </span>
                      )}
                    </div>
                  )}
                  {ocResult.unmatched.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-emerald-200/70">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        SKUs no encontrados
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {ocResult.unmatched.slice(0, 8).map(u => (
                          <span
                            key={u.sku}
                            title={u.rawLine || u.sku}
                            className="text-[10px] font-mono bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded"
                          >
                            {u.sku}{u.quantity > 1 ? ` ×${u.quantity}` : ''}
                          </span>
                        ))}
                        {ocResult.unmatched.length > 8 && (
                          <span className="text-[10px] text-amber-600 font-semibold">
                            +{ocResult.unmatched.length - 8} más
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-700/80 mt-1">
                        Buscalos en el catálogo o agrégalos manualmente.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results / Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Empty state */}
          {!debouncedSku && addedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
                <Barcode className="h-8 w-8 text-[#FF6E23]/50" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Busca por código SKU</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Digita el código del producto que necesitas para agregarlo directamente al carrito sin navegar el catálogo.
              </p>
              <div className="flex items-center gap-2 mt-5 text-xs text-gray-400">
                <span className="bg-gray-100 px-2.5 py-1 rounded-lg font-mono font-bold">SKU</span>
                <ArrowRight className="h-3 w-3" />
                <span className="bg-gray-100 px-2.5 py-1 rounded-lg">Cantidad</span>
                <ArrowRight className="h-3 w-3" />
                <span className="bg-orange-100 text-[#FF6E23] px-2.5 py-1 rounded-lg font-bold">Agregar</span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && debouncedSku && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF6E23] mr-2" />
              <span className="text-sm text-gray-500">Buscando SKU...</span>
            </div>
          )}

          {/* No results */}
          {!isLoading && !hiddenFetching && debouncedSku && debouncedSku.length >= 2 && displayVariants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <h3 className="text-sm font-bold text-gray-700 mb-1">Sin resultados para "{debouncedSku}"</h3>
              <p className="text-xs text-gray-500">
                Verifica el código SKU e intenta nuevamente.
              </p>
            </div>
          )}

          {/* Search Results */}
          {!isLoading && displayVariants.length > 0 && (
            <div className="px-5 py-3 space-y-2.5">
              {displayVariants.map(({ genericName, variant, imageUrl, isExactMatch, isHidden }: any) => {
                const qty = skuQuantities[variant.sku] || 0;
                const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : (variant.price || 0);
                const hasOffer = variant.offerPrice && variant.offerPrice > 0 && variant.price && variant.price > variant.offerPrice;
                const rules = getFormatQuantityRules(variant.format);

                return (
                  <div
                    key={variant.sku}
                    className={`rounded-xl border-2 p-3.5 transition-all ${
                      isExactMatch
                        ? 'border-[#FF6E23]/40 bg-orange-50/30 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {(variant.imageUrl || imageUrl) ? (
                          <img
                            src={variant.imageUrl || imageUrl || ''}
                            alt={genericName}
                            className="w-full h-full object-contain p-1"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-200" />
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 leading-tight truncate">
                              {genericName}
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isExactMatch ? 'bg-[#FF6E23]/10 text-[#FF6E23]' : 'bg-gray-100 text-gray-600'}`}>
                                {variant.sku}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {variant.format}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                {variant.color}
                              </span>
                              {isHidden && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="Código personalizado de tu lista — no aparece en el catálogo">
                                  Personalizado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-right flex-shrink-0">
                            {hasOffer ? (
                              <>
                                <span className="text-[10px] line-through text-gray-400 block">{formatPrice(variant.price)}</span>
                                <span className="text-sm font-black text-rose-600">{formatPrice(variant.offerPrice)}</span>
                              </>
                            ) : effectivePrice > 0 ? (
                              <span className="text-sm font-black text-[#FF6E23]">{formatPrice(effectivePrice)}</span>
                            ) : (
                              <span className="text-xs text-gray-400">Consultar</span>
                            )}
                          </div>
                        </div>

                        {/* Quantity + Add Row */}
                        <div className="flex items-center justify-between mt-2.5 gap-2">
                          {/* Packaging rule hint */}
                          <span className="text-[9px] text-gray-400 font-medium">
                            {rules.minQuantity > 1 ? `Mín: ${rules.minQuantity} · Saltos de ${rules.stepQuantity}` : 'Mín: 1 unidad'}
                          </span>

                          <div className="flex items-center gap-2">
                            {/* Subtotal preview */}
                            {qty > 0 && effectivePrice > 0 && (
                              <span className="text-xs font-bold text-gray-500">
                                {formatPrice(effectivePrice * qty)}
                              </span>
                            )}

                            {/* Quantity controls */}
                            <div className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm h-8">
                              <button
                                onClick={() => setSkuQuantities(prev => ({ ...prev, [variant.sku]: Math.max(0, (prev[variant.sku] || 0) - (variant.stepSize || rules.stepQuantity)) }))}
                                className="w-8 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                                disabled={qty === 0}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                value={qty || ''}
                                placeholder="0"
                                onChange={e => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                  if (!isNaN(val)) setSkuQuantities(prev => ({ ...prev, [variant.sku]: Math.max(0, val) }));
                                }}
                                className="w-12 h-full text-center text-sm font-bold border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#FF6E23] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                min="0"
                                step={variant.stepSize || rules.stepQuantity}
                              />
                              <button
                                onClick={() => {
                                  const current = skuQuantities[variant.sku] || 0;
                                  const next = current === 0 ? (variant.minUnit || rules.minQuantity) : current + (variant.stepSize || rules.stepQuantity);
                                  setSkuQuantities(prev => ({ ...prev, [variant.sku]: next }));
                                }}
                                className="w-8 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Add button */}
                            <button
                              onClick={() => handleAddVariant(variant, genericName)}
                              disabled={qty === 0 || effectivePrice === 0}
                              className="h-8 px-3 rounded-lg bg-[#FF6E23] hover:bg-[#E55E13] text-white text-xs font-bold transition-all shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="hidden sm:inline">Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Session Added Items Summary */}
          {addedItems.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Productos Agregados ({addedItems.length})</span>
                <span className="text-xs font-bold text-gray-700">Subtotal: {formatPrice(sessionTotal)}</span>
              </div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar">
                {addedItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-800 truncate block">{item.name}</span>
                        <span className="text-[10px] text-gray-500">
                          {item.sku} · {item.color} · {item.format} · x{item.qty}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 flex-shrink-0 ml-2">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            Cerrar
          </button>
          {addedItems.length > 0 && (
            <button
              onClick={() => { setShowFloatingCart(true); onClose(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white text-sm font-bold transition-all shadow-lg shadow-orange-200/50"
            >
              <ShoppingCart className="h-4 w-4" />
              Ver Carrito ({addedItems.length} item{addedItems.length !== 1 ? 's' : ''})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TiendaPage() {
  const { user, logoutMutation } = useAuth();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showGroupedDetailDialog, setShowGroupedDetailDialog] = useState(false);
  const [groupedDetailProduct, setGroupedDetailProduct] = useState<{ product: StoreGenericProduct; variant: StoreFormatVariant } | null>(null);

  const isClient = user?.role === 'client';
  const { data: clientData } = useQuery<{ lcen?: string }>({
    queryKey: ['/api/clients/by-user', user?.id],
    enabled: !!user?.id && isClient,
  });

  // Fetch branches accessible to this client user
  const { data: branchesData } = useQuery<{ branches: StoreBranch[]; currentBranchId: string }>({
    queryKey: ['/api/store/my-branches'],
    enabled: isClient,
  });

  const availableBranches = branchesData?.branches || [];
  const defaultBranchId = branchesData?.currentBranchId || null;
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() => {
    return localStorage.getItem('cart_selected_branch_id');
  });

  // Set default branch on first load if none was persisted
  useEffect(() => {
    if (defaultBranchId && !selectedBranchId) {
      setSelectedBranchId(defaultBranchId);
    }
  }, [defaultBranchId]);

  // Persist selected branch so the cart page can default the shipping address to it
  // Also notify CartContext so it can swap to that branch's cart
  useEffect(() => {
    if (selectedBranchId) {
      localStorage.setItem('cart_selected_branch_id', selectedBranchId);
      window.dispatchEvent(
        new CustomEvent('panoramica:branch-changed', { detail: selectedBranchId })
      );
    }
  }, [selectedBranchId]);

  const activeBranch = availableBranches.find(b => b.id === selectedBranchId) || null;
  const clientPriceList = activeBranch?.priceList || clientData?.lcen || null;
  const showBranchSelector = isClient && availableBranches.length > 1;


  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  
  // Variant selection state
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [selectedVariantGroup, setSelectedVariantGroup] = useState<ProductGroup | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<StoreProduct | null>(null);
  
  // Grouped product accordion state
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedFormats, setExpandedFormats] = useState<Set<string>>(new Set());
  
  // Banner carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // Cart state management
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showFloatingCart, setShowFloatingCart] = useState(false);
  
  // FAQ modal state
  const [showFaqModal, setShowFaqModal] = useState(false);

  // SKU Quick Order modal state
  const [showSkuQuickOrder, setShowSkuQuickOrder] = useState(false);

  // Header height tracking for sticky filter bar
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounce search — 300ms delay for AJAX instant search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Product info modal state
  const [infoModal, setInfoModal] = useState<{ open: boolean; productName: string; loading: boolean; data: any | null }>({
    open: false, productName: '', loading: false, data: null
  });

  const openInfoModal = async (productName: string) => {
    setInfoModal({ open: true, productName, loading: true, data: null });
    try {
      const res = await fetch(`/api/public/product-content/${encodeURIComponent(productName)}`);
      const data = await res.json();
      setInfoModal(prev => ({ ...prev, loading: false, data }));
    } catch {
      setInfoModal(prev => ({ ...prev, loading: false, data: null }));
    }
  };
  const { toast } = useToast();
  const { addItem } = useCart();

  // Quantity management functions
  const getProductQuantity = (productId: string, unidad: string | undefined): number => {
    return quantities[productId] || getMinimumQuantity(unidad);
  };

  const updateQuantity = (productId: string, newQuantity: number, unidad: string | undefined) => {
    const validQuantity = validateQuantity(newQuantity, unidad);
    setQuantities(prev => ({
      ...prev,
      [productId]: validQuantity
    }));
  };

  const incrementQuantity = (productId: string, unidad: string | undefined) => {
    const currentQuantity = getProductQuantity(productId, unidad);
    const jump = getQuantityJumpRule(unidad);
    updateQuantity(productId, currentQuantity + jump, unidad);
  };

  const decrementQuantity = (productId: string, unidad: string | undefined) => {
    const currentQuantity = getProductQuantity(productId, unidad);
    const jump = getQuantityJumpRule(unidad);
    const newQuantity = Math.max(getMinimumQuantity(unidad), currentQuantity - jump);
    updateQuantity(productId, newQuantity, unidad);
  };

  const calculateTotalPrice = (basePrice: number | string | null | undefined, quantity: number): number => {
    if (!basePrice) return 0;
    const numPrice = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
    if (isNaN(numPrice)) return 0;
    return numPrice * quantity;
  };

  // Handle add to cart click - legacy individual product
  const handleAddToCartClick = (product: StoreProduct) => {
    // No variants in grouped view, add directly to cart
    addToCart(product);
  };

  // Add to cart functionality
  const addToCart = (product: StoreProduct) => {
    const productCode = getProductCode(product);
    const productName = getProductName(product);
    const unitPrice = getProductPrice(product);
    const unit = getProductUnit(product) || 'Unidad';
    const requestedQuantity = getProductQuantity(product.id, getProductUnit(product));
    
    // Validation
    if (unitPrice === 0) {
      toast({
        title: "Error",
        description: "Producto sin precio disponible",
        variant: "destructive"
      });
      return;
    }
    
    if (requestedQuantity === 0) {
      toast({
        title: "Error", 
        description: "Cantidad no válida",
        variant: "destructive"
      });
      return;
    }
    
    // CRITICAL FIX: Validate quantity according to packaging rules
    const validation = validateCartQuantity(requestedQuantity, unit);
    const validatedQuantity = validation.validQuantity;
    
    // Update local UI state to reflect the validated quantity
    if (validatedQuantity !== requestedQuantity) {
      setQuantities(prev => ({
        ...prev,
        [product.id]: validatedQuantity
      }));
    }
    
    // Use CartContext to add item with validated quantity
    try {
      addItem({
        productId: product.id,
        productCode,
        productName,
        productSlug: product.slug,
        unit,
        unitPrice,
        isOffer: false,
        convenioPct: branchDiscountPct > 0 ? branchDiscountPct : undefined,
        quantity: validatedQuantity, // Use validated quantity
        imageUrl: getProductImageUrl(product),
        category: getProductCategory(product),
        minQuantity: validation.minQuantity,
        quantityStep: validation.stepQuantity
      });
      
      // Show appropriate message based on validation
      const message = validatedQuantity !== requestedQuantity ? 
        `${productName} - Cantidad ajustada: ${validatedQuantity} (${validation.error || 'por reglas de empaque'})` :
        `${productName} - Cantidad: ${validatedQuantity}`;
      
      toast({
        title: "Producto agregado al carrito",
        description: message,
        action: <Check className="h-4 w-4" />
      });

      // 🛒 ABRIR AUTOMÁTICAMENTE EL CARRITO después de agregar producto
      setShowFloatingCart(true);
      
      // Reset quantity for this product to minimum valid quantity
      setQuantities(prev => ({
        ...prev,
        [product.id]: validation.minQuantity
      }));
      
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto al carrito",
        variant: "destructive"
      });
    }
  };

  // Fetch store configuration
  const { data: storeConfig } = useQuery<StoreConfig>({
    queryKey: ['/api/store/config'],
    retry: false,
    staleTime: 300_000, // 5 min
  });

  // Fetch topbar configuration (controls visibility and values)
  const { data: topbarConfig } = useQuery<{
    phone: { value: string; visible: boolean };
    email: { value: string; visible: boolean };
    address: { value: string; visible: boolean };
    faq: { visible: boolean };
    freeShipping: { threshold: number; visible: boolean };
    customText?: { value: string; visible: boolean };
  }>({
    queryKey: ['/api/ecommerce/topbar-config'],
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  // Fetch free shipping threshold (fallback — topbar config takes priority)
  const { data: freeShippingData } = useQuery<{ threshold: number }>({
    queryKey: ['/api/ecommerce/free-shipping-threshold'],
    retry: false,
    staleTime: 300_000, // 5 min
  });
  const freeShippingThreshold = topbarConfig?.freeShipping?.threshold ?? freeShippingData?.threshold ?? 250000;

  // Fetch store config
  const { data: config } = useQuery<any>({
    queryKey: ['/api/ecommerce/store-config'],
    retry: false,
    staleTime: 300_000,
  });

  // Fetch store banners
  const { data: storeBanners = [] } = useQuery<StoreBanner[]>({
    queryKey: ['/api/store/banners'],
    retry: false,
    staleTime: 300_000, // 5 min
  });

  // Split DB banners into hero and footer
  const heroDbBanners = storeBanners.filter(b => b.tipoVisualizacion === 'hero').sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((b: any) => ({ src: b.imagenDesktop, alt: b.titulo, mobileSrc: b.imagenMobile, linkUrl: b.linkUrl }));
  const footerBanners = storeBanners.filter(b => b.tipoVisualizacion === 'footer').sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((b: any) => ({ src: b.imagenDesktop, alt: b.titulo, mobileSrc: b.imagenMobile, linkUrl: b.linkUrl }));
  const adBanners = storeBanners.filter(b => b.tipoVisualizacion === 'ad').sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((b: any) => ({ src: b.imagenDesktop, alt: b.titulo, mobileSrc: b.imagenMobile, linkUrl: b.linkUrl }));

  // Use DB banners if available, otherwise fallback to hardcoded
  const banners = heroDbBanners.length > 0
    ? heroDbBanners
    : [
        { src: bannerCopper, alt: "Oferta del Mes - Esmalte Copper", mobileSrc: undefined, linkUrl: undefined },
        { src: bannerStain, alt: "Oferta del Mes - Stain Impregnante", mobileSrc: undefined, linkUrl: undefined },
        { src: bannerDespacho, alt: "Despacho Gratis - 3% OFF", mobileSrc: undefined, linkUrl: undefined }
      ];

  const carouselDelayMs = (config?.seoSettings?.carouselDelay || 5) * 1000;

  // Carousel auto-rotation effect
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % banners.length);
      }, carouselDelayMs);
      return () => clearInterval(interval);
    }
  }, [isHovered, banners.length, carouselDelayMs]);

  // Fetch grouped store products (same grouping logic as salesperson catalog, with prices)
  const { data: groupedData, isLoading: productsLoading } = useQuery<StoreCatalogResponse>({
    queryKey: ['/api/store/products/grouped', debouncedSearch, selectedCategory, clientPriceList, selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      if (clientPriceList) params.append('priceList', clientPriceList);
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      
      const url = `/api/store/products/grouped${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    retry: false,
    staleTime: 30_000, // Cache for 30s — server also caches
    placeholderData: (prev: any) => prev, // Keep previous data during transitions
  });

  // Fetch offers prices
  const { data: offersData } = useQuery<{ items: { codigo: string; precio: string; paused?: boolean }[] }>({
    queryKey: ['/api/price-list-offers'],
    queryFn: async () => {
      const res = await fetch('/api/price-list-offers?limit=10000');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 60_000,
  });

  const offersMap = useMemo(() => {
    const map = new Map<string, number>();
    if (offersData?.items) {
      offersData.items.forEach((item) => {
        if (item.codigo && !item.paused) {
          map.set(item.codigo.toUpperCase(), Number(item.precio));
        }
      });
    }
    return map;
  }, [offersData]);

  // Merge offer prices into grouped data
  // NOTE: For client users, the backend already applies branch discount to both price & offerPrice.
  // The offersMap from /api/price-list-offers has RAW (undiscounted) prices, so we must NOT
  // override the server-side discounted prices for clients.
  const groupedDataWithOffers = useMemo(() => {
    if (!groupedData?.catalog) return groupedData;

    // Skip offersMap merge for client users — trust server-side pricing
    if (isClient) return groupedData;

    const updatedCatalog = groupedData.catalog.map((genericProduct) => {
      const updatedColors: { [color: string]: StoreFormatVariant[] } = {};
      Object.entries(genericProduct.colors).forEach(([color, variants]) => {
        updatedColors[color] = variants.map((variant) => {
          const offerPrice = offersMap.get(variant.sku?.toUpperCase() || '');
          return {
            ...variant,
            offerPrice: offerPrice || variant.offerPrice || null,
          };
        });
      });
      return {
        ...genericProduct,
        colors: updatedColors,
      };
    });
    return {
      ...groupedData,
      catalog: updatedCatalog,
    };
  }, [groupedData, offersMap, isClient]);

  const groupedCatalog: StoreGenericProduct[] = useMemo(() => {
    let catalog = groupedDataWithOffers?.catalog || [];
    // Client-side tag filter
    if (selectedTag) {
      catalog = catalog.filter(p => (p.tags || []).includes(selectedTag));
    }
    return catalog;
  }, [groupedDataWithOffers, selectedTag]);

  // Branch discount percentage from API (used to show original prices in UI)
  const branchDiscountPct = groupedDataWithOffers?.branchDiscountPercent || 0;

  // Fetch admin-defined active tags
  const { data: adminTags = [] } = useQuery<{ name: string; color: string }[]>({
    queryKey: ['/api/store/tags'],
    staleTime: 300_000,
  });

  // Derive available tags from the full catalog, filtered to only admin-defined tags
  const availableTags: { name: string; count: number; color: string }[] = useMemo(() => {
    const adminTagNames = new Set(adminTags.map((t: any) => t.name));
    const adminTagColors = new Map(adminTags.map((t: any) => [t.name, t.color]));
    const allProducts = groupedDataWithOffers?.catalog || [];
    const tagMap = new Map<string, number>();
    allProducts.forEach(p => {
      (p.tags || []).forEach(tag => {
        if (adminTagNames.has(tag)) { // Only count tags that exist in admin panel
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      });
    });
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count, color: adminTagColors.get(name) || 'gray' }))
      .sort((a, b) => b.count - a.count);
  }, [groupedDataWithOffers, adminTags]);

  // Fetch store categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/store/categories'],
    retry: false,
    staleTime: 300_000, // Categories rarely change — cache 5 min
  });

  // Get active hero banner

  // Toggle expand product / color
  const toggleProduct = (name: string) => {
    setExpandedProducts(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  };

  const toggleFormat = (productName: string, format: string) => {
    const key = `${productName}-${format}`;
    setExpandedFormats(prev => {
      const s = new Set(prev);
      
      // Ensure only one format active per product at a time
      Array.from(s).forEach(k => {
        if (k.startsWith(`${productName}-`)) s.delete(k);
      });
      
      if (!s.has(key)) {
        s.add(key);
        s.add(`selected-${productName}`);
      }
      return s;
    });
  };

  // Add grouped variants in bulk to cart
  const addBulkVariantsToCart = (variants: StoreFormatVariant[], productName: string) => {
    let addedCount = 0;
    const variantsToAdd = variants.filter(v => (quantities[v.sku] || 0) > 0);
    
    if (variantsToAdd.length === 0) {
      toast({
        title: "Seleccione cantidad",
        description: "Debe ingresar una cantidad mayor a 0 para al menos un color",
        variant: "destructive"
      });
      return;
    }

    variantsToAdd.forEach(variant => {
      const qty = quantities[variant.sku] || 0;
      const basePrice = variant.price || 0;
      const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;
      
      if (effectivePrice === 0) return;

      const validation = validateCartQuantity(qty, variant.format);
      const validatedQuantity = validation.validQuantity;

      const isOfferItem = !!(variant.offerPrice && variant.offerPrice > 0 && basePrice > effectivePrice);
      try {
        addItem({
          productId: variant.sku,
          productCode: variant.sku,
          productName: productName,
          selectedPackaging: variant.format,
          selectedColor: variant.color,
          unit: variant.format,
          unitPrice: effectivePrice,
          originalPrice: isOfferItem
            ? basePrice
            : (variant.originalPrice && variant.originalPrice > effectivePrice ? variant.originalPrice : undefined),
          isOffer: isOfferItem,
          convenioPct: !isOfferItem && branchDiscountPct > 0 ? branchDiscountPct : undefined,
          quantity: validatedQuantity,
          minQuantity: validation.minQuantity,
          quantityStep: validation.stepQuantity,
          imageUrl: variant.imageUrl || undefined,
        });

        addedCount += validatedQuantity;
      } catch (err) {
        console.error("Error adding to cart", err);
      }
    });

    if (addedCount > 0) {
      setShowFloatingCart(true);
      
      // Reset quantities for added variants
      setQuantities(prev => {
        const next = { ...prev };
        variantsToAdd.forEach(v => {
           next[v.sku] = 0;
        });
        return next;
      });
    }
  };

  // Add grouped variant to cart
  /**
   * Agrega un PALLET COMPLETO al carrito (Opción B).
   *
   * Política comercial:
   *   - quantity = packaging.amountPerPallet (ej 144 galones)
   *   - unitPrice = listPrice × (1 − palletDiscountPct/100) ← ya pre-rebajado
   *   - originalPrice = listPrice (para mostrar tachado)
   *   - El descuento por pallet REEMPLAZA cualquier oferta activa (no se suman).
   *   - convenioPct NO se aplica (el pallet es su propio régimen comercial).
   *   - Stock: NO bloqueamos — siempre se muestra (decisión de producto, ver memoria).
   */
  const addPalletToCart = (variant: StoreFormatVariant, productName: string) => {
    const pkg = variant.packaging;
    const units = pkg?.amountPerPallet || 0;
    if (!pkg?.palletEnabled || units < 1) {
      toast({
        title: "Pallet no disponible",
        description: "Este producto no tiene venta por pallet habilitada",
        variant: "destructive",
      });
      return;
    }
    // Precio de lista: usamos `originalPrice` (precio sin convenio) si existe, sino `price`.
    // Razón: el pallet REEMPLAZA descuentos, así que partimos del precio sin convenio.
    const listPrice = (variant.originalPrice && variant.originalPrice > 0)
      ? variant.originalPrice
      : (variant.price || 0);
    if (listPrice === 0) {
      toast({
        title: "Error",
        description: "Producto sin precio disponible",
        variant: "destructive",
      });
      return;
    }
    // Modo precio fijo gana sobre modo descuento si ambos vinieran de la DB.
    const hasFixedPrice = pkg.palletPrice != null && Number(pkg.palletPrice) > 0;
    let palletUnitPrice: number;
    let discountPct: number;
    if (hasFixedPrice) {
      const palletTotal = Math.round(Number(pkg.palletPrice));
      palletUnitPrice = Math.round(palletTotal / units);
      const listTotal = listPrice * units;
      // Derivamos el % implícito sólo para mostrarlo en el badge del carrito.
      discountPct = listTotal > 0 ? Math.max(0, Math.round((1 - palletTotal / listTotal) * 100)) : 0;
    } else {
      discountPct = Math.max(0, Math.min(100, Number(pkg.palletDiscountPct || 0)));
      palletUnitPrice = Math.round(listPrice * (1 - discountPct / 100));
    }

    try {
      addItem({
        productId: variant.sku,
        productCode: variant.sku,
        productName,
        selectedPackaging: variant.format,
        selectedColor: variant.color,
        unit: variant.format,
        unitPrice: palletUnitPrice,
        originalPrice: palletUnitPrice < listPrice ? listPrice : undefined, // tachado sólo si hay rebaja real
        isOffer: false,           // No es oferta — es modo pallet
        convenioPct: undefined,   // No se aplica convenio en modo pallet
        quantity: units,
        // Bypaseamos minQuantity/quantityStep estándar: el pallet ya define la cantidad.
        // Las reglas de empaque (GL=múltiplos de 4) se cumplen igual: 144/36/24 son válidos.
        minQuantity: 1,
        quantityStep: 1,
        imageUrl: variant.imageUrl || undefined,
        isPalletPurchase: true,
        palletDiscountPct: discountPct,
      });

      toast({
        title: "✓ Pallet agregado al carrito",
        description: `${units}× ${productName} (${variant.color}, ${variant.format})${discountPct > 0 ? ` — ${discountPct}% off` : ''}`,
        action: <Check className="h-4 w-4" />,
      });
      setShowFloatingCart(true);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo agregar el pallet al carrito",
        variant: "destructive",
      });
    }
  };

  const addGroupedVariantToCart = (variant: StoreFormatVariant, productName: string) => {
    const qty = quantities[variant.sku] || variant.minUnit || 1;
    const basePrice = variant.price || 0;
    const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;
    
    if (effectivePrice === 0) {
      toast({
        title: "Error",
        description: "Producto sin precio disponible",
        variant: "destructive"
      });
      return;
    }

    const validation = validateCartQuantity(qty, variant.format);
    const validatedQuantity = validation.validQuantity;

    if (validatedQuantity !== qty) {
      setQuantities(prev => ({ ...prev, [variant.sku]: validatedQuantity }));
    }

    const isOfferItem = !!(variant.offerPrice && variant.offerPrice > 0 && basePrice > effectivePrice);
    try {
      addItem({
        productId: variant.sku,
        productCode: variant.sku,
        productName: productName,
        selectedPackaging: variant.format,
        selectedColor: variant.color,
        unit: variant.format,
        unitPrice: effectivePrice,
        originalPrice: isOfferItem
          ? basePrice
          : (variant.originalPrice && variant.originalPrice > effectivePrice ? variant.originalPrice : undefined),
        isOffer: isOfferItem,
        convenioPct: !isOfferItem && branchDiscountPct > 0 ? branchDiscountPct : undefined,
        quantity: validatedQuantity,
        minQuantity: validation.minQuantity,
        quantityStep: validation.stepQuantity,
        imageUrl: variant.imageUrl || undefined,
      });

      toast({
        title: "Producto agregado al carrito",
        description: `${validatedQuantity}x ${productName} (${variant.color}, ${variant.format})`,
        action: <Check className="h-4 w-4" />
      });

      setShowFloatingCart(true);
      setQuantities(prev => ({ ...prev, [variant.sku]: validation.minQuantity }));
    } catch {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto al carrito",
        variant: "destructive"
      });
    }
  };

  const openProductDetail = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowProductDialog(true);
  };

  // Deep-link: /tienda?openProduct=slug → abrir modal del producto automáticamente
  useEffect(() => {
    const url = new URL(window.location.href);
    const slugParam = url.searchParams.get("openProduct");
    if (!slugParam || showProductDialog) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/products/by-slug/${encodeURIComponent(slugParam)}`);
        if (!res.ok) return;
        const p = await res.json();
        if (cancelled) return;
        // Construir un StoreProduct mínimo a partir de la respuesta
        const storeProduct: StoreProduct = {
          id: p.id,
          kopr: p.sku || "",
          name: p.descripcion || p.plProducto || "",
          category: p.categoria || undefined,
          ud02pr: p.formatUnit || undefined,
          precio: p.precioEcommerce ? Number(p.precioEcommerce) : undefined,
          primaryImageUrl: p.imagenUrl || undefined,
          description: p.descripcion || undefined,
          active: p.activo !== false,
          slug: p.slug || undefined,
          codigo: p.sku || undefined,
          producto: p.descripcion || p.plProducto || undefined,
          unidad: p.formatUnit || undefined,
          imagenUrl: p.imagenUrl || undefined,
          descripcion: p.descripcion || undefined,
          activo: p.activo !== false,
        };
        openProductDetail(storeProduct);
        // Limpiar el param sin recargar
        url.searchParams.delete("openProduct");
        window.history.replaceState({}, "", url.toString());
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigationItems = [
    { name: "Contacto", href: "#contacto" },
  ];

  // Login Gate state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({ empresa: '', rut: '', contacto: '', email: '', telefono: '', ciudad: '' });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Login Gate — determine if we need the auth overlay
  const isGuest = !user;

  // Lock scroll when guest overlay is active and not showing register form
  useEffect(() => {
    if (isGuest) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isGuest]);

  return (
    <>
    {/* ═══════════════════════════════════════════════════════════════════════
        GUEST OVERLAY — Blurred store with login/register modal
        ═══════════════════════════════════════════════════════════════════════ */}
    {isGuest && (
      <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
        {/* Dark overlay with blur backing */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

        {/* Centered Modal */}
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="relative bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] border border-white/50 w-full max-w-md animate-in zoom-in-95 fade-in duration-500"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Top accent bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FF6E23] via-[#FF8F50] to-[#FF6E23] rounded-t-[2rem]" />

            <div className="px-8 pt-10 pb-8 sm:px-10">
              {/* Logo & Title */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-[#FF6E23] to-[#E55E13] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 ring-4 ring-orange-100">
                  <LockKeyhole className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight uppercase mb-2">
                  Acceso Exclusivo
                </h2>
                <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-xs mx-auto">
                  Para ver precios, catálogo completo y realizar pedidos necesitas una cuenta autorizada.
                </p>
              </div>

              {!showRegisterForm ? (
                /* ── Default view: Two action buttons ── */
                <div className="space-y-4">
                  {/* Login Button */}
                  <a
                    href="/login"
                    className="w-full flex items-center justify-center gap-3 bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] text-sm uppercase tracking-widest"
                  >
                    <User className="h-5 w-5" />
                    Iniciar Sesión
                  </a>

                  {/* Divider */}
                  <div className="relative flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">o</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Request Access Button */}
                  <button
                    onClick={() => setShowRegisterForm(true)}
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-xl transition-all border-2 border-gray-200 hover:border-[#FF6E23]/40 hover:text-[#FF6E23] text-sm uppercase tracking-widest"
                  >
                    <UserPlus className="h-5 w-5" />
                    Solicitar Acceso
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-6 pt-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                      <Tag className="h-3.5 w-3.5 text-[#FF6E23]/60" />
                      Precios B2B
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                      <Truck className="h-3.5 w-3.5 text-[#FF6E23]/60" />
                      Despacho
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold">
                      <Box className="h-3.5 w-3.5 text-[#FF6E23]/60" />
                      Stock Real
                    </div>
                  </div>
                </div>
              ) : !registerSuccess ? (
                /* ── Registration Form ── */
                <div>
                  <button
                    onClick={() => setShowRegisterForm(false)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#FF6E23] transition-colors mb-6"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Volver
                  </button>
                  <h3 className="text-lg font-black text-gray-900 mb-1 uppercase tracking-tight">Solicitar Cuenta</h3>
                  <p className="text-xs text-gray-500 mb-6 font-medium">Completa el formulario y te contactaremos para crear tus credenciales.</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">Empresa *</label>
                        <input type="text" value={registerForm.empresa} onChange={e => setRegisterForm(p => ({ ...p, empresa: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="Constructora ABC" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">RUT *</label>
                        <input type="text" value={registerForm.rut} onChange={e => setRegisterForm(p => ({ ...p, rut: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="76.123.456-7" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">Nombre *</label>
                        <input type="text" value={registerForm.contacto} onChange={e => setRegisterForm(p => ({ ...p, contacto: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="Juan Pérez" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">Teléfono *</label>
                        <input type="tel" value={registerForm.telefono} onChange={e => setRegisterForm(p => ({ ...p, telefono: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="+56 9 1234 5678" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">Correo *</label>
                      <input type="email" value={registerForm.email} onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="contacto@empresa.cl" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 mb-1 block uppercase tracking-wide">Ciudad</label>
                      <input type="text" value={registerForm.ciudad} onChange={e => setRegisterForm(p => ({ ...p, ciudad: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6E23] focus:bg-white transition-all text-sm" placeholder="Santiago" />
                    </div>
                    <button
                      onClick={async () => {
                        if (!registerForm.empresa || !registerForm.rut || !registerForm.contacto || !registerForm.email || !registerForm.telefono) {
                          toast({ title: 'Error', description: 'Por favor completa todos los campos requeridos (*).', variant: 'destructive' });
                          return;
                        }
                        setRegisterLoading(true);
                        try {
                          await fetch('/api/ecommerce/account-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registerForm) });
                          setRegisterSuccess(true);
                        } catch (err) {
                          console.error(err);
                          toast({ title: 'Error', description: 'Ocurrió un error al enviar la solicitud.', variant: 'destructive' });
                        } finally {
                          setRegisterLoading(false);
                        }
                      }}
                      disabled={registerLoading || !registerForm.empresa || !registerForm.rut || !registerForm.contacto || !registerForm.email || !registerForm.telefono}
                      className="w-full py-3.5 mt-1 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-black uppercase text-xs tracking-wide transition-all shadow-lg shadow-orange-500/25 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {registerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      {registerLoading ? 'ENVIANDO...' : 'SOLICITAR ACCESO'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Success State ── */
                <div className="py-4 text-center">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-50 flex items-center justify-center ring-8 ring-emerald-50/50">
                    <Check className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3 uppercase tracking-tight">¡Solicitud Enviada!</h3>
                  <p className="text-gray-500 text-sm mb-6 leading-relaxed font-medium">
                    Nuestro equipo comercial te contactará a la brevedad para configurar tu cuenta.
                  </p>
                  <button
                    onClick={() => { setRegisterSuccess(false); setShowRegisterForm(false); setRegisterForm({ empresa: '', rut: '', contacto: '', email: '', telefono: '', ciudad: '' }); }}
                    className="inline-flex items-center justify-center gap-2 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold px-6 py-3 rounded-xl transition-all border-2 border-gray-200 text-sm uppercase"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    <div className={`min-h-screen bg-[#f8f9fb] ${isGuest ? 'blur-[6px] grayscale-[30%] pointer-events-none select-none' : ''}`}>
      {/* Header — Modern SaaS */}
      <header ref={headerRef} className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top micro-strip */}
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between py-1.5 md:py-1 text-[10px] md:text-[11px] text-gray-400 border-b border-gray-100/80 gap-1.5 md:gap-0">
            {/* Left side info: Hidden on very small screens, visible on md Desktop */}
            <div className="hidden md:flex items-center gap-4">
              {(topbarConfig?.phone?.visible !== false) && (
                <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><Phone className="h-3 w-3" />{topbarConfig?.phone?.value || storeConfig?.phone || "+56 2 2345 6789"}</span>
              )}
              {(topbarConfig?.email?.visible !== false) && (
                <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><Mail className="h-3 w-3" />{topbarConfig?.email?.value || storeConfig?.email || "contacto@panoramica.cl"}</span>
              )}
              {(topbarConfig?.address?.visible !== false) && (
                <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><MapPin className="h-3 w-3" />{topbarConfig?.address?.value || storeConfig?.address || "Santiago, Chile"}</span>
              )}
            </div>
            {/* Right side info: Promotions, FAQ - Visible on mobile and centered */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 w-full md:w-auto">
              {(topbarConfig?.faq?.visible !== false) && (
                <>
                  <button
                    onClick={() => setShowFaqModal(true)}
                    className="flex items-center gap-1 hover:text-gray-600 transition-colors cursor-pointer font-medium"
                  >
                    <HelpCircle className="h-3 w-3" />
                    Preguntas Frecuentes
                  </button>
                  <span className="hidden md:inline text-gray-200">|</span>
                </>
              )}
              {(topbarConfig?.freeShipping?.visible !== false) && freeShippingThreshold > 0 && (
                <span className="text-[#FF6E23] font-semibold flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  Envío gratis sobre {freeShippingThreshold > 0 ? `$${freeShippingThreshold.toLocaleString('es-CL')}` : ''}
                </span>
              )}
              {(() => {
                const pct = Number(config?.checkoutSettings?.shippingDiscountPercentage) || 0;
                const min = Number(config?.checkoutSettings?.shippingDiscountMinAmount) || 0;
                if (pct <= 0) return null;
                return (
                  <span className="text-[#FF6E23] font-semibold flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    {min > 0
                      ? `${pct}% dcto. envío sobre $${min.toLocaleString('es-CL')}`
                      : `${pct}% dcto. envío`}
                  </span>
                );
              })()}
              {topbarConfig?.customText?.visible && topbarConfig.customText.value && (
                <span className="text-[#FF6E23] font-semibold flex items-center gap-1 text-center">
                  {topbarConfig.customText.value}
                </span>
              )}
            </div>
          </div>

          {/* Main header */}
          <div className="flex items-center justify-between py-2 md:py-3 gap-2 md:gap-4">
            {/* Logo */}
            <Link href="/tienda">
              <div className="flex items-center cursor-pointer flex-shrink-0 group">
                <img 
                  src={storeConfig?.logoUrl || "/panoramica-logo.png"} 
                  alt="Panorámica"
                  className="h-8 md:h-11 w-auto transition-transform group-hover:scale-[1.02]"
                />
              </div>
            </Link>

            {/* Search Bar — Desktop (with integrated SKU button) */}
            <div className="hidden md:flex flex-1 max-w-xl">
              <div className="relative w-full group flex">
                {searchTerm !== debouncedSearch ? (
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin z-10" />
                ) : (
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#FF6E23] transition-colors z-10" />
                )}
                <Input
                  placeholder="Buscar productos, familias..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value) {
                      setSelectedCategory('all');
                      setSelectedTag(null);
                    }
                  }}
                  className="pl-10 pr-10 h-10 text-sm rounded-l-xl rounded-r-none border-gray-200 border-r-0 focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 bg-gray-50/80 hover:bg-white transition-all shadow-sm"
                  data-testid="input-search-tienda"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-[120px] top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => setShowSkuQuickOrder(true)}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-r-xl bg-gradient-to-r from-[#FF6E23] to-[#E55E13] hover:from-[#E55E13] hover:to-[#D44E03] text-white text-xs font-bold transition-all shadow-sm whitespace-nowrap border border-[#FF6E23] flex-shrink-0"
                  data-testid="button-sku-quick-order"
                  title="Pedido Rápido por SKU"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Buscar por SKU</span>
                </button>
              </div>
            </div>

            {/* Mobile Search Bar — inline (with integrated SKU button) */}
            <div className="md:hidden flex-1 mx-1">
              <div className="relative w-full flex">
                {searchTerm !== debouncedSearch ? (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin z-10" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 z-10" />
                )}
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value) {
                      setSelectedCategory('all');
                      setSelectedTag(null);
                    }
                  }}
                  className="pl-8 pr-8 text-xs h-9 border-gray-200 rounded-l-lg rounded-r-none border-r-0 bg-gray-50/80 shadow-sm"
                  data-testid="input-search-mobile"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-[42px] top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors z-10"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowSkuQuickOrder(true)}
                  className="flex items-center justify-center w-10 h-9 rounded-r-lg bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white transition-all shadow-sm border border-[#FF6E23] flex-shrink-0"
                  data-testid="button-sku-quick-order-mobile"
                  title="Buscar por SKU"
                >
                  <Zap className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-1">
              {/* Branch Selector */}
              {showBranchSelector && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 border border-violet-200/60 hover:border-violet-300 transition-all duration-200 group"
                      data-testid="branch-selector"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-violet-600" />
                      <span className="hidden md:inline text-xs font-semibold text-violet-700 max-w-[120px] truncate">
                        {activeBranch?.branchLabel || activeBranch?.name || 'Sucursal'}
                      </span>
                      <ChevronsUpDown className="h-3 w-3 text-violet-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 rounded-xl shadow-xl border-gray-200/80 p-1">
                    <DropdownMenuLabel className="px-2">
                      <p className="text-xs font-medium text-gray-500">Seleccionar Sucursal</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableBranches.map(branch => (
                      <DropdownMenuItem
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className={`flex items-center gap-3 cursor-pointer rounded-lg px-2 py-2.5 ${
                          branch.id === selectedBranchId
                            ? 'bg-violet-50 border border-violet-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          branch.isRoot
                            ? 'bg-gradient-to-br from-violet-400 to-indigo-500 text-white'
                            : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white'
                        }`}>
                          {branch.isRoot ? <Building className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{branch.branchLabel || branch.name}</p>
                          {branch.address && (
                            <p className="text-[10px] text-muted-foreground truncate">{branch.address}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {branch.id === selectedBranchId && (
                            <Check className="h-4 w-4 text-violet-600" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* User Menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 px-1.5 md:px-2.5 py-1.5 hover:bg-gray-50 rounded-xl transition-all"
                      data-testid="button-user-menu"
                    >
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-[#FF6E23] to-[#E55E13] rounded-lg md:rounded-xl flex items-center justify-center shadow-sm shadow-orange-200">
                        <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-white" />
                      </div>
                      <span className="hidden lg:block text-sm font-semibold text-gray-700 max-w-[100px] truncate">
                        {user.firstName || user.email?.split('@')[0]}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-gray-200/80 p-1">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1 px-1">
                        <p className="text-sm font-semibold">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.firstName || user.email}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/mis-pedidos" className="flex items-center cursor-pointer rounded-lg px-2 py-1.5">
                        <Package className="mr-2 h-4 w-4 text-gray-400" />
                        <span>Mis Pedidos</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/mi-cuenta" className="flex items-center cursor-pointer rounded-lg px-2 py-1.5">
                        <LayoutDashboard className="mr-2 h-4 w-4 text-gray-400" />
                        <span>Mi Cuenta</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => logoutMutation.mutate()}
                      className="flex items-center cursor-pointer text-red-500 hover:text-red-600 rounded-lg px-2 py-1.5"
                      data-testid="button-logout"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Salir</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}



              {/* Custom color request */}
              <CustomColorButton variant="compact" />

              {/* Cart */}
              <CartToggle onClick={() => setShowFloatingCart(true)} />


            </div>
          </div>
        </div>


      </header>
      
      {/* Banner Carousel - Full Width (hidden when searching) */}
      {!searchTerm && (
      <section 
        className="w-screen relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="banner-carousel"
      >
        {/* Image container with transitions */}
        <div className="relative w-full group">
          {banners.map((banner, index) => (
            <div
              key={index}
              className={`w-full transition-opacity duration-500 ${
                index === currentSlide ? 'opacity-100 relative z-10' : 'opacity-0 absolute top-0 left-0 z-0'
              }`}
              data-testid={`banner-slide-${index}`}
            >
              {banner.linkUrl ? (
                <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <picture>
                    {banner.mobileSrc && <source media="(max-width: 768px)" srcSet={banner.mobileSrc} />}
                    <img
                      src={banner.src}
                      alt={banner.alt}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="w-full h-auto object-contain block"
                    />
                  </picture>
                </a>
              ) : (
                <picture>
                  {banner.mobileSrc && <source media="(max-width: 768px)" srcSet={banner.mobileSrc} />}
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                    className="w-full h-auto object-contain block"
                  />
                </picture>
              )}
            </div>
          ))}
          
          {/* Navigation Arrows */}
          <button 
            onClick={() => setCurrentSlide(prev => (prev === 0 ? banners.length - 1 : prev - 1))}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Anterior banner"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setCurrentSlide(prev => (prev + 1) % banners.length)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Siguiente banner"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        
      </section>
      )}

      {/* ─── Filter Bar: Unified Categories & Tags ─── */}
      <section className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky z-40" style={{ top: `${headerHeight}px` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2">
            {/* Catálogo label - now hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0 pr-3 border-r border-gray-200">
              <h2 className="text-sm font-bold text-gray-900" id="productos">Catálogo</h2>
              <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{groupedCatalog.length}</span>
            </div>

            {isMobile ? (
              <div className="flex flex-col gap-2 w-full">
                {/* Category toggle button - full width */}
                <div className="w-full relative">
                  <button
                    onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                    className={`h-9 w-full text-[11px] font-bold rounded-xl gap-1.5 flex items-center justify-between px-3 transition-all duration-300 ${
                      showCategoriesDropdown
                        ? 'bg-gradient-to-r from-[#FF6E23] to-[#E55E13] text-white shadow-lg shadow-orange-200/50 border border-[#FF6E23]'
                        : 'bg-white text-gray-700 border border-gray-200 shadow-sm hover:border-orange-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Grid3X3 className={`h-3.5 w-3.5 transition-colors ${showCategoriesDropdown ? 'text-white' : 'text-[#FF6E23]'}`} />
                      {selectedCategory === 'all' ? 'Categorías' : selectedCategory}
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${showCategoriesDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Animated panel */}
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: showCategoriesDropdown ? `${(categories.length + 1) * 44 + 40}px` : '0px',
                      opacity: showCategoriesDropdown ? 1 : 0,
                    }}
                  >
                    <div className="pt-2 pb-1">
                      <div className="bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-200/50 overflow-hidden">
                        {/* "Todas" option */}
                        <button
                          onClick={() => { setSelectedCategory('all'); setSelectedTag(null); setShowCategoriesDropdown(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                            selectedCategory === 'all' && !selectedTag
                              ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-[#FF6E23] border-l-[3px] border-l-[#FF6E23]'
                              : 'text-gray-600 hover:bg-gray-50 border-l-[3px] border-l-transparent'
                          }`}
                          style={{ animationDelay: '0ms' }}
                        >
                          <span>Todas las categorías</span>
                          {selectedCategory === 'all' && !selectedTag && <Check className="h-3.5 w-3.5 text-[#FF6E23]" />}
                        </button>

                        <div className="h-px bg-gray-100 mx-3" />

                        {/* Category items with stagger effect */}
                        {categories.map((category, index) => {
                          const isActive = selectedCategory === category && !selectedTag;
                          return (
                            <button
                              key={category}
                              onClick={() => { setSelectedCategory(category); setSelectedTag(null); setShowCategoriesDropdown(false); }}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                                isActive
                                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-[#FF6E23] border-l-[3px] border-l-[#FF6E23]'
                                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-l-transparent hover:border-l-gray-300'
                              }`}
                              style={{
                                transform: showCategoriesDropdown ? 'translateX(0)' : 'translateX(-12px)',
                                opacity: showCategoriesDropdown ? 1 : 0,
                                transition: `transform 300ms ease ${(index + 1) * 30}ms, opacity 300ms ease ${(index + 1) * 30}ms`,
                              }}
                            >
                              <span>{category}</span>
                              {isActive && <Check className="h-3.5 w-3.5 text-[#FF6E23]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {availableTags.length > 0 && (
                  <div className="grid gap-2 py-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(availableTags.length, 3)}, 1fr)` }}>
                    {availableTags.map(({ name, count, color: tagColor }) => {
                      const isActive = selectedTag === name;
                      const TAG_UI_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
                        green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-500 border-emerald-500', activeText: 'text-white' },
                        blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', activeBg: 'bg-blue-500 border-blue-500', activeText: 'text-white' },
                        amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', activeBg: 'bg-amber-500 border-amber-500', activeText: 'text-white' },
                        red: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', activeBg: 'bg-rose-500 border-rose-500', activeText: 'text-white' },
                        purple: { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', activeBg: 'bg-violet-500 border-violet-500', activeText: 'text-white' },
                        pink: { bg: 'bg-pink-50 border-pink-200', text: 'text-pink-700', activeBg: 'bg-pink-500 border-pink-500', activeText: 'text-white' },
                        cyan: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', activeBg: 'bg-cyan-500 border-cyan-500', activeText: 'text-white' },
                        orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', activeBg: 'bg-orange-500 border-orange-500', activeText: 'text-white' },
                        indigo: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', activeBg: 'bg-indigo-500 border-indigo-500', activeText: 'text-white' },
                        teal: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', activeBg: 'bg-teal-500 border-teal-500', activeText: 'text-white' },
                      };
                      const c = TAG_UI_COLORS[tagColor] || { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', activeBg: 'bg-gray-600 border-gray-600', activeText: 'text-white' };
                      
                      return (
                        <button
                          key={name}
                          onClick={() => {
                            if (isActive) {
                              setSelectedTag(null);
                            } else {
                              setSelectedTag(name);
                              setSelectedCategory('all');
                            }
                          }}
                          className={`px-2 py-1.5 rounded-full text-[9px] font-bold transition-all border flex items-center justify-center gap-1 whitespace-nowrap ${
                            isActive ? c.activeBg + ' ' + c.activeText : c.bg + ' ' + c.text
                          } hover:shadow-sm`}
                          data-testid={`filter-tag-mobile-${name}`}
                        >
                          <Tag className="h-2.5 w-2.5 flex-shrink-0" />
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <>
                  {/* "Todos" button */}
                  <button
                    onClick={() => { setSelectedCategory('all'); setSelectedTag(null); }}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border ${
                      selectedCategory === 'all' && !selectedTag
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                    data-testid="filter-cat-all"
                  >
                    Todos
                  </button>

                  {/* Categories */}
                  {categories.map((category) => {
                    const isActive = selectedCategory === category && !selectedTag;
                    return (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(isActive ? 'all' : category);
                          setSelectedTag(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border ${
                          isActive
                            ? 'bg-[#FF6E23] text-white border-[#FF6E23] shadow-sm'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200 hover:text-[#FF6E23] hover:bg-orange-50'
                        }`}
                        data-testid={`filter-cat-${category}`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </>

                {/* Divider if tags exist */}
                {availableTags.length > 0 && (
                  <div className="h-5 w-px bg-gray-200 mx-1" />
                )}

                {/* Tags - with admin-defined colors */}
                {availableTags.map(({ name, count, color: tagColor }) => {
                  const isActive = selectedTag === name;
                  const TAG_UI_COLORS: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
                    green: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-500 border-emerald-500', activeText: 'text-white' },
                    blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', activeBg: 'bg-blue-500 border-blue-500', activeText: 'text-white' },
                    amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', activeBg: 'bg-amber-500 border-amber-500', activeText: 'text-white' },
                    red: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', activeBg: 'bg-rose-500 border-rose-500', activeText: 'text-white' },
                    purple: { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', activeBg: 'bg-violet-500 border-violet-500', activeText: 'text-white' },
                    pink: { bg: 'bg-pink-50 border-pink-200', text: 'text-pink-700', activeBg: 'bg-pink-500 border-pink-500', activeText: 'text-white' },
                    cyan: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', activeBg: 'bg-cyan-500 border-cyan-500', activeText: 'text-white' },
                    orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', activeBg: 'bg-orange-500 border-orange-500', activeText: 'text-white' },
                    indigo: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', activeBg: 'bg-indigo-500 border-indigo-500', activeText: 'text-white' },
                    teal: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700', activeBg: 'bg-teal-500 border-teal-500', activeText: 'text-white' },
                  };
                  const c = TAG_UI_COLORS[tagColor] || TAG_UI_COLORS['gray'] || { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', activeBg: 'bg-gray-600 border-gray-600', activeText: 'text-white' };
                  
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        if (isActive) {
                          setSelectedTag(null);
                          setSelectedCategory('all');
                        } else {
                          setSelectedTag(name);
                          setSelectedCategory('all');
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                        isActive ? c.activeBg + ' ' + c.activeText : c.bg + ' ' + c.text
                      } hover:shadow-sm`}
                      data-testid={`filter-tag-${name}`}
                    >
                      <Tag className="h-3 w-3" />
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Products — Grouped Accordion View */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {productsLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500 mb-4">Cargando productos...</div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : groupedCatalog.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-gray-500 mb-4">
              Intenta cambiar los filtros de búsqueda o la categoría seleccionada.
            </p>
            <Button 
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {groupedCatalog.map((product, index) => {
              const colorKeys = Object.keys(product.colors)
                .sort((a, b) => product.colors[b].length - product.colors[a].length);
              const isExpanded = expandedProducts.has(product.genericName);
              const totalVariants = Object.values(product.colors).flat().length;
              
              const desktopFreq = config?.adSettings?.desktopFrequency || 6;
              const mobileFreq = config?.adSettings?.mobileFrequency || 4;
              const desktopHeight = config?.adSettings?.desktopHeight || 300;
              const mobileHeight = config?.adSettings?.mobileHeight || 150;
              
              // Calculate if we should show an ad banner after this item
              const isDesktopAdSlot = (index + 1) % desktopFreq === 0;
              const isMobileAdSlot = (index + 1) % mobileFreq === 0;
              
              let adBannerIdx = -1;
              if (isDesktopAdSlot || isMobileAdSlot) {
                 // pick banner sequentially without repeating
                 const slotIndex = Math.floor((index + 1) / (isDesktopAdSlot ? desktopFreq : mobileFreq)) - 1;
                 if (slotIndex >= 0 && slotIndex < adBanners.length) {
                   adBannerIdx = slotIndex;
                 }
              }
              const bannerToShow = adBannerIdx >= 0 ? adBanners[adBannerIdx] : null;

              return (
                <Fragment key={product.genericName}>
                <ProductCardExpandable
                  mode="store"
                  product={product}
                  adminTags={adminTags}
                  branchDiscountPct={branchDiscountPct}
                  onAddToCart={(variants, qtyMap) => {
                    const variantsToAdd = (variants as StoreFormatVariant[]).filter(v => (qtyMap[v.sku] || 0) > 0);
                    if (variantsToAdd.length === 0) {
                      toast({
                        title: "Seleccione cantidad",
                        description: "Debe ingresar una cantidad mayor a 0 para al menos un color",
                        variant: "destructive"
                      });
                      return;
                    }
                    let addedCount = 0;
                    variantsToAdd.forEach(variant => {
                      const qty = qtyMap[variant.sku] || 0;
                      const basePrice = variant.price || 0;
                      const effectivePrice = (variant.offerPrice && variant.offerPrice > 0) ? variant.offerPrice : basePrice;
                      if (effectivePrice === 0) return;
                      const validation = validateCartQuantity(qty, variant.format);
                      const validatedQuantity = validation.validQuantity;
                      const isOfferItem = !!(variant.offerPrice && variant.offerPrice > 0 && basePrice > effectivePrice);
                      try {
                        addItem({
                          productId: variant.sku,
                          productCode: variant.sku,
                          productName: product.genericName,
                          selectedPackaging: variant.format,
                          selectedColor: variant.color,
                          unit: variant.format,
                          unitPrice: effectivePrice,
                          originalPrice: isOfferItem
                            ? basePrice
                            : (variant.originalPrice && variant.originalPrice > effectivePrice ? variant.originalPrice : undefined),
                          isOffer: isOfferItem,
                          convenioPct: !isOfferItem && branchDiscountPct > 0 ? branchDiscountPct : undefined,
                          quantity: validatedQuantity,
                          minQuantity: validation.minQuantity,
                          quantityStep: validation.stepQuantity,
                          imageUrl: variant.imageUrl || undefined,
                        });
                        addedCount += validatedQuantity;
                      } catch (err) {
                        console.error("Error adding to cart", err);
                      }
                    });
                    if (addedCount > 0) setShowFloatingCart(true);
                  }}
                  onOpenInfoModal={openInfoModal}
                  onOpenDetail={(p, v) => {
                    setGroupedDetailProduct({ product: p as StoreGenericProduct, variant: v as StoreFormatVariant });
                    setShowGroupedDetailDialog(true);
                  }}
                />
                
                {/* Ad Banner injected between products */}
                {bannerToShow && (isDesktopAdSlot || isMobileAdSlot) && (
                  <div 
                    className={`col-span-full my-4 rounded-2xl overflow-hidden hover:shadow-lg transition-all ${isDesktopAdSlot && !isMobileAdSlot ? 'hidden lg:block' : ''} ${isMobileAdSlot && !isDesktopAdSlot ? 'block lg:hidden' : ''}`}
                    style={{ '--ad-mobile-height': `${mobileHeight}px`, '--ad-desktop-height': `${desktopHeight}px` } as React.CSSProperties}
                  >
                    {bannerToShow.linkUrl ? (
                      <a href={bannerToShow.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                        <picture>
                          {bannerToShow.mobileSrc && <source media="(max-width: 768px)" srcSet={bannerToShow.mobileSrc} />}
                          <img src={bannerToShow.src} alt={bannerToShow.alt || "Anuncio"} className="w-full object-cover h-[var(--ad-mobile-height)] lg:h-[var(--ad-desktop-height)]" />
                        </picture>
                      </a>
                    ) : (
                      <div className="w-full h-full">
                        <picture>
                          {bannerToShow.mobileSrc && <source media="(max-width: 768px)" srcSet={bannerToShow.mobileSrc} />}
                          <img src={bannerToShow.src} alt={bannerToShow.alt || "Anuncio"} className="w-full object-cover h-[var(--ad-mobile-height)] lg:h-[var(--ad-desktop-height)]" />
                        </picture>
                      </div>
                    )}
                  </div>
                )}
                </Fragment>
              );
            })}
          </div>
        )}
      </section>
      {/* Grouped Product Detail Dialog */}
      <Dialog open={showGroupedDetailDialog} onOpenChange={setShowGroupedDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {groupedDetailProduct && (() => {
            const { product: gp, variant: gv } = groupedDetailProduct;
            const firstVariant = Object.values(gp.colors).flat()[0];
            const desc = firstVariant?.description || gp.breveResena;
            const dims = firstVariant?.dimensions;
            const pkg = firstVariant?.packaging;
            
            return (
              <>
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle className="text-2xl font-black text-gray-900">
                    {gp.genericName}
                  </DialogTitle>
                  {gp.groupName && (
                    <Badge className="w-fit mt-1 bg-[#FF6E23]/10 text-[#FF6E23] border-[#FF6E23]/20 font-semibold text-xs">{gp.groupName}</Badge>
                  )}
                </DialogHeader>
                
                <div className="p-6 space-y-6">
                  {/* Image + Price Row */}
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-64 flex-shrink-0">
                      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 p-6 flex items-center justify-center">
                        {gp.imageUrl ? (
                          <img src={gp.imageUrl} alt={gp.genericName} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-16 h-16 text-gray-200" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      {/* Price */}
                      {gv.price && gv.price > 0 && (
                        <div className={`bg-gradient-to-r ${gv.offerPrice && gv.offerPrice > 0 ? 'from-rose-500/5 to-orange-50 border-rose-200/30' : gv.originalPrice && gv.originalPrice > gv.price ? 'from-emerald-500/5 to-emerald-50 border-emerald-200/30' : 'from-[#FF6E23]/5 to-orange-50 border-[#FF6E23]/10'} rounded-xl p-5 border`}>
                          {gv.offerPrice && gv.offerPrice > 0 ? (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Precio oferta</span>
                                <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0">
                                  -{Math.round(((gv.price - gv.offerPrice) / gv.price) * 100)}%
                                </Badge>
                              </div>
                              <div className="text-3xl font-black text-rose-600 mt-1">
                                {formatPrice(gv.offerPrice)}
                                <span className="text-sm font-normal text-gray-500 ml-2">/ {gv.format}</span>
                              </div>
                              <div className="text-sm text-gray-400 line-through mt-0.5">{formatPrice(gv.price)}</div>
                            </>
                          ) : gv.originalPrice && gv.originalPrice > gv.price ? (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Precio con convenio</span>
                                <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0" title="Descuento por convenio aplicado a la lista asignada">
                                  CONVENIO -{branchDiscountPct}%
                                </Badge>
                              </div>
                              <div className="text-3xl font-black text-emerald-600 mt-1">
                                {formatPrice(gv.price)}
                                <span className="text-sm font-normal text-gray-500 ml-2">/ {gv.format}</span>
                              </div>
                              <div className="text-sm text-gray-400 line-through mt-0.5">{formatPrice(gv.originalPrice)}</div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Precio referencial</span>
                              <div className="text-3xl font-black text-[#FF6E23] mt-1">
                                {formatPrice(gv.price)}
                                <span className="text-sm font-normal text-gray-500 ml-2">/ {gv.format}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* Quick Info */}
                      <div className="grid grid-cols-2 gap-3">
                        {gv.format && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase">Formato</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{gv.format}</p>
                          </div>
                        )}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">Colores</span>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">{Object.keys(gp.colors).length} disponible{Object.keys(gp.colors).length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">Código</span>
                          <p className="text-sm font-bold text-gray-800 mt-0.5 font-mono">{gv.sku}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">Marca</span>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">Pinturas Panorámica</p>
                        </div>
                      </div>
                      
                      {/* Tags */}
                      {gp.tags && gp.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {gp.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs bg-gray-100 text-gray-600">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Description */}
                  {desc && (
                    <div className="border-t border-gray-100 pt-5">
                      <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#FF6E23]" /> Descripción
                      </h4>
                      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
                    </div>
                  )}
                  
                  {/* Dimensions */}
                  {dims && (dims.weight || dims.length || dims.volume) && (
                    <div className="border-t border-gray-100 pt-5">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-[#FF6E23]" /> Dimensiones y Peso
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {dims.weight && (
                          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                            <span className="text-[10px] font-semibold text-blue-400 uppercase">Peso</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{dims.weight} {dims.weightUnit || 'kg'}</p>
                          </div>
                        )}
                        {dims.length && dims.width && dims.height && (
                          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                            <span className="text-[10px] font-semibold text-blue-400 uppercase">Medidas (L×A×H)</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{dims.length}×{dims.width}×{dims.height} {dims.lengthUnit || 'cm'}</p>
                          </div>
                        )}
                        {dims.volume && (
                          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                            <span className="text-[10px] font-semibold text-blue-400 uppercase">Volumen</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{dims.volume} {dims.volumeUnit || 'cm³'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Packaging */}
                  {pkg && (pkg.packageName || pkg.boxName || pkg.palletName) && (
                    <div className="border-t border-gray-100 pt-5">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#FF6E23]" /> Empaque y Embalaje
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {pkg.packageName && (
                          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                            <span className="text-[10px] font-semibold text-emerald-500 uppercase">{pkg.packageName}</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{pkg.amountPerPackage} {pkg.amountPerPackage === 1 ? 'unidad' : 'unidades'}</p>
                          </div>
                        )}
                        {pkg.boxName && (
                          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                            <span className="text-[10px] font-semibold text-emerald-500 uppercase">{pkg.boxName}</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{pkg.amountPerBox} unidades</p>
                          </div>
                        )}
                        {pkg.palletName && (
                          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                            <span className="text-[10px] font-semibold text-emerald-500 uppercase">{pkg.palletName}</span>
                            <p className="text-sm font-bold text-gray-800 mt-0.5">{pkg.amountPerPallet} unidades</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Venta por pallet — botón Opción B (qty = palletUnits, descuento aplicado a unitPrice) */}
                  {pkg?.palletEnabled && (pkg?.amountPerPallet || 0) > 0 && (gv.price || 0) > 0 && (() => {
                    const units = pkg!.amountPerPallet!;
                    const listPrice = (gv.originalPrice && gv.originalPrice > 0) ? gv.originalPrice : (gv.price || 0);
                    // Modo precio fijo gana sobre modo descuento si ambos vinieran.
                    const hasFixedPrice = pkg!.palletPrice != null && Number(pkg!.palletPrice) > 0;
                    let palletTotal: number;
                    let palletUnitPrice: number;
                    let discPct: number;
                    if (hasFixedPrice) {
                      palletTotal = Math.round(Number(pkg!.palletPrice));
                      palletUnitPrice = Math.round(palletTotal / units);
                      const listTotal = listPrice * units;
                      discPct = listTotal > 0 ? Math.max(0, Math.round((1 - palletTotal / listTotal) * 100)) : 0;
                    } else {
                      discPct = Math.max(0, Math.min(100, Number(pkg!.palletDiscountPct || 0)));
                      palletUnitPrice = Math.round(listPrice * (1 - discPct / 100));
                      palletTotal = palletUnitPrice * units;
                    }
                    const savings = (listPrice * units) - palletTotal;
                    return (
                      <div className="border-t border-gray-100 pt-5">
                        <div className="bg-gradient-to-r from-blue-500/5 to-indigo-50 rounded-xl p-5 border border-blue-200/40">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Venta por pallet</span>
                            {hasFixedPrice ? (
                              <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">PRECIO FIJO</Badge>
                            ) : discPct > 0 && (
                              <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">-{discPct}%</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-3">
                            {units} unidades por pallet
                            {savings > 0 && ` — ahorras ${formatPrice(savings)}`}
                          </p>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-2xl font-black text-blue-700">{formatPrice(palletTotal)}</span>
                            <span className="text-sm text-gray-500">total pallet</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mb-3">Unidad: {formatPrice(palletUnitPrice)}</p>
                          <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              addPalletToCart(gv, gp.genericName);
                              setShowGroupedDetailDialog(false);
                            }}
                            data-testid="button-add-pallet"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Pallet completo ({units} un)
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <DialogTitle className="text-2xl">
                    {getProductName(selectedProduct)}
                  </DialogTitle>
                  {selectedProduct.slug && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={async () => {
                        const url = `${window.location.origin}/p/${selectedProduct.slug}`;
                        try {
                          if (navigator.share) {
                            await navigator.share({ title: getProductName(selectedProduct), url });
                          } else {
                            await navigator.clipboard.writeText(url);
                            toast({ title: "Link copiado", description: url });
                          }
                        } catch {
                          try {
                            await navigator.clipboard.writeText(url);
                            toast({ title: "Link copiado", description: url });
                          } catch {
                            toast({ title: "Link", description: url });
                          }
                        }
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      Compartir
                    </Button>
                  )}
                </div>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Product Image */}
                <div className="space-y-4">
                  <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
                    {getProductImageUrl(selectedProduct) ? (
                      <img 
                        src={getProductImageUrl(selectedProduct)}
                        alt={getProductName(selectedProduct)}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <ImageIcon className="h-16 w-16 mx-auto mb-2" />
                        <p>Sin imagen disponible</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Details */}
                <div className="space-y-6">
                  {/* Price */}
                  <div className={`rounded-lg p-6 ${selectedProduct.offerPrice ? 'bg-red-50' : 'bg-[#FF6E23]/5'}`}>
                    <h4 className="font-semibold mb-2 text-gray-700">Precio</h4>
                    <div className="text-3xl font-bold text-[#FF6E23]">
                      {formatPrice(getProductPrice(selectedProduct))}
                      <Badge variant="secondary" className="ml-3 text-sm bg-gray-100 text-gray-600 font-normal px-3 py-1">
                        {getProductUnit(selectedProduct) || 'Unidad'}
                      </Badge>
                    </div>
                    {selectedProduct.offerPrice && (
                      <Badge className="mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1">
                        OFERTA
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {getProductDescription(selectedProduct) && (
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-700">Descripción</h4>
                      <p className="text-gray-600">{getProductDescription(selectedProduct)}</p>
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Código</h4>
                      <p className="text-gray-600 font-mono text-sm">{getProductCode(selectedProduct)}</p>
                    </div>
                    
                    {getProductCategory(selectedProduct) && (
                      <div>
                        <h4 className="font-semibold mb-1 text-gray-700">Categoría</h4>
                        <p className="text-gray-600">{getProductCategory(selectedProduct)}</p>
                      </div>
                    )}
                    
                    {getProductUnit(selectedProduct) && (
                      <div>
                        <h4 className="font-semibold mb-1 text-gray-700">Presentación</h4>
                        <p className="text-gray-600">{getProductUnit(selectedProduct)}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Marca</h4>
                      <p className="text-gray-600">Pinturas Panorámica</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      className="flex-1 bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white py-3"
                      onClick={() => selectedProduct && handleAddToCartClick(selectedProduct)}
                      data-testid="button-add-cart-dialog"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Agregar al Carrito
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-[#FF6E23] text-[#FF6E23] hover:bg-[#FF6E23]/10 py-3"
                    >
                      Ver más productos
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Variant Selection Dialog */}
      <Dialog open={showVariantDialog} onOpenChange={setShowVariantDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecciona una Variante</DialogTitle>
          </DialogHeader>
          
          {selectedVariantGroup && (
            <div className="space-y-4">
              {/* Group Info */}
              <div className="pb-4 border-b">
                <h3 className="font-bold text-lg">{selectedVariantGroup.nombre}</h3>
                {selectedVariantGroup.descripcion && (
                  <p className="text-muted-foreground text-sm mt-1">{selectedVariantGroup.descripcion}</p>
                )}
              </div>

              {/* Variant Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedVariantGroup.productos.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id;
                  const variantPrice = getProductPrice(variant);
                  
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        isSelected 
                          ? 'border-[#FF6E23] bg-[#FF6E23]/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      data-testid={`button-variant-${variant.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{variant.variantLabel || getProductName(variant)}</span>
                        {isSelected && (
                          <div className="bg-[#FF6E23] text-white rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Código: {getProductCode(variant)}
                      </div>
                      <div className="text-lg font-bold text-[#FF6E23]">
                        {formatPrice(variantPrice)}
                      </div>
                      {variant.isMainVariant && (
                        <Badge variant="default" className="mt-2">Principal</Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quantity Selector */}
              {selectedVariant && (
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-3">Cantidad</h4>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => decrementQuantity(selectedVariant.id, getProductUnit(selectedVariant))}
                      disabled={getProductQuantity(selectedVariant.id, getProductUnit(selectedVariant)) <= getMinimumQuantity(getProductUnit(selectedVariant))}
                      data-testid="button-decrement-variant"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    
                    <div className="min-w-[4rem] text-center">
                      <div className="text-2xl font-bold">
                        {getProductQuantity(selectedVariant.id, getProductUnit(selectedVariant))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getQuantityLabel(getProductUnit(selectedVariant))}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => incrementQuantity(selectedVariant.id, getProductUnit(selectedVariant))}
                      data-testid="button-increment-variant"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowVariantDialog(false);
                    setSelectedVariant(null);
                    setSelectedVariantGroup(null);
                  }}
                  data-testid="button-cancel-variant"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white"
                  onClick={() => {
                    if (selectedVariant) {
                      addToCart(selectedVariant);
                      setShowVariantDialog(false);
                      setSelectedVariant(null);
                      setSelectedVariantGroup(null);
                    }
                  }}
                  disabled={!selectedVariant}
                  data-testid="button-confirm-variant"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Agregar al Carrito
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer Banners */}
      {footerBanners.length > 0 && (
        <footer className="w-full mt-16 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col w-full">
            {footerBanners.map((banner, index) => (
              <div 
                key={index}
                className="w-full cursor-pointer relative"
                onClick={() => banner.linkUrl ? window.open(banner.linkUrl, '_blank') : null}
              >
                <picture>
                  {banner.mobileSrc && (
                    <source media="(max-width: 768px)" srcSet={banner.mobileSrc} />
                  )}
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                </picture>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 py-6 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Pinturas Panorámica. Todos los derechos reservados.</p>
          </div>
        </footer>
      )}
      {footerBanners.length === 0 && (
        <footer className="bg-gray-900 py-6 mt-16 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Pinturas Panorámica. Todos los derechos reservados.</p>
        </footer>
      )}
    </div>
    
    {/* Floating Cart */}
    <FloatingCart 
      isOpen={showFloatingCart} 
      onClose={() => setShowFloatingCart(false)} 
    />

    {/* ─── SKU Quick Order Modal ─── */}
    {showSkuQuickOrder && (
      <SkuQuickOrderModal
        onClose={() => setShowSkuQuickOrder(false)}
        clientPriceList={clientPriceList}
        offersMap={offersMap}
        isClient={isClient}
        selectedBranchId={selectedBranchId}
        branchDiscountPct={branchDiscountPct}
        addItem={addItem}
        setShowFloatingCart={setShowFloatingCart}
      />
    )}

    {/* Product Info Modal */}
    {infoModal.open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="sticky top-0 bg-white border-b px-5 py-4 rounded-t-2xl flex items-center justify-between z-10">
            <div>
              <h3 className="font-bold text-lg text-gray-800 uppercase">{infoModal.productName}</h3>
              <p className="text-sm text-gray-500">Ficha Técnica del Producto</p>
            </div>
            <button
              onClick={() => setInfoModal({ open: false, productName: '', loading: false, data: null })}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Modal body */}
          <div className="px-5 py-5">
            {infoModal.loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#FF6E23]" />
                <span className="ml-3 text-base text-gray-500">Cargando información...</span>
              </div>
            ) : !infoModal.data ? (
              <div className="text-center py-16">
                <Package className="h-14 w-14 text-gray-300 mx-auto mb-4" />
                <p className="text-base text-gray-500 font-medium">No hay información técnica disponible.</p>
                <p className="text-sm text-gray-400 mt-1">El administrador puede cargarla desde el panel.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Featured Image */}
                {infoModal.data.imagenDestacada && (
                  <div className="rounded-xl overflow-hidden border-2 border-gray-100">
                    <img
                      src={infoModal.data.imagenDestacada}
                      alt={infoModal.productName}
                      className="w-full max-h-64 object-contain bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Galería de fotos promocionales */}
                {Array.isArray(infoModal.data.fotosPromocionales) && infoModal.data.fotosPromocionales.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {infoModal.data.fotosPromocionales.map((foto: any, idx: number) => (
                      <a
                        key={idx}
                        href={foto.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-100 bg-gray-50 aspect-square hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={foto.url}
                          alt={foto.name || infoModal.productName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                {infoModal.data.breveResena && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-base text-blue-800 font-medium">{infoModal.data.breveResena}</p>
                  </div>
                )}

                {/* YouTube Video */}
                {infoModal.data.youtubeUrl && (() => {
                  const url = infoModal.data.youtubeUrl;
                  let videoId: string | null = null;
                  try {
                    if (url.includes('youtu.be/')) {
                      videoId = url.split('youtu.be/')[1]?.split(/[?&#]/)[0] || null;
                    } else if (url.includes('youtube.com')) {
                      const urlObj = new URL(url);
                      videoId = urlObj.searchParams.get('v');
                    }
                  } catch {}
                  if (videoId) {
                    return (
                      <div className="rounded-xl overflow-hidden border-2 border-gray-100">
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="Video del producto"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                {infoModal.data.descripcion && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Descripción</h4>
                    <p className="text-base text-gray-700">{infoModal.data.descripcion}</p>
                  </div>
                )}
                {infoModal.data.usos && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Usos y Aplicaciones</h4>
                    <p className="text-base text-gray-700">{infoModal.data.usos}</p>
                  </div>
                )}
                {infoModal.data.presentacion && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Presentaciones</h4>
                    <p className="text-base text-gray-700">{infoModal.data.presentacion}</p>
                  </div>
                )}
                {infoModal.data.rendimiento && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Rendimiento</h4>
                    <p className="text-base text-gray-700">{infoModal.data.rendimiento}</p>
                  </div>
                )}
                {infoModal.data.preparacionSuperficie && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Preparación de Superficie</h4>
                    <p className="text-base text-gray-700">{infoModal.data.preparacionSuperficie}</p>
                  </div>
                )}
                {infoModal.data.modoAplicacion && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Modo de Aplicación</h4>
                    <p className="text-base text-gray-700">{infoModal.data.modoAplicacion}</p>
                  </div>
                )}
                {(infoModal.data.tiempoSecado || infoModal.data.capas || infoModal.data.dilucion) && (
                  <div className="grid grid-cols-3 gap-3">
                    {infoModal.data.tiempoSecado && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Secado</p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">{infoModal.data.tiempoSecado}</p>
                      </div>
                    )}
                    {infoModal.data.capas && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Capas</p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">{infoModal.data.capas}</p>
                      </div>
                    )}
                    {infoModal.data.dilucion && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Dilución</p>
                        <p className="text-sm text-gray-700 mt-1 font-medium">{infoModal.data.dilucion}</p>
                      </div>
                    )}
                  </div>
                )}
                {infoModal.data.observaciones && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Observaciones</h4>
                    <p className="text-base text-gray-700">{infoModal.data.observaciones}</p>
                  </div>
                )}

                {/* FAQs */}
                {(infoModal.data.preguntasFrecuentes || []).length > 0 && (
                  <div className="border-t pt-5 mt-5">
                    <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Preguntas Frecuentes
                    </h4>
                    <div className="space-y-3">
                      {(infoModal.data.preguntasFrecuentes as Array<{pregunta: string; respuesta: string}>).map((faq: {pregunta: string; respuesta: string}, i: number) => (
                        <div key={i} className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                          <p className="text-base font-bold text-purple-800">{faq.pregunta}</p>
                          <p className="text-sm text-purple-700 mt-1.5">{faq.respuesta}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {/* ─── FAQ Modal ─── */}
    <Dialog open={showFaqModal} onOpenChange={setShowFaqModal}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HelpCircle className="h-5 w-5 text-[#FF6E23]" />
            Preguntas Frecuentes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {[
            {
              pregunta: "¿Cómo puedo realizar un pedido?",
              respuesta: "Navegue por nuestro catálogo, seleccione los productos que necesita ajustando las cantidades, y haga clic en el botón del carrito para revisar su pedido. Luego presione \"Enviar Pedido\" para confirmar. Recibirá una confirmación por correo electrónico."
            },
            {
              pregunta: "¿Cuál es el monto mínimo de compra?",
              respuesta: "El monto mínimo de compra varía según el tipo de producto y formato. Los galones se venden en unidades individuales, mientras que los formatos de 1/4 de galón tienen un mínimo de 6 unidades. Consulte las especificaciones de cada producto para más detalles."
            },
            {
              pregunta: "¿Cuáles son los costos de envío?",
              respuesta: `Los costos de envío se calculan según el volumen de su pedido y la zona de despacho. Pedidos sobre $${freeShippingThreshold.toLocaleString('es-CL')} tienen envío gratuito dentro de la Región Metropolitana. Para regiones, consulte con nuestro equipo de ventas.`
            },
            {
              pregunta: "¿Cuánto tiempo tarda el despacho?",
              respuesta: "Los pedidos dentro de la Región Metropolitana se despachan en 24 a 48 horas hábiles. Para regiones, el plazo es de 3 a 5 días hábiles dependiendo de la ubicación. Recibirá un aviso cuando su pedido sea despachado."
            },
            {
              pregunta: "¿Qué métodos de pago aceptan?",
              respuesta: "Aceptamos transferencia bancaria y pago contra factura para clientes con crédito aprobado. Al enviar su pedido, recibirá los datos bancarios para realizar la transferencia. El pedido se procesará una vez confirmado el pago."
            },
            {
              pregunta: "¿Puedo ver el rendimiento de los productos?",
              respuesta: "Sí, en la ficha técnica de cada producto puede encontrar información sobre rendimiento por m², tiempos de secado, y recomendaciones de aplicación. Haga clic en \"Detalles\" en cualquier producto para ver su información completa."
            },
            {
              pregunta: "¿Cómo solicito una cotización formal?",
              respuesta: "Puede agregar los productos que necesita al carrito y enviar el pedido. Nuestro equipo comercial le enviará una cotización formal con los precios y condiciones aplicables a su cuenta."
            },
            {
              pregunta: "¿Qué hago si un producto no tiene stock?",
              respuesta: "Si un producto muestra stock 0, puede contactarnos directamente al correo o teléfono indicado en la parte superior de la tienda. Nuestro equipo le informará sobre disponibilidad y tiempos de reposición."
            },
          ].map((faq, i) => (
            <details key={i} className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden transition-all hover:border-[#FF6E23]/30">
              <summary className="flex items-center justify-between p-4 cursor-pointer select-none list-none">
                <span className="text-sm font-semibold text-gray-800 pr-4">{faq.pregunta}</span>
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 pt-0">
                <p className="text-sm text-gray-600 leading-relaxed">{faq.respuesta}</p>
              </div>
            </details>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-gray-400">
            ¿Tiene alguna otra consulta? Contáctenos al {storeConfig?.phone || "+56 2 2345 6789"} o escríbanos a {storeConfig?.email || "contacto@panoramica.cl"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}