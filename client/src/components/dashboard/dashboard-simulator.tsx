import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Users, Package, DollarSign } from "lucide-react";

interface DashboardSimulatorProps {
  view: "all" | "goals-only" | "by-segment" | "by-salesperson";
  period: string | null;
  filterType: string;
  selectedEntity: string | null;
  years?: number[];
}

export function DashboardSimulator({ view, period, filterType, selectedEntity, years }: DashboardSimulatorProps) {
  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/sales/metrics', period, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      const res = await fetch(`/api/sales/metrics?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return await res.json();
    },
    enabled: !!period,
  });

  // Fetch segments
  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ['/api/sales/segments', period, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segments?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch segments');
      return await res.json();
    },
    enabled: !!period && view === "all",
  });

  // Fetch segment salespeople (for by-segment view)
  const { data: segmentSalespeople } = useQuery({
    queryKey: ['/api/sales/segment', selectedEntity, 'salespeople', period, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segment/${selectedEntity}/salespeople?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    },
    enabled: view === "by-segment" && !!selectedEntity && !!period,
  });

  // Fetch segment clients
  const { data: segmentClients } = useQuery({
    queryKey: ['/api/sales/segment', selectedEntity, 'clients', period, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      const res = await fetch(`/api/sales/segment/${selectedEntity}/clients?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    },
    enabled: view === "by-segment" && !!selectedEntity && !!period,
  });

  // Fetch salesperson clients
  const { data: salespersonClients } = useQuery({
    queryKey: ['/api/sales/salesperson', selectedEntity, 'clients', period, filterType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      const res = await fetch(`/api/sales/salesperson/${selectedEntity}/clients?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    },
    enabled: view === "by-salesperson" && !!selectedEntity && !!period,
  });

  // Fetch top products for salesperson
  const { data: salespersonProducts } = useQuery({
    queryKey: ['/api/sales/top-products', period, filterType, selectedEntity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (filterType) params.append('filterType', filterType);
      if (selectedEntity) params.append('salesperson', selectedEntity);
      params.append('limit', '5');
      const res = await fetch(`/api/sales/top-products?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    },
    enabled: view === "by-salesperson" && !!selectedEntity && !!period,
  });

  // Fetch goals progress
  const { data: goalsProgress } = useQuery({
    queryKey: ['/api/goals/progress', period],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.append('selectedPeriod', period);
      const res = await fetch(`/api/goals/progress?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch');
      return await res.json();
    },
    enabled: view === "goals-only" && !!period,
  });

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

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-600";
  };

  if (!period) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-sm">Selecciona un período para ver los datos del dashboard</p>
      </div>
    );
  }

  if (metricsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1">VENTAS TOTALES</div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(metrics?.totalSales || 0)}
              </div>
              {metrics?.previousMonthSales !== undefined && (
                <div className={`text-[10px] mt-1 flex items-center gap-1 ${getChangeColor(
                  ((metrics.totalSales - metrics.previousMonthSales) / metrics.previousMonthSales) * 100
                )}`}>
                  {metrics.totalSales > metrics.previousMonthSales ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(((metrics.totalSales - metrics.previousMonthSales) / metrics.previousMonthSales) * 100).toFixed(1)}% vs anterior
                </div>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-blue-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1">UNIDADES VENDIDAS</div>
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(metrics?.totalUnits || 0)}
              </div>
              {metrics?.previousMonthUnits !== undefined && (
                <div className={`text-[10px] mt-1 flex items-center gap-1 ${getChangeColor(
                  ((metrics.totalUnits - metrics.previousMonthUnits) / metrics.previousMonthUnits) * 100
                )}`}>
                  {metrics.totalUnits > metrics.previousMonthUnits ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(((metrics.totalUnits - metrics.previousMonthUnits) / metrics.previousMonthUnits) * 100).toFixed(1)}% vs anterior
                </div>
              )}
            </div>
            <Package className="h-8 w-8 text-orange-500 opacity-20" />
          </div>
        </Card>

        <Card className="p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1">CLIENTES ACTIVOS</div>
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(metrics?.activeCustomers || 0)}
              </div>
              {metrics?.previousMonthCustomers !== undefined && (
                <div className={`text-[10px] mt-1 flex items-center gap-1 ${getChangeColor(
                  ((metrics.activeCustomers - metrics.previousMonthCustomers) / metrics.previousMonthCustomers) * 100
                )}`}>
                  {metrics.activeCustomers > metrics.previousMonthCustomers ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(((metrics.activeCustomers - metrics.previousMonthCustomers) / metrics.previousMonthCustomers) * 100).toFixed(1)}% vs anterior
                </div>
              )}
            </div>
            <Users className="h-8 w-8 text-green-500 opacity-20" />
          </div>
        </Card>
      </div>

      {/* View-specific content */}
      {view === "all" && (
        <Card className="p-3 bg-white shadow-sm">
          <div className="text-xs font-semibold text-gray-700 mb-3">Ventas por Segmento</div>
          {segmentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <div className="space-y-1.5">
              {segments?.slice(0, 5).map((seg: any) => (
                <div key={seg.segment} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                  <span className="font-medium">{seg.segment}</span>
                  <span className="text-gray-600">{formatCurrency(seg.totalSales)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {view === "goals-only" && goalsProgress && goalsProgress.length > 0 && (
        <Card className="p-4 bg-white shadow-sm">
          <div className="text-xs font-semibold text-gray-700 mb-3">Progreso de Metas</div>
          <div className="space-y-3">
            {goalsProgress.map((goal: any) => {
              const percentage = (goal.currentSales / goal.goalAmount) * 100;
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{goal.targetName}</span>
                    <span className="text-gray-600">{percentage.toFixed(1)}% completado</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${percentage >= 100 ? 'bg-green-500' : percentage >= 75 ? 'bg-blue-500' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-gray-600">Meta</div>
                      <div className="font-bold text-blue-900">{formatCurrency(goal.goalAmount)}</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-gray-600">Alcanzado</div>
                      <div className="font-bold text-green-900">{formatCurrency(goal.currentSales)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "by-segment" && selectedEntity && (
        <>
          <Card className="p-3 bg-white shadow-sm">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Vendedores del Segmento "{selectedEntity}"
            </div>
            <div className="space-y-1.5">
              {segmentSalespeople?.slice(0, 5).map((sp: any) => (
                <div key={sp.salespersonName} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="font-medium">{sp.salespersonName}</span>
                  <span className="text-gray-600">{formatCurrency(sp.totalSales)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3 bg-white shadow-sm">
            <div className="text-xs font-semibold text-gray-700 mb-2">Clientes del Segmento</div>
            <div className="space-y-1.5">
              {segmentClients?.slice(0, 5).map((client: any) => (
                <div key={client.clientName} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="font-medium">{client.clientName}</span>
                  <span className="text-gray-600">{formatCurrency(client.totalSales)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {view === "by-salesperson" && selectedEntity && (
        <>
          <Card className="p-3 bg-white shadow-sm">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Clientes del Vendedor "{selectedEntity}"
            </div>
            <div className="space-y-1.5">
              {salespersonClients?.slice(0, 5).map((client: any) => (
                <div key={client.clientName} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="font-medium">{client.clientName}</span>
                  <span className="text-gray-600">{formatCurrency(client.totalSales)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-3 bg-white shadow-sm">
            <div className="text-xs font-semibold text-gray-700 mb-2">Productos Más Vendidos</div>
            <div className="space-y-1.5">
              {salespersonProducts?.items?.slice(0, 5).map((product: any) => (
                <div key={product.productName} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                  <span className="font-medium">{product.productName}</span>
                  <span className="text-gray-600">{formatNumber(product.totalUnits)} uds</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
