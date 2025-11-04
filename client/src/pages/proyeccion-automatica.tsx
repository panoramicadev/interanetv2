import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart3, TrendingUp, Users, Calendar, Target, AlertCircle } from "lucide-react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProyeccionAutomatica() {
  const currentYear = new Date().getFullYear();
  const futureYear = currentYear + 1;

  const [selectedYear, setSelectedYear] = useState<string>(futureYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"client" | "segment" | "salesperson">("client");

  // Fetch available years (current + future)
  const { data: yearsData = [] } = useQuery<number[]>({
    queryKey: ['/api/proyecciones/years'],
  });

  // Fetch segments
  const { data: segments = [] } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ['/api/proyecciones/segments'],
  });

  // Fetch salespeople
  const { data: salespeople = [] } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ['/api/proyecciones/salespeople'],
  });

  // Build query params for chart data
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedYear !== "all") params.append('years', selectedYear);
    if (selectedMonth !== "all") params.append('months', selectedMonth);
    if (selectedSegment !== "all") params.append('segment', selectedSegment);
    if (selectedSalesperson !== "all") params.append('salespersonCode', selectedSalesperson);
    return params.toString();
  }, [selectedYear, selectedMonth, selectedSegment, selectedSalesperson]);

  // Fetch chart data
  const { data: chartData, isLoading } = useQuery<{
    byClient: Array<{
      clientCode: string;
      clientName: string;
      segment: string;
      total: number;
      byMonth: Record<string, number>;
    }>;
    bySegment: Array<{
      segment: string;
      total: number;
      byMonth: Record<string, number>;
    }>;
    bySalesperson: Array<{
      salespersonCode: string;
      total: number;
      byMonth: Record<string, number>;
    }>;
  }>({
    queryKey: ['/api/proyecciones/charts', queryParams],
    enabled: selectedYear !== "all",
  });

  // Prepare chart data based on view mode
  const barChartData = useMemo(() => {
    if (!chartData) return null;

    let labels: string[] = [];
    let data: number[] = [];
    let backgroundColors: string[] = [];

    switch (viewMode) {
      case "client":
        // Top 15 clients by projected amount
        const topClients = chartData.byClient.slice(0, 15);
        labels = topClients.map(c => c.clientName.length > 30 ? c.clientName.substring(0, 27) + '...' : c.clientName);
        data = topClients.map(c => c.total);
        backgroundColors = topClients.map(() => 'rgba(54, 162, 235, 0.6)');
        break;

      case "segment":
        labels = chartData.bySegment.map(s => s.segment);
        data = chartData.bySegment.map(s => s.total);
        backgroundColors = chartData.bySegment.map(() => 'rgba(75, 192, 192, 0.6)');
        break;

      case "salesperson":
        labels = chartData.bySalesperson.map(s => s.salespersonCode);
        data = chartData.bySalesperson.map(s => s.total);
        backgroundColors = chartData.bySalesperson.map(() => 'rgba(255, 159, 64, 0.6)');
        break;
    }

    return {
      labels,
      datasets: [
        {
          label: 'Proyección de Ventas',
          data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
          borderWidth: 2,
        },
      ],
    };
  }, [chartData, viewMode]);

  // Calculate monthly breakdown for selected view
  const monthlyChartData = useMemo(() => {
    if (!chartData || selectedMonth !== "all") return null;

    let monthlyData: Record<string, number> = {};

    switch (viewMode) {
      case "client":
        chartData.byClient.forEach(client => {
          Object.entries(client.byMonth).forEach(([month, amount]) => {
            monthlyData[month] = (monthlyData[month] || 0) + amount;
          });
        });
        break;

      case "segment":
        if (selectedSegment !== "all") {
          const segmentItem = chartData.bySegment.find(s => s.segment === selectedSegment);
          monthlyData = segmentItem?.byMonth || {};
        } else {
          chartData.bySegment.forEach(segment => {
            Object.entries(segment.byMonth).forEach(([month, amount]) => {
              monthlyData[month] = (monthlyData[month] || 0) + amount;
            });
          });
        }
        break;

      case "salesperson":
        if (selectedSalesperson !== "all") {
          const salespersonItem = chartData.bySalesperson.find(s => s.salespersonCode === selectedSalesperson);
          monthlyData = salespersonItem?.byMonth || {};
        } else {
          chartData.bySalesperson.forEach(salesperson => {
            Object.entries(salesperson.byMonth).forEach(([month, amount]) => {
              monthlyData[month] = (monthlyData[month] || 0) + amount;
            });
          });
        }
        break;
    }

    // Sort by month
    const sortedEntries = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));
    
    return {
      labels: sortedEntries.map(([monthKey]) => {
        const [year, month] = monthKey.split('-');
        const monthName = MONTHS.find(m => m.value === parseInt(month))?.label || month;
        return `${monthName} ${year}`;
      }),
      datasets: [
        {
          label: 'Proyección Mensual',
          data: sortedEntries.map(([, amount]) => amount),
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 2,
        },
      ],
    };
  }, [chartData, viewMode, selectedSegment, selectedSalesperson, selectedMonth]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return formatCurrency(context.parsed.y);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  // Calculate total projected amount
  const totalProjected = useMemo(() => {
    if (!chartData) return 0;
    
    switch (viewMode) {
      case "client":
        return chartData.byClient.reduce((sum, c) => sum + c.total, 0);
      case "segment":
        if (selectedSegment !== "all") {
          return chartData.bySegment.find(s => s.segment === selectedSegment)?.total || 0;
        }
        return chartData.bySegment.reduce((sum, s) => sum + s.total, 0);
      case "salesperson":
        if (selectedSalesperson !== "all") {
          return chartData.bySalesperson.find(s => s.salespersonCode === selectedSalesperson)?.total || 0;
        }
        return chartData.bySalesperson.reduce((sum, s) => sum + s.total, 0);
      default:
        return 0;
    }
  }, [chartData, viewMode, selectedSegment, selectedSalesperson]);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-proyeccion-automatica">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">
          <BarChart3 className="inline-block mr-2 h-8 w-8" />
          Visualización de Proyecciones
        </h1>
        <p className="text-gray-600 mt-2" data-testid="text-page-description">
          Análisis gráfico de las proyecciones manuales de ventas
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros de Análisis
          </CardTitle>
          <CardDescription>Selecciona los parámetros para visualizar las proyecciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Year Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Año</label>
              <Select value={selectedYear} onValueChange={setSelectedYear} data-testid="select-year">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  {yearsData.filter(y => y >= currentYear).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} data-testid="select-month">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MONTHS.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segment Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Segmento</label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment} data-testid="select-segment">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segments.map(segment => (
                    <SelectItem key={segment.code} value={segment.code}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Salesperson Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedor</label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson} data-testid="select-salesperson">
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {salespeople.map(sp => (
                    <SelectItem key={sp.code} value={sp.code}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vista</label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)} data-testid="select-view-mode">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Por Cliente</SelectItem>
                  <SelectItem value="segment">Por Segmento</SelectItem>
                  <SelectItem value="salesperson">Por Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proyectado</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-total-projected">
                  {formatCurrency(totalProjected)}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {viewMode === "client" ? "Clientes" : viewMode === "segment" ? "Segmentos" : "Vendedores"}
                </p>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-item-count">
                  {chartData ? 
                    (viewMode === "client" ? chartData.byClient.length :
                     viewMode === "segment" ? chartData.bySegment.length :
                     chartData.bySalesperson.length) : 0
                  }
                </p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Período</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="text-period">
                  {selectedMonth === "all" ? selectedYear : `${MONTHS.find(m => m.value === parseInt(selectedMonth))?.label} ${selectedYear}`}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando datos...</p>
            </div>
          </CardContent>
        </Card>
      ) : !chartData || (viewMode === "client" && chartData.byClient.length === 0) ||
         (viewMode === "segment" && chartData.bySegment.length === 0) ||
         (viewMode === "salesperson" && chartData.bySalesperson.length === 0) ? (
        <Alert data-testid="alert-no-data">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No hay proyecciones disponibles con los filtros seleccionados. 
            Crea proyecciones en la sección "Proyección Manual" para visualizarlas aquí.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Main Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>
                {viewMode === "client" ? "Top 15 Clientes por Proyección" :
                 viewMode === "segment" ? "Proyección por Segmento" :
                 "Proyección por Vendedor"}
              </CardTitle>
              <CardDescription>
                Análisis de proyecciones de ventas {selectedMonth === "all" ? "para el período completo" : "del mes seleccionado"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                {barChartData && <Bar data={barChartData} options={chartOptions} />}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Breakdown Chart */}
          {selectedMonth === "all" && monthlyChartData && (
            <Card>
              <CardHeader>
                <CardTitle>Desglose Mensual</CardTitle>
                <CardDescription>Distribución de proyecciones por mes</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: '300px' }}>
                  <Bar data={monthlyChartData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Info Footer */}
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          <strong>Nota:</strong> Esta visualización muestra únicamente las proyecciones manuales creadas por los usuarios.
          Los datos se actualizan en tiempo real según las proyecciones ingresadas en el sistema.
        </AlertDescription>
      </Alert>
    </div>
  );
}
