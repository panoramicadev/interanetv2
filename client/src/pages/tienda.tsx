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
  Check
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

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
  ecomPrice?: string; // Price field from API (string format)
  primaryImageUrl?: string; // Primary image URL from API
  description?: string;
  active: boolean;
  slug?: string;
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

// Cart item interface
interface CartItem {
  productId: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  totalPrice: number;
  imageUrl?: string;
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
  // Priority: ecomPrice -> canalDigital -> 0
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
  if (/BD\s*[-\s]?\s*[45]|BALDE\s*[45]?|\bBD[45]\b/i.test(unit)) {
    return 1;
  }
  
  // GL (Galones) - multiples of 4 - Use precise word boundary matching
  if (/\bGL\b|\bGAL[ÓO]N/i.test(unit)) {
    return 4;
  }
  
  // 1/4 (1/4 de Galón) - multiples of 6 - Precise fraction matching
  if (/1\s*\/\s*4|\bCUARTO\b/i.test(unit)) {
    return 6;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Cart state management
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  
  // Calculate cart count from cart items
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

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

  // Add to cart functionality
  const addToCart = (product: StoreProduct) => {
    const productCode = getProductCode(product);
    const productName = getProductName(product);
    const unitPrice = getProductPrice(product);
    const unit = getProductUnit(product) || 'Unidad';
    const quantity = getProductQuantity(product.id, getProductUnit(product));
    
    // Validation
    if (unitPrice === 0) {
      toast({
        title: "Error",
        description: "Producto sin precio disponible",
        variant: "destructive"
      });
      return;
    }
    
    if (quantity === 0) {
      toast({
        title: "Error", 
        description: "Cantidad no válida",
        variant: "destructive"
      });
      return;
    }
    
    // Check if item already exists in cart
    const existingItemIndex = cartItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...cartItems];
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        totalPrice: unitPrice * newQuantity
      };
      
      setCartItems(updatedItems);
      
      toast({
        title: "Producto actualizado",
        description: `${productName} - Cantidad: ${newQuantity}`,
        action: <Check className="h-4 w-4" />
      });
    } else {
      // Add new item to cart
      const newCartItem: CartItem = {
        productId: product.id,
        productCode,
        productName,
        unitPrice,
        quantity,
        unit,
        totalPrice: unitPrice * quantity,
        imageUrl: getProductImageUrl(product)
      };
      
      setCartItems(prev => [...prev, newCartItem]);
      
      toast({
        title: "Producto agregado al carrito",
        description: `${productName} - Cantidad: ${quantity}`,
        action: <Check className="h-4 w-4" />
      });
    }
    
    // Reset quantity for this product
    setQuantities(prev => ({
      ...prev,
      [product.id]: getMinimumQuantity(getProductUnit(product))
    }));
  };

  // Fetch store configuration
  const { data: storeConfig } = useQuery<StoreConfig>({
    queryKey: ['/api/store/config'],
    retry: false,
  });

  // Fetch store banners
  const { data: banners = [] } = useQuery<StoreBanner[]>({
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

  // Get active hero banner
  const heroBanner = banners.find(b => b.activo && b.titulo.includes("OFERTA"));

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !searchTerm || 
      getProductName(product).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProductCode(product).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || getProductCategory(product) === selectedCategory;
    
    return matchesSearch && matchesCategory && isProductActive(product);
  });

  const openProductDetail = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowProductDialog(true);
  };

  const navigationItems = [
    { name: "Experiencia/Especialidad", href: "#experiencia" },
    { name: "Recomendación", href: "#recomendacion" },
    { name: "Ofertas", href: "#ofertas" },
    { name: "Productos", href: "#productos" },
    { name: "Contacto", href: "#contacto" },
  ];

  return (
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
            <div className="text-[#FF8401] font-medium">
              ¡Envío gratis en compras sobre $50.000!
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
                  className="pl-12 pr-4 py-3 text-base rounded-full border-2 border-gray-200 focus:border-[#FF8401] focus:ring-[#FF8401]"
                  data-testid="input-search-tienda"
                />
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-4">
              {/* Cart */}
              <Button 
                variant="ghost" 
                className="relative p-2 hover:bg-[#FF8401]/10"
                data-testid="button-cart"
              >
                <ShoppingCart className="h-6 w-6 text-gray-700" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-[#FF8401] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center p-0">
                    {cartCount}
                  </Badge>
                )}
              </Button>

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
        <nav className={`bg-[#FF8401] ${showMobileMenu ? 'block' : 'hidden'} md:block`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-[#000000]">
            <div className="flex flex-col md:flex-row md:space-x-8 py-3">
              {navigationItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-white hover:text-white/80 px-3 py-2 text-sm font-medium transition-colors duration-200 pl-[12px] pr-[12px] pt-[0px] pb-[0px]"
                  data-testid={`link-nav-${item.name.toLowerCase()}`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        </nav>
      </header>
      {/* Hero Banner */}
      {heroBanner && (
        <section 
          className="relative py-12 md:py-20 overflow-hidden"
          style={{ 
            backgroundColor: heroBanner.colorFondo,
            color: heroBanner.colorTexto 
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Content */}
              <div className="text-center lg:text-left">
                <div className="mb-4">
                  <Badge className="bg-white text-[#FF8401] px-4 py-2 text-sm font-bold mb-4">
                    {heroBanner.titulo}
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                  {heroBanner.subtitulo || "STAIN"}
                </h1>
                <p className="text-lg md:text-xl mb-6 opacity-90">
                  {heroBanner.descripcion || "IMPERMEANTE DE MADERA"}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start">
                  <div className="text-center">
                    <div className="text-sm opacity-80">Desde</div>
                    <div className="text-3xl md:text-4xl font-bold">$12.990</div>
                  </div>
                  <Button 
                    className="bg-white text-[#FF8401] hover:bg-gray-100 px-8 py-3 rounded-full font-semibold text-lg"
                    data-testid="button-ver-ofertas"
                  >
                    Ver Ofertas
                  </Button>
                </div>
              </div>

              {/* Image placeholder */}
              <div className="relative">
                <div className="aspect-square bg-white/10 rounded-2xl flex items-center justify-center">
                  {heroBanner.imagenDesktop ? (
                    <img 
                      src={heroBanner.imagenDesktop}
                      alt={heroBanner.subtitulo || "Producto destacado"}
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
              <Badge variant="secondary" className="bg-[#FF8401]/10 text-[#FF8401]">
                {filteredProducts.length} productos
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
            {filteredProducts.map((product, index) => {
              const isNew = index < 3; // Mark first 3 as "New"
              const isOffer = index === 0; // First product as special offer
              
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
                        <div className="text-lg font-semibold text-[#FF8401] mt-1">
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
                          className="w-full bg-[#FF8401] hover:bg-[#FF8401]/90 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
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
                  <div className="bg-[#FF8401]/5 rounded-lg p-6">
                    <h4 className="font-semibold mb-2 text-gray-700">Precio</h4>
                    <div className="text-3xl font-bold text-[#FF8401]">
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
                      className="flex-1 bg-[#FF8401] hover:bg-[#FF8401]/90 text-white py-3"
                      onClick={() => selectedProduct && addToCart(selectedProduct)}
                      data-testid="button-add-cart-dialog"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Agregar al Carrito
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-[#FF8401] text-[#FF8401] hover:bg-[#FF8401]/10 py-3"
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
  );
}