import { useQuery } from "@tanstack/react-query";
import { Package, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductGroupBreakdownProps {
  productName: string;
  selectedPeriod: string;
  filterType: string;
}

interface GroupBreakdownData {
  groupName: string;
  totalSales: number;
  totalUnits: number;
  transactionCount: number;
  uniqueClients: number;
  topClient: string | null;
  topSalesperson: string | null;
  variants: Array<{
    fullName: string;
    format: string;
    color: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
  }>;
  formatBreakdown: Array<{
    format: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    percentage: number;
  }>;
  colorBreakdown: Array<{
    color: string;
    totalSales: number;
    totalUnits: number;
    transactionCount: number;
    percentage: number;
  }>;
}

interface ProductGroup {
  id: string;
  nombre: string;
  variationCount: number;
  variations: Array<{ producto: string }>;
}

const fmtCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const fmtNumber = (num: number) => new Intl.NumberFormat('es-CL').format(num);

const getFormatIcon = (f: string) => {
  if (f.includes('Galón') || f.includes('Galones')) return '🪣';
  if (f.includes('Balde')) return '🪣';
  if (f.includes('Tineta')) return '🫙';
  if (f.includes('1/4')) return '🥤';
  if (f.includes('Litro')) return '🧴';
  if (f.includes('Kilo')) return '⚖️';
  return '📦';
};

const getColorDot = (color: string) => {
  const map: Record<string, string> = {
    'Blanco': '#FFFFFF', 'Negro': '#1a1a1a', 'Rojo': '#DC2626',
    'Azul': '#2563EB', 'Azul Pacífico': '#0891B2', 'Verde': '#16A34A',
    'Amarillo': '#EAB308', 'Gris': '#6B7280', 'Café': '#92400E',
    'Rosa': '#EC4899', 'Naranja': '#EA580C', 'Violeta': '#7C3AED',
    'Incoloro': '#E5E7EB', 'Beige': '#D4A574', 'Crema': '#FFF8DC',
    'Marfil': '#FFFFF0', 'Celeste': '#7DD3FC',
  };
  const hex = map[color] || '#9CA3AF';
  return (
    <div
      className="w-4 h-4 rounded-full border border-gray-300 shrink-0"
      style={{ backgroundColor: hex }}
    />
  );
};

export default function ProductGroupBreakdown({ productName, selectedPeriod, filterType }: ProductGroupBreakdownProps) {
  // 1. Find matching product group by name
  const { data: groups } = useQuery<ProductGroup[]>({
    queryKey: ["/api/ecommerce/admin/grupos", { withVariations: true }],
    queryFn: async () => {
      const res = await fetch("/api/ecommerce/admin/grupos?withVariations=true", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Find group that matches the product name
  const matchingGroup = groups?.find(g =>
    g.nombre.toUpperCase() === productName.toUpperCase() ||
    productName.toUpperCase().includes(g.nombre.toUpperCase()) ||
    g.nombre.toUpperCase().includes(productName.toUpperCase())
  );

  // 2. Fetch breakdown if group found
  const { data, isLoading } = useQuery<GroupBreakdownData>({
    queryKey: ["/api/sales/product-group", matchingGroup?.id, "breakdown", selectedPeriod, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', selectedPeriod);
      params.append('filterType', filterType);
      const res = await fetch(`/api/sales/product-group/${matchingGroup!.id}/breakdown?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch product group breakdown');
      return res.json();
    },
    enabled: !!matchingGroup?.id,
  });

  // Also try to get parent product variants as fallback (from the sales data directly)
  const { data: parentData, isLoading: isLoadingParent } = useQuery<GroupBreakdownData>({
    queryKey: [`/api/sales/product-parent/${productName}/variants`, selectedPeriod, filterType],
    queryFn: async () => {
      const res = await fetch(
        `/api/sales/product-parent/${encodeURIComponent(productName)}/variants?period=${selectedPeriod}&filterType=${filterType}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    enabled: !matchingGroup, // Only fetch if no ecommerce group matches
  });

  const breakdownData = data || parentData;
  const loading = matchingGroup ? isLoading : isLoadingParent;

  if (loading) {
    return (
      <div className="modern-card p-4 lg:p-6 hover-lift">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!breakdownData || (breakdownData.formatBreakdown.length === 0 && breakdownData.colorBreakdown.length === 0)) {
    return null; // Don't render if no data
  }

  return (
    <div className="modern-card p-4 lg:p-6 hover-lift">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
          <Layers className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Desglose de Producto
          </h2>
          <p className="text-sm text-gray-500">
            Formatos y colores vendidos • {breakdownData.variants.length} variante{breakdownData.variants.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Tabs defaultValue="envases" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="envases" className="text-sm">
            📦 Envases
            {breakdownData.formatBreakdown.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{breakdownData.formatBreakdown.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="colores" className="text-sm">
            🎨 Colores
            {breakdownData.colorBreakdown.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{breakdownData.colorBreakdown.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="variantes" className="text-sm">
            📋 Todas
            {breakdownData.variants.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-5">{breakdownData.variants.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Envases Tab */}
        <TabsContent value="envases" className="mt-4">
          {breakdownData.formatBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {breakdownData.formatBreakdown.map((f, i) => (
                <div key={f.format} className={`border rounded-xl p-4 ${i === 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getFormatIcon(f.format)}</span>
                      <span className="font-semibold text-sm text-gray-900">{f.format}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-medium">
                      {f.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Ventas</span>
                      <span className="font-bold text-green-700">{fmtCurrency(f.totalSales)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Unidades</span>
                      <span className="font-semibold text-blue-700">{fmtNumber(f.totalUnits)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Transacciones</span>
                      <span className="text-gray-700">{fmtNumber(f.transactionCount)}</span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(f.percentage, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay datos de formatos para este período</p>
            </div>
          )}
        </TabsContent>

        {/* Colores Tab */}
        <TabsContent value="colores" className="mt-4">
          {breakdownData.colorBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {breakdownData.colorBreakdown.map((c, i) => (
                <div key={c.color} className={`border rounded-xl p-4 ${i === 0 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getColorDot(c.color)}
                      <span className="font-semibold text-sm text-gray-900">{c.color}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-medium">
                      {c.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Ventas</span>
                      <span className="font-bold text-green-700">{fmtCurrency(c.totalSales)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Unidades</span>
                      <span className="font-semibold text-blue-700">{fmtNumber(c.totalUnits)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Transacciones</span>
                      <span className="text-gray-700">{fmtNumber(c.transactionCount)}</span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(c.percentage, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay datos de colores para este período</p>
            </div>
          )}
        </TabsContent>

        {/* Todas las Variantes Tab */}
        <TabsContent value="variantes" className="mt-4">
          {breakdownData.variants.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Variante</TableHead>
                    <TableHead className="text-left">Envase</TableHead>
                    <TableHead className="text-left">Color</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Txns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdownData.variants.map((v, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{v.fullName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{getFormatIcon(v.format)}</span>
                          <span className="text-sm">{v.format}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getColorDot(v.color)}
                          <span className="text-sm">{v.color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-700 text-sm">
                        {fmtCurrency(v.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtNumber(v.totalUnits)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtNumber(v.transactionCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hay variantes para este período</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
