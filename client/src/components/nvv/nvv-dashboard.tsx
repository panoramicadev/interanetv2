import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  Users, 
  Building, 
  Package, 
  DollarSign,
  Calendar,
  UserCheck,
  MapPin,
  FileText
} from "lucide-react";

interface NvvDashboardMetrics {
  totalRecords: number;
  totalSalespeople: number;
  totalCompanies: number;
  totalPendingAmount: number;
  averageOrderValue: number;
  topSalespeople: Array<{
    salesperson: string;
    totalAmount: number;
    recordCount: number;
  }>;
  topCompanies: Array<{
    company: string;
    totalAmount: number;
    recordCount: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  regionBreakdown: Array<{
    region: string;
    count: number;
    amount: number;
  }>;
}

interface NvvRecord {
  id: string;
  // Direct CSV column fields
  NOKOEN: string | null; // Cliente
  KOPRCT: string | null; // SKU del producto
  NOKOPR: string | null; // Nombre del producto
  KOFULIDO: string | null; // Vendedor
  FEERLI: string | null; // Fecha de compromiso
  CAPRCO2: string | null; // Cantidad confirmada
  CAPREX2: string | null; // Cantidad requerida
  PPPRNE: string | null; // Precio unitario neto
  // Additional CSV columns that we might need
  NUDO: string | null; // Número de documento
  TIDO: string | null; // Tipo de documento
  COMUNA: string | null; // Comuna
  OBSERVA: string | null; // Observaciones
  // System fields
  status?: string;
  importBatch?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800"
};

export function NvvDashboard() {
  // Obtener datos detallados de las notas de venta
  const { data: detailedData, isLoading: isLoadingDetails, error } = useQuery<NvvRecord[]>({
    queryKey: ['/api/nvv/pending'],
    queryFn: async () => {
      const response = await fetch('/api/nvv/pending?limit=100&offset=0');
      if (!response.ok) {
        throw new Error('Error al cargar datos detallados');
      }
      return response.json();
    },
    retry: false,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(dateString));
  };

  const calculatePendingAmount = (record: NvvRecord) => {
    const caprco2 = parseFloat(record.CAPRCO2 || '0');
    const caprex2 = parseFloat(record.CAPREX2 || '0'); 
    const ppprne = parseFloat(record.PPPRNE || '0');
    const pendingUnits = Math.max(caprco2 - caprex2, 0);
    return pendingUnits * ppprne;
  };

  const getMonthFromDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: 'long'
    }).format(date);
  };

  const getMonthFromFEERLI = (feerli: string) => {
    if (!feerli) return 'Fecha no disponible';
    
    try {
      // FEERLI viene desde PostgreSQL en formato YYYY-MM-DD
      const date = new Date(feerli);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      return new Intl.DateTimeFormat('es-CL', {
        year: 'numeric',
        month: 'long'
      }).format(date);
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const formatFEERLI = (feerli: string) => {
    if (!feerli) return 'Sin fecha';
    
    try {
      // Las fechas vienen desde PostgreSQL en formato YYYY-MM-DD
      const date = new Date(feerli);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      // Formatear a DD/MM/YYYY para mostrar
      return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const calculateMonthlyTotals = () => {
    if (!detailedData) return {};
    
    const monthlyTotals: Record<string, number> = {};
    
    detailedData.forEach(record => {
      const feerli = record.FEERLI;
      const month = getMonthFromFEERLI(feerli || '');
      const pendingAmount = calculatePendingAmount(record);
      
      if (monthlyTotals[month]) {
        monthlyTotals[month] += pendingAmount;
      } else {
        monthlyTotals[month] = pendingAmount;
      }
    });
    
    return monthlyTotals;
  };

  if (isLoadingDetails) {
    return (
      <Card className="p-6 text-center">
        <div className="animate-pulse text-gray-500">Cargando datos de notas de venta...</div>
      </Card>
    );
  }

  if (error || !detailedData) {
    return (
      <Card className="p-6 text-center">
        <div className="text-red-600 mb-2">Error al cargar datos de NVV</div>
        <p className="text-sm text-gray-600">
          Asegúrate de haber importado datos NVV primero
        </p>
      </Card>
    );
  }

  const monthlyTotals = calculateMonthlyTotals();

  return (
    <div className="space-y-6">
      {/* Total NVV por Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Total NVV por Mes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(monthlyTotals).length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              No hay datos de NVV disponibles
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(monthlyTotals)
                .sort(([a], [b]) => new Date(a + " 1, 2024").getTime() - new Date(b + " 1, 2024").getTime())
                .map(([month, total]) => (
                  <div key={month} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {month}
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabla de Datos Detallados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Datos Detallados de Notas de Venta</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!detailedData || detailedData.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No hay datos de notas de venta disponibles
            </div>
          ) : (
            <div className="h-96 w-full overflow-auto border rounded-lg">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="min-w-[120px]">Mes NVV</TableHead>
                    <TableHead className="min-w-[100px]">Vendedor</TableHead>
                    <TableHead className="min-w-[150px]">Cliente (NOKOEN)</TableHead>
                    <TableHead className="min-w-[120px]">SKU (KOPRCT)</TableHead>
                    <TableHead className="min-w-[200px]">Producto (NOKOPR)</TableHead>
                    <TableHead className="min-w-[100px] text-right">Cant. Confirmada</TableHead>
                    <TableHead className="min-w-[100px] text-right">Cant. Requerida</TableHead>
                    <TableHead className="min-w-[100px] text-right">Precio Unit.</TableHead>
                    <TableHead className="min-w-[120px] text-right">Monto Pendiente</TableHead>
                    <TableHead className="min-w-[100px]">Estado</TableHead>
                    <TableHead className="min-w-[120px]">Fecha Compromiso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedData.slice(0, 100).map((record) => {
                    const pendingAmount = calculatePendingAmount(record);
                    const caprco2 = record.CAPRCO2 ? parseFloat(record.CAPRCO2) : 0;
                    const caprex2 = record.CAPREX2 ? parseFloat(record.CAPREX2) : 0;
                    const ppprne = record.PPPRNE ? parseFloat(record.PPPRNE) : 0;
                    
                    // Usar campos directos de CSV
                    const nokoen = record.NOKOEN || 'Sin cliente';
                    const koprct = record.KOPRCT || 'Sin SKU';
                    const nokopr = record.NOKOPR || 'Sin producto';
                    const kofulido = record.KOFULIDO || 'Sin vendedor';
                    
                    return (
                      <TableRow key={record.id} data-testid={`row-nvv-${record.id}`}>
                        <TableCell className="min-w-[120px]" data-testid={`text-month-${record.id}`}>
                          {getMonthFromFEERLI(record.FEERLI || '')}
                        </TableCell>
                        <TableCell className="font-medium min-w-[100px]" data-testid={`text-salesperson-${record.id}`}>
                          {kofulido}
                        </TableCell>
                        <TableCell className="min-w-[150px]" data-testid={`text-client-${record.id}`}>
                          {nokoen}
                        </TableCell>
                        <TableCell className="font-mono text-xs min-w-[120px]" data-testid={`text-sku-${record.id}`}>
                          {koprct}
                        </TableCell>
                        <TableCell className="min-w-[200px]" data-testid={`text-product-${record.id}`}>
                          {nokopr}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-confirmed-${record.id}`}>
                          {formatNumber(caprco2)}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-required-${record.id}`}>
                          {formatNumber(caprex2)}
                        </TableCell>
                        <TableCell className="text-right min-w-[100px]" data-testid={`text-unitprice-${record.id}`}>
                          {formatCurrency(ppprne)}
                        </TableCell>
                        <TableCell className="text-right font-medium min-w-[120px]" data-testid={`text-pending-${record.id}`}>
                          {formatCurrency(pendingAmount)}
                        </TableCell>
                        <TableCell className="min-w-[100px]" data-testid={`text-status-${record.id}`}>
                          <Badge className={statusColors[record.status || 'pending'] || "bg-gray-100 text-gray-800"}>
                            {statusLabels[record.status || 'pending'] || record.status || 'Pendiente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[120px]" data-testid={`text-date-${record.id}`}>
                          {formatFEERLI(record.FEERLI || '')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-600">
            Mostrando hasta 100 registros más recientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}