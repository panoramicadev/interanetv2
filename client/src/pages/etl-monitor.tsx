import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Database, 
  Loader2, 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  TrendingUp,
  Calendar,
  FileText,
  Server,
  Filter,
  Settings,
  Download,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface ETLExecution {
  id: string;
  etlName: string;
  executionDate: string;
  status: string;
  period: string;
  documentTypes: string;
  branches: string;
  recordsProcessed: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
  watermarkDate: string | null;
}

interface ETLConfig {
  id: string;
  etlName: string;
  customWatermark: string | null;
  useCustomWatermark: boolean;
  keepCustomWatermark: boolean;
  timeoutMinutes: number;
  intervalMinutes: number;
  createdAt: string;
  updatedAt: string;
}

interface ETLStatus {
  lastExecution: ETLExecution | null;
  isRunning: boolean;
  history: ETLExecution[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  config: ETLConfig;
}

// Configuración de ETLs disponibles
const ETL_CONFIGS = [
  {
    id: 'ventas_incremental',
    name: 'Ventas Incremental',
    description: 'ETL incremental de ventas desde SQL Server (ejecuta cada 15 min)',
    icon: TrendingUp,
    color: 'blue',
  },
  // Aquí se pueden agregar más ETLs en el futuro
  // {
  //   id: 'compras_incremental',
  //   name: 'Compras Incremental',
  //   description: 'ETL incremental de compras desde SQL Server',
  //   icon: ShoppingCart,
  //   color: 'green',
  // },
];

export default function ETLMonitor() {
  const { user } = useAuth();
  const [selectedETL, setSelectedETL] = useState(ETL_CONFIGS[0].id);
  const [autoRefresh, setAutoRefresh] = useState(true);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-spinner" />
      </div>
    );
  }

  // Only admin and supervisor can access ETL monitor
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

  const currentETL = ETL_CONFIGS.find(etl => etl.id === selectedETL) || ETL_CONFIGS[0];
  const ETLIcon = currentETL.icon;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-8 w-8" />
            Monitor ETL
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoreo y control de procesos de extracción, transformación y carga de datos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-toggle-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Actualización Auto' : 'Actualización Manual'}
          </Button>
        </div>
      </div>

      {/* ETL Selector Tabs */}
      <Tabs value={selectedETL} onValueChange={setSelectedETL} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:w-auto md:inline-grid" style={{ gridTemplateColumns: `repeat(${ETL_CONFIGS.length}, minmax(0, 1fr))` }}>
          {ETL_CONFIGS.map((etl) => {
            const Icon = etl.icon;
            return (
              <TabsTrigger 
                key={etl.id} 
                value={etl.id}
                className="flex items-center gap-2"
                data-testid={`tab-${etl.id}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{etl.name}</span>
                <span className="sm:hidden">{etl.name.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ETL_CONFIGS.map((etl) => (
          <TabsContent key={etl.id} value={etl.id} className="space-y-6 mt-6">
            {/* ETL Description Card */}
            <Card className={`bg-gradient-to-r ${etl.color === 'green' ? 'from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800' : 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800'}`}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${etl.color === 'green' ? 'text-green-900 dark:text-green-100' : 'text-blue-900 dark:text-blue-100'}`}>
                  <Server className="h-5 w-5" />
                  {etl.name}
                </CardTitle>
                <CardDescription className={etl.color === 'green' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}>
                  {etl.description}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Status Section */}
            <ETLStatusSection etlName={etl.id} autoRefresh={autoRefresh} />

            {/* History Section */}
            <ETLHistorySection etlName={etl.id} autoRefresh={autoRefresh} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ETL Status Section Component
function ETLStatusSection({ etlName, autoRefresh }: { etlName: string; autoRefresh: boolean }) {
  const { toast } = useToast();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [customWatermark, setCustomWatermark] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(10);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [keepCustomWatermark, setKeepCustomWatermark] = useState(false);

  // Fetch ETL status
  const { data: status, isLoading } = useQuery<ETLStatus>({
    queryKey: [`/api/etl/status?etlName=${etlName}`],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    retry: 2, // Max 2 retries on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // Execute ETL mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/etl/execute?etlName=${etlName}`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "ETL Ejecutado",
        description: `Se procesaron ${data.recordsProcessed || 0} registros en ${Math.round(data.executionTimeMs / 1000)}s`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/etl/status?etlName=${etlName}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al ejecutar ETL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel ETL mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/etl/cancel?etlName=${etlName}`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "ETL Cancelado",
        description: data.message || "El proceso ETL ha sido cancelado exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/etl/status?etlName=${etlName}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al cancelar ETL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update ETL configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (configData: { customWatermark?: string; timeoutMinutes?: number; intervalMinutes?: number; keepCustomWatermark?: boolean }) => {
      return await apiRequest(`/api/etl/config?etlName=${etlName}`, {
        method: 'POST',
        data: configData,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Configuración Actualizada",
        description: data.message || "La configuración del ETL se actualizó exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/etl/status?etlName=${etlName}`] });
      setShowConfigDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar configuración",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize config form values when dialog opens
  useEffect(() => {
    if (showConfigDialog && status?.config) {
      setTimeoutMinutes(status.config.timeoutMinutes);
      setIntervalMinutes(status.config.intervalMinutes || 15);
      setKeepCustomWatermark(status.config.keepCustomWatermark || false);
      setCustomWatermark('');
    }
  }, [showConfigDialog, status?.config]);

  const handleExecute = () => {
    if (status?.isRunning) {
      toast({
        title: "ETL en ejecución",
        description: "Ya hay un proceso ETL en ejecución. Por favor espera a que termine.",
        variant: "destructive",
      });
      return;
    }
    executeMutation.mutate();
  };

  const handleCancel = () => {
    if (!status?.isRunning) {
      toast({
        title: "No hay proceso en ejecución",
        description: "No hay ningún proceso ETL en ejecución para cancelar.",
        variant: "destructive",
      });
      return;
    }
    cancelMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const lastExecution = status?.lastExecution;
  const isRunning = status?.isRunning || false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Current Status Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Estado Actual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isRunning ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <div>
                    <p className="font-semibold text-lg">ETL en Ejecución</p>
                    <p className="text-sm text-muted-foreground">
                      Procesando datos desde SQL Server...
                    </p>
                  </div>
                </>
              ) : lastExecution?.status === 'success' ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-lg">ETL Completado</p>
                    <p className="text-sm text-muted-foreground">
                      Última ejecución exitosa
                    </p>
                  </div>
                </>
              ) : lastExecution?.status === 'failed' || lastExecution?.status === 'error' ? (
                <>
                  <XCircle className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="font-semibold text-lg">ETL Fallido</p>
                    <p className="text-sm text-muted-foreground">
                      La última ejecución tuvo errores
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Database className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="font-semibold text-lg">Sin Ejecutar</p>
                    <p className="text-sm text-muted-foreground">
                      No hay registros de ejecución
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowConfigDialog(true)}
                disabled={isRunning}
                size="lg"
                variant="outline"
                data-testid="button-config-etl"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurar
              </Button>
              {isRunning ? (
                <Button
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  size="lg"
                  variant="destructive"
                  data-testid="button-cancel-etl"
                >
                  {cancelMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar Proceso
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleExecute}
                  disabled={executeMutation.isPending}
                  size="lg"
                  data-testid="button-execute-etl"
                >
                  {executeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Ejecutar ETL
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {lastExecution && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Última Actualización</p>
                <p className="font-semibold" data-testid="text-last-execution">
                  {formatDistanceToNow(new Date(lastExecution.executionDate), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(lastExecution.executionDate).toLocaleString('es-CL')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Registros fact_ventas</p>
                <p className="font-semibold text-2xl" data-testid="text-records-processed">
                  {(lastExecution as any).totalFactVentasRecords?.toLocaleString('es-CL') || '0'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiempo de Ejecución</p>
                <p className="font-semibold">
                  {lastExecution.executionTimeMs 
                    ? `${(lastExecution.executionTimeMs / 1000).toFixed(2)}s`
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Período Procesado</p>
                <p className="font-semibold text-sm">{lastExecution.period}</p>
              </div>
            </div>
          )}

          {lastExecution?.errorMessage && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">Error:</p>
              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                {lastExecution.errorMessage}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Ejecuciones</p>
            <p className="text-2xl font-bold">{status?.totalExecutions || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Exitosas</p>
            <p className="text-2xl font-bold text-green-600">
              {status?.successfulExecutions || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fallidas</p>
            <p className="text-2xl font-bold text-red-600">
              {status?.failedExecutions || 0}
            </p>
          </div>
          {lastExecution?.watermarkDate && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">Watermark Actual</p>
              <p className="text-sm font-semibold">
                {new Date(lastExecution.watermarkDate).toLocaleString('es-CL')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar ETL</DialogTitle>
            <DialogDescription>
              Ajusta la configuración del proceso ETL. El watermark personalizado se usará solo una vez,
              luego el proceso volverá a modo incremental.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Config Display */}
            {status?.config && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Configuración Actual:
                </p>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p>• Timeout: {status.config.timeoutMinutes} minutos</p>
                  <p>• Intervalo automático: {status.config.intervalMinutes} minutos</p>
                  {status.config.useCustomWatermark && status.config.customWatermark && (
                    <p>• Watermark personalizado activo: {new Date(status.config.customWatermark).toLocaleDateString('es-CL')}</p>
                  )}
                  {!status.config.useCustomWatermark && (
                    <p>• Modo: Incremental (desde última ejecución)</p>
                  )}
                </div>
              </div>
            )}

            {/* Watermark Configuration */}
            <div className="space-y-2">
              <Label htmlFor="customWatermark">
                Fecha de Inicio Personalizada (opcional)
              </Label>
              <Input
                id="customWatermark"
                type="date"
                value={customWatermark}
                onChange={(e) => setCustomWatermark(e.target.value)}
                data-testid="input-custom-watermark"
              />
              <p className="text-xs text-muted-foreground">
                Si se configura, el ETL procesará datos desde esta fecha solo en la próxima ejecución.
                Luego volverá automáticamente a modo incremental.
              </p>
              
              {/* Keep Custom Watermark Checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="keepCustomWatermark"
                  checked={keepCustomWatermark}
                  onCheckedChange={(checked) => setKeepCustomWatermark(checked as boolean)}
                  data-testid="checkbox-keep-watermark"
                />
                <Label
                  htmlFor="keepCustomWatermark"
                  className="text-sm font-normal cursor-pointer"
                >
                  Mantener watermark personalizado permanente
                </Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Si está activado, el watermark personalizado se mantendrá en todas las ejecuciones hasta que lo desactives.
              </p>
            </div>

            {/* Timeout Configuration */}
            <div className="space-y-2">
              <Label htmlFor="timeout">
                Timeout (minutos)
              </Label>
              <Input
                id="timeout"
                type="number"
                min="1"
                max="60"
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(parseInt(e.target.value) || 10)}
                data-testid="input-timeout"
              />
              <p className="text-xs text-muted-foreground">
                Tiempo máximo de ejecución antes de cancelar automáticamente el proceso.
              </p>
            </div>

            {/* Interval Configuration */}
            <div className="space-y-2">
              <Label htmlFor="interval">
                Intervalo Automático (minutos)
              </Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="1440"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 15)}
                data-testid="input-interval"
              />
              <p className="text-xs text-muted-foreground">
                Frecuencia de ejecución automática del ETL. Requiere reiniciar el servidor para aplicar cambios.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfigDialog(false)}
              data-testid="button-cancel-config"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                updateConfigMutation.mutate({
                  customWatermark: customWatermark || undefined,
                  timeoutMinutes,
                  intervalMinutes,
                  keepCustomWatermark,
                });
              }}
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-config"
            >
              {updateConfigMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Configuración'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ETL History Section Component
function ETLHistorySection({ etlName, autoRefresh }: { etlName: string; autoRefresh: boolean }) {
  // Date filter state - default to last 30 days
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [filterEnabled, setFilterEnabled] = useState(false);

  // Build query URL with optional date filters
  const queryUrl = filterEnabled 
    ? `/api/etl/status?etlName=${etlName}&startDate=${startDate}&endDate=${endDate}`
    : `/api/etl/status?etlName=${etlName}`;

  const { data: status } = useQuery<ETLStatus>({
    queryKey: [queryUrl],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    retry: 2, // Max 2 retries on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  const history = status?.history || [];

  const handleApplyFilter = () => {
    setFilterEnabled(true);
  };

  const handleClearFilter = () => {
    setFilterEnabled(false);
    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Exitoso
          </Badge>
        );
      case 'failed':
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Fallido
          </Badge>
        );
      case 'running':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            En Ejecución
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historial de Ejecuciones
        </CardTitle>
        <CardDescription>
          {filterEnabled 
            ? `Mostrando ${history.length} ejecuciones entre ${format(new Date(startDate), 'dd/MM/yyyy', { locale: es })} y ${format(new Date(endDate), 'dd/MM/yyyy', { locale: es })}`
            : `Últimas ${history.length} ejecuciones del ETL`
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Date Filter Controls */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Filtrar por Fecha</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start-date" className="text-xs">Fecha Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date" className="text-xs">Fecha Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
                data-testid="input-end-date"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleApplyFilter}
                size="sm"
                className="flex-1"
                data-testid="button-apply-filter"
              >
                <Filter className="h-3 w-3 mr-1" />
                Aplicar
              </Button>
              {filterEnabled && (
                <Button
                  onClick={handleClearFilter}
                  size="sm"
                  variant="outline"
                  data-testid="button-clear-filter"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay historial de ejecuciones disponible</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Tiempo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((execution) => (
                  <TableRow key={execution.id} data-testid={`row-execution-${execution.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(execution.executionDate), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(execution.executionDate).toLocaleString('es-CL')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(execution.status)}</TableCell>
                    <TableCell className="text-sm">{execution.period}</TableCell>
                    <TableCell className="text-right font-mono">
                      {execution.recordsProcessed?.toLocaleString('es-CL') || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {execution.executionTimeMs 
                        ? `${(execution.executionTimeMs / 1000).toFixed(2)}s`
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Sync History Row Component with collapsible error details
function SyncHistoryRow({ sync, index }: { sync: any; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasError = sync.status === 'error' && sync.errorMessage;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Exitoso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Parcial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow data-testid={`row-sync-${index}`}>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">
              {formatDistanceToNow(new Date(sync.createdAt || sync.startedAt), {
                addSuffix: true,
                locale: es,
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(sync.createdAt || sync.startedAt).toLocaleString('es-CL')}
            </span>
          </div>
        </TableCell>
        <TableCell>{getStatusBadge(sync.status)}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {sync.syncMode === 'incremental' ? 'Incremental' : 'Completo'}
          </Badge>
        </TableCell>
        <TableCell className="text-sm">
          {sync.startDate && sync.endDate 
            ? `${format(new Date(sync.startDate), 'dd/MM/yy')} - ${format(new Date(sync.endDate), 'dd/MM/yy')}`
            : '-'}
        </TableCell>
        <TableCell className="text-right font-mono">
          {sync.recordsNew?.toLocaleString('es-CL') || '-'}
        </TableCell>
        <TableCell className="text-right">
          {sync.duration 
            ? `${(sync.duration / 1000).toFixed(2)}s`
            : '-'}
        </TableCell>
        <TableCell>
          {hasError && (
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                data-testid={`button-toggle-error-${index}`}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </TableCell>
      </TableRow>
      {hasError && (
        <TableRow>
          <TableCell colSpan={7} className="p-0 border-0">
            <CollapsibleContent>
              <div className="px-4 py-3 bg-destructive/10 border-l-4 border-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-destructive mb-1">
                      Error de Sincronización
                    </p>
                    <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap break-all">
                      {sync.errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      )}
    </Collapsible>
  );
}

