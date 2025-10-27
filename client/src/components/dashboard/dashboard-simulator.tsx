import { useQuery } from "@tanstack/react-query";
import KPICards from "./kpi-cards";
import GoalsProgress from "./goals-progress";
import SalesChart from "./sales-chart";
import SegmentChart from "./segment-chart";
import TopSalespeoplePanel from "./top-salespeople-panel";
import TopClientsPanel from "./top-clients-panel";
import TopProductsChart from "./top-products-chart";
import PackagingSalesMetrics from "./packaging-sales-metrics";
import TransactionsTable from "./transactions-table";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Calendar } from "lucide-react";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "custom-range";
  month?: number;
  months?: number[];
  startDate?: Date;
  endDate?: Date;
  display: string;
}

interface DashboardSimulatorProps {
  view: "all" | "goals-only" | "by-segment" | "by-salesperson";
  selection: YearMonthSelection | null;
  selectedEntity: string | null;
}

export function DashboardSimulator({ view, selection, selectedEntity }: DashboardSimulatorProps) {
  // Determine if this is a single period or comparison mode
  const isComparison = selection && (
    selection.years.length > 1 || 
    (selection.months && selection.months.length > 1)
  );

  // Map view to globalFilter format
  const globalFilter = (() => {
    if (view === "all" || view === "goals-only") {
      return { type: "all" as const };
    } else if (view === "by-segment") {
      return { type: "segment" as const, value: selectedEntity || undefined };
    } else {
      return { type: "salesperson" as const, value: selectedEntity || undefined };
    }
  })();

  // Generate period string for single period mode
  const getSinglePeriod = (): string | null => {
    if (!selection) return null;
    
    if (selection.period === "full-year") {
      return selection.years[0].toString();
    } else if (selection.period === "month" || selection.period === "months") {
      const year = selection.years[0];
      // months array is 0-indexed, need to convert to 1-indexed for API
      const monthValue = selection.months?.[0] !== undefined 
        ? selection.months[0] + 1 
        : selection.month || 1;
      const month = monthValue.toString().padStart(2, '0');
      return `${year}-${month}`;
    }
    return null;
  };

  // Generate array of periods for comparison mode
  const getComparisonPeriods = (): Array<{period: string, label: string, filterType: string}> => {
    if (!selection) return [];
    
    const periods: Array<{period: string, label: string, filterType: string}> = [];
    
    if (selection.period === "full-year") {
      // Multiple years comparison
      selection.years.forEach(year => {
        periods.push({
          period: year.toString(),
          label: year.toString(),
          filterType: "year"
        });
      });
    } else if (selection.months && selection.months.length > 0) {
      // Multiple months comparison
      selection.years.forEach(year => {
        selection.months!.forEach(monthIndex => {
          const month = (monthIndex + 1).toString().padStart(2, '0');
          const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          periods.push({
            period: `${year}-${month}`,
            label: `${monthNames[monthIndex]} ${year}`,
            filterType: "month"
          });
        });
      });
    }
    
    return periods;
  };

  const singlePeriod = getSinglePeriod();
  const comparisonPeriods = getComparisonPeriods();
  const filterType = selection?.period === "full-year" ? "year" : "month";

  // Fetch goals progress for single period
  const { data: goalsProgress } = useQuery({
    queryKey: ['/api/goals/progress', singlePeriod],
    queryFn: async () => {
      if (!singlePeriod) return [];
      const params = new URLSearchParams();
      params.append('selectedPeriod', singlePeriod);
      const res = await fetch(`/api/goals/progress?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch goals');
      return await res.json();
    },
    enabled: !isComparison && !!singlePeriod,
  });

  // Fetch metrics for comparison periods
  const comparisonQueries = useQuery({
    queryKey: ['/api/sales/metrics-comparison', comparisonPeriods, selectedEntity, view],
    queryFn: async () => {
      const results = await Promise.all(
        comparisonPeriods.map(async ({ period, label, filterType }) => {
          const params = new URLSearchParams();
          params.append('period', period);
          params.append('filterType', filterType);
          if (globalFilter.type === "segment" && globalFilter.value) {
            params.append('segment', globalFilter.value);
          }
          if (globalFilter.type === "salesperson" && globalFilter.value) {
            params.append('salesperson', globalFilter.value);
          }
          
          const res = await fetch(`/api/sales/metrics?${params}`, { credentials: "include" });
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          return { ...data, label, period };
        })
      );
      return results;
    },
    enabled: Boolean(isComparison && comparisonPeriods.length > 0),
  });

  if (!selection) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Selecciona un período para ver los datos del dashboard</p>
      </div>
    );
  }

  // COMPARISON MODE
  if (isComparison && comparisonQueries.data) {
    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value);
    
    const formatNumber = (value: number) => 
      new Intl.NumberFormat('es-CL').format(value);

    return (
      <div className="space-y-4">
        {/* Comparison Header */}
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-sm font-semibold text-blue-900">Modo Comparativo</div>
            <div className="text-xs text-blue-700">
              Comparando {comparisonQueries.data.length} períodos
            </div>
          </div>
        </div>

        {/* Comparison KPI Cards */}
        <div className="grid grid-cols-1 gap-4">
          {/* Ventas Totales Comparison */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-semibold">Ventas Totales por Período</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comparisonQueries.data.map((data: any) => (
                <div key={data.period} className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <div className="text-xs text-blue-700 font-medium mb-1">{data.label}</div>
                  <div className="text-lg font-bold text-blue-900">{formatCurrency(data.totalSales || 0)}</div>
                  <div className="text-[10px] text-blue-600 mt-1">
                    {formatNumber(data.totalUnits || 0)} uds
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Unidades Vendidas Comparison */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-orange-500" />
              <h3 className="text-sm font-semibold">Unidades Vendidas por Período</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comparisonQueries.data.map((data: any) => (
                <div key={data.period} className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                  <div className="text-xs text-orange-700 font-medium mb-1">{data.label}</div>
                  <div className="text-lg font-bold text-orange-900">{formatNumber(data.totalUnits || 0)}</div>
                  <div className="text-[10px] text-orange-600 mt-1">
                    {formatCurrency(data.totalSales || 0)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Clientes Activos Comparison */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-semibold">Clientes Activos por Período</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comparisonQueries.data.map((data: any) => (
                <div key={data.period} className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                  <div className="text-xs text-green-700 font-medium mb-1">{data.label}</div>
                  <div className="text-lg font-bold text-green-900">{formatNumber(data.activeCustomers || 0)}</div>
                  <div className="text-[10px] text-green-600 mt-1">
                    {formatNumber(data.totalTransactions || 0)} transacciones
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary Table */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Resumen Comparativo</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Período</th>
                    <th className="text-right p-2 font-semibold">Ventas</th>
                    <th className="text-right p-2 font-semibold">Unidades</th>
                    <th className="text-right p-2 font-semibold">Clientes</th>
                    <th className="text-right p-2 font-semibold">Trans.</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonQueries.data.map((data: any) => (
                    <tr key={data.period} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{data.label}</td>
                      <td className="p-2 text-right">{formatCurrency(data.totalSales || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.totalUnits || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.activeCustomers || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.totalTransactions || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Comparison Sales Chart */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <SalesChart 
              selectedPeriod={comparisonPeriods[0]?.period || ""}
              filterType={comparisonPeriods[0]?.filterType as any || "month"}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              comparisonPeriods={comparisonPeriods}
            />
          </div>
        </div>
      </div>
    );
  }

  // SINGLE PERIOD MODE - Use existing dashboard components
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* KPI Cards with Modern Styling */}
      <div>
        <KPICards 
          selectedPeriod={singlePeriod || ""} 
          filterType={filterType}
          segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
          salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
          comparePeriod="none"
        />
      </div>
      
      {/* Goals Progress Dashboard - Solo mostrar para meses completos y cuando hay metas configuradas */}
      {filterType === "month" && goalsProgress && goalsProgress.length > 0 && view !== "goals-only" && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <GoalsProgress 
            globalFilter={globalFilter}
            selectedPeriod={singlePeriod || ""}
          />
        </div>
      )}

      {/* Goals-only view */}
      {view === "goals-only" && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <GoalsProgress 
            globalFilter={{ type: "all" }}
            selectedPeriod={singlePeriod || ""}
          />
        </div>
      )}
      
      {/* Primary Analytics - Sales Chart Full Width */}
      {view !== "goals-only" && !isComparison && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <SalesChart 
            selectedPeriod={singlePeriod || ""} 
            filterType={filterType}
            segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
            salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
          />
        </div>
      )}

      {/* Ventas por Segmento - Full Width Chart - Ocultar cuando hay filtro activo */}
      {globalFilter.type === "all" && view !== "goals-only" && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <SegmentChart 
            selectedPeriod={singlePeriod || ""} 
            filterType={filterType}
            onSegmentClick={(segmentName) => {
              console.log("Clicked segment:", segmentName);
            }}
          />
        </div>
      )}

      {/* Sales Team & Client Analytics - Full Width Column */}
      {view !== "goals-only" && (
        <>
          {/* Ocultar panel de vendedores cuando se filtra por vendedor específico */}
          {globalFilter.type !== "salesperson" && (
            <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
              <TopSalespeoplePanel 
                selectedPeriod={singlePeriod || ""} 
                filterType={filterType}
                segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
                salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
              />
            </div>
          )}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopClientsPanel 
              selectedPeriod={singlePeriod || ""} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Products Chart */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopProductsChart 
              selectedPeriod={singlePeriod || ""} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Packaging Metrics - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <PackagingSalesMetrics 
              selectedPeriod={singlePeriod || ""} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Transactions - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TransactionsTable 
              selectedPeriod={singlePeriod || ""} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
