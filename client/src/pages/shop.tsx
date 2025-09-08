import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, ShoppingCart, Eye, LogIn, Package } from "lucide-react";
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
  if (!price || price === "0") return "Precio no disponible";
  const numPrice = parseFloat(price);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numPrice);
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
  const categories = Array.from(new Set(products.map((p: ShopProduct) => p.category).filter(Boolean)));

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tienda Panorámica
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {!authLoading && (
                <>
                  {isAuthenticated ? (
                    <Link href="/dashboard">
                      <Button variant="outline">
                        Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/api/login">
                      <Button className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-shop"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]" data-testid="select-category">
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
          </CardContent>
        </Card>

        {/* Authentication Notice */}
        {!authLoading && !isAuthenticated && (
          <Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogIn className="h-5 w-5 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      Inicia sesión para ver precios
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-200">
                      Puedes ver nuestros productos, pero necesitas una cuenta para ver precios y hacer pedidos.
                    </p>
                  </div>
                </div>
                <Link href="/api/login">
                  <Button>
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {productsLoading ? (
          <div className="text-center py-12">
            <div className="animate-pulse">Cargando productos...</div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const productPrice = prices[product.sku];
              
              return (
                <Card 
                  key={product.id} 
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  onClick={() => openProductDetail(product)}
                  data-testid={`card-product-${product.sku}`}
                >
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {/* SKU Badge */}
                      <div className="flex justify-between items-start">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {product.sku}
                        </Badge>
                        {product.variantFeaturesValue && (
                          <Badge variant="outline" className="text-xs">
                            {product.variantFeaturesValue}
                          </Badge>
                        )}
                      </div>

                      {/* Product Name */}
                      <h3 className="font-semibold text-lg leading-tight group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* Category */}
                      {product.category && (
                        <p className="text-sm text-muted-foreground">
                          {product.category}
                        </p>
                      )}

                      {/* Packaging */}
                      {product.packagingUnitName && (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {product.packagingUnitName}
                          </span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="pt-2 border-t">
                        {isAuthenticated ? (
                          <div className="text-xl font-bold text-green-600">
                            {formatPrice(productPrice)}
                          </div>
                        ) : (
                          <div className="text-lg font-medium text-muted-foreground">
                            Inicia sesión para ver precio
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          className="w-full group-hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(product);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
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
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron productos</h3>
              <p className="text-muted-foreground">
                Intenta cambiar los filtros de búsqueda o la categoría seleccionada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Detail Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-xl mb-2">
                      {selectedProduct.name}
                    </DialogTitle>
                    <div className="flex gap-2 mb-4">
                      <Badge variant="secondary" className="font-mono">
                        SKU: {selectedProduct.sku}
                      </Badge>
                      {selectedProduct.variantFeaturesValue && (
                        <Badge variant="outline">
                          {selectedProduct.variantFeaturesValue}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Price */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Precio</h4>
                  {isAuthenticated ? (
                    <div className="text-2xl font-bold text-green-600">
                      {formatPrice(prices[selectedProduct.sku])}
                    </div>
                  ) : (
                    <div className="text-lg text-muted-foreground">
                      Inicia sesión para ver el precio de este producto
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedProduct.category && (
                    <div>
                      <h4 className="font-semibold mb-1">Categoría</h4>
                      <p className="text-muted-foreground">{selectedProduct.category}</p>
                    </div>
                  )}
                  
                  {selectedProduct.packagingUnitName && (
                    <div>
                      <h4 className="font-semibold mb-1">Presentación</h4>
                      <p className="text-muted-foreground">{selectedProduct.packagingUnitName}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isAuthenticated && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                          ¿Quieres hacer un pedido?
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-200">
                          Inicia sesión para ver precios y realizar pedidos
                        </p>
                      </div>
                      <Link href="/api/login">
                        <Button>
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