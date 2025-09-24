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
  const { data: metrics, isLoading, error } = useQuery<NvvDashboardMetrics>({
    queryKey: ['/api/nvv/dashboard'],
    retry: false,
  });

  // Obtener datos detallados de las notas de venta
  const { data: detailedData, isLoading: isLoadingDetails } = useQuery<NvvRecord[]>({
    queryKey: ['/api/nvv/pending'],
    queryFn: async () => {
      const response = await fetch('/api/nvv/pending?limit=50&offset=0');
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="p-6 text-center">
        <div className="text-red-600 mb-2">Error al cargar dashboard</div>
        <p className="text-sm text-gray-600">
          Asegúrate de haber importado datos NVV primero
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(metrics.totalRecords)}
            </div>
            <p className="text-xs text-muted-foreground">Notas de venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendedores Activos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(metrics.totalSalespeople)}
            </div>
            <p className="text-xs text-muted-foreground">Vendedores únicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(metrics.totalCompanies)}
            </div>
            <p className="text-xs text-muted-foreground">Clientes únicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Pendiente</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(metrics.totalPendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio: {formatCurrency(metrics.averageOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Salespeople */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Top Vendedores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topSalespeople.slice(0, 5).map((salesperson, index) => (
                <div key={salesperson.salesperson} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{salesperson.salesperson}</div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(salesperson.recordCount)} registros
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      {formatCurrency(salesperson.totalAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>Top Empresas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topCompanies.slice(0, 5).map((company, index) => (
                <div key={company.company} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[200px]" title={company.company}>
                        {company.company}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(company.recordCount)} registros
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      {formatCurrency(company.totalAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Estados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.statusBreakdown.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge className={statusColors[status.status] || "bg-gray-100 text-gray-800"}>
                      {statusLabels[status.status] || status.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {formatNumber(status.count)} registros
                    </span>
                  </div>
                  <div className="font-medium text-sm">
                    {formatCurrency(status.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Region Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Por Región</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.regionBreakdown.slice(0, 5).map((region) => (
                <div key={region.region} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium truncate max-w-[150px]" title={region.region}>
                      {region.region || 'Sin región'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatNumber(region.count)} reg.
                    </span>
                  </div>
                  <div className="font-medium text-sm">
                    {formatCurrency(region.amount)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Datos Detallados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Datos Detallados de Notas de Venta</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDetails ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-pulse text-gray-500">Cargando datos detallados...</div>
            </div>
          ) : !detailedData || detailedData.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No hay datos de notas de venta disponibles
            </div>
          ) : (
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant. Confirmada</TableHead>
                    <TableHead>Cant. Requerida</TableHead>
                    <TableHead>Precio Unit.</TableHead>
                    <TableHead>Monto Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Compromiso</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead>Segmento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedData.slice(0, 50).map((record) => {
                    const pendingAmount = calculatePendingAmount(record);
                    const caprco2 = record.originalData?.CAPRCO2 ? parseFloat(record.originalData.CAPRCO2) : 0;
                    const caprex2 = record.originalData?.CAPREX2 ? parseFloat(record.originalData.CAPREX2) : 0;
                    const ppprne = record.originalData?.PPPRNE ? parseFloat(record.originalData.PPPRNE) : 0;
                    
                    return (
                      <TableRow key={record.id} data-testid={`row-nvv-${record.id}`}>
                        <TableCell className="font-medium" data-testid={`text-salesperson-${record.id}`}>
                          {record.salesperson || 'Sin vendedor'}
                        </TableCell>
                        <TableCell data-testid={`text-client-${record.id}`}>
                          {record.clientName}
                        </TableCell>
                        <TableCell data-testid={`text-product-${record.id}`}>
                          {record.productName || record.originalData?.NOKOPR || 'Sin producto'}
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
                        <TableCell data-testid={`text-segment-${record.id}`}>
                          {record.segment || 'Sin segmento'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          <div className="mt-4 text-sm text-gray-600">
            Mostrando hasta 50 registros más recientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}