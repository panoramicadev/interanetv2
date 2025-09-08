import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/dashboard/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Upload, Package, TrendingUp, Warehouse, Edit, History, Filter, Eye, Building2 } from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit1: string;
  unit2: string;
  unitRatio: string;
  price: string;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [newPrice, setNewPrice] = useState("");
  const [priceReason, setPriceReason] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to dashboard if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Acceso denegado",
        description: "Solo los administradores pueden acceder a esta página.",
        variant: "destructive",
      });
      window.location.href = '/';
    }
  }, [isAuthenticated, isLoading, user, toast]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products', { search: searchTerm, active: filterActive, hasPrices: filterPrices }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== 'all') params.append('active', filterActive);
      if (filterPrices !== 'all') params.append('hasPrices', filterPrices);
      
      const response = await apiRequest('GET', `/api/products?${params.toString()}`);
      return await response.json() as Product[];
    }
  });

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ['/api/warehouses'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/warehouses');
      return await response.json() as any[];
    }
  });

  // Fetch warehouse stock summary
  const { data: warehouseSummary = [] } = useQuery<WarehouseSummary[]>({
    queryKey: ['/api/warehouses/stock-summary'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/warehouses/stock-summary');
      return await response.json() as WarehouseSummary[];
    }
  });

  // Fetch warehouse detailed stock
  const { data: warehouseStock = [] } = useQuery<WarehouseStock[]>({
    queryKey: ['/api/warehouses', selectedWarehouse, 'stock'],
    queryFn: async () => {
      if (!selectedWarehouse) return [];
      const response = await apiRequest('GET', `/api/warehouses/${selectedWarehouse}/stock`);
      return await response.json() as WarehouseStock[];
    },
    enabled: !!selectedWarehouse
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ sku, price, reason }: { sku: string; price: number; reason?: string }) => {
      const response = await fetch(`/api/products/${sku}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ price, reason })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update price');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShowPriceDialog(false);
      setSelectedProduct(null);
      setNewPrice("");
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
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/products/import-products-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to import CSV');
      }
      
      return response.json();
    },
    onSuccess: (data: { result: ImportResult }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/warehouses'] });
      setShowImportDialog(false);
      setImportFile(null);
      
      const { result } = data;
      toast({
        title: "Importación completada",
        description: `Se procesaron ${result.processedProducts} productos. ${result.newProducts} nuevos productos creados.`,
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

  const handlePriceUpdate = () => {
    if (!selectedProduct || !newPrice) return;
    
    updatePriceMutation.mutate({
      sku: selectedProduct.sku,
      price: parseFloat(newPrice),
      reason: priceReason
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = () => {
    if (importFile) {
      importMutation.mutate(importFile);
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price || price === "0") return "Sin precio";
    return `$${parseFloat(price).toLocaleString()}`;
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
    <div className="min-h-screen bg-background">
      <Sidebar onImportClick={() => setShowImportDialog(true)} />
      
      <div className="lg:ml-64 transition-all duration-300">
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
                {products.filter(p => p.price && parseFloat(p.price) > 0).length}
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
                {warehouses.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-stock">
                {warehouseSummary.reduce((sum, w) => sum + w.totalPhysicalStock, 0).toLocaleString()}
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
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por SKU o nombre del producto..."
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
                      <TableHead>SKU</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Bodegas</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id} data-testid={`row-product-${product.sku}`}>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="max-w-xs truncate" title={product.name}>
                          {product.name}
                        </TableCell>
                        <TableCell>
                          <span className={!product.price || parseFloat(product.price) === 0 ? "text-muted-foreground" : ""}>
                            {formatPrice(product.price)}
                          </span>
                        </TableCell>
                        <TableCell>{formatStock(product.totalStock)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {product.warehouses?.slice(0, 3).map((warehouse) => (
                              <Badge key={warehouse} variant="secondary" className="text-xs">
                                {warehouse}
                              </Badge>
                            ))}
                            {(product.warehouses?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(product.warehouses?.length || 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
                                setNewPrice(product.price || "");
                                setShowPriceDialog(true);
                              }}
                              data-testid={`button-edit-price-${product.sku}`}
                            >
                              <Edit className="h-4 w-4" />
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
            {warehouseSummary.map((warehouse) => (
              <Card key={warehouse.warehouseCode} className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedWarehouse(warehouse.warehouseCode);
                      setShowStockDialog(true);
                    }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {warehouse.warehouseName}
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Productos:</span>
                      <span className="font-medium">{warehouse.totalProducts}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Stock Físico:</span>
                      <span className="font-medium">{warehouse.totalPhysicalStock.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Stock Disponible:</span>
                      <span className="font-medium">{warehouse.totalAvailableStock.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.sku}>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-mono text-sm font-medium">{product.sku}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {product.name}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{formatPrice(product.price)}</span>
                          <Badge variant={product.active ? "default" : "secondary"} className="text-xs">
                            {product.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar precio */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Precio</DialogTitle>
            <DialogDescription>
              Actualizar el precio para {selectedProduct?.sku} - {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="price">Nuevo Precio</Label>
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
                {updatePriceMutation.isPending ? "Actualizando..." : "Actualizar Precio"}
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
                {warehouseStock.map((stock, index) => (
                  <TableRow key={`${stock.productSku}-${stock.branchCode}-${index}`}>
                    <TableCell className="font-mono text-sm">{stock.productSku}</TableCell>
                    <TableCell className="max-w-xs truncate">{stock.productName}</TableCell>
                    <TableCell>{stock.branchCode}</TableCell>
                    <TableCell>{stock.physicalStock1.toLocaleString()} {stock.unit1}</TableCell>
                    <TableCell>{stock.physicalStock2.toLocaleString()} {stock.unit2}</TableCell>
                    <TableCell>{stock.availableStock1.toLocaleString()} {stock.unit1}</TableCell>
                    <TableCell>{stock.availableStock2.toLocaleString()} {stock.unit2}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}