import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, Calendar, AlertCircle, BarChart3 } from "lucide-react";
import { format, addMonths, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MonthlySales {
  period: string; // YYYY-MM
  totalSales: number;
}

interface HistoricalData {
  salesperson?: string;
  segment?: string;
  monthlySales: MonthlySales[];
}

interface ProjectionData {
  period: string;
  projected: number;
  confidence: {
    lower: number;
    upper: number;
  };
}

// Holt-Winters Exponential Smoothing for forecasting
function holtWintersForecasting(
  historicalData: number[],
  periods: number = 12,
  alpha: number = 0.2,
  beta: number = 0.1,
  gamma: number = 0.1,
  seasonLength: number = 12
): ProjectionData[] {
  if (historicalData.length < seasonLength * 2) {
    // Not enough data for seasonal decomposition
    return simpleExpSmoothing(historicalData, periods);
  }

  const n = historicalData.length;
  const level: number[] = [];
  const trend: number[] = [];
  const season: number[] = new Array(n).fill(0);
  
  // Initialize level and trend
  level[0] = historicalData[0];
  trend[0] = (historicalData[seasonLength] - historicalData[0]) / seasonLength;
  
  // Initialize seasonal components
  for (let i = 0; i < seasonLength; i++) {
    let avgSum = 0;
    let count = 0;
    for (let j = i; j < n; j += seasonLength) {
      avgSum += historicalData[j];
      count++;
    }
    season[i] = (avgSum / count) / level[0];
  }
  
  // Apply Holt-Winters
  for (let i = 1; i < n; i++) {
    const prevLevel = level[i - 1];
    const prevTrend = trend[i - 1];
    const prevSeason = season[i - seasonLength] || season[i % seasonLength];
    
    level[i] = alpha * (historicalData[i] / prevSeason) + (1 - alpha) * (prevLevel + prevTrend);
    trend[i] = beta * (level[i] - prevLevel) + (1 - beta) * prevTrend;
    season[i] = gamma * (historicalData[i] / level[i]) + (1 - gamma) * prevSeason;
  }
  
  // Generate forecasts
  const forecasts: ProjectionData[] = [];
  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];
  
  for (let i = 1; i <= periods; i++) {
    const seasonIndex = (n - seasonLength + (i - 1)) % seasonLength;
    const seasonalComponent = season[n - seasonLength + seasonIndex] || 1;
    
    const forecast = (lastLevel + i * lastTrend) * seasonalComponent;
    
    // Calculate confidence interval (95%)
    const stdDev = calculateStdDev(historicalData);
    const marginOfError = 1.96 * stdDev * Math.sqrt(i);
    
    const currentDate = new Date();
    const projectedDate = addMonths(currentDate, i);
    
    forecasts.push({
      period: format(projectedDate, 'yyyy-MM'),
      projected: Math.max(0, forecast),
      confidence: {
        lower: Math.max(0, forecast - marginOfError),
        upper: forecast + marginOfError,
      },
    });
  }
  
  return forecasts;
}

// Simple Exponential Smoothing (fallback for insufficient data)
function simpleExpSmoothing(data: number[], periods: number): ProjectionData[] {
  if (data.length === 0) return [];
  
  const alpha = 0.3;
  let smoothed = data[0];
  
  for (let i = 1; i < data.length; i++) {
    smoothed = alpha * data[i] + (1 - alpha) * smoothed;
  }
  
  // Calculate trend from last 6 months
  const recentData = data.slice(-6);
  const trend = recentData.length > 1
    ? (recentData[recentData.length - 1] - recentData[0]) / recentData.length
    : 0;
  
  const forecasts: ProjectionData[] = [];
  const stdDev = calculateStdDev(data);
  
  for (let i = 1; i <= periods; i++) {
    const forecast = smoothed + trend * i;
    const marginOfError = 1.96 * stdDev * Math.sqrt(i);
    
    const currentDate = new Date();
    const projectedDate = addMonths(currentDate, i);
    
    forecasts.push({
      period: format(projectedDate, 'yyyy-MM'),
      projected: Math.max(0, forecast),
      confidence: {
        lower: Math.max(0, forecast - marginOfError),
        upper: forecast + marginOfError,
      },
    });
  }
  
  return forecasts;
}

function calculateStdDev(data: number[]): number {
  if (data.length === 0) return 0;
  
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  
  return Math.sqrt(variance);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProyeccionPage() {
  const [viewType, setViewType] = useState<"salesperson" | "segment">("salesperson");
  const [selectedYear, setSelectedYear] = useState<string>(format(addMonths(new Date(), 1), 'yyyy'));
  
  const { data: historicalData, isLoading } = useQuery<HistoricalData[]>({
    queryKey: ['/api/proyeccion/historical', viewType],
  });
  
  const projections = useMemo(() => {
    if (!historicalData) return [];
    
    return historicalData.map((item) => {
      const salesValues = item.monthlySales.map(m => m.totalSales);
      const forecast = holtWintersForecasting(salesValues, 12);
      
      return {
        name: item.salesperson || item.segment || 'Unknown',
        historical: item.monthlySales,
        projections: forecast,
        totalProjected: forecast.reduce((sum, p) => sum + p.projected, 0),
        avgMonthly: forecast.reduce((sum, p) => sum + p.projected, 0) / forecast.length,
      };
    });
  }, [historicalData]);
  
  // Filter projections by selected year
  const filteredProjections = useMemo(() => {
    return projections.map(p => ({
      ...p,
      projections: p.projections.filter(proj => proj.period.startsWith(selectedYear)),
    }));
  }, [projections, selectedYear]);
  
  // Available years for selection
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      currentYear,
      currentYear + 1,
      currentYear + 2,
    ].map(year => year.toString());
  }, []);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Proyecciones Holt-Winters:</strong> Sistema de forecasting basado en suavización exponencial triple que considera tendencia y estacionalidad.
          Las proyecciones incluyen intervalos de confianza del 95%.
        </AlertDescription>
      </Alert>
      
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Tabs for view type */}
      <Tabs value={viewType} onValueChange={(v) => setViewType(v as "salesperson" | "segment")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="salesperson" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Por Vendedor
          </TabsTrigger>
          <TabsTrigger value="segment" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Por Segmento
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="salesperson" className="mt-6 space-y-6">
          <ProjectionsList projections={filteredProjections} type="vendedor" />
        </TabsContent>
        
        <TabsContent value="segment" className="mt-6 space-y-6">
          <ProjectionsList projections={filteredProjections} type="segmento" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ProjectionsListProps {
  projections: Array<{
    name: string;
    projections: ProjectionData[];
    totalProjected: number;
    avgMonthly: number;
  }>;
  type: string;
}

function ProjectionsList({ projections, type }: ProjectionsListProps) {
  if (projections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-center">
            No hay datos históricos suficientes para generar proyecciones.
            <br />
            Se requieren al menos 24 meses de datos de ventas.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proyectado</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(projections.reduce((sum, p) => sum + p.totalProjected, 0))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Suma de todas las proyecciones
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Mensual</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(projections.reduce((sum, p) => sum + p.avgMonthly, 0) / projections.length)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Promedio global
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total {type}s</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projections.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Con proyecciones activas
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Projections */}
      {projections.map((item) => (
        <Card key={item.name}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{item.name}</span>
              <Badge variant="outline" className="text-sm">
                Total: {formatCurrency(item.totalProjected)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Promedio mensual: {formatCurrency(item.avgMonthly)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Proyección</TableHead>
                    <TableHead className="text-right">Rango Inferior (95%)</TableHead>
                    <TableHead className="text-right">Rango Superior (95%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.projections.map((proj) => (
                    <TableRow key={proj.period}>
                      <TableCell className="font-medium">
                        {format(new Date(proj.period + '-01'), 'MMMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {formatCurrency(proj.projected)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {formatCurrency(proj.confidence.lower)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {formatCurrency(proj.confidence.upper)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
