import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import { ViewSelector, type DashboardView } from "@/components/dashboard/view-selector";
import { SimpleEntitySelector } from "@/components/dashboard/simple-entity-selector";
import { DashboardSimulator } from "@/components/dashboard/dashboard-simulator";
import { Calendar, Eye } from "lucide-react";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "months" | "custom-range";
  month?: number;
  months?: number[];
  startDate?: Date;
  endDate?: Date;
  display: string;
}

export default function DateSelectorDemo() {
  // Initialize with current month
  const getCurrentMonthSelection = (): YearMonthSelection => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    return {
      years: [currentYear],
      period: "month",
      month: currentMonth + 1,
      months: [currentMonth],
      display: `${monthNames[currentMonth]} ${currentYear}`
    };
  };

  const [selection, setSelection] = useState<YearMonthSelection | null>(getCurrentMonthSelection());
  const [view, setView] = useState<DashboardView>("all");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Filtros Dashboard</h1>
          <p className="text-gray-600">
            Prueba los filtros con datos reales antes de integrarlos al dashboard principal
          </p>
        </div>

        {/* All Selectors Card */}
        <Card className="border-2 border-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filtros del Dashboard</CardTitle>
            <CardDescription className="text-sm">
              Todos los controles de filtrado en un solo lugar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* All filters in one line */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Vista */}
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Vista:</span>
                <ViewSelector
                  value={view}
                  onChange={(newView) => {
                    setView(newView);
                    setSelectedEntity(null);
                  }}
                />
              </div>

              {/* Segment/Salesperson selector - shown conditionally */}
              {(view === "by-segment" || view === "by-salesperson") && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {view === "by-segment" ? "Segmento:" : "Vendedor:"}
                  </span>
                  <SimpleEntitySelector
                    dimension={view === "by-segment" ? "segment" : "salesperson"}
                    value={selectedEntity}
                    onChange={setSelectedEntity}
                  />
                </div>
              )}

              {/* Period */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
                <YearMonthSelector
                  value={selection}
                  onChange={setSelection}
                />
              </div>
            </div>

            {/* Display Selected Filters */}
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Filtros activos:</div>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded border border-purple-200">
                <Eye className="h-3 w-3 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-purple-900">
                    Vista: {view === "all" ? "Todo el dashboard" : 
                           view === "goals-only" ? "Solo metas globales" :
                           view === "by-segment" ? "Por segmento" : "Por vendedor"}
                  </div>
                </div>
              </div>

              {selection && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded border border-blue-200">
                  <Calendar className="h-3 w-3 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-blue-900">
                      Período: {selection.display}
                    </div>
                    <div className="text-[10px] text-blue-700 mt-0.5">
                      {selection.period === "full-year" && "Año(s) completo(s)"}
                      {selection.period === "month" && `Mes específico en ${selection.years.length} año(s)`}
                      {selection.period === "months" && `${selection.months?.length} meses en ${selection.years.length} año(s)`}
                    </div>
                  </div>
                </div>
              )}

              {selectedEntity && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded border border-green-200">
                  <div className="h-3 w-3 text-green-600 flex-shrink-0 rounded-full bg-green-200" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-green-900">
                      {view === "by-segment" && `Segmento: ${selectedEntity}`}
                      {view === "by-salesperson" && `Vendedor: ${selectedEntity}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Real con Datos del Backend */}
        <Card className="border-2 border-indigo-100 bg-gradient-to-br from-gray-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Dashboard con Datos Reales</CardTitle>
            <CardDescription className="text-sm">
              {selection && (selection.years.length > 1 || (selection.months && selection.months.length > 1)) 
                ? "Mostrando comparativas entre múltiples períodos"
                : "Datos reales del backend según los filtros seleccionados"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DashboardSimulator
              view={view}
              selection={selection}
              selectedEntity={selectedEntity}
            />
          </CardContent>
        </Card>

        {/* JSON Output for Developers */}
        <Card className="bg-gray-900 text-gray-100 border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-mono">JSON Output (para desarrollo)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify({ view, period: selection, selectedEntity }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
