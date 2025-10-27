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

interface DashboardSimulatorProps {
  view: "all" | "goals-only" | "by-segment" | "by-salesperson";
  period: string | null;
  filterType: string;
  selectedEntity: string | null;
  years?: number[];
}

export function DashboardSimulator({ view, period, filterType, selectedEntity }: DashboardSimulatorProps) {
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

  // Fetch goals progress
  const { data: goalsProgress } = useQuery({
    queryKey: ['/api/goals/progress', period],
    queryFn: async () => {
      if (!period) return [];
      const params = new URLSearchParams();
      params.append('period', period);
      const res = await fetch(`/api/goals/progress?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch goals');
      return await res.json();
    },
    enabled: !!period,
  });

  if (!period) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-sm">Selecciona un período para ver los datos del dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* KPI Cards with Modern Styling */}
      <div>
        <KPICards 
          selectedPeriod={period} 
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
            selectedPeriod={period}
          />
        </div>
      )}

      {/* Goals-only view */}
      {view === "goals-only" && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <GoalsProgress 
            globalFilter={{ type: "all" }}
            selectedPeriod={period}
          />
        </div>
      )}
      
      {/* Primary Analytics - Sales Chart Full Width - Solo mostrar para meses y rangos */}
      {filterType !== "day" && view !== "goals-only" && (
        <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
          <SalesChart 
            selectedPeriod={period} 
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
            selectedPeriod={period} 
            filterType={filterType}
            onSegmentClick={(segmentName) => {
              // En el simulador no hacemos nada cuando se hace click
              console.log("Clicked segment:", segmentName);
            }}
          />
        </div>
      )}

      {/* Sales Team & Client Analytics - Full Width Column */}
      {view !== "goals-only" && (
        <>
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopSalespeoplePanel 
              selectedPeriod={period} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopClientsPanel 
              selectedPeriod={period} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Products Chart */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TopProductsChart 
              selectedPeriod={period} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Packaging Metrics - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <PackagingSalesMetrics 
              selectedPeriod={period} 
              filterType={filterType}
              segment={globalFilter.type === "segment" ? globalFilter.value : undefined}
              salesperson={globalFilter.type === "salesperson" ? globalFilter.value : undefined}
            />
          </div>

          {/* Transactions - Full Width */}
          <div className="modern-card p-3 sm:p-4 lg:p-6 hover-lift">
            <TransactionsTable 
              selectedPeriod={period} 
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
