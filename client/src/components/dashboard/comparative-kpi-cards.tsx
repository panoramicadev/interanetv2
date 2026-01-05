import { useQueries } from "@tanstack/react-query";
import { DollarSign, Package, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SalesMetrics {
  totalSales: number;
  totalTransactions: number;
  totalUnits: number;
  activeCustomers: number;
}

interface ComparativeKPICardsProps {
  periods: Array<{ period: string; label: string; filterType: "day" | "month" | "year" }>;
  segment?: string;
  salesperson?: string;
  client?: string;
}

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

export default function ComparativeKPICards({ periods, segment, salesperson, client }: ComparativeKPICardsProps) {
  const metricsQueries = useQueries({
    queries: periods.map(({ period, filterType }) => ({
      queryKey: [`/api/sales/metrics?period=${period}&filterType=${filterType}${
        segment ? `&segment=${encodeURIComponent(segment)}` : ''
      }${salesperson ? `&salesperson=${encodeURIComponent(salesperson)}` : ''}${client ? `&client=${encodeURIComponent(client)}` : ''}`],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('period', period);
        params.append('filterType', filterType);
        if (segment) params.append('segment', segment);
        if (salesperson) params.append('salesperson', salesperson);
        if (client) params.append('client', client);
        
        const res = await fetch(`/api/sales/metrics?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json() as SalesMetrics;
      }
    }))
  });

  const isLoading = metricsQueries.some(q => q.isLoading);
  const allData = metricsQueries.map(q => q.data);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CL').format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-64 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const labels = periods.map(p => p.label);
  const salesData = allData.map(d => d?.totalSales || 0);
  const unitsData = allData.map(d => d?.totalUnits || 0);
  const transactionsData = allData.map(d => d?.totalTransactions || 0);
  const totalSales = salesData.reduce((a, b) => a + b, 0);
  const totalUnits = unitsData.reduce((a, b) => a + b, 0);
  const totalTransactions = transactionsData.reduce((a, b) => a + b, 0);

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
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    }
  };

  const unitsBarOptions = {
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
          callback: (value: any) => formatNumber(value),
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    }
  };

  const transactionsBarOptions = {
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
          callback: (value: any) => formatNumber(value),
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      x: {
        grid: {
          display: false,
        }
      }
    }
  };

  const salesChartData = {
    labels,
    datasets: [{
      label: 'Ventas',
      data: salesData,
      backgroundColor: CATEGORY_COLORS.slice(0, periods.length),
      borderRadius: 6,
    }]
  };

  const unitsChartData = {
    labels,
    datasets: [{
      label: 'Unidades',
      data: unitsData,
      backgroundColor: CATEGORY_COLORS.slice(0, periods.length).map(c => c.replace('0.8', '0.7')),
      borderRadius: 6,
    }]
  };

  const transactionsChartData = {
    labels,
    datasets: [{
      label: 'Transacciones',
      data: transactionsData,
      backgroundColor: CATEGORY_COLORS.slice(0, periods.length).map(c => c.replace('0.8', '0.6')),
      borderRadius: 6,
    }]
  };

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-semibold text-blue-900">Modo Comparativo</div>
              <div className="text-sm text-blue-700">Comparando {periods.length} períodos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Total Ventas</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalSales)}</div>
            <div className="text-xs text-gray-500 mt-1">{periods.length} períodos combinados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Package className="h-5 w-5" />
              <span className="text-sm font-medium">Total Unidades</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(totalUnits)}</div>
            <div className="text-xs text-gray-500 mt-1">{periods.length} períodos combinados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Total Transacciones</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(totalTransactions)}</div>
            <div className="text-xs text-gray-500 mt-1">{periods.length} períodos combinados</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Ventas por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {salesData.some(v => v > 0) ? (
                <Bar data={salesChartData} options={barOptions} />
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
              <Package className="h-5 w-5 text-orange-600" />
              Unidades por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {unitsData.some(v => v > 0) ? (
                <Bar data={unitsChartData} options={unitsBarOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Transacciones por Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {transactionsData.some(v => v > 0) ? (
              <Bar data={transactionsChartData} options={transactionsBarOptions} />
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
