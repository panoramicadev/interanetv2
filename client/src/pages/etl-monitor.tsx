import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Server
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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

interface ETLStatus {
  lastExecution: ETLExecution | null;
  isRunning: boolean;
  history: ETLExecution[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
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
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <Server className="h-5 w-5" />
                  {etl.name}
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-300">
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

  // Fetch ETL status
  const { data: status, isLoading } = useQuery<ETLStatus>({
    queryKey: ['/api/etl/status', etlName],
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds
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
      queryClient.invalidateQueries({ queryKey: ['/api/etl/status', etlName] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al ejecutar ETL",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
            <Button
              onClick={handleExecute}
              disabled={isRunning || executeMutation.isPending}
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
                <p className="text-sm text-muted-foreground">Registros Procesados</p>
                <p className="font-semibold text-2xl" data-testid="text-records-processed">
                  {lastExecution.recordsProcessed?.toLocaleString('es-CL') || '0'}
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
    </div>
  );
}

// ETL History Section Component
function ETLHistorySection({ etlName, autoRefresh }: { etlName: string; autoRefresh: boolean }) {
  const { data: status } = useQuery<ETLStatus>({
    queryKey: ['/api/etl/status', etlName],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const history = status?.history || [];

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
          Últimas {history.length} ejecuciones del ETL
        </CardDescription>
      </CardHeader>
      <CardContent>
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
