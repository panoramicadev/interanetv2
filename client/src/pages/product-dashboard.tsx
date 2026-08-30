import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useFilter } from "@/contexts/FilterContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Package, Palette, ShoppingBag, Users, TrendingUp,
  DollarSign, Search, BarChart3, Layers, Building2, UserCheck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import MargenResumenCard from "@/components/dashboard/margen-resumen-card";
import { esColorIncoloro, INCOLORO_FONDO, INCOLORO_BRILLO, INCOLORO_TITULO } from "@/lib/color-incoloro";

// Types
interface ProductFamily {
  family: string;
  productCount: number;
  totalSales: number;
}

interface ProductDashboardData {
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  uniqueProducts: number;
  uniqueClients: number;
  topColors: Array<{ color: string; totalSales: number; totalUnits: number; percentage: number }>;
  topFormats: Array<{ format: string; totalSales: number; totalUnits: number; percentage: number }>;
  topProducts: Array<{ productName: string; totalSales: number; totalUnits: number; transactionCount: number }>;
  segmentBreakdown: Array<{ segment: string; totalSales: number; totalUnits: number; clientCount: number; percentage: number }>;
  topClients: Array<{ clientName: string; totalSales: number; totalUnits: number; transactionCount: number }>;
  topSalespeople: Array<{ salespersonName: string; totalSales: number; totalUnits: number; clientCount: number }>;
  salesTrend: Array<{ period: string; sales: number; units: number }>;
}

// Utilities
const fmtCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const fmtNumber = (num: number) => new Intl.NumberFormat('es-CL').format(Math.round(num));

const COLOR_MAP: Record<string, string> = {
  'Blanco': '#F3F4F6', 'Negro': '#1F2937', 'Rojo': '#DC2626',
  'Azul': '#2563EB', 'Azul Pacífico': '#0891B2', 'Verde': '#16A34A',
  'Amarillo': '#EAB308', 'Gris': '#6B7280', 'Café': '#92400E',
  'Rosa': '#EC4899', 'Naranja': '#EA580C', 'Violeta': '#7C3AED',
  'Incoloro': '#E5E7EB', 'Beige': '#D4A574', 'Crema': '#FFF8DC',
  'Marfil': '#FFFFF0', 'Celeste': '#7DD3FC', 'Sin especificar': '#9CA3AF',
};

const FORMAT_ICONS: Record<string, string> = {
  'Galón': '🪣', '4 Galones': '🪣', '1/4 Galón': '🥤',
  'Balde': '🪣', 'Tineta': '🫙', 'Kilo': '⚖️',
  'Litro': '🧴', 'Onza': '💧', 'Metro': '📏', 'Otro': '📦',
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function buildPeriodParams(selection: any): { period: string; filterType: string } {
  const { years, period, months, days, startDate, endDate } = selection;
  const year = years?.[0] || new Date().getFullYear();

  switch (period) {
    case 'full-year':
      return { period: String(year), filterType: 'year' };
    case 'month':
      const month = months?.[0] || (new Date().getMonth() + 1);
      return { period: `${year}-${String(month).padStart(2, '0')}`, filterType: 'month' };
    case 'day':
      const day = days?.[0] || new Date().getDate();
      const m = months?.[0] || (new Date().getMonth() + 1);
      return { period: `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`, filterType: 'day' };
    case 'custom-range':
      if (startDate && endDate) {
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        return { period: `${fmt(new Date(startDate))}_${fmt(new Date(endDate))}`, filterType: 'range' };
      }
      return { period: `${year}-${String(months?.[0] || 1).padStart(2, '0')}`, filterType: 'month' };
    default:
      return { period: `${year}-${String(months?.[0] || (new Date().getMonth() + 1)).padStart(2, '0')}`, filterType: 'month' };
  }
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-2xl px-4 py-3 text-sm">
      <p className="font-bold text-gray-900 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-600">
          <span className="font-semibold" style={{ color: p.color }}>{p.name}: </span>
          {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ProductDashboard() {
  const [, setLocation] = useLocation();
  const { selection } = useFilter();
  const isMobile = useIsMobile();

  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [familySearch, setFamilySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const { period, filterType } = useMemo(() => buildPeriodParams(selection), [selection]);

  // Fetch families
  const { data: families = [] } = useQuery<ProductFamily[]>({
    queryKey: [`/api/sales/product-families?period=${period}&filterType=${filterType}`],
  });

  // Filtered families for search
  const filteredFamilies = useMemo(() => {
    if (!familySearch) return families;
    return families.filter(f => f.family.toLowerCase().includes(familySearch.toLowerCase()));
  }, [families, familySearch]);

  // Fetch dashboard data
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('period', period);
    params.append('filterType', filterType);
    if (selectedFamily) params.append('family', selectedFamily);
    return params.toString();
  }, [period, filterType, selectedFamily]);

  const { data: dashboardData, isLoading } = useQuery<ProductDashboardData>({
    queryKey: [`/api/sales/product-dashboard?${queryParams}`],
  });

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!dashboardData?.topProducts) return [];
    if (!productSearch) return dashboardData.topProducts;
    return dashboardData.topProducts.filter(p =>
      p.productName.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [dashboardData?.topProducts, productSearch]);

  // Trend data with month labels
  const trendData = useMemo(() => {
    if (!dashboardData?.salesTrend) return [];
    return dashboardData.salesTrend.map(t => {
      const parts = t.period.split('-');
      const label = parts.length === 2 ? `${MONTH_NAMES[parts[1]] || parts[1]} ${parts[0].slice(2)}` : t.period;
      return { ...t, label };
    });
  }, [dashboardData?.salesTrend]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 py-5 m-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard de Productos</h1>
                <p className="text-xs sm:text-sm text-gray-500">Análisis por agrupación comercial</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Family selector */}
          <div className="flex-1 min-w-0">
            <Select value={selectedFamily || "all"} onValueChange={(v) => setSelectedFamily(v === "all" ? "" : v)}>
              <SelectTrigger className="h-11 w-full rounded-xl border-gray-200 bg-white shadow-sm" data-testid="select-family">
                <div className="flex items-center gap-2 truncate">
                  <Layers className="h-4 w-4 text-teal-600 shrink-0" />
                  <SelectValue placeholder="Todas las agrupaciones" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 max-h-80">
                <div className="px-3 py-2 border-b">
                  <Input
                    placeholder="Buscar agrupación..."
                    value={familySearch}
                    onChange={(e) => setFamilySearch(e.target.value)}
                    className="h-8 text-sm"
                    data-testid="input-family-search"
                  />
                </div>
                <SelectItem value="all">
                  <span className="font-medium">Todas las agrupaciones</span>
                </SelectItem>
                {filteredFamilies.map(f => (
                  <SelectItem key={f.family} value={f.family}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="truncate">{f.family}</span>
                      <span className="text-xs text-gray-400 shrink-0">{f.productCount} prod.</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <span className="font-medium">Período:</span>
            <span className="font-bold text-gray-700">{selection.display}</span>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 animate-pulse shadow-sm">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(j => <div key={j} className="h-20 bg-gray-100 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : dashboardData ? (
        <div className="px-4 space-y-4 pb-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Ventas Totales', value: fmtCurrency(dashboardData.totalSales), icon: DollarSign, color: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-500/20' },
              { label: 'Unidades', value: fmtNumber(dashboardData.totalUnits), icon: Package, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
              { label: 'Productos', value: fmtNumber(dashboardData.uniqueProducts), icon: ShoppingBag, color: 'from-purple-500 to-violet-600', shadow: 'shadow-purple-500/20' },
              { label: 'Clientes', value: fmtNumber(dashboardData.uniqueClients), icon: Users, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
              { label: 'Transacciones', value: fmtNumber(dashboardData.transactionCount), icon: TrendingUp, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all" data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 bg-gradient-to-br ${kpi.color} rounded-lg flex items-center justify-center shadow-lg ${kpi.shadow}`}>
                    <kpi.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Margen de la agrupación seleccionada, mismo período y mismo filtro */}
          <MargenResumenCard
            selectedPeriod={period}
            filterType={filterType as "day" | "month" | "year" | "range"}
            family={selectedFamily || undefined}
          />

          {/* Colors & Formats Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Colors */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Palette className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Colores Más Vendidos</h2>
                  <p className="text-xs text-gray-500">{dashboardData.topColors.length} colores</p>
                </div>
              </div>
              {dashboardData.topColors.length > 0 ? (
                <div className="space-y-2.5">
                  {dashboardData.topColors.slice(0, 8).map((c, i) => (
                    <div key={c.color} className="flex items-center gap-3">
                      {/* Los incoloros van como vidrio, no como color plano: no tienen color */}
                      {esColorIncoloro(c.color) ? (
                        <div
                          className="relative overflow-hidden w-5 h-5 rounded-full border-2 border-gray-200 shrink-0"
                          style={INCOLORO_FONDO}
                          title={INCOLORO_TITULO}
                        >
                          <span className="pointer-events-none absolute inset-0 rounded-full" style={INCOLORO_BRILLO} />
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0"
                          style={{ backgroundColor: COLOR_MAP[c.color] || '#9CA3AF' }}
                        />
                      )}
                      <span className="text-sm font-medium text-gray-700 w-28 truncate">{c.color}</span>
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(c.percentage, 100)}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium shrink-0">{c.percentage.toFixed(1)}%</Badge>
                      <span className="text-xs font-bold text-green-700 w-24 text-right shrink-0">{fmtCurrency(c.totalSales)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Palette className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sin datos de colores</p>
                </div>
              )}
            </div>

            {/* Formats */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Package className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Formatos Más Vendidos</h2>
                  <p className="text-xs text-gray-500">{dashboardData.topFormats.length} formatos</p>
                </div>
              </div>
              {dashboardData.topFormats.length > 0 ? (
                <div className="space-y-2.5">
                  {dashboardData.topFormats.map((f, i) => (
                    <div key={f.format} className="flex items-center gap-3">
                      <span className="text-lg shrink-0">{FORMAT_ICONS[f.format] || '📦'}</span>
                      <span className="text-sm font-medium text-gray-700 w-28 truncate">{f.format}</span>
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(f.percentage, 100)}%`,
                              backgroundColor: CHART_COLORS[(i + 3) % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium shrink-0">{f.percentage.toFixed(1)}%</Badge>
                      <span className="text-xs font-bold text-green-700 w-24 text-right shrink-0">{fmtCurrency(f.totalSales)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sin datos de formatos</p>
                </div>
              )}
            </div>
          </div>

          {/* Segments Breakdown */}
          {dashboardData.segmentBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Building2 className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Segmentos Compradores</h2>
                  <p className="text-xs text-gray-500">¿Quién compra más {selectedFamily ? `"${selectedFamily}"` : 'estos productos'}?</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboardData.segmentBreakdown.map((s, i) => (
                  <div
                    key={s.segment}
                    className={`border rounded-xl p-4 transition-all hover:shadow-md ${i === 0 ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{s.segment}</span>
                      <Badge variant="secondary" className="text-xs font-medium shrink-0">
                        {s.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Ventas</span>
                        <span className="font-bold text-green-700">{fmtCurrency(s.totalSales)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Unidades</span>
                        <span className="font-semibold text-blue-700">{fmtNumber(s.totalUnits)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Clientes</span>
                        <span className="text-gray-700">{s.clientCount}</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(s.percentage, 100)}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales Trend */}
          {trendData.length > 1 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <TrendingUp className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Tendencia de Ventas</h2>
                  <p className="text-xs text-gray-500">{trendData.length} períodos</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Ventas"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Clients & Salespeople */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Clients */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <Users className="w-4.5 h-4.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Top Clientes</h2>
              </div>
              {dashboardData.topClients.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.topClients.slice(0, 10).map((c, i) => (
                    <div key={c.clientName} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-700 flex-1 truncate">{c.clientName}</span>
                      <span className="text-xs font-bold text-green-700 shrink-0">{fmtCurrency(c.totalSales)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>
              )}
            </div>

            {/* Top Salespeople */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <UserCheck className="w-4.5 h-4.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Top Vendedores</h2>
              </div>
              {dashboardData.topSalespeople.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.topSalespeople.slice(0, 10).map((s, i) => (
                    <div key={s.salespersonName} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700 block truncate">{s.salespersonName}</span>
                        <span className="text-xs text-gray-400">{s.clientCount} clientes</span>
                      </div>
                      <span className="text-xs font-bold text-green-700 shrink-0">{fmtCurrency(s.totalSales)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <ShoppingBag className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Productos</h2>
                  <p className="text-xs text-gray-500">{filteredProducts.length} de {dashboardData.topProducts.length} productos</p>
                </div>
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 h-9 text-sm rounded-lg"
                  data-testid="input-product-search"
                />
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">#</TableHead>
                      <TableHead className="text-left">Producto</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Txns</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.slice(0, 30).map((p, i) => (
                      <TableRow key={p.productName}>
                        <TableCell className="text-gray-400 text-xs font-bold">{i + 1}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[300px] truncate">{p.productName}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-green-700">{fmtCurrency(p.totalSales)}</TableCell>
                        <TableCell className="text-right text-sm">{fmtNumber(p.totalUnits)}</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">{fmtNumber(p.transactionCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredProducts.length > 30 && (
                  <p className="text-center text-xs text-gray-400 mt-3">
                    Mostrando 30 de {filteredProducts.length} productos
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No se encontraron productos</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Selecciona una agrupación comercial</p>
          <p className="text-sm">para ver las métricas de productos</p>
        </div>
      )}
    </div>
  );
}
