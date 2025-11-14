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
  AlertCircle,
  Package,
  DollarSign,
  Building2
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

interface ETLExecution {
  id: string;
  etlName: string;
  startTime: string;
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

// GDV Interfaces
interface GdvSyncLog {
  id: string;
  startTime: string;
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

// NVV Interfaces
interface NvvSyncLog {
  id: string;
  startTime: string;
  endTime: string | null;
  status: string;
  recordsProcessed: number | null;
  recordsInserted: number | null;
  recordsUpdated: number | null;
  statusChanges: number | null;
  executionTimeMs: number | null;
  errorMessage: string | null;
  watermarkStart: string | null;
  watermarkEnd: string | null;
}

interface NvvStateChange {
  id: string;
  executionId: string;
  idmaeedo: string;
  nudo: string | null;
  sudo: string | null;
  changeType: string;
  previousStatus: string | null;
  newStatus: string;
  monto: string | null;
  changedAt: string;
  executionStartTime: string | null;
  executionEndTime: string | null;
  watermarkStart: string | null;
  watermarkEnd: string | null;
}

interface NvvSummary {
  totalNvv: number;
  totalAbiertas: number;
  totalCerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

interface NvvBySucursal {
  sucursal: string;
  totalNvv: number;
  abiertas: number;
  cerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

interface NvvByVendedor {
  sucursal: string;
  kofulido: string;
  nombreVendedor: string;
  totalNvv: number;
  abiertas: number;
  cerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

interface NvvByBodega {
  sucursal: string;
  bosulido: string;
  nombreBodega: string;
  totalNvv: number;
  abiertas: number;
  cerradas: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
}

interface NvvBySegmentoCliente {
  ruen: string | null;
  nombre_segmento_cliente: string | null;
  totalNvv: number;
  abiertas: number;
  cerradas: number;
  pendientes: number;
  montoTotal: number;
  montoAbiertas: number;
  montoCerradas: number;
  montoPendientes: number;
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
  {
    id: 'gdv',
    name: 'GDV',
    description: 'Monitoreo de Guías de Despacho de Venta (sucursales 004, 006, 007)',
    icon: Package,
    color: 'purple',
  },
  {
    id: 'nvv',
    name: 'NVV',
    description: 'Monitoreo de Notas de Venta pendientes',
    icon: FileText,
    color: 'orange',
  },
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
            {etl.id === 'gdv' ? (
              <GDVTabContent autoRefresh={autoRefresh} />
            ) : etl.id === 'nvv' ? (
              <NVVTabContent autoRefresh={autoRefresh} />
            ) : (
              <>
                {/* Standard ETL Sections */}
                <ETLStatusSection etlName={etl.id} autoRefresh={autoRefresh} />
                <ETLHistorySection etlName={etl.id} autoRefresh={autoRefresh} />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ETL Progress State
interface ETLProgress {
  step: number;
  totalSteps: number;
  message: string;
  details?: string;
  percentage: number;
}

// ETL Status Section Component
function ETLStatusSection({ 
  etlName, 
  autoRefresh,
  showDocumentTypes = true,
  showBranches = true
}: { 
  etlName: string; 
  autoRefresh: boolean;
  showDocumentTypes?: boolean;
  showBranches?: boolean;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDiagnosticsDialog, setShowDiagnosticsDialog] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any>(null);
  const [customWatermark, setCustomWatermark] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(10);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [keepCustomWatermark, setKeepCustomWatermark] = useState(false);
  const [etlProgress, setEtlProgress] = useState<ETLProgress | null>(null);
  const [isETLExecuting, setIsETLExecuting] = useState(false);
  const [buttonState, setButtonState] = useState<'idle' | 'clicked' | 'starting' | 'running'>('idle');

  // Fetch ETL status
  const { data: status, isLoading } = useQuery<ETLStatus>({
    queryKey: [`/api/etl/status?etlName=${etlName}`],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
    retry: 2, // Max 2 retries on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // Reset button state when ETL completes
  useEffect(() => {
    if (!isETLExecuting && !status?.isRunning && buttonState !== 'idle') {
      setButtonState('idle');
    }
  }, [isETLExecuting, status?.isRunning, buttonState]);

  // Connect to ETL Progress Stream (SSE)
  useEffect(() => {
    if (!isETLExecuting && !status?.isRunning) {
      setEtlProgress(null);
      return;
    }

    console.log(`🔌 Conectando a SSE para progreso ETL (${etlName})...`);
    const eventSource = new EventSource(`/api/etl/progress?etlName=${etlName}`);
    
    eventSource.onopen = () => {
      console.log('✅ SSE conectado');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as ETLProgress;
        console.log('📊 Progreso recibido:', progress);
        setEtlProgress(progress);
        
        // If we received 100% completion, mark as not executing
        if (progress.percentage === 100) {
          setTimeout(() => {
            setIsETLExecuting(false);
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing ETL progress:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ ETL Progress SSE error:', error);
      eventSource.close();
      setIsETLExecuting(false);
    };

    return () => {
      console.log('🔌 Cerrando conexión SSE');
      eventSource.close();
    };
  }, [isETLExecuting, status?.isRunning]);

  // Execute ETL mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      // Set executing flag immediately to trigger SSE connection
      setIsETLExecuting(true);
      setButtonState('running');
      return await apiRequest(`/api/etl/execute?etlName=${etlName}`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      if (data.isRunning) {
        toast({
          title: "✅ ETL Iniciado Correctamente",
          description: data.message || "El proceso ETL se está ejecutando en segundo plano",
        });
        setButtonState('running');
      } else {
        toast({
          title: "✅ ETL Ejecutado",
          description: `Se procesaron ${data.recordsProcessed || 0} registros en ${Math.round((data.executionTimeMs || 0) / 1000)}s`,
        });
        setIsETLExecuting(false);
        setButtonState('idle');
      }
      // Invalidate to refetch status
      queryClient.invalidateQueries({ queryKey: [`/api/etl/status?etlName=${etlName}`] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al ejecutar ETL",
        description: error.message,
        variant: "destructive",
      });
      setIsETLExecuting(false);
      setButtonState('idle');
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

  // Run diagnostics mutation (Admin only)
  const diagnosticsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/etl/diagnostics?etlName=${etlName}`, {
        method: 'POST',
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('Diagnostics response:', data);
      console.log('Has summary?', !!data.summary);
      console.log('Has checks?', !!data.checks);
      setDiagnosticsResults(data);
      setShowDiagnosticsDialog(true);
      toast({
        title: "Diagnóstico Completado",
        description: `${data.summary?.successful || 0} exitosas, ${data.summary?.errors || 0} errores.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error en diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Run migrations mutation (Admin only)
  const migrationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/etl/run-migrations', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Migraciones Ejecutadas",
        description: data.message || "Las tablas del schema ventas fueron creadas exitosamente",
      });
      // Refresh status and re-run diagnostics
      queryClient.invalidateQueries({ queryKey: [`/api/etl/status?etlName=${etlName}`] });
      diagnosticsMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Error ejecutando migraciones",
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
    if (status?.isRunning || isETLExecuting) {
      toast({
        title: "⏳ ETL en ejecución",
        description: "Ya hay un proceso ETL en ejecución. Por favor espera a que termine.",
        variant: "destructive",
      });
      return;
    }
    
    // Immediate visual feedback and execution
    setButtonState('starting');
    setIsETLExecuting(true);
    
    // Show immediate toast
    toast({
      title: "🚀 Iniciando ETL...",
      description: "Conectando con SQL Server y preparando extracción de datos",
    });
    
    // Execute immediately
    executeMutation.mutate();
  };

  const handleCancel = () => {
    // Note: This function is only called when the cancel button is visible,
    // which already checks isRunning, so we can just execute the cancellation
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
  const isRunning = isETLExecuting || status?.isRunning || false;

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
            <div className="flex gap-2 flex-wrap">
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
              
              {/* Diagnostics Button - Admin only */}
              {user?.role === 'admin' && (
                <>
                  <Button
                    onClick={() => diagnosticsMutation.mutate()}
                    disabled={diagnosticsMutation.isPending}
                    size="lg"
                    variant="outline"
                    data-testid="button-diagnostics"
                    title="Ejecuta diagnóstico completo del sistema (logs en servidor)"
                  >
                    {diagnosticsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Diagnosticando...
                      </>
                    ) : (
                      <>
                        <Server className="h-4 w-4 mr-2" />
                        Diagnóstico
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => migrationsMutation.mutate()}
                    disabled={migrationsMutation.isPending}
                    size="lg"
                    variant="outline"
                    data-testid="button-migrations"
                    title="Ejecuta migraciones para crear las tablas del schema ventas"
                  >
                    {migrationsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Migrando...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Ejecutar Migraciones
                      </>
                    )}
                  </Button>
                </>
              )}
              
              {/* Emergency Cancel Button - Always visible when ETL is running */}
              {isRunning && (
                <Button
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  size="lg"
                  variant="destructive"
                  data-testid="button-cancel-etl"
                  title="Cancela cualquier ETL en ejecución (manual o automático)"
                >
                  {cancelMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Cancelar ETL
                    </>
                  )}
                </Button>
              )}
              
              {/* Execute Button - Only when NOT running */}
              {!isRunning && (
                <Button
                  onClick={handleExecute}
                  disabled={executeMutation.isPending || isETLExecuting}
                  size="lg"
                  data-testid="button-execute-etl"
                  className={`
                    transition-all duration-300 
                    ${buttonState === 'starting' || buttonState === 'running' ? 'animate-pulse' : ''}
                    ${buttonState === 'idle' ? 'hover:scale-105 active:scale-95' : ''}
                  `}
                >
                  {(buttonState === 'starting' || buttonState === 'running' || executeMutation.isPending) ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      <span className="animate-pulse">Iniciando ETL...</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-5 w-5 mr-2" />
                      <span className="font-semibold">Ejecutar ETL</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* ETL Configuration Section */}
          {status?.config && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground">Configuración ETL</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Intervalo Automático</p>
                  <p className="font-semibold text-sm">Cada {status.config.intervalMinutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timeout</p>
                  <p className="font-semibold text-sm">{status.config.timeoutMinutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Watermark Personalizado</p>
                  <p className="font-semibold text-sm">
                    {status.config.useCustomWatermark && status.config.customWatermark
                      ? new Date(status.config.customWatermark).toLocaleDateString('es-CL')
                      : 'No activo'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modo Persistente</p>
                  <p className="font-semibold text-sm">
                    {status.config.keepCustomWatermark ? 'Sí' : 'No'}
                  </p>
                </div>
              </div>
              {lastExecution && (showDocumentTypes || showBranches) && (
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                  {showDocumentTypes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tipos de Documento</p>
                      <p className="font-semibold text-sm">{lastExecution.documentTypes}</p>
                    </div>
                  )}
                  {showBranches && (
                    <div>
                      <p className="text-xs text-muted-foreground">Sucursales</p>
                      <p className="font-semibold text-sm">{lastExecution.branches}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {lastExecution && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Última Actualización</p>
                <p className="font-semibold" data-testid="text-last-execution">
                  {formatDistanceToNow(new Date(lastExecution.startTime), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(lastExecution.startTime).toLocaleString('es-CL')}
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

          {/* Progress Bar - Shown when ETL is running */}
          {isRunning && etlProgress && (
            <div className="pt-4 border-t space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {etlProgress.message}
                  </p>
                </div>
                <span className="text-sm font-semibold text-blue-600">
                  {etlProgress.percentage}%
                </span>
              </div>
              {etlProgress.details && (
                <p className="text-xs text-muted-foreground">
                  {etlProgress.details}
                </p>
              )}
              <div className="space-y-1">
                <Progress value={etlProgress.percentage} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  Paso {etlProgress.step} de {etlProgress.totalSteps}
                </p>
              </div>
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

      {/* Diagnostics Results Dialog */}
      <Dialog open={showDiagnosticsDialog} onOpenChange={setShowDiagnosticsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultados del Diagnóstico ETL</DialogTitle>
            <DialogDescription>
              Diagnóstico completo del sistema de schemas y permisos de PostgreSQL
            </DialogDescription>
          </DialogHeader>

          {!diagnosticsResults && (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Ejecutando diagnóstico...</p>
            </div>
          )}

          {diagnosticsResults && !diagnosticsResults.summary && (
            <div className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Diagnóstico completado pero sin datos de resumen.
              </p>
              <pre className="text-left text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(diagnosticsResults, null, 2)}
              </pre>
            </div>
          )}

          {diagnosticsResults && diagnosticsResults.summary && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {diagnosticsResults.summary.successful || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Exitosas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {diagnosticsResults.summary.warnings || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Advertencias</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {diagnosticsResults.summary.errors || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
              </div>

              {/* Critical Issues */}
              {diagnosticsResults.summary?.criticalIssues?.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                    ⚠️ Problemas Críticos
                  </h3>
                  <ul className="space-y-1">
                    {diagnosticsResults.summary.criticalIssues.map((issue: string, i: number) => (
                      <li key={i} className="text-sm text-red-800 dark:text-red-200">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Results */}
              <div className="space-y-2">
                <h3 className="font-semibold">Detalle de Verificaciones:</h3>
                {diagnosticsResults.checks?.map((check: any, i: number) => (
                  <div 
                    key={i}
                    className={`p-3 rounded-lg border ${
                      check.success 
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {check.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {check.name}
                        </p>
                        {check.details && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {check.details}
                          </p>
                        )}
                        {check.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Error: {check.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowDiagnosticsDialog(false)}>
              Cerrar
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
                          {formatDistanceToNow(new Date(execution.startTime), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(execution.startTime).toLocaleString('es-CL')}
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

// ==================================================================================
// GDV SECTIONS
// ==================================================================================

// GDV Tab Content - manages shared filter state
function GDVTabContent({ autoRefresh }: { autoRefresh: boolean }) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>(['004', '006', '007']);

  const buildFilters = () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (selectedSucursales.length > 0) {
      params.append('sucursales', selectedSucursales.join(','));
    }
    return params.toString();
  };

  const toggleSucursal = (sucursal: string) => {
    setSelectedSucursales(prev => 
      prev.includes(sucursal) 
        ? prev.filter(s => s !== sucursal)
        : [...prev, sucursal]
    );
  };

  const filterState = {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedSucursales,
    toggleSucursal,
    buildFilters,
  };

  return (
    <>
      <GDVStatusSection autoRefresh={autoRefresh} filterState={filterState} />
      <GDVMetricsSection autoRefresh={autoRefresh} filterState={filterState} />
      <GDVHistorySection autoRefresh={autoRefresh} />
    </>
  );
}

function GDVStatusSection({ 
  autoRefresh, 
  filterState 
}: { 
  autoRefresh: boolean; 
  filterState: {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    selectedSucursales: string[];
    toggleSucursal: (sucursal: string) => void;
    buildFilters: () => string;
  };
}) {
  const { toast } = useToast();
  const { startDate, setStartDate, endDate, setEndDate, selectedSucursales, toggleSucursal, buildFilters } = filterState;

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

  return (
    <>
      {/* Execute Button */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Control de Sincronización GDV
            </CardTitle>
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
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
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
              <Label htmlFor="gdv-startDate">Fecha Inicio</Label>
              <Input
                id="gdv-startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-gdv-start-date"
              />
            </div>
            <div>
              <Label htmlFor="gdv-endDate">Fecha Fin</Label>
              <Input
                id="gdv-endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-gdv-end-date"
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
                    data-testid={`button-gdv-sucursal-${sucursal}`}
                  >
                    {sucursal}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-gdv-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total GDV</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-gdv-total">
                  {summary?.totalGdv || 0}
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="default" data-testid="badge-gdv-abiertas">
                    {summary?.totalAbiertas || 0} Abiertas
                  </Badge>
                  <Badge variant="secondary" data-testid="badge-gdv-cerradas">
                    {summary?.totalCerradas || 0} Cerradas
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-gdv-monto-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-gdv-monto-total">
                  {formatCurrency(summary?.montoTotal || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas las GDV (abiertas + cerradas)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-gdv-montos-estado">
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
                  <span className="font-semibold" data-testid="text-gdv-monto-abiertas">
                    {formatCurrency(summary?.montoAbiertas || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cerradas:</span>
                  <span className="font-semibold" data-testid="text-gdv-monto-cerradas">
                    {formatCurrency(summary?.montoCerradas || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function GDVMetricsSection({ 
  autoRefresh,
  filterState
}: { 
  autoRefresh: boolean;
  filterState: {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    selectedSucursales: string[];
    toggleSucursal: (sucursal: string) => void;
    buildFilters: () => string;
  };
}) {
  const { startDate, endDate, selectedSucursales, buildFilters } = filterState;

  const { data: bySucursal, isLoading } = useQuery<GdvBySucursal[]>({
    queryKey: ['/api/etl/gdv/by-sucursal', startDate, endDate, selectedSucursales.join(',')],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/gdv/by-sucursal${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por sucursal');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
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
        {isLoading ? (
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
                <TableRow key={row.sucursal} data-testid={`row-gdv-sucursal-${row.sucursal}`}>
                  <TableCell className="font-medium">{row.sucursal}</TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-total-${row.sucursal}`}>
                    {row.totalGdv}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-abiertas-${row.sucursal}`}>
                    <Badge variant="default">{row.abiertas}</Badge>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-cerradas-${row.sucursal}`}>
                    <Badge variant="secondary">{row.cerradas}</Badge>
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-monto-total-${row.sucursal}`}>
                    {formatCurrency(row.montoTotal)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-monto-abiertas-${row.sucursal}`}>
                    {formatCurrency(row.montoAbiertas)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-monto-cerradas-${row.sucursal}`}>
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
  );
}

function GDVHistorySection({ autoRefresh }: { autoRefresh: boolean }) {
  const { data: history, isLoading } = useQuery<GdvSyncLog[]>({
    queryKey: ['/api/etl/sync-gdv/history'],
    queryFn: async () => {
      const response = await fetch('/api/etl/sync-gdv/history?limit=10');
      if (!response.ok) throw new Error('Error al cargar historial de sincronización');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  return (
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
        {isLoading ? (
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
                <TableRow key={execution.id} data-testid={`row-gdv-history-${execution.id}`}>
                  <TableCell data-testid={`text-gdv-date-${execution.id}`}>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {format(new Date(execution.startTime), "dd MMM yyyy HH:mm", { locale: es })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(execution.startTime), { 
                          addSuffix: true,
                          locale: es 
                        })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`badge-gdv-status-${execution.id}`}>
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
                  <TableCell className="text-right" data-testid={`text-gdv-processed-${execution.id}`}>
                    {execution.recordsProcessed || 0}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-inserted-${execution.id}`}>
                    {execution.recordsInserted || 0}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-updated-${execution.id}`}>
                    {execution.recordsUpdated || 0}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-status-changes-${execution.id}`}>
                    {execution.statusChanges || 0}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-gdv-duration-${execution.id}`}>
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
  );
}

// ==================================================================================
// NVV SECTIONS
// ==================================================================================

function NVVTabContent({ autoRefresh }: { autoRefresh: boolean }) {
  return (
    <>
      <ETLStatusSection 
        etlName="nvv" 
        autoRefresh={autoRefresh}
        showDocumentTypes={false}
        showBranches={false}
      />
      <ETLHistorySection etlName="nvv" autoRefresh={autoRefresh} />
    </>
  );
}

// Legacy NVV components below - will be removed after backend integration is complete
function NVVStatusSectionLegacy({ 
  autoRefresh, 
  filterState 
}: { 
  autoRefresh: boolean; 
  filterState: {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    selectedSucursales: string[];
    toggleSucursal: (sucursal: string) => void;
    selectedVendedores: string[];
    setSelectedVendedores: (vendedores: string[]) => void;
    selectedBodegas: string[];
    setSelectedBodegas: (bodegas: string[]) => void;
    estado: 'abiertas' | 'cerradas' | 'todas';
    setEstado: (estado: 'abiertas' | 'cerradas' | 'todas') => void;
    pendingOnly: boolean;
    setPendingOnly: (value: boolean) => void;
    buildFilters: () => string;
  };
}) {
  const { toast } = useToast();
  const { startDate, setStartDate, endDate, setEndDate, selectedSucursales, toggleSucursal, selectedVendedores, setSelectedVendedores, selectedBodegas, setSelectedBodegas, estado, setEstado, pendingOnly, setPendingOnly, buildFilters } = filterState;

  const { data: summary, isLoading: summaryLoading } = useQuery<NvvSummary>({
    queryKey: ['/api/etl/nvv/summary', startDate, endDate, selectedSucursales.join(','), selectedVendedores.join(','), selectedBodegas.join(','), estado, pendingOnly],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/nvv/summary${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar resumen de NVV');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/etl/sync-nvv', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ ETL de NVV Ejecutado",
        description: `Se procesaron ${data.recordsProcessed || 0} registros (${data.recordsInserted || 0} nuevos, ${data.recordsUpdated || 0} actualizados)`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/nvv/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/nvv/by-sucursal'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/nvv/by-vendedor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/nvv/by-bodega'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/sync-nvv/history'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al ejecutar ETL de NVV",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const migrationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/etl/run-nvv-migrations', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "✅ Migraciones NVV Ejecutadas",
        description: data.message || 'Tablas del schema NVV creadas exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al ejecutar migraciones NVV",
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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Control de Sincronización NVV
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => migrationsMutation.mutate()}
                disabled={migrationsMutation.isPending}
                size="lg"
                variant="outline"
                data-testid="button-nvv-migrations"
                title="Ejecuta migraciones para crear las tablas del schema NVV"
              >
                {migrationsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Migrando...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Ejecutar Migraciones
                  </>
                )}
              </Button>
              <Button
                onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending}
                size="lg"
                data-testid="button-execute-nvv-etl"
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Ejecutar ETL de NVV
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="nvv-startDate">Fecha Inicio</Label>
              <Input
                id="nvv-startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-nvv-start-date"
              />
            </div>
            <div>
              <Label htmlFor="nvv-endDate">Fecha Fin</Label>
              <Input
                id="nvv-endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-nvv-end-date"
              />
            </div>
            <div>
              <Label>Sucursales (opcional)</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['004', '005', '006', '007'].map(sucursal => (
                  <Button
                    key={sucursal}
                    variant={selectedSucursales.includes(sucursal) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleSucursal(sucursal)}
                    data-testid={`button-nvv-sucursal-${sucursal}`}
                  >
                    {sucursal}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="nvv-estado">Estado</Label>
              <div className="flex gap-2 mt-2">
                {(['abiertas', 'cerradas', 'todas'] as const).map(est => (
                  <Button
                    key={est}
                    variant={estado === est ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEstado(est)}
                    data-testid={`button-nvv-estado-${est}`}
                  >
                    {est.charAt(0).toUpperCase() + est.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label htmlFor="nvv-vendedores">Vendedores (opcional, separados por coma)</Label>
              <Input
                id="nvv-vendedores"
                type="text"
                placeholder="Ej: V001,V002,V003"
                value={selectedVendedores.join(',')}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setSelectedVendedores(value ? value.split(',').map(v => v.trim()).filter(Boolean) : []);
                }}
                data-testid="input-nvv-vendedores"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ingrese códigos de vendedores separados por coma
              </p>
            </div>
            <div>
              <Label htmlFor="nvv-bodegas">Bodegas (opcional, separados por coma)</Label>
              <Input
                id="nvv-bodegas"
                type="text"
                placeholder="Ej: B01,B02,B03"
                value={selectedBodegas.join(',')}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setSelectedBodegas(value ? value.split(',').map(b => b.trim()).filter(Boolean) : []);
                }}
                data-testid="input-nvv-bodegas"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ingrese códigos de bodegas separados por coma
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox
              id="nvv-pendingOnly"
              checked={pendingOnly}
              onCheckedChange={(checked) => setPendingOnly(checked as boolean)}
              data-testid="checkbox-nvv-pending-only"
            />
            <label
              htmlFor="nvv-pendingOnly"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Solo documentos con cantidad pendiente (monto ≥ $1,000)
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-nvv-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NVV</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-nvv-total">
                  {summary?.totalNvv || 0}
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="default" data-testid="badge-nvv-abiertas">
                    {summary?.totalAbiertas || 0} Abiertas
                  </Badge>
                  <Badge variant="secondary" data-testid="badge-nvv-cerradas">
                    {summary?.totalCerradas || 0} Cerradas
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-nvv-monto-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold" data-testid="text-nvv-monto-total">
                  {formatCurrency(summary?.montoTotal || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Todas las NVV (abiertas + cerradas)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-nvv-montos-estado">
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
                  <span className="font-semibold" data-testid="text-nvv-monto-abiertas">
                    {formatCurrency(summary?.montoAbiertas || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cerradas:</span>
                  <span className="font-semibold" data-testid="text-nvv-monto-cerradas">
                    {formatCurrency(summary?.montoCerradas || 0)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function NVVMetricsSection({ 
  autoRefresh,
  filterState
}: { 
  autoRefresh: boolean;
  filterState: {
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    selectedSucursales: string[];
    toggleSucursal: (sucursal: string) => void;
    selectedVendedores: string[];
    setSelectedVendedores: (vendedores: string[]) => void;
    selectedBodegas: string[];
    setSelectedBodegas: (bodegas: string[]) => void;
    estado: 'abiertas' | 'cerradas' | 'todas';
    setEstado: (estado: 'abiertas' | 'cerradas' | 'todas') => void;
    pendingOnly: boolean;
    setPendingOnly: (value: boolean) => void;
    buildFilters: () => string;
  };
}) {
  const { startDate, endDate, selectedSucursales, selectedVendedores, selectedBodegas, estado, pendingOnly, buildFilters } = filterState;
  const [activeTab, setActiveTab] = useState('sucursal');

  const { data: bySucursal, isLoading: loadingSucursal } = useQuery<NvvBySucursal[]>({
    queryKey: ['/api/etl/nvv/by-sucursal', startDate, endDate, selectedSucursales.join(','), selectedVendedores.join(','), selectedBodegas.join(','), estado, pendingOnly],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/nvv/by-sucursal${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por sucursal');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: activeTab === 'sucursal',
  });

  const { data: byVendedor, isLoading: loadingVendedor } = useQuery<NvvByVendedor[]>({
    queryKey: ['/api/etl/nvv/by-vendedor', startDate, endDate, selectedSucursales.join(','), selectedVendedores.join(','), selectedBodegas.join(','), estado, pendingOnly],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/nvv/by-vendedor${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por vendedor');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: activeTab === 'vendedor',
  });

  const { data: byBodega, isLoading: loadingBodega } = useQuery<NvvByBodega[]>({
    queryKey: ['/api/etl/nvv/by-bodega', startDate, endDate, selectedSucursales.join(','), selectedVendedores.join(','), selectedBodegas.join(','), estado, pendingOnly],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/nvv/by-bodega${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por bodega');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: activeTab === 'bodega',
  });

  const { data: bySegmentoCliente, isLoading: loadingSegmento } = useQuery<NvvBySegmentoCliente[]>({
    queryKey: ['/api/etl/nvv/by-segmento-cliente', startDate, endDate, selectedSucursales.join(','), selectedVendedores.join(','), selectedBodegas.join(','), estado, pendingOnly],
    queryFn: async () => {
      const filters = buildFilters();
      const response = await fetch(`/api/etl/nvv/by-segmento-cliente${filters ? `?${filters}` : ''}`);
      if (!response.ok) throw new Error('Error al cargar métricas por segmento');
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
    enabled: activeTab === 'segmento',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Métricas Detalladas
        </CardTitle>
        <CardDescription>
          Análisis de NVV por sucursal, vendedor y bodega
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sucursal" data-testid="tab-nvv-sucursal">
              Por Sucursal
            </TabsTrigger>
            <TabsTrigger value="vendedor" data-testid="tab-nvv-vendedor">
              Por Vendedor
            </TabsTrigger>
            <TabsTrigger value="bodega" data-testid="tab-nvv-bodega">
              Por Bodega
            </TabsTrigger>
            <TabsTrigger value="segmento" data-testid="tab-nvv-segmento">
              Por Segmento Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sucursal" className="mt-4">
            {loadingSucursal ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : bySucursal && bySucursal.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sucursal</TableHead>
                      <TableHead className="text-right">Total NVV</TableHead>
                      <TableHead className="text-right">Abiertas</TableHead>
                      <TableHead className="text-right">Cerradas</TableHead>
                      <TableHead className="text-right">Monto Total</TableHead>
                      <TableHead className="text-right">Monto Abiertas</TableHead>
                      <TableHead className="text-right">Monto Cerradas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySucursal.map((row) => (
                      <TableRow key={row.sucursal} data-testid={`row-nvv-sucursal-${row.sucursal}`}>
                        <TableCell className="font-medium">{row.sucursal}</TableCell>
                        <TableCell className="text-right">{row.totalNvv}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">{row.abiertas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.cerradas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.montoTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.montoAbiertas)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.montoCerradas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay datos de NVV por sucursal para el periodo seleccionado
              </p>
            )}
          </TabsContent>

          <TabsContent value="vendedor" className="mt-4">
            {loadingVendedor ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : byVendedor && byVendedor.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Abiertas</TableHead>
                      <TableHead className="text-right">Cerradas</TableHead>
                      <TableHead className="text-right">Monto Abiertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byVendedor.map((row, idx) => (
                      <TableRow key={`${row.sucursal}-${row.kofulido}-${idx}`} data-testid={`row-nvv-vendedor-${row.kofulido}`}>
                        <TableCell>{row.sucursal}</TableCell>
                        <TableCell className="font-mono text-xs">{row.kofulido}</TableCell>
                        <TableCell className="font-medium">{row.nombreVendedor}</TableCell>
                        <TableCell className="text-right">{row.totalNvv}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">{row.abiertas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.cerradas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.montoAbiertas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay datos de NVV por vendedor para el periodo seleccionado
              </p>
            )}
          </TabsContent>

          <TabsContent value="bodega" className="mt-4">
            {loadingBodega ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : byBodega && byBodega.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Bodega</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Abiertas</TableHead>
                      <TableHead className="text-right">Cerradas</TableHead>
                      <TableHead className="text-right">Monto Abiertas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byBodega.map((row, idx) => (
                      <TableRow key={`${row.sucursal}-${row.bosulido}-${idx}`} data-testid={`row-nvv-bodega-${row.bosulido}`}>
                        <TableCell>{row.sucursal}</TableCell>
                        <TableCell className="font-mono text-xs">{row.bosulido}</TableCell>
                        <TableCell className="font-medium">{row.nombreBodega}</TableCell>
                        <TableCell className="text-right">{row.totalNvv}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">{row.abiertas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.cerradas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.montoAbiertas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay datos de NVV por bodega para el periodo seleccionado
              </p>
            )}
          </TabsContent>

          <TabsContent value="segmento" className="mt-4">
            {loadingSegmento ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : bySegmentoCliente && bySegmentoCliente.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segmento Cliente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Abiertas</TableHead>
                      <TableHead className="text-right">Cerradas</TableHead>
                      <TableHead className="text-right">Pendientes</TableHead>
                      <TableHead className="text-right">Monto Pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySegmentoCliente.map((row, idx) => (
                      <TableRow key={`${row.ruen || 'sin-codigo'}-${idx}`} data-testid={`row-nvv-segmento-${row.ruen}`}>
                        <TableCell className="font-medium">{row.nombre_segmento_cliente || 'Sin Segmento'}</TableCell>
                        <TableCell className="text-right">{row.totalNvv}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">{row.abiertas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{row.cerradas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{row.pendientes}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-orange-600 dark:text-orange-400">
                          {formatCurrency(row.montoPendientes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay datos de NVV por segmento para el periodo seleccionado
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function NVVHistorySection({ autoRefresh }: { autoRefresh: boolean }) {
  const [activeTab, setActiveTab] = useState('history');
  
  const { data: history, isLoading: historyLoading } = useQuery<NvvSyncLog[]>({
    queryKey: ['/api/etl/sync-nvv/history', 'limit=10'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: stateChangesData, isLoading: changesLoading } = useQuery<{
    changes: NvvStateChange[];
    total: number;
  }>({
    queryKey: ['/api/etl/nvv/state-changes', 'limit=50'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Monitor de Sincronización NVV
        </CardTitle>
        <CardDescription>
          Historial de ejecuciones y cambios de estado de documentos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Historial de Ejecuciones</TabsTrigger>
            <TabsTrigger value="changes">Documentos con Cambios</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : history && history.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha Ejecución</TableHead>
                      <TableHead>Período Incremental</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Procesados</TableHead>
                      <TableHead className="text-right">Insertados</TableHead>
                      <TableHead className="text-right">Actualizados</TableHead>
                      <TableHead className="text-right">Cambios</TableHead>
                      <TableHead className="text-right">Duración</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((execution) => (
                      <TableRow key={execution.id} data-testid={`row-nvv-history-${execution.id}`}>
                        <TableCell data-testid={`text-nvv-date-${execution.id}`}>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {format(new Date(execution.startTime), "dd MMM yyyy HH:mm:ss", { locale: es })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(execution.startTime), { 
                                addSuffix: true,
                                locale: es 
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-nvv-watermark-${execution.id}`}>
                          {execution.watermarkStart && execution.watermarkEnd ? (
                            <div className="space-y-1 text-xs">
                              <div className="text-muted-foreground">
                                Desde: {format(new Date(execution.watermarkStart), "HH:mm:ss", { locale: es })}
                              </div>
                              <div className="text-muted-foreground">
                                Hasta: {format(new Date(execution.watermarkEnd), "HH:mm:ss", { locale: es })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`badge-nvv-status-${execution.id}`}>
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
                        <TableCell className="text-right" data-testid={`text-nvv-processed-${execution.id}`}>
                          {execution.recordsProcessed || 0}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-nvv-inserted-${execution.id}`}>
                          {execution.recordsInserted || 0}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-nvv-updated-${execution.id}`}>
                          {execution.recordsUpdated || 0}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-nvv-status-changes-${execution.id}`}>
                          {execution.statusChanges || 0}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-nvv-duration-${execution.id}`}>
                          {execution.executionTimeMs 
                            ? `${(execution.executionTimeMs / 1000).toFixed(2)}s`
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay registros de sincronización
              </p>
            )}
          </TabsContent>

          <TabsContent value="changes" className="mt-4">
            {changesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : stateChangesData && stateChangesData.changes.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {stateChangesData.changes.length} de {stateChangesData.total} cambios recientes
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Tipo de Cambio</TableHead>
                        <TableHead>Estado Anterior</TableHead>
                        <TableHead>Estado Nuevo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Fecha del Cambio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stateChangesData.changes.map((change) => (
                        <TableRow key={change.id} data-testid={`row-nvv-change-${change.id}`}>
                          <TableCell data-testid={`text-nvv-doc-${change.id}`}>
                            <div className="space-y-1">
                              <div className="font-medium">{change.nudo || change.idmaeedo}</div>
                              {change.sudo && (
                                <div className="text-xs text-muted-foreground">
                                  Sucursal: {change.sudo}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`badge-nvv-change-type-${change.id}`}>
                            {change.changeType === 'insert' ? (
                              <Badge variant="default">Nuevo</Badge>
                            ) : (
                              <Badge variant="secondary">Cambio de Estado</Badge>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-nvv-prev-status-${change.id}`}>
                            {change.previousStatus ? (
                              change.previousStatus === 'C' ? (
                                <Badge variant="secondary">Cerrado</Badge>
                              ) : (
                                <Badge variant="default">Abierto</Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-nvv-new-status-${change.id}`}>
                            {change.newStatus === 'C' ? (
                              <Badge variant="secondary">Cerrado</Badge>
                            ) : (
                              <Badge variant="default">Abierto</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold" data-testid={`text-nvv-amount-${change.id}`}>
                            {change.monto ? `$${parseFloat(change.monto).toLocaleString('es-CL')}` : '-'}
                          </TableCell>
                          <TableCell data-testid={`text-nvv-changed-at-${change.id}`}>
                            <div className="space-y-1">
                              <div className="text-sm">
                                {format(new Date(change.changedAt), "dd MMM yyyy HH:mm:ss", { locale: es })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(change.changedAt), { 
                                  addSuffix: true,
                                  locale: es 
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No hay cambios de estado recientes
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

