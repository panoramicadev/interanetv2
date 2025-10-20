import { useState, useEffect } from "react";
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
  FileText
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ETLExecution {
  id: string;
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

export default function ETLMonitor() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-8 w-8" />
            Monitor ETL
          </h1>
          <p className="text-muted-foreground">
            Monitoreo y control del proceso de extracción, transformación y carga de datos
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

      {/* Status Section */}
      <ETLStatusSection autoRefresh={autoRefresh} />

      {/* History Section */}
      <ETLHistorySection autoRefresh={autoRefresh} />
    </div>
  );
}

// ETL Status Section Component
function ETLStatusSection({ autoRefresh }: { autoRefresh: boolean }) {
  const { toast } = useToast();

  // Fetch ETL status
  const { data: status, isLoading, refetch } = useQuery<ETLStatus>({
    queryKey: ['/api/etl/status'],
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10 seconds
  });

  // Execute ETL mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/etl/execute', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "ETL Ejecutado",
        description: `Se procesaron ${data.recordsProcessed || 0} registros en ${Math.round(data.executionTimeMs / 1000)}s`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/etl/status'] });
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
function ETLHistorySection({ autoRefresh }: { autoRefresh: boolean }) {
  const { data: status, isLoading } = useQuery<ETLStatus>({
    queryKey: ['/api/etl/status'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const history = status?.history || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historial de Ejecuciones
        </CardTitle>
        <CardDescription>Últimas 10 ejecuciones del proceso ETL</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay historial de ejecuciones disponible
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Tiempo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">
                            {new Date(execution.executionDate).toLocaleDateString('es-CL')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(execution.executionDate).toLocaleTimeString('es-CL')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {execution.status === 'success' ? (
                        <Badge className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Exitoso
                        </Badge>
                      ) : execution.status === 'running' ? (
                        <Badge className="bg-blue-600">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Ejecutando
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{execution.period}</TableCell>
                    <TableCell className="text-sm">
                      {execution.documentTypes.split(',').join(', ')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {execution.recordsProcessed?.toLocaleString('es-CL') || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {execution.executionTimeMs
                        ? `${(execution.executionTimeMs / 1000).toFixed(1)}s`
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
