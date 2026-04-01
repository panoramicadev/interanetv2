import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Tag
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { validateQuantity as validateCartQuantity } from "@/contexts/CartContext";
import { FloatingCart, CartToggle } from "@/components/cart";
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
  // Priority: precio -> ecomPrice -> canalDigital -> 0
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

  // Use DB banners if available, otherwise fallback to hardcoded
  const banners = storeBanners.length > 0
    ? [...storeBanners].sort((a: any, b: any) => (a.orden || 0) - (b.orden || 0)).map((b: any) => ({ src: b.imagenDesktop, alt: b.titulo, mobileSrc: b.imagenMobile, linkUrl: b.linkUrl }))
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
    queryKey: ['/api/store/products/grouped', debouncedSearch, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      
      const url = `/api/store/products/grouped${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    retry: false,
    staleTime: 30_000, // Cache for 30s — server also caches
    placeholderData: (prev: any) => prev, // Keep previous data during transitions
  });

  const groupedCatalog: StoreGenericProduct[] = useMemo(() => {
    let catalog = groupedData?.catalog || [];
    // Client-side tag filter
    if (selectedTag) {
      catalog = catalog.filter(p => (p.tags || []).includes(selectedTag));
    }
    return catalog;
  }, [groupedData, selectedTag]);

  // Fetch admin-defined active tags
  const { data: adminTags = [] } = useQuery<{ name: string; color: string }[]>({
    queryKey: ['/api/store/tags'],
    staleTime: 300_000,
  });

  // Derive available tags from the full catalog, filtered to only admin-defined tags
  const availableTags: { name: string; count: number; color: string }[] = useMemo(() => {
    const adminTagNames = new Set(adminTags.map((t: any) => t.name));
    const adminTagColors = new Map(adminTags.map((t: any) => [t.name, t.color]));
    const allProducts = groupedData?.catalog || [];
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
  }, [groupedData, adminTags]);

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
      const unitPrice = variant.price || 0;
      
      if (unitPrice === 0) return;

      const validation = validateCartQuantity(qty, variant.format);
      const validatedQuantity = validation.validQuantity;

      try {
        addItem({
          productId: variant.sku,
          productCode: variant.sku,
          productName: productName,
          selectedPackaging: variant.format,
          selectedColor: variant.color,
          unit: variant.format,
          unitPrice,
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
      toast({
        title: "Productos agregados",
        description: `Se agregaron ${variantsToAdd.length} colores (${addedCount} unds en total) al carrito`,
        action: <Check className="h-4 w-4" />
      });
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
  const addGroupedVariantToCart = (variant: StoreFormatVariant, productName: string) => {
    const qty = quantities[variant.sku] || variant.minUnit || 1;
    const unitPrice = variant.price || 0;
    
    if (unitPrice === 0) {
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

    try {
      addItem({
        productId: variant.sku,
        productCode: variant.sku,
        productName: productName,
        selectedPackaging: variant.format,
        selectedColor: variant.color,
        unit: variant.format,
        unitPrice,
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

  const navigationItems = [
    { name: "Contacto", href: "#contacto" },
  ];

  // Login Gate state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState({ empresa: '', rut: '', contacto: '', email: '', telefono: '', ciudad: '' });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Login Gate — show exclusive access screen when not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        {/* Subtle pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />

        <div className="relative text-center max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="mb-8">
            <img
              src={storeConfig?.logoUrl || "/panoramica-logo.png"}
              alt="Panorámica"
              className="h-20 sm:h-24 mx-auto drop-shadow-2xl"
            />
          </div>

          {!showRegisterForm && !registerSuccess && (
            <>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-[#FF6E23]/20 text-[#FF6E23] px-4 py-1.5 rounded-full text-sm font-bold mb-6 backdrop-blur-sm border border-[#FF6E23]/30">
                <ShoppingCart className="h-4 w-4" />
                Plataforma eCommerce
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
                Plataforma exclusiva<br />para clientes Panorámica
              </h1>

              <p className="text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
                Accede a nuestro catálogo completo con precios especiales, realiza pedidos y gestiona tu cuenta.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 text-base"
                >
                  <LockKeyhole className="h-4 w-4" />
                  Iniciar Sesión
                </a>
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3 rounded-xl transition-all backdrop-blur-sm border border-white/20 text-base"
                >
                  <UserPlus className="h-4 w-4" />
                  Crear Cuenta
                </button>
              </div>

              <p className="text-gray-500 text-xs mt-10">
                ¿Necesitas ayuda? Contáctanos al {storeConfig?.phone || "+56 2 2345 6789"}
              </p>
            </>
          )}

          {/* Registration Form */}
          {showRegisterForm && !registerSuccess && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-left">
              <h2 className="text-xl font-bold text-white mb-1">Solicitar Cuenta</h2>
              <p className="text-gray-400 text-sm mb-5">Completa tus datos y te contactaremos para activar tu acceso.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Empresa / Razón Social *</label>
                  <input
                    type="text"
                    value={registerForm.empresa}
                    onChange={e => setRegisterForm(p => ({ ...p, empresa: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                    placeholder="Ej: Constructora ABC Ltda."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">RUT Empresa *</label>
                  <input
                    type="text"
                    value={registerForm.rut}
                    onChange={e => setRegisterForm(p => ({ ...p, rut: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                    placeholder="Ej: 76.123.456-7"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">Nombre Contacto *</label>
                    <input
                      type="text"
                      value={registerForm.contacto}
                      onChange={e => setRegisterForm(p => ({ ...p, contacto: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">Teléfono *</label>
                    <input
                      type="tel"
                      value={registerForm.telefono}
                      onChange={e => setRegisterForm(p => ({ ...p, telefono: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Correo Electrónico *</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                    placeholder="contacto@empresa.cl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Ciudad</label>
                  <input
                    type="text"
                    value={registerForm.ciudad}
                    onChange={e => setRegisterForm(p => ({ ...p, ciudad: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FF6E23]/50"
                    placeholder="Santiago"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowRegisterForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-all border border-white/20"
                >
                  Volver
                </button>
                <button
                  onClick={async () => {
                    if (!registerForm.empresa || !registerForm.rut || !registerForm.contacto || !registerForm.email || !registerForm.telefono) return;
                    setRegisterLoading(true);
                    try {
                      await fetch('/api/ecommerce/account-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(registerForm),
                      });
                      setRegisterSuccess(true);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setRegisterLoading(false);
                    }
                  }}
                  disabled={registerLoading || !registerForm.empresa || !registerForm.rut || !registerForm.contacto || !registerForm.email || !registerForm.telefono}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white font-bold text-sm transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registerLoading ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </div>
          )}

          {/* Success message */}
          {registerSuccess && (
            <div className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">¡Solicitud Enviada!</h2>
              <p className="text-gray-400 text-sm mb-5">
                Hemos recibido tu solicitud. Nuestro equipo la revisará y te contactará a la brevedad para activar tu cuenta.
              </p>
              <button
                onClick={() => { setRegisterSuccess(false); setShowRegisterForm(false); setRegisterForm({ empresa: '', rut: '', contacto: '', email: '', telefono: '', ciudad: '' }); }}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-2.5 rounded-xl transition-all border border-white/20 text-sm"
              >
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-[#f8f9fb]">
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

            {/* Search Bar — Desktop */}
            <div className="hidden md:flex flex-1 max-w-lg">
              <div className="relative w-full group">
                {searchTerm !== debouncedSearch ? (
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#FF6E23] transition-colors" />
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
                  className="pl-10 pr-10 h-10 text-sm rounded-xl border-gray-200 focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 bg-gray-50/80 hover:bg-white transition-all shadow-sm"
                  data-testid="input-search-tienda"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Search Bar — inline */}
            <div className="md:hidden flex-1 mx-1">
              <div className="relative w-full">
                {searchTerm !== debouncedSearch ? (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 border-2 border-[#FF6E23] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
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
                  className="pl-8 pr-8 text-xs h-9 border-gray-200 rounded-lg bg-gray-50/80 shadow-sm"
                  data-testid="input-search-mobile"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-1">
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
                    className="w-full h-auto object-contain block"
                  />
                </picture>
              )}
            </div>
          ))}
          
          {/* Navigation Arrows */}
          <button 
            onClick={() => setCurrentSlide(prev => (prev === 0 ? banners.length - 1 : prev - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 opacity-0 group-hover:opacity-100 hidden md:flex"
            aria-label="Anterior banner"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setCurrentSlide(prev => (prev + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all z-20 opacity-0 group-hover:opacity-100 hidden md:flex"
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
              <>
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[11px] font-bold border-gray-200 rounded-lg gap-1.5 bg-white shadow-sm hover:bg-gray-50 flex-shrink-0"
                      >
                        <Grid3X3 className="h-3 w-3 text-[#FF6E23]" />
                        {selectedCategory === 'all' ? 'Categorías' : selectedCategory}
                        <ChevronDown className="h-3 w-3 text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px] p-1 font-bold">
                      <DropdownMenuItem 
                        onClick={() => { setSelectedCategory('all'); setSelectedTag(null); }}
                        className={selectedCategory === 'all' && !selectedTag ? 'bg-gray-100 text-[#FF6E23]' : ''}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>Todas</span>
                          {selectedCategory === 'all' && !selectedTag && <Check className="h-3 w-3" />}
                        </div>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[9px] uppercase text-gray-400 font-black px-2 py-1">Rubros / Familias</DropdownMenuLabel>
                      {categories.map((category) => (
                        <DropdownMenuItem 
                          key={category}
                          onClick={() => { setSelectedCategory(category); setSelectedTag(null); }}
                          className={selectedCategory === category && !selectedTag ? 'bg-gray-100 text-[#FF6E23]' : ''}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{category}</span>
                            {selectedCategory === category && !selectedTag && <Check className="h-3 w-3" />}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1 py-1 pl-1">
                  {/* Tags row for mobile - full width wrap */}
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
                          } else {
                            setSelectedTag(name);
                            setSelectedCategory('all');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                          isActive ? c.activeBg + ' ' + c.activeText : c.bg + ' ' + c.text
                        } hover:shadow-sm`}
                        data-testid={`filter-tag-mobile-${name}`}
                      >
                        <Tag className="h-3 w-3" />
                        {name}
                        <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-200/50'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
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
                      <span className={`text-[9px] px-1 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-200/50 text-gray-500'}`}>{count}</span>
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
            {groupedCatalog.map(product => {
              const colorKeys = Object.keys(product.colors)
                .sort((a, b) => product.colors[b].length - product.colors[a].length);
              const isExpanded = expandedProducts.has(product.genericName);
              const totalVariants = Object.values(product.colors).flat().length;

              return (
                <div
                  key={product.genericName}
                  className={`rounded-2xl overflow-hidden transition-all duration-300 flex flex-col ${
                    isExpanded
                      ? 'border border-[#FF6E23]/30 shadow-xl shadow-orange-100/40 bg-white lg:col-span-2 ring-1 ring-[#FF6E23]/10'
                      : 'border border-gray-200/80 bg-white hover:border-gray-300/80 hover:shadow-lg hover:shadow-gray-100/60'
                  }`}
                >
                  {/* Product Card (collapsed) */}
                  <div
                    className={`cursor-pointer transition-all duration-200 ${
                      isExpanded ? 'bg-gradient-to-r from-orange-50/80 to-amber-50/60' : 'hover:bg-gray-50/40'
                    }`}
                    onClick={() => toggleProduct(product.genericName)}
                  >
                    {!isExpanded ? (
                      <div className="flex">
                        {/* Product Image */}
                        <div className="w-28 sm:w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-gray-50 to-white relative group p-2 sm:p-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.genericName}
                              className="w-full h-full object-contain aspect-square transition-transform duration-300 group-hover:scale-105 rounded-xl"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center aspect-square">
                              <ImageIcon className="w-10 h-10 text-gray-200" />
                            </div>
                          )}
                          {/* Tags overlay */}
                          {(product.tags || []).filter(t => adminTags.some((at: any) => at.name === t)).length > 0 && (
                            <div className="absolute top-1 left-1 sm:top-2 sm:left-2 flex flex-col gap-1.5">
                              {(product.tags || []).filter(t => adminTags.some((at: any) => at.name === t)).slice(0, 2).map(tag => {
                                const tagDef = adminTags.find((at: any) => at.name === tag);
                                const TAG_BG: Record<string, string> = {
                                  green: 'bg-emerald-500/90', blue: 'bg-blue-500/90', amber: 'bg-amber-500/90',
                                  red: 'bg-rose-500/90', purple: 'bg-violet-500/90', pink: 'bg-pink-500/90',
                                  cyan: 'bg-cyan-500/90', orange: 'bg-orange-500/90', indigo: 'bg-indigo-500/90', teal: 'bg-teal-500/90',
                                };
                                const bgClass = TAG_BG[tagDef?.color || 'gray'] || 'bg-gray-600/90';
                                return (
                                  <span key={tag} className={`text-[8px] sm:text-[9px] px-1.5 sm:px-2 py-0.5 rounded-md font-bold whitespace-nowrap backdrop-blur-sm ${bgClass} text-white`}>
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {/* Product Info */}
                        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <h3 className="text-[13px] sm:text-sm font-bold uppercase leading-tight text-gray-900 line-clamp-2 tracking-tight">
                              {product.genericName}
                            </h3>
                            {product.breveResena && (
                              <p className="text-[13px] text-gray-600 mt-1.5 line-clamp-2 leading-relaxed italic">{product.breveResena}</p>
                            )}
                            {/* Available formats */}
                            {(() => {
                              const allFormats = new Set<string>();
                              Object.values(product.colors).flat().forEach(v => {
                                if (v.format) allFormats.add(v.format);
                              });
                              const formats = Array.from(allFormats);
                              if (formats.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                  {formats.map(fmt => (
                                    <span
                                      key={fmt}
                                      className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/60 shadow-sm"
                                    >
                                      <Box className="w-2.5 h-2.5 text-slate-400" />
                                      {fmt}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span title="Colores Disponibles" className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md shadow-sm border border-orange-100/50">
                              <Palette className="w-3 h-3" /> {colorKeys.length} <span className="font-semibold">Color{colorKeys.length !== 1 ? 'es' : ''}</span>
                            </span>
                            <span className="flex-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); openInfoModal(product.genericName); }}
                              className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-[#FF6E23] bg-gray-50 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-all"
                            >
                              <Info className="w-3 h-3" /> Detalles
                            </button>
                            <ChevronRight className="h-4 w-4 text-gray-300" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Expanded Header — compact horizontal bar */
                      <div className="px-4 py-3 flex items-center gap-3">
                        <h3 className="text-sm font-bold uppercase text-[#FF6E23] flex-1 min-w-0 truncate">
                          {product.genericName}
                        </h3>
                        {(product.tags || []).filter(t => adminTags.some((at: any) => at.name === t)).length > 0 && (
                          <div className="flex items-center gap-1">
                            {(product.tags || []).filter(t => adminTags.some((at: any) => at.name === t)).slice(0, 2).map(tag => {
                              const tagDef = adminTags.find((at: any) => at.name === tag);
                              const TAG_BG: Record<string, string> = {
                                green: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500',
                                red: 'bg-rose-500', purple: 'bg-violet-500', pink: 'bg-pink-500',
                                cyan: 'bg-cyan-500', orange: 'bg-orange-500', indigo: 'bg-indigo-500', teal: 'bg-teal-500',
                              };
                              const bgClass = TAG_BG[tagDef?.color || 'gray'] || 'bg-gray-500';
                              return (
                                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${bgClass} text-white`}>
                                  {tag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span title="Colores Disponibles" className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-orange-100/50">
                            <Palette className="w-2.5 h-2.5" /> {colorKeys.length} Color{colorKeys.length !== 1 ? 'es' : ''}
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 transition-colors flex-shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content — Slide-down with image left, options right */}
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: isExpanded ? '600px' : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    {(() => {
                      // Dynamically group variants by Format
                      const formatsMap = new Map<string, StoreFormatVariant[]>();
                      Object.values(product.colors).flat().forEach(v => {
                        if (!formatsMap.has(v.format)) formatsMap.set(v.format, []);
                        formatsMap.get(v.format)!.push(v);
                      });
                      const formatsList = Array.from(formatsMap.keys());
                      
                      const selectedFormatKey = `selected-${product.genericName}`;
                      const activeFormat = expandedFormats.has(selectedFormatKey)
                         ? Array.from(expandedFormats).find(k => k.startsWith(`${product.genericName}-`))?.replace(`${product.genericName}-`, '') || formatsList[0]
                         : formatsList[0];
                      const variantsForFormat = formatsMap.get(activeFormat) || [];
                      
                      const activeFormatData = variantsForFormat[0];
                      const formatImg = product.imageUrl;
                      
                      // Calculate Total for the active format
                      const formatTotal = variantsForFormat.reduce((acc, v) => {
                        const q = quantities[v.sku] || 0;
                        return acc + ((v.price || 0) * q);
                      }, 0);

                      return (
                        <div className="border-t border-[#FF6E23]/10 flex flex-col pt-3 bg-gradient-to-br from-gray-50/50 to-white">
                          
                          {/* Top: Format Selector Tabs */}
                          <div className="px-5 mb-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Selecciona el Formato</span>
                            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar snap-x">
                              {formatsList.map(format => {
                                const isActive = format === activeFormat;
                                return (
                                  <button
                                    key={format}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFormat(product.genericName, format);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex-shrink-0 snap-start ${
                                      isActive
                                        ? 'bg-orange-50/80 border-[#FF6E23] text-[#FF6E23] shadow-sm'
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {format}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Main Content Area */}
                          <div className="flex flex-col md:flex-row gap-5 px-5 pb-5">
                            
                            {/* Left: Format Generic Details */}
                            <div className="hidden md:flex w-44 flex-shrink-0 flex-col items-center">
                              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 p-4 mb-3">
                                {formatImg ? (
                                  <img src={formatImg} alt={product.genericName} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon className="w-10 h-10 text-gray-200" />
                                  </div>
                                )}
                              </div>
                              <div className="text-center w-full">
                                <span className="text-xs font-bold text-gray-800 line-clamp-2">{activeFormat}</span>
                                {activeFormatData?.price && activeFormatData.price > 0 && (
                                  <span className="text-sm font-black text-[#FF6E23] block mt-1">{formatPrice(activeFormatData.price)}</span>
                                )}
                              </div>
                            </div>

                            {/* Right: Colors List Grid */}
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Colores Disponibles · {variantsForFormat.length}</span>
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">Cantidades</span>
                               </div>
                               
                               <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                 {variantsForFormat.map(variant => {
                                  const variantQty = quantities[variant.sku] || 0;
                                  const colorImg = variant.imageUrl;
                                  
                                  return (
                                    <div key={variant.sku} className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${variantQty > 0 ? 'bg-orange-50/30 border-[#FF6E23]/30' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                      
                                      {/* Color Info */}
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 shadow-inner flex-shrink-0 overflow-hidden relative">
                                          {colorImg ? (
                                             <img src={colorImg} alt={variant.color} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                          ) : (
                                             <div className="w-full h-full bg-gray-200" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-gray-800 truncate">{variant.color}</div>
                                          <div className="text-[10px] text-gray-400 mt-0.5 md:hidden">
                                            {variant.price ? formatPrice(variant.price) : 'Consultar'}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Quantity Controls */}
                                      <div className="flex items-center gap-3 flex-shrink-0">
                                        {/* Subtotal preview if > 0 */}
                                        {variantQty > 0 && variant.price && (
                                          <div className="hidden sm:block text-xs font-bold text-[#FF6E23]">
                                            {formatPrice(variant.price * variantQty)}
                                          </div>
                                        )}
                                        
                                        <div className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm h-9">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(0, variantQty - (variant.stepSize || 1)) })); }}
                                            className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                                            disabled={variantQty === 0}
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          
                                          <input
                                            type="number"
                                            value={variantQty || ''}
                                            placeholder="0"
                                            onChange={e => { 
                                              e.stopPropagation(); 
                                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                              if (!isNaN(val)) {
                                                setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(0, val) })); 
                                              }
                                            }}
                                            onClick={e => e.stopPropagation()}
                                            className="w-12 h-full text-center text-sm font-bold border-x border-gray-200 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#FF6E23] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            min="0"
                                            step={variant.stepSize || 1}
                                          />
                                          
                                          <button
                                            onClick={(e) => { 
                                              e.stopPropagation(); 
                                              // Jump from 0 directly to minUnit on first click
                                              const nextQty = variantQty === 0 ? (variant.minUnit || 1) : variantQty + (variant.stepSize || 1);
                                              setQuantities(prev => ({ ...prev, [variant.sku]: nextQty })); 
                                            }}
                                            className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                 })}
                               </div>
                               
                            </div>
                          </div>
                          
                          {/* Bottom Action Bar */}
                          <div className="bg-white border-t border-gray-100 p-4 sticky bottom-0 z-10 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase">Subtotal Formato</span>
                              <span className="text-lg font-black text-gray-900">{formatPrice(formatTotal)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                className="h-11 px-4 rounded-xl border-2 border-[#FF6E23] text-[#FF6E23] hover:bg-[#FF6E23]/5 transition-all duration-300 font-bold text-sm flex items-center gap-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGroupedDetailProduct({ product, variant: activeFormatData || variantsForFormat[0] });
                                  setShowGroupedDetailDialog(true);
                                }}
                              >
                                <Info className="h-4 w-4" />
                                <span className="hidden sm:inline">Ver Detalles</span>
                              </button>
                              
                              <button
                                className="h-11 px-6 rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white transition-all duration-300 font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-orange-500/20 group"
                                onClick={(e) => { e.stopPropagation(); addBulkVariantsToCart(variantsForFormat, product.genericName); }}
                                disabled={formatTotal === 0}
                              >
                                <ShoppingCart className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                                <span className="hidden sm:inline">Añadir al Carrito</span>
                                <span className="sm:hidden">Añadir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
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
                  <DialogTitle className="text-2xl font-black text-gray-900">{gp.genericName}</DialogTitle>
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
                        <div className="bg-gradient-to-r from-[#FF6E23]/5 to-orange-50 rounded-xl p-5 border border-[#FF6E23]/10">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Precio referencial</span>
                          <div className="text-3xl font-black text-[#FF6E23] mt-1">
                            {formatPrice(gv.price)}
                            <span className="text-sm font-normal text-gray-500 ml-2">/ {gv.format}</span>
                          </div>
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
                <DialogTitle className="text-2xl mb-4">
                  {getProductName(selectedProduct)}
                </DialogTitle>
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
                  <div className="bg-[#FF6E23]/5 rounded-lg p-6">
                    <h4 className="font-semibold mb-2 text-gray-700">Precio</h4>
                    <div className="text-3xl font-bold text-[#FF6E23]">
                      {formatPrice(getProductPrice(selectedProduct))}
                      <Badge variant="secondary" className="ml-3 text-sm bg-gray-100 text-gray-600 font-normal px-3 py-1">
                        {getProductUnit(selectedProduct) || 'Unidad'}
                      </Badge>
                    </div>
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <img 
                src={storeConfig?.logoUrl || "/panoramica-logo.png"} 
                alt="Panorámica"
                className="h-12 mb-4"
              />
              <p className="text-gray-400 text-sm">
                30 años de experiencia en pinturas y recubrimientos de calidad superior.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Productos</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Pinturas</a></li>
                <li><a href="#" className="hover:text-white">Impermeabilizantes</a></li>
                <li><a href="#" className="hover:text-white">Barnices</a></li>
                <li><a href="#" className="hover:text-white">Accesorios</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Empresa</h5>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Nosotros</a></li>
                <li><a href="#" className="hover:text-white">Experiencia</a></li>
                <li><a href="#" className="hover:text-white">Contacto</a></li>
                <li><a href="#" className="hover:text-white">Sucursales</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contacto</h5>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{storeConfig?.phone || "+56 2 2345 6789"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{storeConfig?.email || "contacto@panoramica.cl"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{storeConfig?.address || "Santiago, Chile"}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Pinturas Panorámica. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
    
    {/* Floating Cart */}
    <FloatingCart 
      isOpen={showFloatingCart} 
      onClose={() => setShowFloatingCart(false)} 
    />

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