import { useState, useEffect, useMemo } from "react";
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
  Truck
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { validateQuantity as validateCartQuantity } from "@/contexts/CartContext";
import { FloatingCart, CartToggle } from "@/components/cart";
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

// Improved quantity logic functions with precise regex patterns
const getQuantityJumpRule = (unidad: string | undefined): number => {
  if (!unidad) return 1;
  
  const unit = unidad.toUpperCase().trim();
  
  // BD4 and BD5 (Baldes) - individual units - Check this FIRST to avoid conflicts
  // More robust pattern to handle various formats: BD4, BD-4, BD 4, /BD4, BD4/, etc.
  if (/BD\s*[-\s]?\s*[45]|\bBALDE\s*(4|5)\b|\bBD[45]\b/i.test(unit)) {
    return 1;
  }
  
  // 1/4 (1/4 de Galón) - multiples of 6 - Check this BEFORE GL to avoid conflicts
  // Precise fraction matching for various formats: 1/4, 1 / 4, CUARTO
  if (/1\s*\/\s*4|\bCUARTO\b/i.test(unit)) {
    return 6;
  }
  
  // GL (Galones) - multiples of 4 - Use precise word boundary matching
  if (/\bGL\b|\bGAL[ÓO]N/i.test(unit)) {
    return 4;
  }
  
  // Default to individual units
  return 1;
};

const getMinimumQuantity = (unidad: string | undefined): number => {
  return getQuantityJumpRule(unidad);
};

const getQuantityLabel = (unidad: string | undefined): string => {
  const jump = getQuantityJumpRule(unidad);
  if (jump === 1) return "Mín: 1 unidad";
  return `Mín: ${jump} unidades`;
};

const validateQuantity = (quantity: number, unidad: string | undefined): number => {
  const jump = getQuantityJumpRule(unidad);
  const minQuantity = getMinimumQuantity(unidad);
  
  if (quantity < minQuantity) return minQuantity;
  
  // Round to nearest valid quantity
  return Math.max(minQuantity, Math.floor(quantity / jump) * jump);
};

export default function TiendaPage() {
  const { user, logoutMutation } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  
  // Variant selection state
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [selectedVariantGroup, setSelectedVariantGroup] = useState<ProductGroup | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<StoreProduct | null>(null);
  
  // Grouped product accordion state
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  
  // Banner carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // Cart state management
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showFloatingCart, setShowFloatingCart] = useState(false);

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
  });

  // Fetch store banners
  const { data: storeBanners = [] } = useQuery<StoreBanner[]>({
    queryKey: ['/api/store/banners'],
    retry: false,
  });

  // Use DB banners if available, otherwise fallback to hardcoded
  const banners = storeBanners.length > 0
    ? storeBanners.map(b => ({ src: b.imagenDesktop, alt: b.titulo, mobileSrc: b.imagenMobile, linkUrl: b.linkUrl }))
    : [
        { src: bannerCopper, alt: "Oferta del Mes - Esmalte Copper" },
        { src: bannerStain, alt: "Oferta del Mes - Stain Impregnante" },
        { src: bannerDespacho, alt: "Despacho Gratis - 3% OFF" }
      ];

  // Carousel auto-rotation effect
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % banners.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isHovered, banners.length]);

  // Fetch grouped store products (same grouping logic as salesperson catalog, with prices)
  const { data: groupedData, isLoading: productsLoading } = useQuery<StoreCatalogResponse>({
    queryKey: ['/api/store/products/grouped', searchTerm, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      
      const url = `/api/store/products/grouped${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    retry: false,
  });

  const groupedCatalog: StoreGenericProduct[] = useMemo(() => {
    let catalog = groupedData?.catalog || [];
    // Client-side tag filter
    if (selectedTag) {
      catalog = catalog.filter(p => (p.tags || []).includes(selectedTag));
    }
    return catalog;
  }, [groupedData, selectedTag]);

  // Derive available tags from the full catalog (not filtered)
  const availableTags: { name: string; count: number }[] = useMemo(() => {
    const allProducts = groupedData?.catalog || [];
    const tagMap = new Map<string, number>();
    allProducts.forEach(p => {
      (p.tags || []).forEach(tag => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [groupedData]);

  // Fetch store categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/store/categories'],
    retry: false,
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

  const toggleColor = (productName: string, color: string) => {
    const key = `${productName}-${color}`;
    setExpandedColors(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
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
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top micro-strip */}
          <div className="hidden md:flex items-center justify-between py-1 text-[11px] text-gray-400 border-b border-gray-100/80">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><Phone className="h-3 w-3" />{storeConfig?.phone || "+56 2 2345 6789"}</span>
              <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><Mail className="h-3 w-3" />{storeConfig?.email || "contacto@panoramica.cl"}</span>
              <span className="flex items-center gap-1 hover:text-gray-600 transition-colors"><MapPin className="h-3 w-3" />{storeConfig?.address || "Santiago, Chile"}</span>
            </div>
            <span className="text-[#FF6E23] font-semibold flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Envío gratis sobre $250.000
            </span>
          </div>

          {/* Main header */}
          <div className="flex items-center justify-between py-3 gap-4">
            {/* Logo */}
            <Link href="/tienda">
              <div className="flex items-center cursor-pointer flex-shrink-0 group">
                <img 
                  src={storeConfig?.logoUrl || "/panoramica-logo.png"} 
                  alt="Panorámica"
                  className="h-9 md:h-11 w-auto transition-transform group-hover:scale-[1.02]"
                />
              </div>
            </Link>

            {/* Search Bar — Premium glass */}
            <div className="hidden md:flex flex-1 max-w-lg">
              <div className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#FF6E23] transition-colors" />
                <Input
                  placeholder="Buscar productos, familias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 h-10 text-sm rounded-xl border-gray-200 focus:border-[#FF6E23] focus:ring-2 focus:ring-[#FF6E23]/10 bg-gray-50/80 hover:bg-white transition-all shadow-sm"
                  data-testid="input-search-tienda"
                />
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-1.5">
              {/* User Menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 rounded-xl transition-all"
                      data-testid="button-user-menu"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-[#FF6E23] to-[#E55E13] rounded-xl flex items-center justify-center shadow-sm shadow-orange-200">
                        <User className="h-4 w-4 text-white" />
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

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden p-2 rounded-xl hover:bg-gray-100"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                data-testid="button-mobile-menu"
              >
                {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm border-gray-200 rounded-xl bg-gray-50/80 h-10 shadow-sm"
                data-testid="input-search-mobile"
              />
            </div>
          </div>
        </div>


      </header>
      
      {/* Banner Carousel - Full Width */}
      <section 
        className="w-screen relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid="banner-carousel"
      >
        {/* Image container with transitions */}
        <div className="relative w-full">
          {banners.map((banner, index) => (
            <img
              key={index}
              src={banner.src}
              alt={banner.alt}
              className={`w-full h-auto object-contain transition-opacity duration-500 ${
                index === currentSlide ? 'opacity-100 relative' : 'opacity-0 absolute top-0 left-0'
              }`}
              data-testid={`banner-slide-${index}`}
            />
          ))}
        </div>
        
      </section>

      {/* ─── Filter Bar: Categories + Tags ─── */}
      <section className="bg-white border-b border-gray-100 sticky top-[108px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Catalog title + count */}
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight" id="productos">
              Catálogo
            </h2>
            <div className="h-5 w-px bg-gray-200" />
            <span className="text-sm text-gray-400 font-medium">
              {groupedCatalog.length} producto{groupedCatalog.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {/* Category section */}
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
              Categoría
            </span>
            
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid="filter-cat-all"
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(selectedCategory === category ? 'all' : category)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-[#FF6E23] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-[#FF6E23]'
                }`}
                data-testid={`filter-cat-${category}`}
              >
                {category.toUpperCase()}
              </button>
            ))}

            {/* Divider between categories and tags */}
            {availableTags.length > 0 && (
              <>
                <div className="h-4 w-px bg-gray-200 flex-shrink-0 mx-1" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                  Etiqueta
                </span>
              </>
            )}

            {/* Tag pills */}
            {availableTags.map(({ name, count }) => {
              const isActive = selectedTag === name;
              const tagColors: Record<string, { active: string; inactive: string }> = {
                'Mejor Precio': { active: 'bg-emerald-500 text-white shadow-sm', inactive: 'text-emerald-700 hover:bg-emerald-50' },
                'Rápida Rotación': { active: 'bg-blue-500 text-white shadow-sm', inactive: 'text-blue-700 hover:bg-blue-50' },
                'Pocas Unidades': { active: 'bg-amber-500 text-white shadow-sm', inactive: 'text-amber-700 hover:bg-amber-50' },
              };
              const colors = tagColors[name] || { active: 'bg-gray-700 text-white shadow-sm', inactive: 'text-gray-600 hover:bg-gray-100' };
              const dotColors: Record<string, string> = {
                'Mejor Precio': 'bg-emerald-400',
                'Rápida Rotación': 'bg-blue-400',
                'Pocas Unidades': 'bg-amber-400',
              };

              return (
                <button
                  key={name}
                  onClick={() => setSelectedTag(isActive ? null : name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    isActive ? colors.active : `bg-gray-100 ${colors.inactive}`
                  }`}
                  data-testid={`filter-tag-${name}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-white/60' : (dotColors[name] || 'bg-gray-400')
                  }`} />
                  {name}
                  <span className={`text-[10px] font-bold ${
                    isActive ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Clear all filters */}
            {(selectedCategory !== 'all' || selectedTag) && (
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedTag(null); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-all whitespace-nowrap flex-shrink-0 ml-1"
                data-testid="filter-clear"
              >
                <X className="h-3 w-3" />
                Limpiar
              </button>
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
                        <div className="w-28 sm:w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-gray-50 to-white relative group">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.genericName}
                              className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
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
                          {(product.tags || []).length > 0 && (
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              {(product.tags || []).slice(0, 2).map(tag => (
                                <span key={tag} className={`text-[9px] px-2 py-0.5 rounded-md font-bold whitespace-nowrap backdrop-blur-sm ${
                                  tag === 'Mejor Precio' ? 'bg-emerald-500/90 text-white' :
                                  tag === 'Rápida Rotación' ? 'bg-blue-500/90 text-white' :
                                  tag === 'Pocas Unidades' ? 'bg-amber-500/90 text-white' :
                                  'bg-gray-600/90 text-white'
                                }`}>
                                  {tag}
                                </span>
                              ))}
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
                          </div>
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Palette className="w-2.5 h-2.5" /> {colorKeys.length}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Box className="w-2.5 h-2.5" /> {totalVariants}
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
                        {(product.tags || []).length > 0 && (
                          <div className="flex items-center gap-1">
                            {(product.tags || []).slice(0, 2).map(tag => (
                              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                tag === 'Mejor Precio' ? 'bg-emerald-500 text-white' :
                                tag === 'Rápida Rotación' ? 'bg-blue-500 text-white' :
                                tag === 'Pocas Unidades' ? 'bg-amber-500 text-white' :
                                'bg-gray-500 text-white'
                              }`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="inline-flex items-center gap-1 bg-orange-50 text-[#FF6E23] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Palette className="w-2.5 h-2.5" /> {colorKeys.length}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Box className="w-2.5 h-2.5" /> {totalVariants}
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
                      const selectedColorKey = `selected-${product.genericName}`;
                      const activeColor = expandedColors.has(selectedColorKey) 
                        ? Array.from(expandedColors).find(k => k.startsWith(`${product.genericName}-`))?.replace(`${product.genericName}-`, '') || colorKeys[0]
                        : colorKeys[0];
                      const activeVariants = product.colors[activeColor] || [];
                      const activeColorImg = activeVariants.find(v => v.imageUrl)?.imageUrl || product.imageUrl;

                      return (
                        <div className="border-t border-[#FF6E23]/10 flex flex-col sm:flex-row">
                          {/* Left: Product Image */}
                          <div className="w-full sm:w-36 md:w-44 flex-shrink-0 bg-gradient-to-br from-gray-50 to-white p-3 flex items-start justify-center">
                            <div className="w-28 sm:w-full aspect-square rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 mx-auto">
                              {activeColorImg ? (
                                <img src={activeColorImg} alt={`${product.genericName} ${activeColor}`} className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="w-10 h-10 text-gray-200" />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Color chips + Format cards */}
                          <div className="flex-1 min-w-0 p-3 overflow-y-auto" style={{ maxHeight: '560px' }}>
                            {/* Color Chips */}
                            <div className="mb-3">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 block">Color</span>
                              <div className="flex flex-wrap gap-1.5">
                                {colorKeys.map(color => {
                                  const isActive = color === activeColor;
                                  const colorImg = product.colors[color]?.find(v => v.imageUrl)?.imageUrl;
                                  return (
                                    <button
                                      key={color}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedColors(prev => {
                                          const s = new Set(prev);
                                          Array.from(s).filter(k => k.startsWith(`${product.genericName}-`)).forEach(k => s.delete(k));
                                          s.add(`${product.genericName}-${color}`);
                                          s.add(selectedColorKey);
                                          return s;
                                        });
                                      }}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                                        isActive
                                          ? 'bg-[#FF6E23] text-white shadow-sm'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {colorImg && (
                                        <div className="w-4 h-4 rounded-full overflow-hidden border border-white/60 flex-shrink-0">
                                          <img src={colorImg} alt={color} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        </div>
                                      )}
                                      {color.toLowerCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Format Cards */}
                            <div>
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 block">
                                Formato · {activeVariants.length} opcion{activeVariants.length !== 1 ? 'es' : ''}
                              </span>
                              <div className="space-y-2">
                                {activeVariants.map(variant => {
                                  const variantQty = quantities[variant.sku] || variant.minUnit || 1;
                                  return (
                                    <div key={variant.sku} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 hover:border-[#FF6E23]/20 transition-all">
                                      {/* Desktop: single row layout */}
                                      <div className="hidden sm:flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-800">{variant.format}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                                              Disponible
                                            </span>
                                          </div>
                                          {variant.price && variant.price > 0 ? (
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(variant.price)}</span>
                                          ) : (
                                            <span className="text-[10px] text-gray-400">Sin precio</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <div className="inline-flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(variant.minUnit || 1, variantQty - (variant.stepSize || 1)) })); }}
                                              className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 text-gray-400"
                                              disabled={variantQty <= (variant.minUnit || 1)}
                                            >
                                              <Minus className="w-2.5 h-2.5" />
                                            </button>
                                            <input
                                              type="number"
                                              value={variantQty}
                                              onChange={e => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(variant.minUnit || 1, parseInt(e.target.value) || variant.minUnit || 1) })); }}
                                              onClick={e => e.stopPropagation()}
                                              className="w-8 h-7 text-center text-xs font-bold border-x border-gray-200 bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              min={variant.minUnit || 1}
                                              step={variant.stepSize || 1}
                                            />
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: variantQty + (variant.stepSize || 1) })); }}
                                              className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 text-gray-400"
                                            >
                                              <Plus className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                          <button
                                            className="h-7 px-2.5 rounded-md bg-[#FF6E23] hover:bg-[#E55E13] text-white transition-all font-bold text-[10px] flex items-center gap-1"
                                            onClick={(e) => { e.stopPropagation(); addGroupedVariantToCart(variant, product.genericName); }}
                                          >
                                            <ShoppingCart className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Mobile: stacked two-row layout */}
                                      <div className="sm:hidden space-y-2">
                                        {/* Row 1: Format name + price */}
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-gray-800">{variant.format}</span>
                                          {variant.price && variant.price > 0 ? (
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(variant.price)}</span>
                                          ) : (
                                            <span className="text-[10px] text-gray-400">Sin precio</span>
                                          )}
                                        </div>
                                        {/* Row 2: Qty controls + cart button */}
                                        <div className="flex items-center justify-end gap-1.5">
                                          <div className="inline-flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(variant.minUnit || 1, variantQty - (variant.stepSize || 1)) })); }}
                                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-400"
                                              disabled={variantQty <= (variant.minUnit || 1)}
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>
                                            <input
                                              type="number"
                                              value={variantQty}
                                              onChange={e => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: Math.max(variant.minUnit || 1, parseInt(e.target.value) || variant.minUnit || 1) })); }}
                                              onClick={e => e.stopPropagation()}
                                              className="w-10 h-8 text-center text-sm font-bold border-x border-gray-200 bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                              min={variant.minUnit || 1}
                                              step={variant.stepSize || 1}
                                            />
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setQuantities(prev => ({ ...prev, [variant.sku]: variantQty + (variant.stepSize || 1) })); }}
                                              className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-400"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <button
                                            className="h-8 px-3 rounded-md bg-[#FF6E23] hover:bg-[#E55E13] text-white transition-all font-bold text-xs flex items-center gap-1.5"
                                            onClick={(e) => { e.stopPropagation(); addGroupedVariantToCart(variant, product.genericName); }}
                                          >
                                            <ShoppingCart className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {variant.price && variant.price > 0 && variantQty > 1 && (
                                        <div className="text-[10px] text-[#FF6E23] font-semibold mt-1 text-right">
                                          Total: {formatPrice(variant.price * variantQty)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
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
    </>
  );
}