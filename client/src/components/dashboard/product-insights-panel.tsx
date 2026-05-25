import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Package, Palette, Users, UserCheck, TrendingUp, DollarSign, ShoppingBag,
  Layers, ArrowUp, ArrowDown, ChevronDown, Grid3x3, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ProductInsights {
  productName: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  uniqueClients: number;
  variantCount: number;
  topClient: string | null;
  topSalesperson: string | null;
  variants: Array<{ fullName: string; format: string; color: string; totalSales: number; totalUnits: number; transactionCount: number }>;
  formatBreakdown: Array<{ format: string; totalSales: number; totalUnits: number; transactionCount: number; percentage: number }>;
  colorBreakdown: Array<{ color: string; totalSales: number; totalUnits: number; transactionCount: number; percentage: number }>;
  colorFormatMatrix: Array<{ color: string; format: string; totalSales: number; totalUnits: number; transactionCount: number }>;
  topClients: Array<{ clientName: string; totalSales: number; totalUnits: number; transactionCount: number }>;
  salespeople: Array<{ salespersonName: string; totalSales: number; totalUnits: number; clientCount: number }>;
  salespeopleNotSelling: Array<{ salespersonName: string; totalSales: number }>;
  monthlyTrend: Array<{ period: string; sales: number; units: number }>;
}

interface Props {
  productName: string;
  selectedPeriod: string;
  filterType: string;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtNumber = (n: number) => new Intl.NumberFormat("es-CL").format(Math.round(n || 0));

const COLOR_MAP: Record<string, string> = {
  Blanco: "#F3F4F6", Negro: "#1F2937", Rojo: "#DC2626", Azul: "#2563EB", "Azul Pacífico": "#0891B2",
  Verde: "#16A34A", Amarillo: "#EAB308", Gris: "#6B7280", Café: "#92400E", Rosa: "#EC4899",
  Naranja: "#EA580C", Violeta: "#7C3AED", Incoloro: "#E5E7EB", Beige: "#D4A574", Crema: "#FFF8DC",
  Marfil: "#FFFFF0", Celeste: "#7DD3FC", "Sin especificar": "#9CA3AF",
};
const FORMAT_ICONS: Record<string, string> = {
  Galón: "🪣", "4 Galones": "🪣", "1/4 Galón": "🥤", Balde: "🪣", Tineta: "🫙",
  Kilo: "⚖️", Litro: "🧴", Onza: "💧", Metro: "📏", Otro: "📦",
};
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthLabel = (period: string) => {
  const [y, m] = period.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS[idx] || m} ${y?.slice(2) || ""}`;
};

function SectionCard({ icon, gradient, shadow, title, subtitle, children, right }: {
  icon: React.ReactNode; gradient: string; shadow: string; title: string; subtitle?: string;
  children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="modern-card p-4 lg:p-5 hover-lift">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br", gradient, shadow)}>
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function ProductInsightsPanel({ productName, selectedPeriod, filterType }: Props) {
  const [matrixMetric, setMatrixMetric] = useState<"sales" | "units">("sales");
  const [showVariants, setShowVariants] = useState(false);
  const [showNotSelling, setShowNotSelling] = useState(false);

  const { data, isLoading } = useQuery<ProductInsights>({
    queryKey: ["/api/sales/product-insights", productName, selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams({ product: productName, period: selectedPeriod, filterType });
      const res = await fetch(`/api/sales/product-insights?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!productName,
  });

  const trend = useMemo(() => (data?.monthlyTrend || []).map((t) => ({ ...t, label: monthLabel(t.period) })), [data]);
  const peak = useMemo(() => {
    const withSales = trend.filter((t) => t.sales > 0);
    if (!withSales.length) return null;
    return withSales.reduce((a, b) => (b.sales > a.sales ? b : a));
  }, [trend]);
  const low = useMemo(() => {
    const withSales = trend.filter((t) => t.sales > 0);
    if (withSales.length < 2) return null;
    return withSales.reduce((a, b) => (b.sales < a.sales ? b : a));
  }, [trend]);

  // Matrix axes
  const matrixColors = useMemo(() => (data?.colorBreakdown || []).map((c) => c.color), [data]);
  const matrixFormats = useMemo(() => (data?.formatBreakdown || []).map((f) => f.format), [data]);
  const matrixLookup = useMemo(() => {
    const m = new Map<string, { totalSales: number; totalUnits: number }>();
    (data?.colorFormatMatrix || []).forEach((e) => m.set(`${e.color}|||${e.format}`, e));
    return m;
  }, [data]);

  if (isLoading) {
    return (
      <div className="modern-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-56" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || (data.totalSales === 0 && data.transactionCount === 0)) {
    return (
      <div className="modern-card p-10 text-center text-gray-400">
        <Package className="w-14 h-14 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium text-gray-600">{productName}</p>
        <p className="text-sm">Sin ventas registradas para este producto en el período seleccionado.</p>
      </div>
    );
  }

  const sellers = data.salespeople;
  const kpis = [
    { label: "Ventas", value: fmtCurrency(data.totalSales), icon: DollarSign, g: "from-emerald-500 to-green-600", s: "shadow-emerald-500/20" },
    { label: "Unidades", value: fmtNumber(data.totalUnits), icon: Package, g: "from-blue-500 to-indigo-600", s: "shadow-blue-500/20" },
    { label: "Transacciones", value: fmtNumber(data.transactionCount), icon: TrendingUp, g: "from-rose-500 to-pink-600", s: "shadow-rose-500/20" },
    { label: "Clientes", value: fmtNumber(data.uniqueClients), icon: Users, g: "from-amber-500 to-orange-600", s: "shadow-amber-500/20" },
    { label: "Variantes", value: fmtNumber(data.variantCount), icon: Layers, g: "from-purple-500 to-violet-600", s: "shadow-purple-500/20" },
  ];

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">{data.productName}</h1>
          <p className="text-xs sm:text-sm text-gray-500">Análisis comercial del producto · {data.variantCount} variantes vendidas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100" data-testid={`product-kpi-${k.label.toLowerCase()}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg bg-gradient-to-br", k.g, k.s)}>
                <k.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Seasonality */}
      <SectionCard
        icon={<TrendingUp className="w-4.5 h-4.5 text-white" />} gradient="from-blue-500 to-indigo-600" shadow="shadow-blue-500/20"
        title="Estacionalidad" subtitle="Ventas mensuales (últimos 12 meses) · cuándo se vende más y cuándo menos"
        right={
          <div className="hidden sm:flex items-center gap-2">
            {peak && <Badge className="bg-green-100 text-green-700 border-green-200"><ArrowUp className="h-3 w-3 mr-1" />Peak: {peak.label} · {fmtCurrency(peak.sales)}</Badge>}
            {low && <Badge className="bg-amber-100 text-amber-700 border-amber-200"><ArrowDown className="h-3 w-3 mr-1" />Bajo: {low.label} · {fmtCurrency(low.sales)}</Badge>}
          </div>
        }
      >
        {trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, name: string) => [name === "sales" ? fmtCurrency(v) : fmtNumber(v), name === "sales" ? "Ventas" : "Unidades"]}
                labelStyle={{ fontWeight: 700 }}
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
              />
              <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                {trend.map((t) => (
                  <Cell
                    key={t.period}
                    fill={peak && t.period === peak.period ? "#16A34A" : low && t.period === low.period ? "#F59E0B" : "#93C5FD"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-gray-400 py-8">Sin datos de tendencia</p>
        )}
      </SectionCard>

      {/* Colors + Formats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<Palette className="w-4.5 h-4.5 text-white" />} gradient="from-purple-500 to-violet-600" shadow="shadow-purple-500/20"
          title="Colores" subtitle={`${data.colorBreakdown.length} colores vendidos`}>
          {data.colorBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {data.colorBreakdown.slice(0, 10).map((c) => (
                <div key={c.color} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" style={{ backgroundColor: COLOR_MAP[c.color] || "#9CA3AF" }} />
                  <span className="text-sm font-medium text-gray-700 w-28 truncate">{c.color}</span>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.min(c.percentage, 100)}%` }} />
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{c.percentage.toFixed(1)}%</Badge>
                  <span className="text-xs font-bold text-green-700 w-24 text-right shrink-0">{fmtCurrency(c.totalSales)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>}
        </SectionCard>

        <SectionCard icon={<Package className="w-4.5 h-4.5 text-white" />} gradient="from-green-500 to-emerald-600" shadow="shadow-green-500/20"
          title="Formatos" subtitle={`${data.formatBreakdown.length} formatos vendidos`}>
          {data.formatBreakdown.length > 0 ? (
            <div className="space-y-2.5">
              {data.formatBreakdown.map((f) => (
                <div key={f.format} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{FORMAT_ICONS[f.format] || "📦"}</span>
                  <span className="text-sm font-medium text-gray-700 w-28 truncate">{f.format}</span>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(f.percentage, 100)}%` }} />
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{f.percentage.toFixed(1)}%</Badge>
                  <span className="text-xs font-bold text-green-700 w-24 text-right shrink-0">{fmtCurrency(f.totalSales)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>}
        </SectionCard>
      </div>

      {/* Color × Format matrix */}
      {matrixColors.length > 0 && matrixFormats.length > 0 && (
        <SectionCard icon={<Grid3x3 className="w-4.5 h-4.5 text-white" />} gradient="from-cyan-500 to-teal-600" shadow="shadow-cyan-500/20"
          title="Matriz Color × Formato" subtitle="Detalle cruzado por color y formato"
          right={
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setMatrixMetric("sales")} className={cn("px-3 py-1.5 font-medium", matrixMetric === "sales" ? "bg-teal-500 text-white" : "bg-white text-gray-600")} data-testid="matrix-metric-sales">Ventas</button>
              <button onClick={() => setMatrixMetric("units")} className={cn("px-3 py-1.5 font-medium", matrixMetric === "units" ? "bg-teal-500 text-white" : "bg-white text-gray-600")} data-testid="matrix-metric-units">Unidades</button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left sticky left-0 bg-white">Color</TableHead>
                  {matrixFormats.map((f) => (
                    <TableHead key={f} className="text-right whitespace-nowrap">
                      <span className="mr-1">{FORMAT_ICONS[f] || "📦"}</span>{f}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrixColors.map((color) => (
                  <TableRow key={color}>
                    <TableCell className="font-medium text-sm sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: COLOR_MAP[color] || "#9CA3AF" }} />
                        {color}
                      </div>
                    </TableCell>
                    {matrixFormats.map((f) => {
                      const cell = matrixLookup.get(`${color}|||${f}`);
                      const val = cell ? (matrixMetric === "sales" ? cell.totalSales : cell.totalUnits) : 0;
                      return (
                        <TableCell key={f} className={cn("text-right text-sm tabular-nums", val > 0 ? "text-gray-800" : "text-gray-300")}>
                          {val > 0 ? (matrixMetric === "sales" ? fmtCurrency(val) : fmtNumber(val)) : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}

      {/* Clients + Salespeople */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard icon={<Users className="w-4.5 h-4.5 text-white" />} gradient="from-cyan-500 to-teal-600" shadow="shadow-cyan-500/20"
          title="Clientes que más lo compran" subtitle={`Top ${Math.min(data.topClients.length, 10)} clientes`}>
          {data.topClients.length > 0 ? (
            <div className="space-y-1">
              {data.topClients.slice(0, 10).map((c, i) => (
                <div key={c.clientName} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className={cn("text-xs font-bold w-5 text-right shrink-0", i === 0 ? "text-amber-500" : "text-gray-400")}>{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{c.clientName}</span>
                  <span className="text-xs text-gray-400 shrink-0">{fmtNumber(c.totalUnits)} u.</span>
                  <span className="text-xs font-bold text-green-700 shrink-0 w-24 text-right">{fmtCurrency(c.totalSales)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>}
        </SectionCard>

        <SectionCard icon={<UserCheck className="w-4.5 h-4.5 text-white" />} gradient="from-indigo-500 to-blue-600" shadow="shadow-indigo-500/20"
          title="Vendedores" subtitle={`${sellers.length} venden este producto`}>
          {sellers.length > 0 ? (
            <div className="space-y-1">
              {sellers.map((s, i) => {
                const isTop = i === 0 && sellers.length > 1;
                const isBottom = i === sellers.length - 1 && sellers.length > 1;
                return (
                  <div key={s.salespersonName} className={cn("flex items-center gap-3 py-1.5 px-2 rounded-lg border-b border-gray-50 last:border-0",
                    isTop && "bg-green-50/60", isBottom && "bg-amber-50/60")}>
                    <span className="text-xs font-bold text-gray-400 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 block truncate">{s.salespersonName}</span>
                      <span className="text-xs text-gray-400">{s.clientCount} clientes · {fmtNumber(s.totalUnits)} u.</span>
                    </div>
                    {isTop && <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0"><ArrowUp className="h-3 w-3 mr-0.5" />Más</Badge>}
                    {isBottom && <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0"><ArrowDown className="h-3 w-3 mr-0.5" />Menos</Badge>}
                    <span className="text-xs font-bold text-green-700 shrink-0 w-24 text-right">{fmtCurrency(s.totalSales)}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-center text-sm text-gray-400 py-6">Sin datos</p>}

          {/* Salespeople NOT selling */}
          {data.salespeopleNotSelling.length > 0 && (
            <Collapsible open={showNotSelling} onOpenChange={setShowNotSelling} className="mt-3 border-t border-gray-100 pt-3">
              <CollapsibleTrigger className="w-full flex items-center justify-between text-sm text-gray-600 hover:text-gray-900" data-testid="toggle-not-selling">
                <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" />No lo venden ({data.salespeopleNotSelling.length}) · oportunidad</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", showNotSelling && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="flex flex-wrap gap-1.5">
                  {data.salespeopleNotSelling.map((s) => (
                    <Badge key={s.salespersonName} variant="outline" className="text-xs font-normal text-gray-600" title={`Ventas totales del período: ${fmtCurrency(s.totalSales)}`}>
                      {s.salespersonName}
                    </Badge>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </SectionCard>
      </div>

      {/* All variants (collapsible) */}
      <div className="modern-card p-4 lg:p-5">
        <Collapsible open={showVariants} onOpenChange={setShowVariants}>
          <CollapsibleTrigger className="w-full flex items-center justify-between" data-testid="toggle-variants">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                <Layers className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-base font-bold text-gray-900">Todas las variantes</h2>
                <p className="text-xs text-gray-500">{data.variants.length} variantes por color y formato</p>
              </div>
            </div>
            <ChevronDown className={cn("h-5 w-5 text-gray-500 transition-transform", showVariants && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Variante</TableHead>
                    <TableHead className="text-left">Formato</TableHead>
                    <TableHead className="text-left">Color</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Txns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.variants.map((v, idx) => (
                    <TableRow key={`${v.fullName}-${idx}`}>
                      <TableCell className="font-medium text-sm max-w-[260px] truncate">{v.fullName}</TableCell>
                      <TableCell><span className="text-sm">{FORMAT_ICONS[v.format] || "📦"} {v.format}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: COLOR_MAP[v.color] || "#9CA3AF" }} />
                          <span className="text-sm">{v.color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700 text-sm">{fmtCurrency(v.totalSales)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtNumber(v.totalUnits)}</TableCell>
                      <TableCell className="text-right text-sm text-gray-500">{fmtNumber(v.transactionCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
