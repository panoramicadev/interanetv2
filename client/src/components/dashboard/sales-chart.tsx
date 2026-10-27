import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { useState, useEffect } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface ChartDataPoint {
  period: string;
  sales: number;
}

interface SalesChartProps {
  selectedPeriod: string;
  filterType: "day" | "month" | "year" | "range";
  segment?: string;
  salesperson?: string;
  client?: string;
  product?: string;
  branch?: string;
  comparisonPeriods?: Array<{period: string, label: string, filterType: string}>;
}

// Paleta categórica de la intranet (ver skill panoramica-design): la serie
// principal va en el naranjo de marca y las de comparación siguen el orden fijo.
const CHART_COLORS = [
  { border: '#fd6301', bg: 'rgba(253, 99, 1, 0.3)' },     // Naranjo de marca
  { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.3)' },    // Azul
  { border: '#10b981', bg: 'rgba(16, 185, 129, 0.3)' },   // Verde
  { border: '#db2777', bg: 'rgba(219, 39, 119, 0.3)' },   // Rosa
  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.3)' },   // Ámbar
  { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.3)' },   // Morado
  { border: '#0d9488', bg: 'rgba(13, 148, 136, 0.3)' },   // Teal
  { border: '#64748b', bg: 'rgba(100, 116, 139, 0.3)' },  // Otras
];

// NVV: color de estado "pendiente"
const NVV_COLOR = { border: '#d97706', bg: 'rgba(217, 119, 6, 0.3)' };

// Mismo tramo del año anterior: mismo diseño que la serie del período elegido (línea
// gruesa, relleno degradado y puntos), en el negro de marca (pedido del usuario, oct-2026).
const ANIO_ANTERIOR_COLOR = { border: '#0a0a0a', bg: 'rgba(10, 10, 10, 0.18)' };

const dosDigitos = (n: number) => String(n).padStart(2, '0');

// Sin círculo en los días/semanas en cero (pedido del usuario, oct-2026): con todos los
// puntos marcados, una fila de ceros se leía como actividad. El punto vuelve al pasar el mouse.
const radioSinCeros = (radio: number) => (ctx: any) => {
  const v = ctx.raw;
  return v === null || v === undefined || Math.abs(Number(v)) < 1 ? 0 : radio;
};

/**
 * El mismo tramo, un año antes, para cruzarlo en el gráfico (pedido del usuario, oct-2026).
 * El mes en curso se compara "a la fecha": del 1 al mismo día del año anterior, porque el
 * servidor también corta el mes actual en hoy. Un mes cerrado se compara completo.
 * Devuelve null cuando no hay con qué comparar (un día suelto o un período sin formato).
 */
function periodoAnioAnterior(selectedPeriod: string, filterType: string): { period: string; filterType: string; anio: number } | null {
  const hoy = new Date();
  if (filterType === 'month') {
    const m = (selectedPeriod || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    if (anio === hoy.getFullYear() && mes === hoy.getMonth() + 1) {
      // 29 de febrero contra un año que no es bisiesto: hasta el último día de ese mes
      const ultimoDia = new Date(anio - 1, mes, 0).getDate();
      const dia = Math.min(hoy.getDate(), ultimoDia);
      return {
        period: `${anio - 1}-${m[2]}-01_${anio - 1}-${m[2]}-${dosDigitos(dia)}`,
        filterType: 'range',
        anio: anio - 1,
      };
    }
    return { period: `${anio - 1}-${m[2]}`, filterType: 'month', anio: anio - 1 };
  }
  if (filterType === 'year') {
    // El año entero puede llegar como "2026" o como "2026-01"
    const anio = Number((selectedPeriod || '').slice(0, 4));
    return Number.isInteger(anio) && anio > 0 ? { period: String(anio - 1), filterType: 'year', anio: anio - 1 } : null;
  }
  if (filterType === 'range' && (selectedPeriod || '').includes('_')) {
    const correr = (f: string) => {
      const [a, mm, dd] = f.split('-').map(Number);
      if (!a || !mm || !dd) return null;
      const ultimoDia = new Date(a - 1, mm, 0).getDate();
      return `${a - 1}-${dosDigitos(mm)}-${dosDigitos(Math.min(dd, ultimoDia))}`;
    };
    const [inicio, fin] = selectedPeriod.split('_');
    const a = correr(inicio);
    const b = correr(fin);
    return a && b ? { period: `${a}_${b}`, filterType: 'range', anio: Number(inicio.slice(0, 4)) - 1 } : null;
  }
  return null;
}

export default function SalesChart({ selectedPeriod, filterType, segment, salesperson, client, product, branch, comparisonPeriods }: SalesChartProps) {
  // Auto-set chart period based on main filter type
  const getDefaultPeriod = (): 'weekly' | 'monthly' | 'daily' => {
    // El gráfico parte siempre en Diario, para todos (pedido del usuario, oct-2026); después
    // se cambia con los botones. La única excepción es el año completo: ahí parte en meses,
    // porque 365 puntos no se leen y no hay botón "Mensual" para volver.
    if (filterType === 'year') return 'monthly';
    return 'daily';
  };
  
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'daily'>(getDefaultPeriod());
  const [dataSource, setDataSource] = useState<'facturado' | 'nvv'>('facturado');
  const isComparison = comparisonPeriods && comparisonPeriods.length > 0;
  
  // Sync chart period when main filter changes
  useEffect(() => {
    setPeriod(getDefaultPeriod());
  }, [filterType, selectedPeriod]);
  
  const chartPeriod = filterType === 'day' ? 'daily' : period;
  const isNvv = dataSource === 'nvv';
  
  // Single period query - FACTURADO
  const { data: chartData, isLoading: singleLoading} = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/sales/chart-data', chartPeriod, selectedPeriod, filterType, segment, salesperson, client, product, branch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (product) params.append('product', product);
      if (branch) params.append('branch', branch);
      const res = await fetch(`/api/sales/chart-data?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison && !isNvv,
  });

  // Single period query - NVV
  const { data: nvvChartData, isLoading: nvvLoading } = useQuery<ChartDataPoint[]>({
    queryKey: ['/api/nvv/chart-data', chartPeriod, selectedPeriod, filterType, segment, salesperson, client],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', selectedPeriod);
      params.append('filterType', filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      const res = await fetch(`/api/nvv/chart-data?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison && isNvv,
  });

  // Multi-period comparison query (only for facturado)
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['/api/sales/chart-data-comparison', comparisonPeriods, chartPeriod, segment, salesperson, client, product],
    queryFn: async () => {
      const results = await Promise.all(
        (comparisonPeriods || []).map(async ({ period: p, label, filterType: ft }) => {
          const params = new URLSearchParams();
          params.append('period', chartPeriod);
          params.append('selectedPeriod', p);
          params.append('filterType', ft);
          if (segment) params.append('segment', segment);
          if (salesperson) params.append('salesperson', salesperson);
          if (client) params.append('client', client);
          if (product) params.append('product', product);
          
          const res = await fetch(`/api/sales/chart-data?${params}`, { credentials: "include" });
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          return { label, data };
        })
      );
      return results;
    },
    enabled: isComparison,
  });

  // Mismo tramo del año anterior (Facturado o NVV, según lo que se esté mirando)
  const anterior = filterType !== 'day' ? periodoAnioAnterior(selectedPeriod, filterType) : null;
  const { data: anteriorData } = useQuery<ChartDataPoint[]>({
    queryKey: [isNvv ? '/api/nvv/chart-data' : '/api/sales/chart-data', 'anio-anterior', chartPeriod, anterior?.period, anterior?.filterType, segment, salesperson, client, product, branch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', chartPeriod);
      params.append('selectedPeriod', anterior!.period);
      params.append('filterType', anterior!.filterType);
      if (segment) params.append('segment', segment);
      if (salesperson) params.append('salesperson', salesperson);
      if (client) params.append('client', client);
      if (!isNvv && product) params.append('product', product);
      if (!isNvv && branch) params.append('branch', branch);
      const res = await fetch(`${isNvv ? '/api/nvv/chart-data' : '/api/sales/chart-data'}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !isComparison && !!anterior,
  });

  const isLoading = isComparison ? comparisonLoading : (isNvv ? nvvLoading : singleLoading);
  const activeData = isNvv ? nvvChartData : chartData;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const createGradient = (ctx: any, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color.replace(/[\d.]+\)/, '0.0)'));
    return gradient;
  };

  // Active color based on data source
  const activeColor = isNvv ? NVV_COLOR : CHART_COLORS[0];

  // El año anterior se alinea por posición: día 1 con día 1, semana 1 del mes con semana 1.
  // Las fechas no coinciden (otro día de la semana, otro número de semana), pero lo que se
  // compara es el mismo tramo del período.
  const etiquetas = activeData?.map(d => d.period) || [];
  const mostrarAnterior = !isComparison && !!anterior && !!anteriorData && anteriorData.length > 0;
  const nombreSerie = isNvv ? 'NVV' : 'Ventas';
  const anioActual = anterior ? anterior.anio + 1 : undefined;

  // Build chart configuration
  const chartConfig = isComparison && comparisonData ? {
    labels: comparisonData[0]?.data?.map((d: ChartDataPoint) => d.period) || [],
    datasets: comparisonData.map((item: any, index: number) => {
      const colorSet = CHART_COLORS[index % CHART_COLORS.length];
      return {
        label: item.label,
        data: item.data?.map((d: ChartDataPoint) => d.sales) || [],
        fill: true,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          return createGradient(ctx, colorSet.bg);
        },
        borderColor: colorSet.border,
        borderWidth: 3,
        pointRadius: radioSinCeros(4),
        pointHoverRadius: 6,
        pointBackgroundColor: colorSet.border,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: colorSet.border,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 3,
        tension: 0.4,
      };
    })
  } : {
    labels: etiquetas,
    datasets: [{
      label: mostrarAnterior ? `${nombreSerie} ${anioActual}` : nombreSerie,
      data: activeData?.map(d => d.sales) || [],
      fill: true,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const {ctx, chartArea} = chart;
        if (!chartArea) return null;
        return createGradient(ctx, activeColor.bg);
      },
      borderColor: activeColor.border,
      borderWidth: 3,
      pointRadius: radioSinCeros(6),
      pointHoverRadius: 8,
      pointBackgroundColor: activeColor.border,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: activeColor.border,
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 3,
      tension: 0.4,
    },
    ...(mostrarAnterior ? [{
      label: `${nombreSerie} ${anterior!.anio}`,
      data: etiquetas.map((_, i) => anteriorData![i]?.sales ?? null),
      fill: true,
      backgroundColor: (context: any) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return null;
        return createGradient(ctx, ANIO_ANTERIOR_COLOR.bg);
      },
      borderColor: ANIO_ANTERIOR_COLOR.border,
      borderWidth: 3,
      pointRadius: radioSinCeros(6),
      pointHoverRadius: 8,
      pointBackgroundColor: ANIO_ANTERIOR_COLOR.border,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointHoverBackgroundColor: ANIO_ANTERIOR_COLOR.border,
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 3,
      tension: 0.4,
    }] : [])]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      point: {
        radius: radioSinCeros(4),
        hoverRadius: 6,
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: isComparison || mostrarAnterior,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: activeColor.border,
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            if (context.parsed.y === null || context.parsed.y === undefined) return `${label}: —`;
            const value = formatCurrency(context.parsed.y);
            return `${label}: ${value}`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            // Las notas de crédito pueden dejar un día bajo cero: mismo formato con signo
            const signo = value < 0 ? '-' : '';
            const abs = Math.abs(value);
            if (abs >= 1000000) {
              return `${signo}$${(abs / 1000000).toFixed(1)}M`;
            } else if (abs >= 1000) {
              return `${signo}$${(abs / 1000).toFixed(0)}K`;
            }
            return `${signo}$${abs}`;
          },
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false,
        },
      },
      x: {
        ticks: {
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280',
          maxRotation: 45,
          minRotation: 0,
          // Abajo va solo el número, contado dentro del período que se está mirando
          // (pedido del usuario, sep-2026): el día del mes en la vista Diaria y la
          // semana del mes —1, 2, 3…— en la Semanal. El mes y el año ya están en el
          // selector de período de arriba, y con la fecha completa o con "Semana 36"
          // las etiquetas se pisaban entre sí. El tooltip sigue mostrando el texto
          // entero, y cualquier otra etiqueta pasa tal cual.
          callback: function (this: any, value: any, index: number) {
            const raw = this.getLabelForValue ? this.getLabelForValue(value) : value;
            const texto = String(raw ?? '');
            const fecha = texto.match(/^\d{4}-\d{2}-(\d{2})$/);
            if (fecha) return String(Number(fecha[1]));
            // "Semana 36" viene numerada dentro del año; acá se renumera por su
            // posición en el gráfico, que es su lugar dentro del período.
            if (/^Semana\s+\d+$/i.test(texto)) return String(index + 1);
            return texto;
          },
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900">
            {isComparison ? 'Comparación de Ventas' : isNvv ? 'Tendencia de NVV' : 'Tendencia de Ventas'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {isComparison 
              ? `Comparando ${comparisonPeriods?.length} períodos` 
              : isNvv ? 'Notas de venta ingresadas por día' : 'Evolución temporal de las ventas'
            }
          </p>
        </div>
        {/* En móvil los controles no caben en el ancho de la pantalla y "Mensual" quedaba
            cortado fuera del borde. Se convierten en una tira que se desliza en horizontal
            —el mismo patrón que usa el resto de la app para barras de 3+ botones—, con la
            barra de scroll oculta para que no corte el borde de la tarjeta. Los grupos van
            con `shrink-0` para que se deslicen enteros en vez de apretarse. */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Facturado / NVV toggle */}
          {!isComparison && (
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setDataSource('facturado')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  dataSource === 'facturado'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Facturado
              </button>
              <button
                onClick={() => setDataSource('nvv')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  dataSource === 'nvv'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                NVV
              </button>
            </div>
          )}
          {/* Period buttons */}
          {filterType !== 'day' && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant={period === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('daily')}
                className="text-xs"
                data-testid="button-chart-daily"
              >
                Diario
              </Button>
              <Button
                variant={period === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('weekly')}
                className="text-xs"
                data-testid="button-chart-weekly"
              >
                Semanal
              </Button>
              {/* Sin botón "Mensual" (decisión del usuario, ago-2026): no cabía en el
                  ancho del celular y quedaba cortado fuera del borde. La vista mensual
                  igual se sigue usando: cuando el período elegido arriba es un año
                  completo, el gráfico se pone en meses solo (ver getDefaultPeriod). */}
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200/60 p-3 sm:p-6 shadow-sm w-full">
        <div className="h-60 sm:h-80 w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className={`animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 ${isNvv ? 'border-amber-500' : 'border-green-500'}`}></div>
            </div>
          ) : (
            <Line data={chartConfig} options={options} />
          )}
        </div>
      </div>
    </div>
  );
}
