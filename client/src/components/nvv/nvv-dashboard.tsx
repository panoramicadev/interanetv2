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
  salesperson: string | null;
  clientName: string;
  productName: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  commitmentDate: string;
  status: string;
  region: string | null;
  segment: string | null;
  originalData: any;
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
    if (!record.originalData) return 0;
    const caprco2 = parseFloat(record.originalData.CAPRCO2 || '0');
    const caprex2 = parseFloat(record.originalData.CAPREX2 || '0'); 
    const ppprne = parseFloat(record.originalData.PPPRNE || '0');
    const pendingUnits = Math.max(caprco2 - caprex2, 0);
    return pendingUnits * ppprne;
  };

  const getMonthFromDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      year: 'numeric',
      month: 'long'
    }).format(date);
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

  return (
    <div className="space-y-6">
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
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes NVV</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente (NOKOEN)</TableHead>
                    <TableHead>SKU (KOPRCT)</TableHead>
                    <TableHead>Producto (NOKOPR)</TableHead>
                    <TableHead>Cant. Confirmada</TableHead>
                    <TableHead>Cant. Requerida</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Monto Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Compromiso</TableHead>
                    <TableHead>Región</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedData.slice(0, 100).map((record) => {
                    const pendingAmount = calculatePendingAmount(record);
                    const caprco2 = record.originalData?.CAPRCO2 ? parseFloat(record.originalData.CAPRCO2) : 0;
                    const caprex2 = record.originalData?.CAPREX2 ? parseFloat(record.originalData.CAPREX2) : 0;
                    const ppprne = record.originalData?.PPPRNE ? parseFloat(record.originalData.PPPRNE) : 0;
                    
                    // Obtener campos correctos del originalData
                    const nokoen = record.originalData?.NOKOEN || record.clientName || 'Sin cliente';
                    const koprct = record.originalData?.KOPRCT || 'Sin SKU';
                    const nokopr = record.originalData?.NOKOPR || record.productName || 'Sin producto';
                    const kofulido = record.originalData?.KOFULIDO || record.salesperson || 'Sin vendedor';
                    
                    return (
                      <TableRow key={record.id} data-testid={`row-nvv-${record.id}`}>
                        <TableCell data-testid={`text-month-${record.id}`}>
                          {getMonthFromDate(record.commitmentDate)}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-salesperson-${record.id}`}>
                          {kofulido}
                        </TableCell>
                        <TableCell data-testid={`text-client-${record.id}`}>
                          {nokoen}
                        </TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-sku-${record.id}`}>
                          {koprct}
                        </TableCell>
                        <TableCell data-testid={`text-product-${record.id}`}>
                          {nokopr}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-confirmed-${record.id}`}>
                          {formatNumber(caprco2)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-required-${record.id}`}>
                          {formatNumber(caprex2)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-unitprice-${record.id}`}>
                          {formatCurrency(ppprne)}
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-pending-${record.id}`}>
                          {formatCurrency(pendingAmount)}
                        </TableCell>
                        <TableCell data-testid={`text-status-${record.id}`}>
                          <Badge className={statusColors[record.status] || "bg-gray-100 text-gray-800"}>
                            {statusLabels[record.status] || record.status}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-date-${record.id}`}>
                          {formatDate(record.commitmentDate)}
                        </TableCell>
                        <TableCell data-testid={`text-region-${record.id}`}>
                          {record.region || 'Sin región'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <div className="mt-4 text-sm text-gray-600">
            Mostrando hasta 100 registros más recientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}