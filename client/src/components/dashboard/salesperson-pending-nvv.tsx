import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

interface SalespersonPendingNVVProps {
  salesperson: string;
  selectedPeriod: string;
  filterType: "day" | "month" | "year";
}

interface NVVRecord {
  id: string;
  NUDO: string;
  TIDO: string;
  FEEMDO: string;
  NOKOEN: string;
  NOKOPR: string;
  KOPRCT: string;
  CAPREX2: number;
  CAPRCO2: number;
  PPPRNE: number;
  cantidadPendiente: number;
  montoPendiente: number;
}

export default function SalespersonPendingNVV({
  salesperson,
  selectedPeriod,
  filterType
}: SalespersonPendingNVVProps) {
  const { data: nvvData, isLoading } = useQuery<NVVRecord[]>({
    queryKey: [`/api/nvv/by-salesperson`, salesperson, selectedPeriod, filterType],
    enabled: !!salesperson
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate totals
  const totalPendingAmount = nvvData?.reduce((sum, record) => sum + record.montoPendiente, 0) || 0;
  const totalPendingUnits = nvvData?.reduce((sum, record) => sum + record.cantidadPendiente, 0) || 0;
  const totalOrders = nvvData?.length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!nvvData || nvvData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No hay notas de venta pendientes en este período
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Notas de Venta Pendientes
          </CardTitle>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-medium">Total Pedidos</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{totalOrders}</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-700 mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Unidades Pendientes</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">
              {totalPendingUnits.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Monto Pendiente</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">
              {formatCurrency(totalPendingAmount)}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant. Requerida</TableHead>
                <TableHead className="text-right">Cant. Confirmada</TableHead>
                <TableHead className="text-right">Cant. Pendiente</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Monto Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nvvData.map((record) => (
                <TableRow key={record.id} data-testid={`nvv-row-${record.id}`}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{record.NUDO}</div>
                      <div className="text-xs text-gray-500">{record.TIDO}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-gray-400" />
                      {formatDate(record.FEEMDO)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="font-medium text-sm truncate">{record.NOKOEN}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="font-medium text-sm truncate">{record.NOKOPR}</div>
                      <div className="text-xs text-gray-500">{record.KOPRCT}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">
                      {record.CAPREX2.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium text-blue-600">
                      {record.CAPRCO2.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {record.cantidadPendiente.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-600">
                    {formatCurrency(record.PPPRNE)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-amber-700">
                      {formatCurrency(record.montoPendiente)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
