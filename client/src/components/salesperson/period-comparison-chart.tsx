import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart3, 
  X, 
  Plus,
  Calendar,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface PeriodSelection {
  id: string;
  label: string;
  period: string;
  filterType: 'year' | 'month' | 'day';
  color: string;
}

interface PeriodComparisonData {
  period: string;
  filterType: string;
  sales: number;
  transactions: number;
  avgTicket: number;
}

interface Props {
  salespersonName: string;
}

const COLORS = [
  'rgb(249, 115, 22)', // orange-500
  'rgb(59, 130, 246)', // blue-500
  'rgb(16, 185, 129)', // green-500
  'rgb(168, 85, 247)', // purple-500
  'rgb(236, 72, 153)', // pink-500
  'rgb(245, 158, 11)', // amber-500
  'rgb(20, 184, 166)', // teal-500
  'rgb(239, 68, 68)', // red-500
];

export default function PeriodComparisonChart({ salespersonName }: Props) {
  const [selectedPeriods, setSelectedPeriods] = useState<PeriodSelection[]>([]);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState<number | null>(null);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Fetch comparison data for all selected periods
  const { data: comparisonData, isLoading } = useQuery<PeriodComparisonData[]>({
    queryKey: ['/api/sales/salesperson', salespersonName, 'period-comparison', selectedPeriods],
    queryFn: async () => {
      if (selectedPeriods.length === 0) return [];
      
      const promises = selectedPeriods.map(async (p) => {
        const params = new URLSearchParams();
        params.append('period', p.period);
        params.append('filterType', p.filterType);
        const res = await fetch(
          `/api/sales/salesperson/${encodeURIComponent(salespersonName)}/details?${params}`,
          { credentials: 'include' }
        );
        if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
        const data = await res.json();
        return {
          period: p.period,
          filterType: p.filterType,
          sales: data.totalSales || 0,
          transactions: data.transactionCount || 0,
          avgTicket: data.averageTicket || 0,
        };
      });
      
      return await Promise.all(promises);
    },
    enabled: selectedPeriods.length > 0,
  });

  const addPeriod = (period: string, filterType: 'year' | 'month' | 'day', label: string) => {
    const id = `${filterType}-${period}`;
    if (selectedPeriods.find(p => p.id === id)) return;
    
    const color = COLORS[selectedPeriods.length % COLORS.length];
    setSelectedPeriods([...selectedPeriods, { id, label, period, filterType, color }]);
  };

  const removePeriod = (id: string) => {
    setSelectedPeriods(selectedPeriods.filter(p => p.id !== id));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("es-CL").format(value);
  };

  // Prepare chart data
  const chartData = {
    labels: selectedPeriods.map(p => p.label),
    datasets: [
      {
        label: 'Ventas',
        data: comparisonData?.map(d => d.sales) || [],
        backgroundColor: selectedPeriods.map(p => p.color.replace('rgb', 'rgba').replace(')', ', 0.6)')),
        borderColor: selectedPeriods.map(p => p.color),
        borderWidth: 2,
      }
    ]
  };

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const months = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  // Calculate percentage changes
  const getPercentageChange = (index: number) => {
    if (!comparisonData || index === 0 || comparisonData.length < 2) return null;
    const current = comparisonData[index].sales;
    const previous = comparisonData[index - 1].sales;
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return (
    <Card className="w-full" data-testid="card-period-comparison">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              Comparativa de Períodos
            </CardTitle>
            <CardDescription>
              Compara ventas entre diferentes años, meses o días
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartType === 'bar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('bar')}
              data-testid="button-chart-type-bar"
            >
              Barras
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
              data-testid="button-chart-type-line"
            >
              Líneas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period selectors */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowYearSelector(!showYearSelector)}
            data-testid="button-add-year"
          >
            <Plus className="h-4 w-4 mr-1" />
            Año
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            data-testid="button-add-month"
          >
            <Plus className="h-4 w-4 mr-1" />
            Mes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDaySelector(!showDaySelector)}
            data-testid="button-add-day"
          >
            <Plus className="h-4 w-4 mr-1" />
            Día
          </Button>
        </div>

        {/* Year selector */}
        {showYearSelector && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Seleccionar año:</p>
            <div className="flex flex-wrap gap-2">
              {years.map(year => (
                <Button
                  key={year}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addPeriod(`${year}-01`, 'year', `${year}`);
                    setShowYearSelector(false);
                  }}
                  data-testid={`button-select-year-${year}`}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Month selector */}
        {showMonthSelector && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Seleccionar año:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {years.map(year => (
                <Button
                  key={year}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonthYear(year)}
                  data-testid={`button-select-month-year-${year}`}
                >
                  {year}
                </Button>
              ))}
            </div>
            {selectedMonthYear && (
              <>
                <p className="text-sm font-medium mb-2">Seleccionar mes:</p>
                <div className="grid grid-cols-4 gap-2">
                  {months.map(month => (
                    <Button
                      key={month.value}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addPeriod(`${selectedMonthYear}-${month.value}`, 'month', `${month.label} ${selectedMonthYear}`);
                        setShowMonthSelector(false);
                        setSelectedMonthYear(null);
                      }}
                      data-testid={`button-select-month-${month.value}`}
                    >
                      {month.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Day selector */}
        {showDaySelector && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-sm font-medium mb-2">Seleccionar día:</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-open-day-picker"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDay ? format(selectedDay, "PPP", { locale: es }) : <span>Elige un día</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDay}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDay(date);
                      const period = format(date, "yyyy-MM-dd");
                      const label = format(date, "d 'de' MMMM yyyy", { locale: es });
                      addPeriod(period, 'day', label);
                      setShowDaySelector(false);
                      setSelectedDay(undefined);
                    }
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Selected periods */}
        {selectedPeriods.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Períodos seleccionados:</p>
            <div className="flex flex-wrap gap-2">
              {selectedPeriods.map((period, index) => {
                const changePercent = getPercentageChange(index);
                return (
                  <Badge
                    key={period.id}
                    variant="secondary"
                    className="flex items-center gap-2 py-1.5 px-3"
                    style={{ backgroundColor: period.color.replace('rgb', 'rgba').replace(')', ', 0.15)'), borderColor: period.color }}
                    data-testid={`badge-period-${period.id}`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{period.label}</span>
                    {changePercent !== null && (
                      <span className={`text-xs flex items-center gap-1 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(changePercent).toFixed(1)}%
                      </span>
                    )}
                    <button
                      onClick={() => removePeriod(period.id)}
                      className="ml-1 hover:opacity-70"
                      data-testid={`button-remove-period-${period.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Chart */}
        {selectedPeriods.length > 0 && (
          <>
            <div className="h-80 w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                </div>
              ) : chartType === 'bar' ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>

            {/* Stats table */}
            {comparisonData && comparisonData.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-comparison-stats">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Período</th>
                      <th className="text-right py-2 px-2 font-medium">Ventas</th>
                      <th className="text-right py-2 px-2 font-medium">Transacciones</th>
                      <th className="text-right py-2 px-2 font-medium">Ticket Promedio</th>
                      <th className="text-right py-2 px-2 font-medium">Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPeriods.map((period, index) => {
                      const data = comparisonData[index];
                      const changePercent = getPercentageChange(index);
                      return (
                        <tr key={period.id} className="border-b last:border-0">
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-3 w-3 rounded-full" 
                                style={{ backgroundColor: period.color }}
                              />
                              <span className="font-medium">{period.label}</span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-2 font-semibold">{formatCurrency(data.sales)}</td>
                          <td className="text-right py-2 px-2">{formatNumber(data.transactions)}</td>
                          <td className="text-right py-2 px-2">{formatCurrency(data.avgTicket)}</td>
                          <td className="text-right py-2 px-2">
                            {changePercent !== null ? (
                              <span className={`flex items-center justify-end gap-1 font-medium ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {selectedPeriods.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Selecciona períodos para comparar</p>
            <p className="text-xs mt-1">Puedes añadir años, meses o días para ver la comparativa</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
