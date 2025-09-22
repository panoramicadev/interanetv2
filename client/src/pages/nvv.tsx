import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, TrendingUp, Target, BarChart3, Users, Building, Package, Upload, Database } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { NVVSummary, NVVTrendPoint, NVVBreakdownItem } from "@shared/schema";
import { NvvCsvImport } from "@/components/nvv/csv-import";
import { PendingSalesTable } from "@/components/nvv/pending-sales-table";

interface PackagingMetric {
  packagingType: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  salesPercentage: number;
  unitPercentage: number;
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartDataLabels
);

export default function NVVPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState("import");
  
  // Filter states - following dashboard pattern
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return format(new Date(), "yyyy-MM");
  });
  const [filterType, setFilterType] = useState<"day" | "month" | "year" | "range">("month");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  // Chart display options
  const [viewMode, setViewMode] = useState<"sales" | "units">("sales");
  const [trendPeriod, setTrendPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [breakdownBy, setBreakdownBy] = useState<"segment" | "salesperson">("segment");
  
  // NVV Filters
  const [nvvFilters, setNvvFilters] = useState({
    status: '',
    salesperson: '',
    segment: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
  });

  // Update selected period when filter type changes
  useEffect(() => {
    switch (filterType) {
      case "day":
        if (selectedDate) {
          setSelectedPeriod(format(selectedDate, "yyyy-MM-dd"));
        }
        break;
      case "month":
        if (!selectedPeriod || selectedPeriod.includes("_")) {
          setSelectedPeriod(format(new Date(), "yyyy-MM"));
        }
        break;
      case "year":
        setSelectedPeriod(selectedYear.toString());
        break;
      case "range":
        if (dateRange?.from && dateRange?.to) {
          setSelectedPeriod(`${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`);
        }
        break;
    }
  }, [filterType, selectedDate, selectedYear, dateRange]);

  // API Queries - placeholder for now, will create endpoints later
  const { data: summary, isLoading: summaryLoading } = useQuery<NVVSummary>({
    queryKey: [`/api/nvv/summary?period=${selectedPeriod}&filterType=${filterType}`],
    enabled: false, // Disable until endpoints are created
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<NVVTrendPoint[]>({
    queryKey: [`/api/nvv/trend?granularity=${trendPeriod}&period=${selectedPeriod}&filterType=${filterType}`],
    enabled: false, // Disable until endpoints are created
  });

  const { data: breakdownData, isLoading: breakdownLoading } = useQuery<NVVBreakdownItem[]>({
    queryKey: [`/api/nvv/breakdown?by=${breakdownBy}&period=${selectedPeriod}&filterType=${filterType}`],
    enabled: false, // Disable until endpoints are created
  });

  // Mock data for development
  const mockSummary: NVVSummary = {
    totalSales: 59940173,
    salesVarianceVsTarget: -15.2,
    salesVarianceVsPrevious: -75.7,
    totalUnits: 3602,
    averageTicket: 394605,
    period: selectedPeriod,
    periodLabel: "Septiembre 2025"
  };

  const mockTrendData: NVVTrendPoint[] = [
    { period: "2025-09-01", periodLabel: "1", sales: 486450, units: 35, target: 600000 },
    { period: "2025-09-02", periodLabel: "2", sales: 892341, units: 62, target: 600000 },
    { period: "2025-09-03", periodLabel: "3", sales: 1245678, units: 89, target: 600000 },
    { period: "2025-09-04", periodLabel: "4", sales: 987234, units: 71, target: 600000 },
    { period: "2025-09-05", periodLabel: "5", sales: 1456789, units: 103, target: 600000 },
  ];

  const mockBreakdownData: NVVBreakdownItem[] = [
    { name: "FERRETERIAS", type: "segment", sales: 18777180, units: 1200, target: 20000000, varianceVsTarget: -6.1, varianceVsPrevious: 12.3, previousSales: 16700000 },
    { name: "PANORAMICA STORE", type: "segment", sales: 16207345, units: 980, target: 15000000, varianceVsTarget: 8.0, varianceVsPrevious: 5.2, previousSales: 15400000 },
    { name: "CONSTRUCCION", type: "segment", sales: 11151583, units: 750, target: 12000000, varianceVsTarget: -7.1, varianceVsPrevious: -2.1, previousSales: 11390000 },
    { name: "MCT", type: "segment", sales: 10367432, units: 620, target: 11000000, varianceVsTarget: -5.8, varianceVsPrevious: 15.6, previousSales: 8970000 },
  ];

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CL').format(num);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al login...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/login");
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando NVV...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Chart configurations for trend
  const trendChartData = {
    labels: mockTrendData.map(d => d.periodLabel),
    datasets: [
      {
        label: viewMode === "sales" ? "Ventas CLP" : "Unidades",
        data: mockTrendData.map(d => viewMode === "sales" ? d.sales : d.units),
        fill: true,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22c55e',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        tension: 0.4,
      },
      {
        label: "Meta",
        data: mockTrendData.map(d => viewMode === "sales" ? (d.target || 0) : 50),
        fill: false,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      }
    ]
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#22c55e',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            if (context.datasetIndex === 0) {
              return viewMode === "sales" ? formatCurrency(context.parsed.y) : `${formatNumber(context.parsed.y)} unidades`;
            }
            return `Meta: ${viewMode === "sales" ? formatCurrency(context.parsed.y) : `${formatNumber(context.parsed.y)} unidades`}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#9ca3af', font: { size: 12 } }
      },
      y: {
        grid: { color: 'rgba(156, 163, 175, 0.2)', drawBorder: false },
        border: { display: false },
        ticks: { display: false }
      }
    }
  };

  // Chart configuration for breakdown (horizontal bars without X-axis)
  const breakdownChartData = {
    labels: mockBreakdownData.map(item => item.name),
    datasets: [{
      label: 'Varianza vs Meta (%)',
      data: mockBreakdownData.map(item => item.varianceVsTarget || 0),
      datalabels: {
        display: true,
        color: 'rgba(0, 0, 0, 0.8)',
        font: { weight: 'bold' as const, size: 12 },
        formatter: function(value: number) {
          return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
        },
        anchor: 'end' as const,
        align: 'right' as const
      },
      backgroundColor: mockBreakdownData.map(item => 
        (item.varianceVsTarget || 0) >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
      ),
      borderColor: mockBreakdownData.map(item => 
        (item.varianceVsTarget || 0) >= 0 ? '#22c55e' : '#ef4444'
      ),
      borderWidth: 2,
      borderRadius: 8,
    }]
  };

  const breakdownChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context: any) {
            return `${context.parsed.x >= 0 ? '+' : ''}${context.parsed.x.toFixed(1)}% vs Meta`;
          }
        }
      }
    },
    scales: {
      x: { display: false, beginAtZero: true },
      y: {
        grid: { display: false },
        ticks: { color: 'rgba(0, 0, 0, 0.6)', font: { size: 12 } }
      }
    }
  };

  // Packaging Breakdown Table Component - Unified View
  function PackagingBreakdownTable({ selectedPeriod, filterType }: {
    selectedPeriod: string;
    filterType: "day" | "month" | "year" | "range";
  }) {
    const { data: packagingData, isLoading } = useQuery<PackagingMetric[]>({
      queryKey: [`/api/nvv/packaging-breakdown?period=${selectedPeriod}&filterType=${filterType}`],
    });

    // Mapping packaging codes to friendly names (as requested by user)
    const packagingNames: Record<string, string> = {
      'BD': 'Baldes de 4 o 5 galones',
      'GL': 'Solo galones', 
      '04': '1/4 de galón'
    };

    // Filter and sort data to show only BD, GL, and 04 (convert Q4 to 04)
    const processedData = packagingData?.map(item => ({
      ...item,
      packagingType: item.packagingType === 'Q4' ? '04' : item.packagingType
    })).filter(item => ['BD', 'GL', '04'].includes(item.packagingType))
    .sort((a, b) => b.totalSales - a.totalSales) || [];
    
    // Calculate totals
    const totalSales = processedData.reduce((sum, item) => sum + item.totalSales, 0);
    const totalUnits = processedData.reduce((sum, item) => sum + item.totalUnits, 0);

    return (
      <Card className="p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Breakdown por Tipo de Envase</h2>
          </div>
          <p className="text-sm text-gray-600">BD: Baldes 4-5 galones | GL: Solo galones | 04: 1/4 de galón</p>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="flex space-x-8">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="packaging-breakdown-table">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-bold text-gray-900 text-base">Tipo de Envase</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900 text-base">Cantidad Vendida</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900 text-base">Monto</th>
                  <th className="text-right py-4 px-4 font-bold text-gray-900 text-base">% de la Venta</th>
                </tr>
              </thead>
              <tbody>
                {processedData.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`packaging-row-${index}`}>
                    <td className="py-4 px-4" data-testid={`text-packaging-${item.packagingType}`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                          item.packagingType === 'BD' ? 'bg-green-500' :
                          item.packagingType === 'GL' ? 'bg-blue-500' :
                          item.packagingType === '04' ? 'bg-orange-500' :
                          'bg-gray-500'
                        }`}>
                          {item.packagingType}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-base">{item.packagingType}</div>
                          <div className="text-sm text-gray-600">{packagingNames[item.packagingType]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right" data-testid={`text-units-${item.packagingType}`}>
                      <div className="text-lg font-bold text-gray-900">{formatNumber(item.totalUnits)}</div>
                      <div className="text-sm text-gray-500">unidades</div>
                    </td>
                    <td className="py-4 px-4 text-right" data-testid={`text-sales-${item.packagingType}`}>
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(item.totalSales)}</div>
                      <div className="text-sm text-gray-500">{item.transactionCount} transacciones</div>
                    </td>
                    <td className="py-4 px-4 text-right" data-testid={`text-perc-${item.packagingType}`}>
                      <div className="text-lg font-bold text-blue-600">{item.salesPercentage.toFixed(1)}%</div>
                    </td>
                  </tr>
                ))}
                
                {/* Total Row */}
                <tr className="border-t-2 border-gray-300 bg-blue-50" data-testid="packaging-total-row">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-bold">Σ</span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-base">Total General</div>
                        <div className="text-sm text-gray-600">Todos los envases</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-lg font-bold text-blue-600">{formatNumber(totalUnits)}</div>
                    <div className="text-sm text-gray-500">unidades</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-lg font-bold text-blue-600">{formatCurrency(totalSales)}</div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-lg font-bold text-blue-600">100.0%</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
              NVV - Notas de Ventas Pendientes
            </h1>
            <p className="text-sm text-gray-600">
              Gestión de notas de ventas pendientes y comprometidas
            </p>
          </div>
        </div>

        {/* Period Filters */}
        <div className="flex items-center space-x-2">
          <Select value={filterType} onValueChange={(value: "day" | "month" | "year" | "range") => setFilterType(value)}>
            <SelectTrigger className="w-32 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200">
              <SelectItem value="day">Día</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="year">Año</SelectItem>
              <SelectItem value="range">Rango</SelectItem>
            </SelectContent>
          </Select>

          {filterType === "day" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-xl border-gray-200 shadow-sm text-sm"
                  data-testid="button-select-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}

          {filterType === "month" && (
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-month-picker"
            />
          )}

          {filterType === "year" && (
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-year-picker"
            />
          )}

          {filterType === "range" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-xl border-gray-200 shadow-sm text-sm"
                  data-testid="button-select-range"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Seleccionar rango"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="flex items-center space-x-2" data-testid="tab-import">
            <Upload className="h-4 w-4" />
            <span>Importar CSV</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center space-x-2" data-testid="tab-data">
            <Database className="h-4 w-4" />
            <span>Datos Importados</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4" />
            <span>Análisis</span>
          </TabsTrigger>
        </TabsList>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-6">
          <NvvCsvImport 
            onImportComplete={() => {
              toast({
                title: "Importación completada",
                description: "Los datos se han importado correctamente",
              });
              setActiveTab("data");
            }}
          />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          {/* Filters for NVV Data */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select 
                value={nvvFilters.status} 
                onValueChange={(value) => setNvvFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={nvvFilters.salesperson} 
                onValueChange={(value) => setNvvFilters(prev => ({ ...prev, salesperson: value }))}
              >
                <SelectTrigger data-testid="filter-salesperson">
                  <SelectValue placeholder="Todos los vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los vendedores</SelectItem>
                  {/* Add salesperson options dynamically */}
                </SelectContent>
              </Select>

              <Select 
                value={nvvFilters.segment} 
                onValueChange={(value) => setNvvFilters(prev => ({ ...prev, segment: value }))}
              >
                <SelectTrigger data-testid="filter-segment">
                  <SelectValue placeholder="Todos los segmentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los segmentos</SelectItem>
                  <SelectItem value="FERRETERIAS">Ferreterías</SelectItem>
                  <SelectItem value="CONSTRUCCION">Construcción</SelectItem>
                  <SelectItem value="MCT">MCT</SelectItem>
                  <SelectItem value="PANORAMICA STORE">Panorámica Store</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="filter-start-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nvvFilters.startDate ? format(nvvFilters.startDate, "dd/MM/yyyy") : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={nvvFilters.startDate}
                    onSelect={(date) => setNvvFilters(prev => ({ ...prev, startDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="filter-end-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nvvFilters.endDate ? format(nvvFilters.endDate, "dd/MM/yyyy") : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={nvvFilters.endDate}
                    onSelect={(date) => setNvvFilters(prev => ({ ...prev, endDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </Card>

          <PendingSalesTable
            startDate={nvvFilters.startDate}
            endDate={nvvFilters.endDate}
            selectedStatus={nvvFilters.status}
            selectedSalesperson={nvvFilters.salesperson}
            selectedSegment={nvvFilters.segment}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4" data-testid="kpi-total-sales">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ventas Totales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(mockSummary.totalSales)}
            </div>
            <p className="text-xs text-red-600 font-medium">
              {mockSummary.salesVarianceVsPrevious ? mockSummary.salesVarianceVsPrevious.toFixed(1) : '0.0'}% vs anterior
            </p>
          </CardContent>
        </Card>

        <Card className="p-4" data-testid="kpi-variance-target">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Varianza vs Meta</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-red-600">
              {mockSummary.salesVarianceVsTarget ? mockSummary.salesVarianceVsTarget.toFixed(1) : '0.0'}%
            </div>
            <p className="text-xs text-gray-500">Bajo objetivo</p>
          </CardContent>
        </Card>

        <Card className="p-4" data-testid="kpi-units">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Unidades</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(mockSummary.totalUnits)}
            </div>
            <p className="text-xs text-gray-500">Vendidas</p>
          </CardContent>
        </Card>

        <Card className="p-4" data-testid="kpi-avg-ticket">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ticket Promedio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(mockSummary.averageTicket)}
            </div>
            <p className="text-xs text-gray-500">Por venta</p>
          </CardContent>
        </Card>

        <Card className="p-4" data-testid="kpi-period">
          <CardHeader className="p-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Período</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-lg font-bold text-gray-900">
              {mockSummary.periodLabel}
            </div>
            <p className="text-xs text-gray-500">Análisis actual</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tendencia de Ventas</h2>
            <p className="text-sm text-gray-600">Evolución temporal con metas</p>
          </div>
          <div className="flex space-x-2">
            <Select value={viewMode} onValueChange={(value: "sales" | "units") => setViewMode(value)}>
              <SelectTrigger className="w-32 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-view-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200">
                <SelectItem value="sales">Ventas CLP</SelectItem>
                <SelectItem value="units">Unidades</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={trendPeriod} onValueChange={(value: "daily" | "weekly" | "monthly") => setTrendPeriod(value)}>
              <SelectTrigger className="w-32 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-trend-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200">
                <SelectItem value="daily">Diario</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="h-80">
          <Line data={trendChartData} options={trendChartOptions} />
        </div>
      </Card>

      {/* Breakdown Chart */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Varianza por {breakdownBy === 'segment' ? 'Segmento' : 'Vendedor'}</h2>
            <p className="text-sm text-gray-600">Cumplimiento vs metas establecidas</p>
          </div>
          <Select value={breakdownBy} onValueChange={(value: "segment" | "salesperson") => setBreakdownBy(value)}>
            <SelectTrigger className="w-40 rounded-xl border-gray-200 shadow-sm text-sm" data-testid="select-breakdown-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-gray-200">
              <SelectItem value="segment">Por Segmento</SelectItem>
              <SelectItem value="salesperson">Por Vendedor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-64">
          <Bar data={breakdownChartData} options={breakdownChartOptions} />
        </div>
      </Card>

      {/* Packaging Breakdown Table */}
      <PackagingBreakdownTable 
        selectedPeriod={selectedPeriod}
        filterType={filterType}
      />

      {/* Detailed Table */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Detalle de Variaciones</h2>
          <p className="text-sm text-gray-600">Información completa por {breakdownBy === 'segment' ? 'segmento' : 'vendedor'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="breakdown-table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  {breakdownBy === 'segment' ? 'Segmento' : 'Vendedor'}
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Ventas</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Unidades</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Meta</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Var. vs Meta</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Var. vs Anterior</th>
              </tr>
            </thead>
            <tbody>
              {mockBreakdownData.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`breakdown-row-${index}`}>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(item.sales)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatNumber(item.units)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {item.target ? formatCurrency(item.target) : '-'}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    (item.varianceVsTarget || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.varianceVsTarget ? `${item.varianceVsTarget >= 0 ? '+' : ''}${item.varianceVsTarget.toFixed(1)}%` : '-'}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    (item.varianceVsPrevious || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.varianceVsPrevious ? `${item.varianceVsPrevious >= 0 ? '+' : ''}${item.varianceVsPrevious.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}