import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Upload, Package, TrendingUp, Warehouse, Edit, History, Filter, Eye, Building2, Globe, ShoppingCart, Tags, Image, Settings, Link, Palette } from "lucide-react";

interface Product {
  id: string;
  kopr: string; // Product code (primary key)
  sku: string; // Legacy compatibility
  name: string;
  unit1?: string;
  unit2?: string;
  unitRatio?: string;
  ud02pr?: string; // Secondary unit presentation
  price?: string; // Legacy price field
  pricePerUnit?: string; // Legacy price field
  packagingUnitName?: string;
  priceProduct?: number; // Regular product price
  priceOffer?: number; // Offer price
  showInStore?: boolean;
  
  // eCommerce fields
  slug?: string; // SEO-friendly URL slug
  ecomActive: boolean; // Show in eCommerce store
  ecomPrice?: number; // eCommerce-specific price
  category?: string; // Product category for eCommerce
  tags?: string[]; // Product tags for filtering/search
  images?: Array<{
    id: string;
    url: string;
    alt: string;
    primary: boolean;
    sort: number;
  }>; // Product images
  seoTitle?: string; // SEO title for product page
  seoDescription?: string; // SEO description for product page
  ogImageUrl?: string; // Open Graph image URL
  
  active: boolean;
  totalStock?: number;
  warehouses?: string[];
  createdAt: string;
  updatedAt: string;
}

interface WarehouseSummary {
  warehouseCode: string;
  warehouseName: string;
  totalProducts: number;
  totalPhysicalStock: number;
  totalAvailableStock: number;
}

interface WarehouseStock {
  productSku: string;
  productName: string;
  branchCode: string;
  physicalStock1: number;
  physicalStock2: number;
  availableStock1: number;
  availableStock2: number;
  unit1?: string;
  unit2?: string;
}

interface ImportResult {
  processedProducts: number;
  newProducts: number;
  updatedStock: number;
  errors: string[];
}

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterPrices, setFilterPrices] = useState<string>("all");
  const [filterEcomActive, setFilterEcomActive] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [newPrice, setNewPrice] = useState("");
  const [newOfferPrice, setNewOfferPrice] = useState("");
  const [showInStore, setShowInStore] = useState(false);
  const [priceReason, setPriceReason] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showEcomDialog, setShowEcomDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  
  // eCommerce form state
  const [ecomSlug, setEcomSlug] = useState("");
  const [ecomCategory, setEcomCategory] = useState("");
  const [ecomTags, setEcomTags] = useState<string[]>([]);
  const [ecomImages, setEcomImages] = useState<Array<{id: string; url: string; alt: string; primary: boolean; sort: number}>>([]); 
  const [ecomSeoTitle, setEcomSeoTitle] = useState("");
  const [ecomSeoDescription, setEcomSeoDescription] = useState("");
  const [ecomOgImage, setEcomOgImage] = useState("");
  const [ecomPriceValue, setEcomPriceValue] = useState("");
  const [ecomActiveValue, setEcomActiveValue] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");
  
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if not authenticated or not admin/supervisor
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'supervisor'))) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores y supervisores pueden acceder a esta página.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation('/');
      }, 1000);
    }
  }, [isAuthenticated, isLoading, user, toast]);

  // Fetch eCommerce products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/ecommerce/products', { search: searchTerm, active: filterActive, ecomActive: filterEcomActive, category: filterCategory }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== 'all') params.append('active', (filterActive === 'true').toString());
      if (filterEcomActive !== 'all') params.append('ecomActive', (filterEcomActive === 'true').toString());
      if (filterCategory !== 'all') params.append('category', filterCategory);
      
      const response = await apiRequest('GET', `/api/ecommerce/products?${params.toString()}`);
      return await response.json() as Product[];
    }
  });

  // Fetch eCommerce categories
  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['/api/ecommerce/categories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ecommerce/categories');
      return await response.json() as string[];
    }
  });


  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ sku, price, offerPrice, showInStore, reason }: { sku: string; price: number; offerPrice?: number; showInStore?: boolean; reason?: string }) => {
      const response = await fetch(`/api/products/${sku}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          price, 
          offerPrice, 
          showInStore, 
          reason 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update price');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowPriceDialog(false);
      setSelectedProduct(null);
      setNewPrice("");
      setNewOfferPrice("");
      setShowInStore(false);
      setPriceReason("");
      toast({
        title: "Precio actualizado",
        description: "El precio del producto se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el precio del producto.",
        variant: "destructive",
      });
    }
  });

  // Import CSV mutation
  const importMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      await apiRequest("POST", "/api/products/import-products-csv", { products: csvData });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowImportDialog(false);
      setImportFile(null);
      
      toast({
        title: "Importación completada",
        description: `Se procesaron ${data.result.processedProducts} productos. ${data.result.newProducts} nuevos productos creados.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error de importación",
        description: "No se pudo importar el archivo CSV.",
        variant: "destructive",
      });
    }
  });

  // eCommerce update mutation
  const updateEcommerceMutation = useMutation({
    mutationFn: async (data: { kopr: string; ecommerce: any }) => {
      const response = await apiRequest('PATCH', `/api/ecommerce/products/${data.kopr}`, data.ecommerce);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      setShowEcomDialog(false);
      setSelectedProduct(null);
      resetEcommerceForm();
      toast({
        title: "eCommerce actualizado",
        description: "La configuración de eCommerce se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración de eCommerce.",
        variant: "destructive",
      });
    }
  });

  // Toggle eCommerce active mutation
  const toggleEcommerceMutation = useMutation({
    mutationFn: async (kopr: string) => {
      const response = await apiRequest('PATCH', `/api/ecommerce/products/${kopr}/toggle-active`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/products'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de eCommerce se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de eCommerce.",
        variant: "destructive",
      });
    }
  });

  // Slug validation mutation
  const validateSlugMutation = useMutation({
    mutationFn: async ({ slug, excludeKopr }: { slug: string; excludeKopr?: string }) => {
      const response = await apiRequest('POST', '/api/ecommerce/products/validate-slug', { slug, excludeKopr });
      return await response.json();
    }
  });

  // Get unique categories for filter dropdown (use from backend + product categories)
  const productCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set([...categories, ...productCategories]));

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const sku = product.sku?.toLowerCase() || "";
      const name = product.name?.toLowerCase() || "";
      const kopr = product.kopr?.toLowerCase() || "";
      if (!sku.includes(searchLower) && 
          !name.includes(searchLower) &&
          !kopr.includes(searchLower)) {
        return false;
      }
    }
    
    // Active filter
    if (filterActive !== 'all') {
      if (filterActive === 'true' && !product.active) return false;
      if (filterActive === 'false' && product.active) return false;
    }
    
    // eCommerce Active filter
    if (filterEcomActive !== 'all') {
      const isEcomActive = !!product.ecomActive;
      if (filterEcomActive === 'true' && !isEcomActive) return false;
      if (filterEcomActive === 'false' && isEcomActive) return false;
    }
    
    // Category filter
    if (filterCategory !== 'all') {
      if (!product.category || product.category !== filterCategory) return false;
    }
    
    
    return true;
  });

  const handlePriceUpdate = () => {
    if (!selectedProduct || !newPrice) return;
    
    updatePriceMutation.mutate({
      sku: selectedProduct.kopr || selectedProduct.sku, // Use kopr if available, fallback to sku
      price: parseFloat(newPrice),
      offerPrice: newOfferPrice ? parseFloat(newOfferPrice) : undefined,
      showInStore: showInStore,
      reason: priceReason
    });
  };

  // Helper functions for eCommerce form
  const resetEcommerceForm = () => {
    setEcomSlug("");
    setEcomCategory("");
    setEcomTags([]);
    setEcomImages([]);
    setEcomSeoTitle("");
    setEcomSeoDescription("");
    setEcomOgImage("");
    setEcomPriceValue("");
    setEcomActiveValue(false);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const initializeEcommerceForm = (product: Product) => {
    setEcomSlug(product.slug || "");
    setEcomCategory(product.category || "");
    setEcomTags(product.tags || []);
    setEcomImages(product.images || []);
    setEcomSeoTitle(product.seoTitle || "");
    setEcomSeoDescription(product.seoDescription || "");
    setEcomOgImage(product.ogImageUrl || "");
    setEcomPriceValue(product.ecomPrice?.toString() || "");
    setEcomActiveValue(product.ecomActive || false);
  };

  const handleEcommerceUpdate = () => {
    if (!selectedProduct) return;
    
    const ecommerceData = {
      slug: ecomSlug,
      category: ecomCategory,
      tags: ecomTags,
      images: ecomImages,
      seoTitle: ecomSeoTitle,
      seoDescription: ecomSeoDescription,
      ogImageUrl: ecomOgImage,
      ecomPrice: ecomPriceValue ? parseFloat(ecomPriceValue) : undefined,
      ecomActive: ecomActiveValue
    };
    
    updateEcommerceMutation.mutate({
      kopr: selectedProduct.kopr,
      ecommerce: ecommerceData
    });
  };

  const handleToggleEcommerce = (product: Product) => {
    toggleEcommerceMutation.mutate(product.kopr);
  };

  const validateSlug = async (slug: string, excludeKopr?: string) => {
    if (!slug.trim()) return { available: false, message: 'Slug is required' };
    
    try {
      const result = await validateSlugMutation.mutateAsync({ slug, excludeKopr });
      return result;
    } catch (error) {
      return { available: false, message: 'Error validating slug' };
    }
  };

  const addImageToProduct = () => {
    if (!newImageUrl || !newImageAlt) return;
    
    const newImage = {
      id: Date.now().toString(),
      url: newImageUrl,
      alt: newImageAlt,
      primary: ecomImages.length === 0, // First image is primary by default
      sort: ecomImages.length
    };
    
    setEcomImages([...ecomImages, newImage]);
    setNewImageUrl("");
    setNewImageAlt("");
  };

  const removeImageFromProduct = (imageId: string) => {
    const updatedImages = ecomImages.filter(img => img.id !== imageId);
    // If we removed the primary image and there are other images, make the first one primary
    if (updatedImages.length > 0) {
      const hadPrimary = ecomImages.some(img => img.primary);
      const stillHasPrimary = updatedImages.some(img => img.primary);
      if (hadPrimary && !stillHasPrimary) {
        updatedImages[0].primary = true;
      }
    }
    setEcomImages(updatedImages);
  };

  const setPrimaryImage = (imageId: string) => {
    const updatedImages = ecomImages.map(img => ({
      ...img,
      primary: img.id === imageId
    }));
    setEcomImages(updatedImages);
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !ecomTags.includes(tag.trim())) {
      setEcomTags([...ecomTags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEcomTags(ecomTags.filter(tag => tag !== tagToRemove));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Funciones de separación universal de CSV (copiadas de import-modal.tsx)
  const detectSeparator = (csvText: string): string => {
    // Analyze the first line to detect separator
    const firstLine = csvText.split('\n')[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    
    const separator = semicolonCount > commaCount ? ';' : ',';
    console.log(`🔍 Separador detectado: "${separator}" (comas: ${commaCount}, punto y coma: ${semicolonCount})`);
    return separator;
  };

  const parseCSVLine = (line: string, separator: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const parseProductCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV debe tener al menos una fila de encabezados y una fila de datos');
    }

    // Auto-detect separator
    const separator = detectSeparator(csvText);
    
    const headers = parseCSVLine(lines[0], separator);
    console.log('🔍 Headers detectados:', headers);
    console.log('🔍 Total filas de datos:', lines.length - 1);
    
    const products = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator);
      
      if (values.length !== headers.length) {
        console.warn(`⚠️ Fila ${i + 1}: ${values.length} valores vs ${headers.length} headers. Saltando.`);
        continue;
      }

      const product: any = {};
      headers.forEach((header, index) => {
        product[header.trim()] = values[index]?.trim() || '';
      });

      // Validación básica - KOPR y NOKOPR son requeridos
      if (product.KOPR && product.NOKOPR) {
        products.push(product);
      }
    }

    console.log(`✅ CSV parseado: ${products.length} productos válidos`);
    return products;
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo CSV",
        variant: "destructive",
      });
      return;
    }

    try {
      const csvText = await importFile.text();
      const parsedData = parseProductCSV(csvText);
      
      if (parsedData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo CSV está vacío o no tiene datos válidos",
          variant: "destructive",
        });
        return;
      }

      // Enviar datos parseados al backend
      importMutation.mutate(parsedData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar el archivo CSV",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: string | number | null) => {
    if (!price || price === "0" || price === 0) return "Sin precio";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `$${numPrice.toLocaleString()}`;
  };

  const formatStock = (stock: number | undefined) => {
    if (stock === undefined) return "N/A";
    return stock.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Productos</h1>
          <p className="text-muted-foreground">
            Administra el catálogo de productos, precios y stock por bodega
          </p>
        </div>
        
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" data-testid="button-import-csv">
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Productos desde CSV</DialogTitle>
              <DialogDescription>
                Selecciona un archivo CSV con la estructura de stock para actualizar productos y inventario.
                Los precios existentes se preservarán.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Archivo CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  data-testid="input-csv-file"
                />
              </div>
              {importFile && (
                <div className="text-sm text-muted-foreground">
                  Archivo seleccionado: {importFile.name}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!importFile || importMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending ? "Importando..." : "Importar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas rápidas */}
      {!productsLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-products">
                {products.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Con Precio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-products-with-price">
                {products.filter(p => 
                  (p.price && parseFloat(p.price) > 0) ||
                  (p.priceProduct && p.priceProduct > 0) ||
                  (p.ecomPrice && p.ecomPrice > 0)
                ).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bodegas</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-warehouses">
                {/* Warehouse functionality removed - showing placeholder */}
                0
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">eCommerce Activos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-ecom-active-products">
                {products.filter(p => !!p.ecomActive).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs para diferentes vistas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="warehouses">Stock por Bodega</TabsTrigger>
          <TabsTrigger value="skus">SKUs Disponibles</TabsTrigger>
        </TabsList>

        {/* Tab de Productos */}
        <TabsContent value="products" className="space-y-4">
          {/* Filtros y búsqueda */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por SKU, KOPR o nombre del producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="input-search-products"
                      />
                    </div>
                  </div>
                  <Select value={filterActive} onValueChange={setFilterActive}>
                    <SelectTrigger className="w-[180px]" data-testid="select-filter-active">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Activos</SelectItem>
                      <SelectItem value="false">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterPrices} onValueChange={setFilterPrices}>
                    <SelectTrigger className="w-[180px]" data-testid="select-filter-prices">
                      <SelectValue placeholder="Precios" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Con precio</SelectItem>
                      <SelectItem value="false">Sin precio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={filterEcomActive} onValueChange={setFilterEcomActive}>
                    <SelectTrigger className="w-[200px]" data-testid="select-filter-ecom-active">
                      <SelectValue placeholder="eCommerce" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">eCommerce Activo</SelectItem>
                      <SelectItem value="false">eCommerce Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla de productos */}
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              <CardDescription>
                Lista de todos los productos en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="text-center py-8">Cargando productos...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU/KOPR</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>eCommerce</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id} data-testid={`row-product-${product.kopr || product.sku}`}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex flex-col">
                            <span className="font-semibold">{product.kopr || product.sku}</span>
                            {product.kopr && product.sku && product.kopr !== product.sku && (
                              <span className="text-xs text-muted-foreground">{product.sku}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex flex-col">
                            <span className="truncate" title={product.name}>{product.name}</span>
                            {product.slug && (
                              <div className="flex items-center gap-1 mt-1">
                                <Link className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{product.slug}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.category ? (
                            <Badge variant="outline" className="text-xs">
                              {product.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sin categoría</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {product.ecomPrice && (
                              <div className="flex items-center gap-1">
                                <ShoppingCart className="h-3 w-3 text-green-600" />
                                <span className="text-sm font-medium">${product.ecomPrice.toLocaleString()}</span>
                              </div>
                            )}
                            {product.priceProduct && (
                              <span className="text-xs text-muted-foreground">
                                Regular: ${product.priceProduct.toLocaleString()}
                              </span>
                            )}
                            {!product.ecomPrice && !product.priceProduct && (
                              <span className="text-muted-foreground text-xs">Sin precio</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <Badge variant={product.ecomActive ? "default" : "secondary"} className="text-xs">
                                {product.ecomActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                            {product.ecomActive && product.tags && product.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Tags className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{product.tags.length} tags</span>
                              </div>
                            )}
                            {product.ecomActive && product.images && product.images.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Image className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{product.images.length} imágenes</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatStock(product.totalStock)}</TableCell>
                        <TableCell>
                          <Badge variant={product.active ? "default" : "secondary"}>
                            {product.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setNewPrice((product.priceProduct || product.pricePerUnit || product.price)?.toString() || "");
                                setNewOfferPrice(product.priceOffer?.toString() || "");
                                setShowInStore(product.showInStore || false);
                                setShowPriceDialog(true);
                              }}
                              data-testid={`button-edit-price-${product.kopr || product.sku}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                initializeEcommerceForm(product);
                                setShowEcomDialog(true);
                              }}
                              data-testid={`button-edit-ecom-${product.kopr || product.sku}`}
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Stock por Bodega */}
        <TabsContent value="warehouses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Funcionalidad de Bodegas
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    La funcionalidad de gestión de stock por bodega será implementada en una futura actualización.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab de SKUs Disponibles */}
        <TabsContent value="skus" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SKUs Disponibles</CardTitle>
              <CardDescription>
                Lista de SKUs únicos en el sistema con información básica
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros para SKUs */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por SKU o nombre de producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                        data-testid="input-search-skus"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterActive} onValueChange={setFilterActive}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="true">Activos</SelectItem>
                        <SelectItem value="false">Inactivos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterPrices} onValueChange={setFilterPrices}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Precios" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="true">Con precio</SelectItem>
                        <SelectItem value="false">Sin precio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Acciones de selección múltiple */}
                {selectedProducts.length > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">
                      {selectedProducts.length} producto(s) seleccionado(s)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProducts([])}
                    >
                      Deseleccionar todo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Aquí se podría agregar funcionalidad de edición masiva
                        toast({ title: "Funcionalidad de edición masiva próximamente" });
                      }}
                    >
                      Editar seleccionados
                    </Button>
                  </div>
                )}
              </div>

              {/* Tabla de SKUs */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(filteredProducts.map(p => p.sku));
                          } else {
                            setSelectedProducts([]);
                          }
                        }}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Precio Oferta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Stock Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.sku} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.sku)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts([...selectedProducts, product.sku]);
                            } else {
                              setSelectedProducts(selectedProducts.filter(id => id !== product.sku));
                            }
                          }}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">{product.sku}</TableCell>
                      <TableCell>
                        <div className="max-w-60 truncate">{product.name}</div>
                      </TableCell>
                      <TableCell>{formatPrice(product.price || null)}</TableCell>
                      <TableCell>
                        {product.priceOffer ? formatPrice(product.priceOffer) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={product.active ? "default" : "secondary"} className="text-xs">
                            {product.active ? "Activo" : "Inactivo"}
                          </Badge>
                          {product.showInStore && (
                            <Badge variant="outline" className="text-xs">
                              En tienda
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{product.totalStock?.toLocaleString() || 0}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setNewPrice(product.price || "");
                            setNewOfferPrice(product.priceOffer?.toString() || "");
                            setShowInStore(product.showInStore || false);
                            setShowPriceDialog(true);
                          }}
                          data-testid={`button-edit-sku-${product.sku}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar precio */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precios</DialogTitle>
            <DialogDescription>
              Actualizar precios para {selectedProduct?.sku} - {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="price">Precio Normal</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                data-testid="input-new-price"
              />
            </div>
            <div>
              <Label htmlFor="offer-price">Precio de Oferta (opcional)</Label>
              <Input
                id="offer-price"
                type="number"
                step="0.01"
                value={newOfferPrice}
                onChange={(e) => setNewOfferPrice(e.target.value)}
                placeholder="0.00"
                data-testid="input-offer-price"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-in-store"
                checked={showInStore}
                onCheckedChange={setShowInStore}
                data-testid="switch-show-in-store"
              />
              <Label htmlFor="show-in-store">Mostrar en tienda</Label>
            </div>
            <div>
              <Label htmlFor="reason">Motivo del cambio (opcional)</Label>
              <Textarea
                id="reason"
                value={priceReason}
                onChange={(e) => setPriceReason(e.target.value)}
                placeholder="Describe el motivo del cambio de precio..."
                data-testid="textarea-price-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handlePriceUpdate}
                disabled={!newPrice || updatePriceMutation.isPending}
                data-testid="button-update-price"
              >
                {updatePriceMutation.isPending ? "Actualizando..." : "Actualizar Precios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestión de eCommerce */}
      <Dialog open={showEcomDialog} onOpenChange={setShowEcomDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestión de eCommerce</DialogTitle>
            <DialogDescription>
              Configurar propiedades de eCommerce para {selectedProduct?.kopr || selectedProduct?.sku} - {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* eCommerce Active Toggle */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ecom-active"
                  checked={ecomActiveValue}
                  onCheckedChange={setEcomActiveValue}
                  data-testid="switch-ecom-active"
                />
                <Label htmlFor="ecom-active" className="text-sm font-medium">Activo en eCommerce</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Habilita este producto para ser visible en la tienda online
              </p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ecom-slug">URL Slug</Label>
                <Input
                  id="ecom-slug"
                  value={ecomSlug}
                  onChange={(e) => setEcomSlug(e.target.value)}
                  placeholder="producto-ejemplo"
                  data-testid="input-ecom-slug"
                />
                <p className="text-xs text-muted-foreground">
                  URL amigable para SEO (solo letras minúsculas, números y guiones)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ecom-price">Precio eCommerce</Label>
                <Input
                  id="ecom-price"
                  type="number"
                  step="0.01"
                  value={ecomPriceValue}
                  onChange={(e) => setEcomPriceValue(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-ecom-price"
                />
                <p className="text-xs text-muted-foreground">
                  Precio específico para la tienda online
                </p>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="ecom-category">Categoría</Label>
              <Input
                id="ecom-category"
                value={ecomCategory}
                onChange={(e) => setEcomCategory(e.target.value)}
                placeholder="Categoria del producto"
                data-testid="input-ecom-category"
              />
              <p className="text-xs text-muted-foreground">
                Categoría para organizar productos en la tienda
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags del Producto</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Agregar tag"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      addTag(target.value);
                      target.value = '';
                    }
                  }}
                  data-testid="input-add-tag"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.querySelector('[data-testid="input-add-tag"]') as HTMLInputElement;
                    if (input && input.value.trim()) {
                      addTag(input.value.trim());
                      input.value = '';
                    }
                  }}
                >
                  <Tags className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {ecomTags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-xs hover:text-destructive"
                      data-testid={`remove-tag-${index}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Imágenes del Producto</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="URL de imagen"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  data-testid="input-image-url"
                />
                <Input
                  placeholder="Texto alternativo"
                  value={newImageAlt}
                  onChange={(e) => setNewImageAlt(e.target.value)}
                  data-testid="input-image-alt"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addImageToProduct}
                  disabled={!newImageUrl || !newImageAlt}
                >
                  <Image className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {ecomImages.map((image, index) => (
                  <div key={image.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" title={image.url}>{image.url}</p>
                      <p className="text-xs text-muted-foreground">{image.alt}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryImage(image.id)}
                        className={image.primary ? 'bg-primary text-primary-foreground' : ''}
                        data-testid={`primary-image-${index}`}
                      >
                        {image.primary ? '★' : '☆'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeImageFromProduct(image.id)}
                        data-testid={`remove-image-${index}`}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEO Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-4 w-4" />
                <Label className="text-sm font-medium">Configuración SEO</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="seo-title">Título SEO</Label>
                <Input
                  id="seo-title"
                  value={ecomSeoTitle}
                  onChange={(e) => setEcomSeoTitle(e.target.value)}
                  placeholder="Título optimizado para buscadores"
                  data-testid="input-seo-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-description">Descripción SEO</Label>
                <Textarea
                  id="seo-description"
                  value={ecomSeoDescription}
                  onChange={(e) => setEcomSeoDescription(e.target.value)}
                  placeholder="Descripción para motores de búsqueda (150-160 caracteres recomendado)"
                  rows={3}
                  data-testid="textarea-seo-description"
                />
                <p className="text-xs text-muted-foreground">
                  {ecomSeoDescription.length}/160 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-image">Imagen Open Graph</Label>
                <Input
                  id="og-image"
                  value={ecomOgImage}
                  onChange={(e) => setEcomOgImage(e.target.value)}
                  placeholder="URL de imagen para redes sociales"
                  data-testid="input-og-image"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowEcomDialog(false)}
                data-testid="button-cancel-ecom"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEcommerceUpdate}
                disabled={updateEcommerceMutation.isPending}
                data-testid="button-save-ecom"
              >
                {updateEcommerceMutation.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver stock detallado de bodega */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Stock Detallado - {selectedWarehouse}</DialogTitle>
            <DialogDescription>
              Inventario completo por producto en esta bodega
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Stock Físico 1</TableHead>
                  <TableHead>Stock Físico 2</TableHead>
                  <TableHead>Stock Disponible 1</TableHead>
                  <TableHead>Stock Disponible 2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay datos de stock por bodega disponibles.
                    <br />
                    Esta funcionalidad será implementada en una futura actualización.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}