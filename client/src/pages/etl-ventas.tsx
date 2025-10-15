import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Database, RefreshCw, BarChart3, Calendar, TrendingUp, Users, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ETLVentasPage() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [maeddoData, setMaeddoData] = useState<any>(null);

  const { data: estado, isLoading: estadoLoading } = useQuery({
    queryKey: ['/api/etl-ventas/estado'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/etl-ventas/stats'],
  });

  const verificarMaeddoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/etl-ventas/verificar-maeddo');
      return response.json();
    },
    onSuccess: (data) => {
      setMaeddoData(data);
      toast({
        title: "Verificación completada",
        description: `Se encontraron ${data.total} registros más recientes`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al verificar datos",
        description: error.message || "No se pudo conectar a SQL Server",
        variant: "destructive",
      });
    }
  });

  const runETLMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/etl-ventas/run', {
        method: 'POST'
      });
    },
    onMutate: () => {
      setIsRunning(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/etl-ventas/estado'] });
      queryClient.invalidateQueries({ queryKey: ['/api/etl-ventas/stats'] });
      toast({
        title: "ETL ejecutado exitosamente",
        description: "Los datos han sido sincronizados correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al ejecutar ETL",
        description: error.message || "Ha ocurrido un error",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRunning(false);
    }
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-titulo">ETL Ventas</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-descripcion">
            Sincronización de datos desde SQL Server Panoramica
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => verificarMaeddoMutation.mutate()}
            disabled={verificarMaeddoMutation.isPending}
            variant="outline"
            size="lg"
            data-testid="button-verificar-maeddo"
          >
            {verificarMaeddoMutation.isPending ? (
              <>
                <Search className="mr-2 h-5 w-5 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Verificar MAEDDO
              </>
            )}
          </Button>
          <Button
            onClick={() => runETLMutation.mutate()}
            disabled={isRunning}
            size="lg"
            data-testid="button-ejecutar-etl"
          >
            {isRunning ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                Ejecutar ETL
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-estado">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Estado del ETL
            </CardTitle>
            <CardDescription>Última sincronización de datos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {estadoLoading ? (
              <div className="text-sm text-muted-foreground">Cargando...</div>
            ) : estado ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última fecha procesada:</span>
                  <span className="font-semibold" data-testid="text-ultima-fecha">
                    {format(new Date(estado.ult_feemli), "dd 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Último ID procesado:</span>
                  <span className="font-mono font-semibold" data-testid="text-ultimo-id">
                    {estado.ult_idmaeedo}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Actualizado:</span>
                  <span className="text-sm" data-testid="text-actualizado">
                    {format(new Date(estado.actualizado_en), "dd/MM/yyyy HH:mm", { locale: es })}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No hay datos disponibles</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-configuracion">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Configuración
            </CardTitle>
            <CardDescription>Parámetros del proceso ETL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Período:</span>
              <span className="font-semibold">2025 en adelante</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipos de documento:</span>
              <span className="font-semibold">FCV, FVL, NCV</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vendedor excluido:</span>
              <span className="font-semibold">FHP (Fernando Herrera Pinto)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Modo:</span>
              <span className="font-semibold">Incremental</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-estadisticas">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estadísticas de Datos
          </CardTitle>
          <CardDescription>Resumen de la tabla fact_ventas</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="text-sm text-muted-foreground">Cargando estadísticas...</div>
          ) : stats ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Database className="h-4 w-4" />
                  Total de registros
                </div>
                <div className="text-2xl font-bold" data-testid="text-total-registros">
                  {parseInt(stats.total_registros || 0).toLocaleString('es-CL')}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  Rango de fechas
                </div>
                <div className="text-sm font-semibold" data-testid="text-rango-fechas">
                  {stats.fecha_min && stats.fecha_max ? (
                    <>
                      {format(new Date(stats.fecha_min), 'dd/MM/yy', { locale: es })}
                      {' - '}
                      {format(new Date(stats.fecha_max), 'dd/MM/yy', { locale: es })}
                    </>
                  ) : 'N/A'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Monto total
                </div>
                <div className="text-2xl font-bold" data-testid="text-monto-total">
                  {formatNumber(parseInt(stats.monto_total || 0))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Vendedores
                </div>
                <div className="text-2xl font-bold" data-testid="text-total-vendedores">
                  {parseInt(stats.total_vendedores || 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No hay estadísticas disponibles</div>
          )}
        </CardContent>
      </Card>

      {maeddoData && (
        <Card data-testid="card-maeddo-verificacion">
          <CardHeader>
            <CardTitle>Datos Más Recientes de MAEDDO (SQL Server)</CardTitle>
            <CardDescription>Últimos {maeddoData.total} registros ordenados por fecha</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">IDMAEDDO</th>
                    <th className="text-left p-2">IDMAEEDO</th>
                    <th className="text-left p-2">TIDO</th>
                    <th className="text-left p-2">KOPRCT</th>
                    <th className="text-left p-2">NOKOPR</th>
                    <th className="text-right p-2">CAPRCO2</th>
                    <th className="text-right p-2">PPPRNE</th>
                    <th className="text-left p-2">FEEMLI</th>
                  </tr>
                </thead>
                <tbody>
                  {maeddoData.registros.map((reg: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">{reg.IDMAEDDO}</td>
                      <td className="p-2 font-mono text-xs">{reg.IDMAEEDO}</td>
                      <td className="p-2">{reg.TIDO}</td>
                      <td className="p-2 font-mono text-xs">{reg.KOPRCT}</td>
                      <td className="p-2 text-xs">{reg.NOKOPR}</td>
                      <td className="p-2 text-right">{reg.CAPRCO2}</td>
                      <td className="p-2 text-right">${parseInt(reg.PPPRNE || 0).toLocaleString('es-CL')}</td>
                      <td className="p-2">{reg.FEEMLI ? format(new Date(reg.FEEMLI), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-proceso">
        <CardHeader>
          <CardTitle>Proceso ETL</CardTitle>
          <CardDescription>Extracción, Transformación y Carga de datos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Extracción (Extract)</h4>
                <p className="text-sm text-muted-foreground">
                  Obtiene datos desde SQL Server Panoramica usando watermark incremental
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Transformación (Transform)</h4>
                <p className="text-sm text-muted-foreground">
                  Normaliza datos en tablas staging y calcula campos derivados
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Carga (Load)</h4>
                <p className="text-sm text-muted-foreground">
                  Inserta/actualiza datos en fact_ventas para análisis
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
