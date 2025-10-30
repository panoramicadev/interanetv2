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
import { Package, Search, AlertCircle, CheckCircle, Loader2, RefreshCcw } from "lucide-react";

interface ProductStock {
  id: number;
  productSku: string;
  productName: string | null;
  warehouseCode: string;
  warehouseName: string | null;
  quantity: number;
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

export default function Inventario() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Inventario</h1>
          <p className="text-muted-foreground">Gestión de stock y disponibilidad de productos</p>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <WarehouseFilter
              selectedWarehouse={selectedWarehouse}
              onWarehouseChange={setSelectedWarehouse}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock Summary Cards */}
      <StockSummary searchTerm={searchTerm} selectedWarehouse={selectedWarehouse} />

      {/* Inventory Table */}
      <InventoryTable
        searchTerm={searchTerm}
        selectedWarehouse={selectedWarehouse}
      />
    </div>
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
}: {
  searchTerm: string;
  selectedWarehouse: string;
}) {
  const { data: summary } = useQuery<{
    totalProducts: number;
    totalQuantity: number;
    totalAvailable: number;
    totalValue: number;
    lowStock: number;
  }>({
    queryKey: ['/api/inventory/summary-with-prices', searchTerm, selectedWarehouse],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedWarehouse !== 'all') params.append('warehouse', selectedWarehouse);
      
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
      <Card data-testid="card-total-products">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary?.totalProducts || 0}</div>
          <p className="text-xs text-muted-foreground">SKUs únicos en inventario</p>
        </CardContent>
      </Card>

      <Card data-testid="card-total-quantity">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary?.totalQuantity?.toLocaleString('es-CL') ?? '0'}
          </div>
          <p className="text-xs text-muted-foreground">Unidades totales</p>
        </CardContent>
      </Card>

      <Card data-testid="card-available">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disponible</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {summary?.totalAvailable?.toLocaleString('es-CL') ?? '0'}
          </div>
          <p className="text-xs text-muted-foreground">Unidades disponibles</p>
        </CardContent>
      </Card>

      <Card data-testid="card-total-value" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Valor Total Inventario</CardTitle>
          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            ${(summary?.totalValue ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">Valorización total a precio medio</p>
        </CardContent>
      </Card>

      <Card data-testid="card-low-stock">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {summary?.lowStock || 0}
          </div>
          <p className="text-xs text-muted-foreground">Productos con stock bajo</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Inventory Table Component
function InventoryTable({
  searchTerm,
  selectedWarehouse,
}: {
  searchTerm: string;
  selectedWarehouse: string;
}) {
  const { data: inventory, isLoading, refetch } = useQuery<ProductStock[]>({
    queryKey: ['/api/inventory-with-prices', searchTerm, selectedWarehouse],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedWarehouse !== 'all') params.append('warehouse', selectedWarehouse);
      
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
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Inventario de Productos</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : inventory && inventory.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead className="text-right">Stock Total</TableHead>
                  <TableHead className="text-right">Unidad</TableHead>
                  <TableHead className="text-right">Precio Medio</TableHead>
                  <TableHead className="text-right">Valor Inventario</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={`${item.productSku}-${item.warehouseCode}`} data-testid={`row-stock-${item.productSku}`}>
                    <TableCell className="font-medium">{item.productSku}</TableCell>
                    <TableCell>{item.productName || '-'}</TableCell>
                    <TableCell>{item.warehouseName || item.warehouseCode}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity.toLocaleString('es-CL')}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {item.unit || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.averagePrice ? `$${item.averagePrice.toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
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
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No hay productos en inventario</p>
            {searchTerm && (
              <p className="text-sm mt-2">Intenta con otros términos de búsqueda</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
