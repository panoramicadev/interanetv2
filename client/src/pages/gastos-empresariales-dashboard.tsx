import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, TrendingUp, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface GastosSummary {
  totalPendiente: number;
  totalAprobado: number;
  totalRechazado: number;
  total: number;
  count: number;
}

interface GastosByCategoria {
  categoria: string;
  total: number;
  count: number;
}

interface GastosByUser {
  userId: string;
  userName: string;
  total: number;
  count: number;
}

interface GastosByDia {
  dia: string;
  total: number;
  cantidad: number;
}

export default function GastosEmpresarialesDashboard() {
  const [, setLocation] = useLocation();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [mes, setMes] = useState(currentMonth.toString());
  const [anio, setAnio] = useState(currentYear.toString());

  // Fetch summary
  const { data: summary } = useQuery<GastosSummary>({
    queryKey: ['/api/gastos-empresariales/analytics/summary', mes, anio],
    queryFn: async () => {
      const response = await fetch(
        `/api/gastos-empresariales/analytics/summary?mes=${mes}&anio=${anio}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Error al cargar resumen');
      return response.json();
    }
  });

  // Fetch by categoria
  const { data: porCategoria = [] } = useQuery<GastosByCategoria[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-categoria', mes, anio],
    queryFn: async () => {
      const response = await fetch(
        `/api/gastos-empresariales/analytics/por-categoria?mes=${mes}&anio=${anio}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Error al cargar datos por categoría');
      return response.json();
    }
  });

  // Fetch by user
  const { data: porUsuario = [] } = useQuery<GastosByUser[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-usuario', mes, anio],
    queryFn: async () => {
      const response = await fetch(
        `/api/gastos-empresariales/analytics/por-usuario?mes=${mes}&anio=${anio}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Error al cargar datos por usuario');
      return response.json();
    }
  });

  // Fetch by day
  const { data: porDia = [] } = useQuery<GastosByDia[]>({
    queryKey: ['/api/gastos-empresariales/analytics/por-dia', mes, anio],
    queryFn: async () => {
      const response = await fetch(
        `/api/gastos-empresariales/analytics/por-dia?mes=${mes}&anio=${anio}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Error al cargar datos por día');
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

  // Chart data for categoria
  const categoriaChartData = {
    labels: porCategoria.map(c => c.categoria),
    datasets: [{
      label: 'Gasto por Categoría',
      data: porCategoria.map(c => c.total),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(139, 92, 246, 0.8)',
      ],
    }]
  };

  // Chart data for users
  const usuarioChartData = {
    labels: porUsuario.map(u => u.userName),
    datasets: [{
      label: 'Gasto por Usuario',
      data: porUsuario.map(u => u.total),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }]
  };

  // Chart data for days
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  const diaChartData = {
    labels: porDia.map(d => formatDate(d.dia)),
    datasets: [{
      label: 'Gasto por Día',
      data: porDia.map(d => d.total),
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
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

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              onClick={() => setLocation('/gastos-empresariales')}
              className="mb-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard de Rendición de Gastos</h1>
            <p className="text-sm text-gray-500 mt-1">Análisis y métricas de gastos empresariales</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[180px]" data-testid="select-mes">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger className="w-[180px]" data-testid="select-anio">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-gastos">
                {formatCurrency(summary?.total || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.count || 0} registro{summary?.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pendiente">
                {formatCurrency(summary?.totalPendiente || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Por aprobar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprobado</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-aprobado">
                {formatCurrency(summary?.totalAprobado || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Aprobados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rechazado</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-total-rechazado">
                {formatCurrency(summary?.totalRechazado || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rechazados</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Gastos por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {porCategoria.length > 0 ? (
                  <Pie data={categoriaChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gastos por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {porUsuario.length > 0 ? (
                  <Bar data={usuarioChartData} options={chartOptions} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Days Chart - Full width */}
        <Card>
          <CardHeader>
            <CardTitle>Días Más Gastados (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {porDia.length > 0 ? (
                <Bar data={diaChartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
