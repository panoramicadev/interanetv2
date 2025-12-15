import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download,
  FileSpreadsheet,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Users,
  FolderOpen
} from "lucide-react";
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
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import type { GastoEmpresarial } from "@shared/schema";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  ChartDataLabels
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
  cantidad: number;
}

interface GastosByUser {
  userId: string;
  userName: string;
  total: number;
  cantidad: number;
}

interface GastosByDia {
  dia: string;
  total: number;
  cantidad: number;
}

const CATEGORIAS = [
  "Combustibles",
  "Colación",
  "Gestión Ventas",
  "Transporte",
  "Materiales",
  "Servicios",
  "Otros"
];

const COLORS = {
  primary: 'rgba(59, 130, 246, 0.8)',
  success: 'rgba(16, 185, 129, 0.8)',
  warning: 'rgba(251, 191, 36, 0.8)',
  danger: 'rgba(239, 68, 68, 0.8)',
  purple: 'rgba(139, 92, 246, 0.8)',
  orange: 'rgba(251, 146, 60, 0.8)',
  teal: 'rgba(20, 184, 166, 0.8)',
  pink: 'rgba(236, 72, 153, 0.8)',
};

const CATEGORY_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.purple,
  COLORS.orange,
  COLORS.teal,
  COLORS.pink,
  COLORS.danger,
];

export default function GastosEmpresarialesDashboard() {
  const [, setLocation] = useLocation();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [mes, setMes] = useState(currentMonth.toString());
  const [anio, setAnio] = useState(currentYear.toString());
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [usuarioFilter, setUsuarioFilter] = useState("todos");

  const { data: summary, isLoading: isLoadingSummary } = useQuery<GastosSummary>({
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

  const { data: porCategoria = [], isLoading: isLoadingCategoria } = useQuery<GastosByCategoria[]>({
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

  const { data: porUsuario = [], isLoading: isLoadingUsuario } = useQuery<GastosByUser[]>({
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

  const { data: porDia = [], isLoading: isLoadingDia } = useQuery<GastosByDia[]>({
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

  const { data: gastosRecientes = [] } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', estadoFilter, categoriaFilter, usuarioFilter],
    queryFn: async () => {
      let url = '/api/gastos-empresariales?limit=10';
      if (estadoFilter !== 'todos') {
        url += `&estado=${estadoFilter}`;
      }
      if (categoriaFilter !== 'todas') {
        url += `&categoria=${encodeURIComponent(categoriaFilter)}`;
      }
      if (usuarioFilter !== 'todos') {
        url += `&userId=${usuarioFilter}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar gastos recientes');
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  const formatFullDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
      case 'rechazado':
        return <Badge className="bg-red-100 text-red-800">Rechazado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
    }
  };

  const statusChartData = {
    labels: ['Pendiente', 'Aprobado', 'Rechazado'],
    datasets: [{
      data: [
        summary?.totalPendiente || 0,
        summary?.totalAprobado || 0,
        summary?.totalRechazado || 0,
      ],
      backgroundColor: [COLORS.warning, COLORS.success, COLORS.danger],
      borderWidth: 0,
    }]
  };

  const categoriaChartData = {
    labels: porCategoria.map(c => c.categoria),
    datasets: [{
      label: 'Monto por Categoría',
      data: porCategoria.map(c => c.total),
      backgroundColor: CATEGORY_COLORS.slice(0, porCategoria.length),
      borderRadius: 4,
    }]
  };

  const usuarioChartData = {
    labels: porUsuario.slice(0, 10).map(u => {
      const parts = u.userName.split(' ');
      return parts.length > 1 ? `${parts[0]} ${parts[1]?.[0] || ''}.` : u.userName;
    }),
    datasets: [{
      label: 'Gasto por Vendedor',
      data: porUsuario.slice(0, 10).map(u => u.total),
      backgroundColor: COLORS.primary,
      borderRadius: 4,
    }]
  };

  const sortedDia = [...porDia].sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());
  const diaChartData = {
    labels: sortedDia.map(d => formatDate(d.dia)),
    datasets: [{
      label: 'Gasto Diario',
      data: sortedDia.map(d => d.total),
      borderColor: COLORS.primary,
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.3,
    }]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      datalabels: {
        formatter: (value: number, ctx: any) => {
          const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
          if (total === 0 || value === 0) return '';
          const percentage = Math.round((value / total) * 100);
          return percentage >= 5 ? `${percentage}%` : '';
        },
        color: '#fff',
        font: { weight: 'bold' as const, size: 12 },
      }
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        }
      }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value),
        }
      }
    }
  };

  const handleExportCSV = () => {
    if (gastosRecientes.length === 0) return;
    
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Estado', 'Proveedor'];
    const rows = gastosRecientes.map(g => [
      formatFullDate(g.createdAt as any),
      g.descripcion,
      g.categoria,
      g.monto,
      g.estado,
      g.proveedor || '-'
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gastos_${anio}_${mes}.csv`;
    link.click();
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

  const hasData = (summary?.count || 0) > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard de Rendición de Gastos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Análisis y métricas de gastos empresariales
          </p>
        </div>
        <Button 
          onClick={handleExportCSV}
          variant="outline"
          disabled={!hasData}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-[140px]" data-testid="select-mes">
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
                <SelectTrigger className="w-[100px]" data-testid="select-anio">
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

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-gray-500" />
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-categoria">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-usuario">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {porUsuario.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-gastos">
              {isLoadingSummary ? '...' : formatCurrency(summary?.total || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {summary?.count || 0} registro{(summary?.count || 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pendiente">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalPendiente || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Por aprobar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-aprobado">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalAprobado || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Aprobados</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazado</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-rechazado">
              {isLoadingSummary ? '...' : formatCurrency(summary?.totalRechazado || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Rechazados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Últimos 10 Gastos Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gastosRecientes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastosRecientes.map((gasto) => (
                    <TableRow key={gasto.id} data-testid={`row-gasto-${gasto.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {formatFullDate(gasto.createdAt as any)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {gasto.descripcion}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{gasto.categoria}</Badge>
                      </TableCell>
                      <TableCell>{gasto.proveedor || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(parseFloat(gasto.monto as any))}
                      </TableCell>
                      <TableCell className="text-center">
                        {getEstadoBadge(gasto.estado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No hay gastos registrados
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {hasData ? (
                <Doughnut data={statusChartData} options={pieOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Gastos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {porCategoria.length > 0 ? (
                <Bar data={categoriaChartData} options={barOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Vendedores con más Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {porUsuario.length > 0 ? (
                <Bar data={usuarioChartData} options={{...barOptions, indexAxis: 'y' as const}} />
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Evolución Diaria del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {porDia.length > 0 ? (
                <Line data={diaChartData} options={lineOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
