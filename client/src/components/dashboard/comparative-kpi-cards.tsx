import { useQueries } from "@tanstack/react-query";
import { DollarSign, Package, Users, TrendingUp, BarChart3 } from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

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

  const formatCompact = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  const labels = periods.map(p => p.label);
  const salesData = allData.map(d => d?.totalSales || 0);
  const unitsData = allData.map(d => d?.totalUnits || 0);
  const transactionsData = allData.map(d => d?.totalTransactions || 0);
  const totalSales = salesData.reduce((a, b) => a + b, 0);
  const totalUnits = unitsData.reduce((a, b) => a + b, 0);
  const totalTransactions = transactionsData.reduce((a, b) => a + b, 0);

  const barColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(234, 179, 8, 0.8)',
    'rgba(20, 184, 166, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(99, 102, 241, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(251, 146, 60, 0.8)',
    'rgba(168, 85, 247, 0.8)',
  ];

  const salesBarData = {
    labels,
    datasets: [
      {
        label: 'Ventas',
        data: salesData,
        backgroundColor: barColors.slice(0, periods.length),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const salesBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrency(context.raw),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCompact(value),
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  const salesPieData = {
    labels,
    datasets: [
      {
        data: salesData,
        backgroundColor: barColors.slice(0, periods.length),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { 
          boxWidth: 12, 
          padding: 8,
          font: { size: 11 }
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const percentage = ((value / totalSales) * 100).toFixed(1);
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  const unitsBarData = {
    labels,
    datasets: [
      {
        label: 'Unidades',
        data: unitsData,
        backgroundColor: barColors.slice(0, periods.length).map(c => c.replace('0.8', '0.6')),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const unitsBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${formatNumber(context.raw)} unidades`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatNumber(value),
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        grid: { display: false },
      },
    },
  };

  const unitsPieData = {
    labels,
    datasets: [
      {
        data: unitsData,
        backgroundColor: barColors.slice(0, periods.length).map(c => c.replace('0.8', '0.7')),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const unitsPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { 
          boxWidth: 12, 
          padding: 8,
          font: { size: 11 }
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const percentage = ((value / totalUnits) * 100).toFixed(1);
            return `${context.label}: ${formatNumber(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-semibold text-blue-900">Modo Comparativo Visual</div>
            <div className="text-sm text-blue-700">Comparando {periods.length} períodos con gráficos</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Ventas</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
          <div className="text-xs opacity-75 mt-1">{periods.length} períodos</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Unidades</span>
          </div>
          <div className="text-2xl font-bold">{formatNumber(totalUnits)}</div>
          <div className="text-xs opacity-75 mt-1">{periods.length} períodos</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Transacciones</span>
          </div>
          <div className="text-2xl font-bold">{formatNumber(totalTransactions)}</div>
          <div className="text-xs opacity-75 mt-1">{periods.length} períodos</div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Ventas por Período</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <Bar data={salesBarData} options={salesBarOptions} />
          </div>
          <div className="h-64">
            <Doughnut data={salesPieData} options={pieOptions} />
          </div>
        </div>
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            const percentage = totalSales > 0 ? ((metrics.totalSales / totalSales) * 100).toFixed(1) : '0';
            return (
              <div 
                key={period.period} 
                className="text-center p-2 rounded-lg bg-gray-50"
                data-testid={`kpi-sales-${period.period}`}
              >
                <div className="text-xs text-gray-500">{period.label}</div>
                <div className="text-sm font-bold text-gray-900">{formatCurrency(metrics.totalSales)}</div>
                <div className="text-xs text-blue-600">{percentage}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Unidades Vendidas por Período</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <Bar data={unitsBarData} options={unitsBarOptions} />
          </div>
          <div className="h-64">
            <Doughnut data={unitsPieData} options={unitsPieOptions} />
          </div>
        </div>
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            const percentage = totalUnits > 0 ? ((metrics.totalUnits / totalUnits) * 100).toFixed(1) : '0';
            return (
              <div 
                key={period.period} 
                className="text-center p-2 rounded-lg bg-gray-50"
                data-testid={`kpi-units-${period.period}`}
              >
                <div className="text-xs text-gray-500">{period.label}</div>
                <div className="text-sm font-bold text-gray-900">{formatNumber(metrics.totalUnits)}</div>
                <div className="text-xs text-orange-600">{percentage}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Transacciones por Período</h3>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}>
          {periods.map((period, index) => {
            const metrics = allData[index];
            if (!metrics) return null;
            const percentage = totalTransactions > 0 ? ((metrics.totalTransactions / totalTransactions) * 100).toFixed(1) : '0';
            const maxTransactions = Math.max(...transactionsData);
            const barWidth = maxTransactions > 0 ? (metrics.totalTransactions / maxTransactions) * 100 : 0;
            
            return (
              <div 
                key={period.period} 
                className="bg-gray-50 rounded-lg p-3"
                data-testid={`kpi-customers-${period.period}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-600">{period.label}</span>
                  <span className="text-xs text-green-600">{percentage}%</span>
                </div>
                <div className="text-lg font-bold text-gray-900 mb-2">
                  {formatNumber(metrics.totalTransactions)}
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
