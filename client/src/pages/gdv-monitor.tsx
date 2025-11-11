import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Loader2, 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Calendar,
  FileText,
  RefreshCw,
  Filter,
  DollarSign,
  Building2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

interface GdvSyncLog {
  id: string;
  executionDate: string;
  status: string;
  recordsProcessed: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  statusChanges: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
}

interface GdvSummary {
  totalGdv: number;
  totalAbiertas: number;
  totalCerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

interface GdvBySucursal {
  sucursal: string;
  totalGdv: number;
  abiertas: number;
  cerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

export default function GdvMonitor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Filtros globales - default últimos 30 días
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>(['004', '006', '007']);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin and supervisor can access GDV monitor
  if (user.role !== 'admin' && user.role !== 'supervisor') {
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

  // Build query params
  const buildFilters = () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedSucursales.length > 0) {
      params.append('sucursales', selectedSucursales.join(','));
    }
    return params.toString();
  };

  // Fetch GDV summary
  const { data: summary, isLoading: summaryLoading } = useQuery<GdvSummary>({
    queryKey: ['/api/etl/gdv/summary', startDate, endDate, selectedSucursales.join(',')],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/gdv/summary${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar resumen de GDV');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch GDV by sucursal
  const { data: bySucursal, isLoading: sucursalLoading } = useQuery<GdvBySucursal[]>({
    queryKey: ['/api/etl/gdv/by-sucursal', startDate, endDate, selectedSucursales.join(',')],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/gdv/by-sucursal${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por sucursal');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch GDV sync history
  const { data: history, isLoading: historyLoading } = useQuery<GdvSyncLog[]>({
    queryKey: ['/api/etl/sync-gdv/history'],
    queryFn: async () => {
      const response = await fetch('/api/etl/sync-gdv/history?limit=10');
      if (!response.ok) throw new Error('Error al cargar historial de sincronización');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Execute GDV ETL mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/etl/sync-gdv', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ ETL de GDV Ejecutado",
        description: `Se procesaron ${data.recordsProcessed || 0} registros (${data.recordsInserted || 0} nuevos, ${data.recordsUpdated || 0} actualizados)`,
      });
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/etl/gdv/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/gdv/by-sucursal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/sync-gdv/history'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al ejecutar ETL de GDV",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const toggleSucursal = (sucursal: string) => {
    setSelectedSucursales(prev => 
      prev.includes(sucursal) 
        ? prev.filter(s => s !== sucursal)
        : [...prev, sucursal]
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Package className="h-8 w-8" />
            Monitor de GDV
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de Guías de Despacho de Venta (GDV) - Sucursales 004, 006, 007
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
            size="lg"
            data-testid="button-execute-gdv-etl"
          >
            {executeMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <PlayCircle className="h-5 w-5 mr-2" />
                Ejecutar ETL de GDV
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-toggle-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Filtros Globales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div>
              <Label>Sucursales</Label>
              <div className="flex gap-2 mt-2">
                {['004', '006', '007'].map(sucursal => (
                  <Button
                    key={sucursal}
                    variant={selectedSucursales.includes(sucursal) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSucursal(sucursal)}
                    data-testid={`button-sucursal-${sucursal}`}
                  >
                    {sucursal}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-gdv">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total GDV</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-total-gdv">
                  {summary?.totalGdv || 0}
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="default" data-testid="badge-abiertas">
                    {summary?.totalAbiertas || 0} Abiertas
                  </Badge>
                  <Badge variant="secondary" data-testid="badge-cerradas">
                    {summary?.totalCerradas || 0} Cerradas
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-monto-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-monto-total">
                  {formatCurrency(summary?.montoTotal || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas las GDV (abiertas + cerradas)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-montos-estado">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montos por Estado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abiertas:</span>
                  <span className="font-semibold" data-testid="text-monto-abiertas">
                    {formatCurrency(summary?.montoAbiertas || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cerradas:</span>
                  <span className="font-semibold" data-testid="text-monto-cerradas">
                    {formatCurrency(summary?.montoCerradas || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas por Sucursal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Métricas por Sucursal
          </CardTitle>
          <CardDescription>
            Detalle de GDV agrupadas por sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sucursalLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : bySucursal && bySucursal.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-right">Total GDV</TableHead>
                  <TableHead className="text-right">Abiertas</TableHead>
                  <TableHead className="text-right">Cerradas</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead className="text-right">Monto Abiertas</TableHead>
                  <TableHead className="text-right">Monto Cerradas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySucursal.map((row) => (
                  <TableRow key={row.sucursal} data-testid={`row-sucursal-${row.sucursal}`}>
                    <TableCell className="font-medium">{row.sucursal}</TableCell>
                    <TableCell className="text-right" data-testid={`text-total-${row.sucursal}`}>
                      {row.totalGdv}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-abiertas-${row.sucursal}`}>
                      <Badge variant="default">{row.abiertas}</Badge>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-cerradas-${row.sucursal}`}>
                      <Badge variant="secondary">{row.cerradas}</Badge>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-monto-total-${row.sucursal}`}>
                      {formatCurrency(row.montoTotal)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-monto-abiertas-${row.sucursal}`}>
                      {formatCurrency(row.montoAbiertas)}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-monto-cerradas-${row.sucursal}`}>
                      {formatCurrency(row.montoCerradas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No hay datos de GDV para el periodo seleccionado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Historial de Sincronización */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Sincronización
          </CardTitle>
          <CardDescription>
            Últimas 10 ejecuciones del ETL de GDV
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : history && history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Procesados</TableHead>
                  <TableHead className="text-right">Insertados</TableHead>
                  <TableHead className="text-right">Actualizados</TableHead>
                  <TableHead className="text-right">Cambios Estado</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((execution) => (
                  <TableRow key={execution.id} data-testid={`row-history-${execution.id}`}>
                    <TableCell data-testid={`text-date-${execution.id}`}>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {format(new Date(execution.executionDate), "dd MMM yyyy HH:mm", { locale: es })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(execution.executionDate), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`badge-status-${execution.id}`}>
                      {execution.status === 'success' ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Exitoso
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-processed-${execution.id}`}>
                      {execution.recordsProcessed || 0}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-inserted-${execution.id}`}>
                      {execution.recordsInserted || 0}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-updated-${execution.id}`}>
                      {execution.recordsUpdated || 0}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-status-changes-${execution.id}`}>
                      {execution.statusChanges || 0}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-duration-${execution.id}`}>
                      {execution.executionTimeMs 
                        ? `${(execution.executionTimeMs / 1000).toFixed(2)}s`
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No hay registros de sincronización
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
