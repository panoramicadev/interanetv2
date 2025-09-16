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
  X
} from "lucide-react";
import { Link } from "wouter";

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
  codigo: string;
  producto: string;
  categoria?: string;
  unidad?: string;
  canalDigital?: number;
  imagenUrl?: string;
  descripcion?: string;
  activo: boolean;
  orden?: number;
}

const formatPrice = (price: number | null | undefined): string => {
  if (!price || price === 0) return "";
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)}`;
};

export default function TiendaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [cartCount] = useState(0);

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
      product.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.categoria === selectedCategory;
    
    return matchesSearch && matchesCategory && product.activo;
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
            <div className="text-orange-600 font-medium">
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
                  className="pl-12 pr-4 py-3 text-base rounded-full border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  data-testid="input-search-tienda"
                />
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-4">
              {/* Cart */}
              <Button 
                variant="ghost" 
                className="relative p-2 hover:bg-orange-50"
                data-testid="button-cart"
              >
                <ShoppingCart className="h-6 w-6 text-gray-700" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center p-0">
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
        <nav className={`bg-orange-600 ${showMobileMenu ? 'block' : 'hidden'} md:block`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:space-x-8 py-3">
              {navigationItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-white hover:text-orange-100 px-3 py-2 text-sm font-medium transition-colors duration-200"
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
                  <Badge className="bg-white text-orange-600 px-4 py-2 text-sm font-bold mb-4">
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
                    className="bg-white text-orange-600 hover:bg-gray-100 px-8 py-3 rounded-full font-semibold text-lg"
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
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
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
                  data-testid={`card-product-${product.codigo}`}
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
                      {product.imagenUrl ? (
                        <img 
                          src={product.imagenUrl}
                          alt={product.producto}
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
                        {product.producto}
                      </h3>
                      
                      {/* Product SKU */}
                      <p className="text-gray-400 text-xs mb-3 font-mono tracking-wide">{product.codigo}</p>


                      {/* Price */}
                      <div className="mb-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatPrice(product.canalDigital)}
                          <span className="text-sm text-gray-500 font-normal">
                            {product.unidad || 'Unidad'}
                          </span>
                        </div>
                        {isOffer && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatPrice((product.canalDigital || 0) * 1.2)}
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="mt-auto">
                        <Button 
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(product);
                          }}
                          data-testid={`button-select-${product.codigo}`}
                        >
                          {index === 0 ? "Seleccionar" : "Agregar al Carrito"}
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
                  {selectedProduct.producto}
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Product Image */}
                <div className="space-y-4">
                  <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
                    {selectedProduct.imagenUrl ? (
                      <img 
                        src={selectedProduct.imagenUrl}
                        alt={selectedProduct.producto}
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
                  <div className="bg-orange-50 rounded-lg p-6">
                    <h4 className="font-semibold mb-2 text-gray-700">Precio</h4>
                    <div className="text-3xl font-bold text-orange-600">
                      {formatPrice(selectedProduct.canalDigital)}
                      <span className="text-lg text-gray-500 font-normal">
                        /{selectedProduct.unidad || 'Unidad'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedProduct.descripcion && (
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-700">Descripción</h4>
                      <p className="text-gray-600">{selectedProduct.descripcion}</p>
                    </div>
                  )}

                  {/* Product Details */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Código</h4>
                      <p className="text-gray-600 font-mono text-sm">{selectedProduct.codigo}</p>
                    </div>
                    
                    {selectedProduct.categoria && (
                      <div>
                        <h4 className="font-semibold mb-1 text-gray-700">Categoría</h4>
                        <p className="text-gray-600">{selectedProduct.categoria}</p>
                      </div>
                    )}
                    
                    {selectedProduct.unidad && (
                      <div>
                        <h4 className="font-semibold mb-1 text-gray-700">Presentación</h4>
                        <p className="text-gray-600">{selectedProduct.unidad}</p>
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
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3"
                      data-testid="button-add-cart-dialog"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Agregar al Carrito
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 border-orange-600 text-orange-600 hover:bg-orange-50 py-3"
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