import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Package, Search, AlertCircle, CheckCircle, Loader2, RefreshCcw, Database } from "lucide-react";
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
          <CardTitle>Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
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
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock Summary Cards */}
      <StockSummary searchTerm={searchTerm} selectedWarehouse={selectedWarehouse} selectedBranch={selectedBranch} />

      {/* Inventory Table */}
      <InventoryTable
        searchTerm={searchTerm}
        selectedWarehouse={selectedWarehouse}
        selectedBranch={selectedBranch}
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
}: {
  selectedWarehouse: string;
  onWarehouseChange: (warehouse: string) => void;
}) {
  const { data: warehouses, isLoading } = useQuery<Warehouse[]>({
    queryKey: ['/api/warehouses'],
    queryFn: async () => {
      const response = await fetch('/api/warehouses', {
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
}: {
  searchTerm: string;
  selectedWarehouse: string;
  selectedBranch: string;
}) {
  const { data: summary } = useQuery<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalValue: number;
    lowStock: number;
  }>({
    queryKey: ['/api/inventory/summary-with-prices', searchTerm, selectedWarehouse, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedWarehouse !== 'all') params.append('warehouse', selectedWarehouse);
      if (selectedBranch !== 'all') params.append('branch', selectedBranch);
      
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
}: {
  searchTerm: string;
  selectedWarehouse: string;
  selectedBranch: string;
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
        ) : inventory && inventory.length > 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Sucursal</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">SKU</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Producto</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Bodega</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Stock Unidad 1</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Stock Unidad 2</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Unidad</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Precio Medio</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Valor Inventario</TableHead>
                  <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item, index) => (
                  <TableRow 
                    key={`${item.branchCode}-${item.productSku}-${item.warehouseCode}-${index}`} 
                    data-testid={`row-stock-${item.productSku}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <TableCell className="font-medium text-xs text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30">
                      {item.branchCode || '-'}
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900 dark:text-gray-100">{item.productSku}</TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300 max-w-xs truncate">{item.productName || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">{item.warehouseName || item.warehouseCode}</TableCell>
                    <TableCell className="text-right text-gray-500 dark:text-gray-400">
                      {item.stock1?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) || '0'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-blue-700 dark:text-blue-400">
                      {item.stock2?.toLocaleString('es-CL', { maximumFractionDigits: 0 }) || '0'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500 dark:text-gray-400">
                      {item.unit2 || item.unit || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-800 dark:text-gray-200">
                      {item.averagePrice ? `$${item.averagePrice.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-indigo-700 dark:text-indigo-400">
                      {item.totalValue ? `$${item.totalValue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '-'}
                    </TableCell>
                    <TableCell>
                      {getStockBadge(item.availableQuantity, item.reservedQuantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    id: number;
    timestamp: string;
    userId: string;
    userEmail: string;
    productosNuevos: number;
    productosActualizados: number;
    productosDesactivados: number;
    totalProcesados: number;
    duracion: number;
    estado: string;
    mensajeError: string | null;
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
          {lastSync.timestamp && !isNaN(new Date(lastSync.timestamp).getTime())
            ? formatDistanceToNow(new Date(lastSync.timestamp), {
                addSuffix: true,
                locale: es,
              })
            : "fecha no disponible"}
          {" "}
          ({lastSync.totalProcesados} productos)
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
