import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  LayoutDashboard
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
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  
  // Variant selection state
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [selectedVariantGroup, setSelectedVariantGroup] = useState<ProductGroup | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<StoreProduct | null>(null);
  
  // Banner carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  const banners = [
    { src: bannerCopper, alt: "Oferta del Mes - Esmalte Copper" },
    { src: bannerStain, alt: "Oferta del Mes - Stain Impregnante" },
    { src: bannerDespacho, alt: "Despacho Gratis - 3% OFF" }
  ];
  
  // Cart state management
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showFloatingCart, setShowFloatingCart] = useState(false);
  const { toast } = useToast();
  const { addItem } = useCart();
  
  // Carousel auto-rotation effect
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % banners.length);
      }, 4000); // 4 seconds
      return () => clearInterval(interval);
    }
  }, [isHovered, banners.length]);

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

  // Handle add to cart click - check if product has variants
  const handleAddToCartClick = (product: StoreProduct) => {
    // Check if this product belongs to a group
    if (product.groupId) {
      const group = productGroups.find(g => g.id === product.groupId);
      if (group && group.productos.length > 1) {
        // Show variant selection dialog
        setSelectedVariantGroup(group);
        setSelectedVariant(product); // Pre-select the clicked product
        setShowVariantDialog(true);
        return;
      }
    }
    
    // No variants, add directly to cart
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

  // Fetch store products
  const { data: products = [], isLoading: productsLoading } = useQuery<StoreProduct[]>({
    queryKey: ['/api/store/products', searchTerm, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory && selectedCategory !== 'all') params.append('categoria', selectedCategory);
      params.append('limit', '100');
      
      const url = `/api/store/products${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    retry: false,
  });

  // Fetch store categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/store/categories'],
    retry: false,
  });

  // Fetch product groups
  const { data: productGroups = [] } = useQuery<ProductGroup[]>({
    queryKey: ['/api/store/groups'],
    retry: false,
  });

  // Get active hero banner
  const heroBanner = storeBanners.find(b => b.activo && b.titulo.includes("OFERTA"));

  // Filter products (ungrouped products only)
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !searchTerm || 
      getProductName(product).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProductCode(product).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || getProductCategory(product) === selectedCategory;
    
    return matchesSearch && matchesCategory && isProductActive(product);
  });
  
  // Filter product groups
  const filteredGroups = productGroups.filter((group) => {
    const matchesSearch = !searchTerm || 
      group.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.productos.some(p => 
        getProductName(p).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getProductCode(p).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesCategory = selectedCategory === "all" || group.categoria === selectedCategory;
    
    return matchesSearch && matchesCategory && group.activo;
  });
  
  // Combine products and groups into a single displayable array
  const allDisplayItems = [
    ...filteredProducts.map(p => ({ type: 'product' as const, item: p })),
    ...filteredGroups.map(g => ({ type: 'group' as const, item: g }))
  ];

  const openProductDetail = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowProductDialog(true);
  };

  const navigationItems = [
    { name: "Contacto", href: "#contacto" },
  ];

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top bar with contact info */}
          <div className="hidden md:flex items-center justify-between py-2 text-sm text-gray-600 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                <span>{storeConfig?.phone || "+56 2 2345 6789"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span>{storeConfig?.email || "contacto@panoramica.cl"}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{storeConfig?.address || "Santiago, Chile"}</span>
              </div>
            </div>
            <div className="text-[#FF6E23] font-medium">
              ¡Envío gratis en compras sobre $250.000!
            </div>
          </div>

          {/* Main header */}
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <Link href="/tienda">
              <div className="flex items-center cursor-pointer">
                <img 
                  src={storeConfig?.logoUrl || "/panoramica-logo.png"} 
                  alt="Panorámica"
                  className="h-12 md:h-16 w-auto"
                />
              </div>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="¿Qué estás buscando?"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 text-base rounded-full border-2 border-gray-200 focus:border-[#FF6E23] focus:ring-[#FF6E23]"
                  data-testid="input-search-tienda"
                />
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-4">
              {/* User Menu */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg"
                      data-testid="button-user-menu"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#FF6E23] rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <span className="hidden md:block text-sm font-medium text-gray-700">
                          {user.firstName || user.email}
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.firstName || user.email}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/" className="flex items-center cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Ir al Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Cart */}
              <CartToggle onClick={() => setShowFloatingCart(true)} />

              {/* Mobile menu toggle */}
              <Button
                variant="ghost"
                className="md:hidden p-2"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                data-testid="button-mobile-menu"
              >
                {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 rounded-lg"
                data-testid="input-search-mobile"
              />
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <nav className={`bg-black ${showMobileMenu ? 'block' : 'hidden'} md:block`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center py-3">
              {/* Left Section - Main categories with icons */}
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                {/* Categories Dropdown */}
                <div className="relative group">
                  <button 
                    className="flex items-center text-white hover:text-white/80 px-2 py-1 text-sm font-bold uppercase transition-colors duration-200"
                    onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                    onMouseEnter={() => setShowCategoriesDropdown(true)}
                    data-testid="button-nav-categories"
                    aria-expanded={showCategoriesDropdown}
                    aria-haspopup="true"
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    CATEGORÍAS
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${showCategoriesDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {/* Dropdown menu - works on both hover (desktop) and click (mobile) */}
                  <div 
                    className={`absolute left-0 mt-1 w-64 bg-white rounded-md shadow-lg z-50 transition-all duration-200 ${showCategoriesDropdown ? 'opacity-100 visible' : 'opacity-0 invisible'} md:group-hover:opacity-100 md:group-hover:visible`}
                    onMouseLeave={() => setShowCategoriesDropdown(false)}
                  >
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setSelectedCategory('all');
                          setShowCategoriesDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Todas las categorías
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category}
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowCategoriesDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recommended Products */}
                <a
                  href="#productos"
                  className="flex items-center text-white hover:text-white/80 px-2 py-1 text-sm font-bold uppercase transition-colors duration-200 whitespace-nowrap"
                  data-testid="link-nav-recomendados"
                >
                  <Award className="h-4 w-4 mr-2" />
                  RECOMENDADOS
                </a>

                {/* Special Offers */}
                <a
                  href="#ofertas"
                  className="flex items-center text-white hover:text-white/80 px-2 py-1 text-sm font-bold uppercase transition-colors duration-200 whitespace-nowrap"
                  data-testid="link-nav-ofertas"
                >
                  <Percent className="h-4 w-4 mr-2" />
                  OFERTAS
                </a>
              </div>

              {/* Right Section - Existing navigation items */}
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mt-3 md:mt-0">
                {navigationItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-white hover:text-white/80 px-2 py-1 text-sm font-bold uppercase transition-colors duration-200 whitespace-nowrap"
                    data-testid={`link-nav-${item.name.toLowerCase()}`}
                  >
                    {item.name.toUpperCase()}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </nav>

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
        
        {/* Navigation dots */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 hover:scale-110 ${
                index === currentSlide ? 'bg-white shadow-lg' : 'bg-white/60 hover:bg-white/80'
              }`}
              data-testid={`banner-dot-${index}`}
              aria-label={`Ir a slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Hero Banner - Hidden when static banner is present */}
      {false && heroBanner && (
        <section 
          className="relative py-12 md:py-20 overflow-hidden"
          style={{ 
            backgroundColor: heroBanner?.colorFondo,
            color: heroBanner?.colorTexto 
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Content */}
              <div className="text-center lg:text-left">
                <div className="mb-4">
                  <Badge className="bg-white text-[#FF6E23] px-4 py-2 text-sm font-bold mb-4">
                    {heroBanner?.titulo}
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                  {heroBanner?.subtitulo || "STAIN"}
                </h1>
                <p className="text-lg md:text-xl mb-6 opacity-90">
                  {heroBanner?.descripcion || "IMPERMEANTE DE MADERA"}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start">
                  <div className="text-center">
                    <div className="text-sm opacity-80">Desde</div>
                    <div className="text-3xl md:text-4xl font-bold">$12.990</div>
                  </div>
                  <Button 
                    className="bg-white text-[#FF6E23] hover:bg-gray-100 px-8 py-3 rounded-full font-semibold text-lg"
                    data-testid="button-ver-ofertas"
                  >
                    Ver Ofertas
                  </Button>
                </div>
              </div>

              {/* Image placeholder */}
              <div className="relative">
                <div className="aspect-square bg-white/10 rounded-2xl flex items-center justify-center">
                  {heroBanner?.imagenDesktop ? (
                    <img 
                      src={heroBanner?.imagenDesktop}
                      alt={heroBanner?.subtitulo || "Producto destacado"}
                      className="max-w-full max-h-full object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="text-center text-white/60">
                      <ImageIcon className="h-16 w-16 mx-auto mb-2" />
                      <p>Imagen del producto</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      {/* Filters Section */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Nuestros Productos
              </h2>
              <Badge variant="secondary" className="bg-[#FF6E23]/10 text-[#FF6E23]">
                {allDisplayItems.length} productos
              </Badge>
            </div>
            
            {/* Category Filter */}
            <div className="flex items-center gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px] border-gray-300" data-testid="select-category-tienda">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>
      {/* Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {productsLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500 mb-4">Cargando productos...</div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-0">
                    <div className="h-48 bg-gray-200"></div>
                    <div className="p-6 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allDisplayItems.map((displayItem, index) => {
              const isNew = index < 3; // Mark first 3 as "New"
              const isOffer = index === 0; // First product as special offer
              
              // Handle both products and groups
              if (displayItem.type === 'group') {
                const group = displayItem.item;
                const mainVariant = group.productos.find(p => p.isMainVariant) || group.productos[0];
                if (!mainVariant) return null;
                
                return (
                  <Card 
                    key={`group-${group.id}`}
                    className="relative bg-white hover:shadow-xl transition-all duration-300 overflow-hidden border-gray-200 h-full flex flex-col group cursor-pointer"
                    onClick={() => {
                      setSelectedVariantGroup(group);
                      setSelectedVariant(mainVariant);
                      setShowVariantDialog(true);
                    }}
                    data-testid={`card-group-${group.id}`}
                  >
                    {/* Badges */}
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                      <Badge className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {group.productos.length} Variantes
                      </Badge>
                      {isNew && (
                        <Badge className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          Nuevo
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-0 flex flex-col h-full">
                      {/* Product Image */}
                      <div className="h-48 bg-gray-100 flex items-center justify-center border-b relative overflow-hidden">
                        {getProductImageUrl(mainVariant) ? (
                          <img 
                            src={getProductImageUrl(mainVariant)}
                            alt={group.nombre}
                            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-center text-gray-400">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-xs">Sin imagen</p>
                          </div>
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="bg-white text-gray-900 shadow-lg"
                          >
                            Seleccionar Variante
                          </Button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex flex-col flex-grow">
                        {/* Product Name */}
                        <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight line-clamp-2">
                          {group.nombre}
                        </h3>
                        
                        {/* Group Description */}
                        {group.descripcion && (
                          <p className="text-gray-500 text-sm mb-3">{group.descripcion}</p>
                        )}

                        {/* Price Range */}
                        <div className="mb-4">
                          <div className="text-xl font-bold text-gray-900">
                            Desde {formatPrice(getProductPrice(mainVariant))}
                          </div>
                          
                          {/* Available Variants */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {group.productos.slice(0, 4).map(variant => (
                              <Badge key={variant.id} variant="outline" className="text-xs">
                                {variant.variantLabel}
                              </Badge>
                            ))}
                            {group.productos.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{group.productos.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Select Variant Button */}
                        <Button
                          className="w-full mt-auto bg-[#FF6E23] hover:bg-[#E55E13] text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVariantGroup(group);
                            setSelectedVariant(mainVariant);
                            setShowVariantDialog(true);
                          }}
                          data-testid={`button-select-variant-${group.id}`}
                        >
                          Seleccionar Variante
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              
              // Original product card
              const product = displayItem.item;
              return (
                <Card 
                  key={product.id} 
                  className="relative bg-white hover:shadow-xl transition-all duration-300 overflow-hidden border-gray-200 h-full flex flex-col group cursor-pointer"
                  onClick={() => openProductDetail(product)}
                  data-testid={`card-product-${getProductCode(product)}`}
                >
                  {/* Badges */}
                  <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    {isNew && (
                      <Badge className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Nuevo
                      </Badge>
                    )}
                    {isOffer && (
                      <Badge className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Oferta
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Product Image */}
                    <div className="h-48 bg-gray-100 flex items-center justify-center border-b relative overflow-hidden">
                      {getProductImageUrl(product) ? (
                        <img 
                          src={getProductImageUrl(product)}
                          alt={getProductName(product)}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center text-gray-400">
                          <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-xs">Sin imagen</p>
                        </div>
                      )}
                      
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          className="bg-white text-gray-900 shadow-lg"
                        >
                          Ver detalles
                        </Button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-grow">
                      {/* Product Name */}
                      <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight line-clamp-2">
                        {getProductName(product)}
                      </h3>
                      
                      {/* Product SKU */}
                      <p className="text-gray-400 text-xs mb-3 font-mono tracking-wide">{getProductCode(product)}</p>


                      {/* Price */}
                      <div className="mb-4">
                        <div className="text-xl font-bold text-gray-900">
                          {formatPrice(getProductPrice(product))}
                          <Badge variant="secondary" className="ml-2 text-xs bg-gray-100 text-gray-600 font-normal px-2 py-1">
                            {getProductUnit(product) || 'Unidad'}
                          </Badge>
                        </div>
                        {isOffer && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatPrice(getProductPrice(product) * 1.2)}
                          </div>
                        )}
                        
                        {/* Total Price Display */}
                        <div className="text-lg font-semibold text-[#FF6E23] mt-1">
                          Total: {formatPrice(calculateTotalPrice(getProductPrice(product), getProductQuantity(product.id, getProductUnit(product))))}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="mt-auto space-y-3">
                        {/* Minimum quantity label */}
                        <div className="text-xs text-gray-500 text-center">
                          {getQuantityLabel(getProductUnit(product))}
                        </div>
                        
                        {/* Quantity Stepper */}
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-gray-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              decrementQuantity(product.id, getProductUnit(product));
                            }}
                            disabled={getProductQuantity(product.id, getProductUnit(product)) <= getMinimumQuantity(getProductUnit(product))}
                            data-testid={`button-decrement-${getProductCode(product)}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          
                          <div className="min-w-[3rem] text-center font-semibold text-lg">
                            {getProductQuantity(product.id, getProductUnit(product))}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-gray-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              incrementQuantity(product.id, getProductUnit(product));
                            }}
                            data-testid={`button-increment-${getProductCode(product)}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Add to Cart Button */}
                        <Button 
                          className="w-full bg-[#FF6E23] hover:bg-[#FF6E23]/90 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCartClick(product);
                          }}
                          data-testid={`button-add-cart-${getProductCode(product)}`}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Agregar al Carrito
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* No Products Found */}
        {!productsLoading && filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
    </>
  );
}