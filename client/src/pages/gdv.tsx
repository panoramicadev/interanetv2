import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Database, 
  BarChart3, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Package,
  DollarSign,
  Building2,
  FileText,
  TrendingUp,
  Loader2,
  History
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface GdvSyncLog {
  id: string;
  status: string;
  period: string;
  branches: string;
  recordsProcessed: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  statusChanges: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
  watermarkDate: string | null;
  startTime: string;
  endTime: string | null;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: es });
  } catch {
    return dateString;
  }
}

function getSucursalName(sudo: string | number | null): string {
  if (sudo === null) return 'Sin sucursal';
  const sucursales: Record<string, string> = {
    '4': 'Santiago',
    '6': 'Antofagasta',
    '7': 'Concepción',
    '004': 'Santiago',
    '006': 'Antofagasta',
    '007': 'Concepción'
  };
  return sucursales[String(sudo)] || String(sudo);
}

export default function GDVPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user || (user.role !== "admin" && user.role !== "supervisor" && user.role !== "logistica_bodega")) {
    setLocation("/dashboard");
    return null;
  }

  const canSync = user.role === "admin" || user.role === "supervisor";

  const { data: syncHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery<GdvSyncLog[]>({
    queryKey: ['/api/etl/sync-gdv/history'],
    enabled: canSync,
  });

  const { data: gdvSummary, isLoading: isLoadingSummary } = useQuery<GdvSummary>({
    queryKey: ['/api/etl/gdv/summary'],
    enabled: canSync,
  });

  const { data: gdvBySucursal, isLoading: isLoadingBySucursal } = useQuery<GdvBySucursal[]>({
    queryKey: ['/api/etl/gdv/by-sucursal'],
    enabled: canSync,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/etl/sync-gdv');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronización completada",
        description: `Se procesaron ${data.result?.recordsProcessed || 0} registros`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/sync-gdv/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/gdv/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/gdv/by-sucursal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/gdv-pending'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error en sincronización",
        description: error.message || "No se pudo sincronizar con el ERP",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800" data-testid="badge-status-success"><CheckCircle className="w-3 h-3 mr-1" /> Exitoso</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800" data-testid="badge-status-failed"><XCircle className="w-3 h-3 mr-1" /> Fallido</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800" data-testid="badge-status-running"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Ejecutando</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800" data-testid="badge-status-unknown"><AlertCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
    }
  };

  const lastSync = syncHistory && syncHistory.length > 0 ? syncHistory[0] : null;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-gdv-title">Guías de Despacho (GDV)</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="text-gdv-description">
              Monitorea las guías de despacho pendientes sincronizadas desde el ERP
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {lastSync && (
              <div className="text-sm text-gray-500 flex items-center gap-2" data-testid="text-last-sync">
                <Clock className="w-4 h-4" />
                Última sync: {formatDate(lastSync.startTime)}
              </div>
            )}
            {canSync && (
              <Button 
                onClick={() => syncMutation.mutate()} 
                disabled={syncMutation.isPending}
                className="flex items-center gap-2"
                data-testid="button-sync-gdv"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sincronizar Ahora
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="tabs-gdv">
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list-gdv">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2" data-testid="tab-gdv-dashboard">
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2" data-testid="tab-gdv-history">
            <History className="h-4 w-4" />
            <span>Historial ETL</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6" data-testid="content-dashboard">
          {isLoadingSummary ? (
            <div className="flex items-center justify-center py-12" data-testid="loading-dashboard">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200" data-testid="card-total-gdv">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Total Documentos GDV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-100" data-testid="value-total-gdv">
                      {(gdvSummary?.totalGdv ?? 0).toLocaleString('es-CL')}
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      guías de despacho en sistema
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200" data-testid="card-monto-abiertas">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Monto GDV Abiertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-900 dark:text-green-100" data-testid="value-monto-abiertas">
                      {formatCurrency(gdvSummary?.montoAbiertas ?? 0)}
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      valor neto pendiente de facturar
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200" data-testid="card-abiertas">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      GDV Abiertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-900 dark:text-amber-100" data-testid="value-abiertas">
                      {(gdvSummary?.totalAbiertas ?? 0).toLocaleString('es-CL')}
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      pendientes de cierre
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200" data-testid="card-monto-total">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Monto Total
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-900 dark:text-purple-100" data-testid="value-monto-total">
                      {formatCurrency(gdvSummary?.montoTotal ?? 0)}
                    </div>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      valor neto total (abiertas + cerradas)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-by-sucursal">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Por Sucursal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingBySucursal ? (
                      <div className="flex items-center justify-center py-8" data-testid="loading-by-sucursal">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : gdvBySucursal && gdvBySucursal.length > 0 ? (
                      <div className="space-y-4">
                        {gdvBySucursal.map((item, idx) => (
                          <div 
                            key={`${item.sucursal}-${idx}`} 
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            data-testid={`sucursal-item-${item.sucursal}`}
                          >
                            <div>
                              <p className="font-medium">{getSucursalName(item.sucursal)}</p>
                              <p className="text-sm text-gray-500">{item.totalGdv} documentos ({item.abiertas} abiertas)</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">{formatCurrency(item.montoAbiertas)}</p>
                              <p className="text-sm text-gray-500">pendiente</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8" data-testid="text-no-data-sucursal">No hay datos disponibles. Ejecuta una sincronización.</p>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-sync-status">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Estado de la Sincronización
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lastSync ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Estado:</span>
                          {getStatusBadge(lastSync.status)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Fecha:</span>
                          <span className="font-medium" data-testid="value-sync-date">{formatDate(lastSync.startTime)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Registros procesados:</span>
                          <span className="font-medium" data-testid="value-records-processed">{(lastSync.recordsProcessed ?? 0).toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Registros insertados:</span>
                          <span className="font-medium" data-testid="value-records-inserted">{(lastSync.recordsInserted ?? 0).toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">GDV eliminadas:</span>
                          <span className="font-medium" data-testid="value-status-changes">{(lastSync.statusChanges ?? 0).toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Tiempo de ejecución:</span>
                          <span className="font-medium" data-testid="value-execution-time">{lastSync.executionTimeMs ? `${(lastSync.executionTimeMs / 1000).toFixed(2)}s` : '-'}</span>
                        </div>
                        {lastSync.errorMessage && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="error-message">
                            <p className="text-sm text-red-700">{lastSync.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8" data-testid="text-no-sync">No hay sincronizaciones registradas</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6" data-testid="content-history">
          <Card data-testid="card-sync-history">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Sincronizaciones
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchHistory()}
                  data-testid="button-refresh-history"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-history">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : syncHistory && syncHistory.length > 0 ? (
                <Table data-testid="table-sync-history">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Procesados</TableHead>
                      <TableHead className="text-right">Insertados</TableHead>
                      <TableHead className="text-right">Eliminados</TableHead>
                      <TableHead className="text-right">Tiempo</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.map((log) => (
                      <TableRow key={log.id} data-testid={`row-sync-${log.id}`}>
                        <TableCell data-testid={`cell-date-${log.id}`}>{formatDate(log.startTime)}</TableCell>
                        <TableCell data-testid={`cell-status-${log.id}`}>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-right" data-testid={`cell-processed-${log.id}`}>{(log.recordsProcessed ?? 0).toLocaleString('es-CL')}</TableCell>
                        <TableCell className="text-right" data-testid={`cell-inserted-${log.id}`}>{(log.recordsInserted ?? 0).toLocaleString('es-CL')}</TableCell>
                        <TableCell className="text-right" data-testid={`cell-changes-${log.id}`}>{(log.statusChanges ?? 0).toLocaleString('es-CL')}</TableCell>
                        <TableCell className="text-right" data-testid={`cell-time-${log.id}`}>{log.executionTimeMs ? `${(log.executionTimeMs / 1000).toFixed(2)}s` : '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-red-600" data-testid={`cell-error-${log.id}`}>{log.errorMessage || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-gray-500 py-8" data-testid="text-no-history">No hay historial de sincronizaciones</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
