import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, LogIn, Package2, ImageIcon, ChevronDown } from "lucide-react";
import { Link } from "wouter";

interface ShopProduct {
  id: string;
  sku: string;
  name: string;
  category?: string;
  packagingUnitName?: string;
  packagingUnit?: string;
  pricePerUnit?: string;
  variantFeaturesValue?: string;
  active: boolean;
}

const formatPrice = (price: string | null | undefined): string => {
  if (!price || price === "0") return "";
  const numPrice = parseFloat(price);
  return `$${new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice)}`;
};

const getPackagingUnit = (packagingUnitName?: string): string => {
  if (!packagingUnitName) return "/Unidad";
  if (packagingUnitName.toLowerCase().includes("galon")) return "/Galón";
  if (packagingUnitName.toLowerCase().includes("litro")) return "/Litro";
  return `/${packagingUnitName}`;
};

export default function ShopPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Fetch public products (always available)
  const { data: products = [], isLoading: productsLoading } = useQuery<ShopProduct[]>({
    queryKey: ['/api/public/products'],
    retry: false,
  });

  // Fetch prices only if authenticated
  const { data: prices = {}, isLoading: pricesLoading } = useQuery<Record<string, string>>({
    queryKey: ['/api/products/prices'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Get unique categories
  const categories = Array.from(new Set(products.map((p: ShopProduct) => p.category).filter(Boolean))) as string[];

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory && product.active;
  });

  const openProductDetail = (product: ShopProduct) => {
    setSelectedProduct(product);
    setShowProductDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Package2 className="h-8 w-8 text-orange-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                Pinturas Panorámica
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {!authLoading && (
                <>
                  {isAuthenticated ? (
                    <Link href="/dashboard">
                      <Button variant="outline" size="sm">
                        Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                        <LogIn className="h-4 w-4 mr-2" />
                        Iniciar Sesión
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300"
                  data-testid="input-search-shop"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px] border-gray-300" data-testid="select-category">
                <SelectValue placeholder="Categoría" />
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

      {/* Authentication Notice */}
      {!authLoading && !isAuthenticated && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-900">
                    Inicia sesión para ver precios
                  </h3>
                  <p className="text-sm text-orange-700">
                    Puedes ver nuestros productos, pero necesitas una cuenta para ver precios y hacer pedidos.
                  </p>
                </div>
              </div>
              <Link href="/login">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Iniciar Sesión
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {productsLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-500">Cargando productos...</div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product, index) => {
              const productPrice = prices[product.sku];
              const isNew = index < 3; // Marcar los primeros 3 como "Nuevo"
              
              return (
                <Card 
                  key={product.id} 
                  className="relative bg-white hover:shadow-lg transition-all duration-200 overflow-hidden border-gray-200 h-full flex flex-col"
                  data-testid={`card-product-${product.sku}`}
                >
                  {/* Etiqueta Nuevo */}
                  {isNew && (
                    <div className="absolute top-4 left-4 z-10">
                      <Badge className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                        Nuevo
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Image Placeholder */}
                    <div className="h-48 bg-gray-100 flex items-center justify-center border-b">
                      <div className="text-center text-gray-400">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-xs">Cargando imagen</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-grow">
                      {/* Top Content - Flexible */}
                      <div className="flex-grow">
                        {/* Product Name */}
                        <h3 className="font-bold text-lg text-gray-900 mb-1 leading-tight">
                          {product.name}
                        </h3>
                        
                        {/* Brand */}
                        <p className="text-gray-500 text-sm mb-4">Pinturas Panorámica</p>

                        {/* Price */}
                        <div className="mb-4">
                          {isAuthenticated ? (
                            <div className="text-2xl font-bold text-gray-900">
                              {formatPrice(productPrice)}
                              <span className="text-sm text-gray-500 font-normal">
                                {getPackagingUnit(product.packagingUnitName)}
                              </span>
                            </div>
                          ) : (
                            <div className="text-lg font-medium text-gray-400">
                              Inicia sesión para ver precio
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Content - Always aligned */}
                      <div className="mt-auto space-y-4">
                        {/* Packaging Dropdown */}
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Packaging</label>
                          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                            <span className="text-sm text-gray-700">
                              {product.packagingUnitName || 'Unidad'}
                            </span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>

                        {/* Action Button */}
                        <div>
                          {isAuthenticated ? (
                            <Button 
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg"
                              onClick={() => openProductDetail(product)}
                              disabled={!productPrice}
                            >
                              {index === 0 ? "Seleccionar" : "Agregar"}
                            </Button>
                          ) : (
                            <Link href="/login">
                              <Button 
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg"
                              >
                                Ver Precio
                              </Button>
                            </Link>
                          )}
                        </div>
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
            <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
            <p className="text-gray-500">
              Intenta cambiar los filtros de búsqueda o la categoría seleccionada.
            </p>
          </div>
        )}
      </div>

      {/* Product Detail Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl mb-4">
                  {selectedProduct.name}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Product Image Placeholder */}
                <div className="h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                  <div className="text-center text-gray-400">
                    <ImageIcon className="h-16 w-16 mx-auto mb-2" />
                    <p>Cargando imagen del producto</p>
                  </div>
                </div>

                {/* Price */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold mb-2 text-gray-700">Precio</h4>
                  {isAuthenticated ? (
                    <div className="text-3xl font-bold text-gray-900">
                      {formatPrice(prices[selectedProduct.sku])}
                      <span className="text-lg text-gray-500 font-normal">
                        {getPackagingUnit(selectedProduct.packagingUnitName)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-lg text-gray-500">
                      Inicia sesión para ver el precio de este producto
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-1 text-gray-700">SKU</h4>
                    <p className="text-gray-600 font-mono text-sm">{selectedProduct.sku}</p>
                  </div>
                  
                  {selectedProduct.category && (
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Categoría</h4>
                      <p className="text-gray-600">{selectedProduct.category}</p>
                    </div>
                  )}
                  
                  {selectedProduct.packagingUnitName && (
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Presentación</h4>
                      <p className="text-gray-600">{selectedProduct.packagingUnitName}</p>
                    </div>
                  )}

                  {selectedProduct.variantFeaturesValue && (
                    <div>
                      <h4 className="font-semibold mb-1 text-gray-700">Variante</h4>
                      <p className="text-gray-600">{selectedProduct.variantFeaturesValue}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isAuthenticated && (
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-orange-900 mb-1">
                          ¿Quieres hacer un pedido?
                        </h4>
                        <p className="text-sm text-orange-700">
                          Inicia sesión para ver precios y realizar pedidos
                        </p>
                      </div>
                      <Link href="/login">
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                          Iniciar Sesión
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}