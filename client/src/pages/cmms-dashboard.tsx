import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Wrench,
  Clock,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Zap,
  Users,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface CMMSMetrics {
  totalOTs: number;
  otsPendientes: number;
  otsEnCurso: number;
  otsPausadas: number;
  otsFinalizadas: number;
  preventivas: number;
  correctivas: number;
  mttr: number;
  costoTotal: number;
  costoPlanificado: number;
  costoDesviacion: number;
  equiposCriticos: number;
  equiposOperativos: number;
  equiposEnMantencion: number;
  equiposDetenidos: number;
  proveedoresActivos: number;
  planesPreventivosActivos: number;
  planesVencidos: number;
  mantencionesPlanificadasTotal: number;
  mantencionesPlanificadasAprobadas: number;
  mantencionesPlanificadasCosto: number;
}

export default function CMMSDashboard() {
  const [, setLocation] = useLocation();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [mes, setMes] = useState(currentMonth.toString());
  const [anio, setAnio] = useState(currentYear.toString());
  const [area, setArea] = useState<string>("all");

  // Generate start and end dates for the selected period
  const startDate = mes === 'all' 
    ? `${anio}-01-01` 
    : `${anio}-${mes.padStart(2, '0')}-01`;
  const endDate = mes === 'all' 
    ? `${anio}-12-31` 
    : `${anio}-${mes.padStart(2, '0')}-${new Date(parseInt(anio), parseInt(mes), 0).getDate()}`;

  // Fetch CMMS metrics
  const { data: metrics, isLoading } = useQuery<CMMSMetrics>({
    queryKey: ['/api/cmms/metrics', startDate, endDate, area],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(area !== 'all' && { area }),
      });
      const response = await fetch(`/api/cmms/metrics?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar métricas CMMS');
      return response.json();
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)} hrs`;
  };

  // Chart: OTs por Estado
  const estadoChartData = {
    labels: ['Pendientes', 'En Curso', 'Finalizadas', 'Pausadas'],
    datasets: [{
      label: 'Órdenes de Trabajo',
      data: [
        metrics?.otsPendientes || 0,
        metrics?.otsEnCurso || 0,
        metrics?.otsFinalizadas || 0,
        metrics?.otsPausadas || 0,
      ],
      backgroundColor: [
        'rgba(251, 146, 60, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(234, 179, 8, 0.8)',
      ],
    }]
  };

  // Chart: Preventivas vs Correctivas
  const tipoChartData = {
    labels: ['Preventivas', 'Correctivas'],
    datasets: [{
      data: [metrics?.preventivas || 0, metrics?.correctivas || 0],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
    }]
  };

  // Chart: Estado de Equipos
  const equiposChartData = {
    labels: ['Operativos', 'En Mantención', 'Detenidos'],
    datasets: [{
      data: [
        metrics?.equiposOperativos || 0,
        metrics?.equiposEnMantencion || 0,
        metrics?.equiposDetenidos || 0,
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/mantenciones')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-title">
                  <Wrench className="h-8 w-8" />
                  Dashboard CMMS
                </h1>
                <p className="text-muted-foreground" data-testid="text-subtitle">
                  Sistema de Gestión de Mantenimiento
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Button
                variant="outline"
                className="h-auto flex-col items-start p-3 space-y-1"
                onClick={() => setLocation('/cmms/equipos')}
                data-testid="button-equipos"
              >
                <Wrench className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Equipos Críticos</div>
                  <div className="text-xs text-muted-foreground">Gestionar equipos</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex-col items-start p-3 space-y-1"
                onClick={() => setLocation('/cmms/proveedores')}
                data-testid="button-proveedores"
              >
                <Users className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Proveedores</div>
                  <div className="text-xs text-muted-foreground">Gestionar proveedores</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex-col items-start p-3 space-y-1"
                onClick={() => setLocation('/cmms/presupuesto')}
                data-testid="button-presupuesto"
              >
                <DollarSign className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Presupuesto</div>
                  <div className="text-xs text-muted-foreground">Administrar presupuesto</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex-col items-start p-3 space-y-1"
                onClick={() => setLocation('/cmms/planes-preventivos')}
                data-testid="button-planes"
              >
                <Calendar className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Planes Preventivos</div>
                  <div className="text-xs text-muted-foreground">Programación</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto flex-col items-start p-3 space-y-1 bg-green-50 border-green-200 hover:bg-green-100"
                onClick={() => setLocation('/cmms/mantenciones-planificadas')}
                data-testid="button-mantenciones-planificadas"
              >
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Mant. Planificadas</div>
                  <div className="text-xs text-muted-foreground">Proyectos grandes</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Mes</label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger data-testid="select-month">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    <SelectItem value="1">Enero</SelectItem>
                    <SelectItem value="2">Febrero</SelectItem>
                    <SelectItem value="3">Marzo</SelectItem>
                    <SelectItem value="4">Abril</SelectItem>
                    <SelectItem value="5">Mayo</SelectItem>
                    <SelectItem value="6">Junio</SelectItem>
                    <SelectItem value="7">Julio</SelectItem>
                    <SelectItem value="8">Agosto</SelectItem>
                    <SelectItem value="9">Septiembre</SelectItem>
                    <SelectItem value="10">Octubre</SelectItem>
                    <SelectItem value="11">Noviembre</SelectItem>
                    <SelectItem value="12">Diciembre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Año</label>
                <Select value={anio} onValueChange={setAnio}>
                  <SelectTrigger data-testid="select-year">
                    <SelectValue placeholder="Seleccionar año" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Área</label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger data-testid="select-area">
                    <SelectValue placeholder="Todas las áreas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las áreas</SelectItem>
                    <SelectItem value="administracion">Administración</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                    <SelectItem value="laboratorio">Laboratorio</SelectItem>
                    <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                    <SelectItem value="bodega_productos_terminados">Bodega Productos Terminados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando métricas...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Total OTs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total OTs</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-ots">{metrics?.totalOTs || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.otsPendientes || 0} pendientes
                  </p>
                </CardContent>
              </Card>

              {/* MTTR */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MTTR Promedio</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-mttr">
                    {formatHours(metrics?.mttr || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tiempo medio de reparación
                  </p>
                </CardContent>
              </Card>

              {/* Preventivas vs Correctivas */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tipo de Mantención</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-preventivas">
                    {metrics?.preventivas || 0} / {metrics?.correctivas || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preventivas / Correctivas
                  </p>
                </CardContent>
              </Card>

              {/* Costo Ejecutado */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Costo Ejecutado</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-cost-total">
                    {formatCurrency(metrics?.costoTotal || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Planificado: {formatCurrency(metrics?.costoPlanificado || 0)}
                  </p>
                </CardContent>
              </Card>

              {/* Equipos Críticos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Equipos Críticos</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-equipos-criticos">
                    {metrics?.equiposCriticos || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.equiposOperativos || 0} operativos
                  </p>
                </CardContent>
              </Card>

              {/* Proveedores */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proveedores Activos</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-proveedores">
                    {metrics?.proveedoresActivos || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Externos especializados
                  </p>
                </CardContent>
              </Card>

              {/* Planes Preventivos */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Planes Preventivos</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-planes-activos">
                    {metrics?.planesPreventivosActivos || 0}
                  </div>
                  <p className="text-xs text-red-500">
                    {metrics?.planesVencidos || 0} vencidos
                  </p>
                </CardContent>
              </Card>

              {/* Desviación Presupuestaria */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Desviación Presupuesto</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(metrics?.costoDesviacion || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} data-testid="text-desviacion">
                    {formatCurrency(Math.abs(metrics?.costoDesviacion || 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(metrics?.costoDesviacion || 0) > 0 ? 'Sobre' : 'Bajo'} presupuesto
                  </p>
                </CardContent>
              </Card>

              {/* Mant. Planificadas */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mant. Planificadas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-mant-planificadas">
                    {metrics?.mantencionesPlanificadasTotal || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.mantencionesPlanificadasAprobadas || 0} aprobadas
                  </p>
                </CardContent>
              </Card>

              {/* Aprobadas Pendientes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprobadas Pendientes</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-aprobadas-pendientes">
                    {metrics?.mantencionesPlanificadasAprobadas || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pendientes de ejecutar
                  </p>
                </CardContent>
              </Card>

              {/* Costo Planificado */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Costo Planificado</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-costo-planificado">
                    {formatCurrency(metrics?.mantencionesPlanificadasCosto || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Proyectos grandes
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* OTs por Estado */}
              <Card>
                <CardHeader>
                  <CardTitle>OTs por Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Bar data={estadoChartData} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Preventivas vs Correctivas */}
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de Mantención</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Doughnut data={tipoChartData} options={doughnutOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Estado de Equipos */}
              <Card>
                <CardHeader>
                  <CardTitle>Estado de Equipos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Doughnut data={equiposChartData} options={doughnutOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
