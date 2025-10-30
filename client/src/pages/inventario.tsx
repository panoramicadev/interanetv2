import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Package, Search, AlertCircle, CheckCircle, Loader2, RefreshCcw, Database, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ProductStock {
  id?: number;
  branchCode: string;
  productSku: string;
  productName: string | null;
  warehouseCode: string;
  warehouseName: string | null;
  stock1: number;
  stock2: number;
  quantity: number;
  unit1?: string;
  unit2?: string;
  unit?: string;
  reservedQuantity: number;
  availableQuantity: number;
  averagePrice?: number;
  totalValue?: number;
  lastUpdated: string | null;
}

interface Warehouse {
  code: string;
  name: string;
}

interface Branch {
  code: string;
  name: string;
}

export default function Inventario() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [hideNoStock, setHideNoStock] = useState(false);
  const [hideZZProducts, setHideZZProducts] = useState(false);

  // Reset warehouse filter when branch changes
  useEffect(() => {
    setSelectedWarehouse("all");
  }, [selectedBranch]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin, supervisor, salesperson, and logistica_bodega can access inventory
  if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'salesperson' && user.role !== 'logistica_bodega') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>No tienes permisos para acceder a este módulo.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Inventario</h1>
          <p className="text-muted-foreground">Gestión de stock y disponibilidad de productos</p>
        </div>
        {(user.role === 'admin' || user.role === 'supervisor') && (
          <SyncCatalogButton />
        )}
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por SKU o nombre de producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <BranchFilter
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
            />
            <WarehouseFilter
              selectedWarehouse={selectedWarehouse}
              onWarehouseChange={setSelectedWarehouse}
              selectedBranch={selectedBranch}
            />
          </div>
          
          {/* Additional Filters */}
          <div className="flex flex-wrap items-center gap-6 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="hide-no-stock"
                checked={hideNoStock}
                onCheckedChange={setHideNoStock}
                data-testid="switch-hide-no-stock"
              />
              <Label
                htmlFor="hide-no-stock"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Ocultar productos sin stock
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="hide-zz-products"
                checked={hideZZProducts}
                onCheckedChange={setHideZZProducts}
                data-testid="switch-hide-zz-products"
              />
              <Label
                htmlFor="hide-zz-products"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Ocultar productos con SKU que inicie con "ZZ"
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Summary Cards */}
      <StockSummary 
        searchTerm={searchTerm} 
        selectedWarehouse={selectedWarehouse} 
        selectedBranch={selectedBranch}
        hideNoStock={hideNoStock}
        hideZZProducts={hideZZProducts}
      />

      {/* Inventory Table */}
      <InventoryTable
        searchTerm={searchTerm}
        selectedWarehouse={selectedWarehouse}
        selectedBranch={selectedBranch}
        hideNoStock={hideNoStock}
        hideZZProducts={hideZZProducts}
      />
    </div>
  );
}

// Branch Filter Component
function BranchFilter({
  selectedBranch,
  onBranchChange,
}: {
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
}) {
  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const response = await fetch('/api/branches', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar sucursales');
      }
      return response.json();
    },
  });

  return (
    <Select value={selectedBranch} onValueChange={onBranchChange}>
      <SelectTrigger data-testid="select-branch">
        <SelectValue placeholder="Seleccionar sucursal" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las sucursales</SelectItem>
        {branches?.map((branch) => (
          <SelectItem key={branch.code} value={branch.code}>
            {branch.name || branch.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Warehouse Filter Component
function WarehouseFilter({
  selectedWarehouse,
  onWarehouseChange,
  selectedBranch,
}: {
  selectedWarehouse: string;
  onWarehouseChange: (warehouse: string) => void;
  selectedBranch: string;
}) {
  const { data: warehouses, isLoading } = useQuery<Warehouse[]>({
    queryKey: ['/api/warehouses', selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== 'all') {
        params.append('branch', selectedBranch);
      }
      
      const response = await fetch(`/api/warehouses?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Error al cargar bodegas');
      }
      return response.json();
    },
  });

  return (
    <Select value={selectedWarehouse} onValueChange={onWarehouseChange}>
      <SelectTrigger data-testid="select-warehouse">
        <SelectValue placeholder="Seleccionar bodega" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las bodegas</SelectItem>
        {warehouses?.map((warehouse) => (
          <SelectItem key={warehouse.code} value={warehouse.code}>
            {warehouse.name || warehouse.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Stock Summary Component
function StockSummary({
  searchTerm,
  selectedWarehouse,
  selectedBranch,
  hideNoStock,
  hideZZProducts,
}: {
  searchTerm: string;
  selectedWarehouse: string;
  selectedBranch: string;
  hideNoStock: boolean;
  hideZZProducts: boolean;
}) {
  const { data: summary } = useQuery<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalValue: number;
    lowStock: number;
  }>({
    queryKey: ['/api/inventory/summary-with-prices', searchTerm, selectedWarehouse, selectedBranch, hideNoStock, hideZZProducts],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedWarehouse !== 'all') params.append('warehouse', selectedWarehouse);
      if (selectedBranch !== 'all') params.append('branch', selectedBranch);
      if (hideNoStock) params.append('hideNoStock', 'true');
      if (hideZZProducts) params.append('hideZZProducts', 'true');
      
      const response = await fetch(`/api/inventory/summary-with-prices?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) {
          return {
            totalProducts: 0,
            totalQuantity: 0,
            totalAvailable: 0,
            totalValue: 0,
            lowStock: 0,
          };
        }
        throw new Error('Error al cargar resumen');
      }
      return response.json();
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card data-testid="card-total-products" className="rounded-3xl border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Productos</CardTitle>
          <div className="w-10 h-10 rounded-full bg-purple-500/20 dark:bg-purple-500/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{summary?.totalProducts?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) || 0}</div>
          <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">SKUs únicos en inventario</p>
        </CardContent>
      </Card>

      <Card data-testid="card-total-quantity" className="rounded-3xl border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Stock Total</CardTitle>
          <div className="w-10 h-10 rounded-full bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {summary?.totalQuantity?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) ?? '0'}
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Unidades totales</p>
        </CardContent>
      </Card>

      <Card data-testid="card-available" className="rounded-3xl border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Disponible</CardTitle>
          <div className="w-10 h-10 rounded-full bg-green-500/20 dark:bg-green-500/30 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {summary?.totalAvailable?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) ?? '0'}
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">Unidades disponibles</p>
        </CardContent>
      </Card>

      <Card data-testid="card-total-value" className="rounded-3xl border-0 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Valor Total Inventario</CardTitle>
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30 flex items-center justify-center">
            <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
            ${(summary?.totalValue ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Valorización total a precio medio</p>
        </CardContent>
      </Card>

      <Card data-testid="card-low-stock" className="rounded-3xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/40 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">Stock Bajo</CardTitle>
          <div className="w-10 h-10 rounded-full bg-orange-500/20 dark:bg-orange-500/30 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            {(summary?.lowStock || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">Productos con stock bajo</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Inventory Table Component
function InventoryTable({
  searchTerm,
  selectedWarehouse,
  selectedBranch,
  hideNoStock,
  hideZZProducts,
}: {
  searchTerm: string;
  selectedWarehouse: string;
  selectedBranch: string;
  hideNoStock: boolean;
  hideZZProducts: boolean;
}) {
  const { data: inventory, isLoading, refetch } = useQuery<ProductStock[]>({
    queryKey: ['/api/inventory-with-prices', searchTerm, selectedWarehouse, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedWarehouse !== 'all') params.append('warehouse', selectedWarehouse);
      if (selectedBranch !== 'all') params.append('branch', selectedBranch);
      
      const response = await fetch(`/api/inventory-with-prices?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Error al cargar inventario');
      }
      return response.json();
    },
  });

  const getStockBadge = (available: number, reserved: number) => {
    if (available === 0) {
      return <Badge variant="destructive">Sin Stock</Badge>;
    }
    if (available < 10) {
      return <Badge className="bg-orange-500">Stock Bajo</Badge>;
    }
    if (reserved > 0) {
      return <Badge variant="secondary">Con Reservas</Badge>;
    }
    return <Badge className="bg-green-500">Disponible</Badge>;
  };

  // Apply client-side filters
  const filteredInventory = inventory?.filter((item) => {
    // Filter out products with no stock if hideNoStock is enabled
    if (hideNoStock && item.availableQuantity === 0) {
      return false;
    }
    
    // Filter out products with SKU starting with "ZZ" if hideZZProducts is enabled
    if (hideZZProducts && item.productSku?.toUpperCase().startsWith('ZZ')) {
      return false;
    }
    
    return true;
  }) || [];

  return (
    <Card className="rounded-3xl border-0 bg-white dark:bg-slate-900 shadow-sm">
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">Inventario de Productos</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Listado detallado por sucursal y bodega</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          </div>
        ) : filteredInventory && filteredInventory.length > 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 px-2">•</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 px-2">Suc</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-20 px-2">SKU</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700 dark:text-gray-300 px-2">Producto</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-20 px-2">Bod</TableHead>
                    <TableHead className="text-xs text-right font-semibold text-gray-700 dark:text-gray-300 w-20 px-2">UD1</TableHead>
                    <TableHead className="text-xs text-right font-semibold text-gray-700 dark:text-gray-300 w-20 px-2">UD2</TableHead>
                    <TableHead className="text-xs text-right font-semibold text-gray-700 dark:text-gray-300 w-24 px-2">Precio</TableHead>
                    <TableHead className="text-xs text-right font-semibold text-gray-700 dark:text-gray-300 w-24 px-2">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item, index) => {
                    const available = item.availableQuantity || 0;
                    const reserved = item.reservedQuantity || 0;
                    let statusColor = 'bg-green-500';
                    if (available === 0) statusColor = 'bg-red-500';
                    else if (available < 10) statusColor = 'bg-orange-500';
                    else if (reserved > 0) statusColor = 'bg-blue-500';
                    
                    return (
                      <TableRow 
                        key={`${item.branchCode}-${item.productSku}-${item.warehouseCode}-${index}`} 
                        data-testid={`row-stock-${item.productSku}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <TableCell className="py-1 px-2">
                          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                        </TableCell>
                        <TableCell className="text-xs font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 py-1 px-2">
                          {item.branchCode || '-'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900 dark:text-gray-100 py-1 px-2">
                          <div className="truncate">{item.productSku}</div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 dark:text-gray-300 py-1 px-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate max-w-[200px] cursor-help">
                                {item.productName || '-'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{item.productName || '-'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-400 py-1 px-2">
                          <div className="truncate">{item.warehouseName || item.warehouseCode}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right text-gray-700 dark:text-gray-300 py-1 px-2 whitespace-nowrap">
                          {item.stock1?.toLocaleString('es-CL', { maximumFractionDigits: 2 }) || '0'} <span className="text-[10px] text-gray-500">{item.unit1 || ''}</span>
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold text-blue-700 dark:text-blue-400 py-1 px-2 whitespace-nowrap">
                          {item.stock2?.toLocaleString('es-CL', { maximumFractionDigits: 2 }) || '0'} <span className="text-[10px] text-gray-500">{item.unit2 || ''}</span>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium text-gray-800 dark:text-gray-200 py-1 px-2 whitespace-nowrap">
                          {item.averagePrice ? `$${item.averagePrice.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-bold text-indigo-700 dark:text-indigo-400 py-1 px-2 whitespace-nowrap">
                          {item.totalValue ? `$${item.totalValue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No hay productos en inventario</p>
            {searchTerm && (
              <p className="text-sm mt-2 text-gray-500">Intenta con otros términos de búsqueda</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncCatalogButton() {
  const { toast } = useToast();

  const { data: lastSync, isLoading: isLoadingLastSync } = useQuery<{
    id: string;
    completedAt: string;
    userId: string;
    userEmail: string;
    productsNew: number;
    productsUpdated: number;
    productsDeactivated: number;
    totalProcessed: number;
    duration: number;
    status: string;
    errorMessage: string | null;
    summary: any;
  } | null>({
    queryKey: ['/api/inventory/last-sync'],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/inventory/sync', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/last-sync'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/summary'] });
      
      if (data.status === 'success') {
        toast({
          title: "Sincronización completada",
          description: `Se procesaron ${data.totalProcessed} productos: ${data.productsNew} nuevos, ${data.productsUpdated} actualizados, ${data.productsDeactivated} desactivados`,
        });
      } else if (data.status === 'partial') {
        toast({
          title: "Sincronización parcial",
          description: `Se procesaron ${data.totalProcessed} productos con algunos errores. Revisa el historial para más detalles.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Error en sincronización",
          description: data.errorMessage || "Ocurrió un error durante la sincronización",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo sincronizar el catálogo",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        data-testid="button-sync-catalog"
        className="gap-2"
      >
        {syncMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sincronizando...
          </>
        ) : (
          <>
            <Database className="h-4 w-4" />
            Sincronizar Catálogo
          </>
        )}
      </Button>
      
      {!isLoadingLastSync && lastSync && (
        <p className="text-xs text-muted-foreground" data-testid="text-last-sync">
          Última sincronización:{" "}
          {lastSync.completedAt && !isNaN(new Date(lastSync.completedAt).getTime())
            ? formatDistanceToNow(new Date(lastSync.completedAt), {
                addSuffix: true,
                locale: es,
              })
            : "fecha no disponible"}
          {" "}
          ({lastSync.totalProcessed || 0} productos)
        </p>
      )}
      
      {!isLoadingLastSync && !lastSync && (
        <p className="text-xs text-muted-foreground">
          No hay sincronizaciones previas
        </p>
      )}
    </div>
  );
}
