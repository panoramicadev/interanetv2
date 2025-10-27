import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import { ViewSelector, type DashboardView } from "@/components/dashboard/view-selector";
import { SimpleEntitySelector } from "@/components/dashboard/simple-entity-selector";
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

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function DateSelectorDemo() {
  const [selection, setSelection] = useState<YearMonthSelection | null>(null);
  const [view, setView] = useState<DashboardView>("all");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Filtros Dashboard</h1>
          <p className="text-gray-600">
            Prueba todos los filtros antes de integrarlos al dashboard principal
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
                    // Reset entity filter when changing view
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

        {/* Dashboard Visual Simulation */}
        <Card className="border-2 border-indigo-100 bg-gradient-to-br from-gray-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Simulación Visual del Dashboard</CardTitle>
            <CardDescription className="text-sm">
              Vista previa de cómo se vería el dashboard con estos filtros aplicados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mock KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-lg border shadow-sm">
                <div className="text-[10px] font-medium text-gray-500 mb-1">VENTAS TOTALES</div>
                <div className="text-xl font-bold text-gray-900">$195.086.384</div>
                <div className="text-[10px] text-green-600 mt-1">↑ 12.4% vs período anterior</div>
              </div>
              <div className="p-3 bg-white rounded-lg border shadow-sm">
                <div className="text-[10px] font-medium text-gray-500 mb-1">TOTAL ACUMULADO AÑO</div>
                <div className="text-xl font-bold text-gray-900">$730.589.429</div>
                <div className="text-[10px] text-blue-600 mt-1">Año 2025</div>
              </div>
              <div className="p-3 bg-white rounded-lg border shadow-sm">
                <div className="text-[10px] font-medium text-gray-500 mb-1">UNIDADES VENDIDAS</div>
                <div className="text-xl font-bold text-gray-900">12.219</div>
                <div className="text-[10px] text-orange-600 mt-1">↓ 7.5% vs período anterior</div>
              </div>
            </div>

            {/* View-specific content */}
            {view === "all" && (
              <>
                {/* Chart placeholder */}
                <div className="p-4 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-3">Tendencia de Ventas</div>
                  <div className="h-32 bg-gradient-to-r from-blue-50 to-indigo-50 rounded flex items-end justify-around px-4 gap-1">
                    <div className="w-full bg-blue-400 rounded-t" style={{ height: '45%' }}></div>
                    <div className="w-full bg-blue-400 rounded-t" style={{ height: '62%' }}></div>
                    <div className="w-full bg-blue-400 rounded-t" style={{ height: '38%' }}></div>
                    <div className="w-full bg-blue-500 rounded-t" style={{ height: '75%' }}></div>
                    <div className="w-full bg-blue-500 rounded-t" style={{ height: '88%' }}></div>
                    <div className="w-full bg-blue-600 rounded-t" style={{ height: '95%' }}></div>
                  </div>
                </div>

                {/* Segments table */}
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Ventas por Segmento</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">FERRETERIAS</span>
                      <span className="text-gray-600">$45.230.120</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">CONSTRUCTORAS</span>
                      <span className="text-gray-600">$38.564.890</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">PINTURERIAS</span>
                      <span className="text-gray-600">$32.450.760</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {view === "goals-only" && (
              <div className="p-4 bg-white rounded-lg border shadow-sm">
                <div className="text-xs font-semibold text-gray-700 mb-3">Progreso de Metas</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">Meta Global</span>
                      <span className="text-gray-600">85% completado</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="text-gray-600">Meta</div>
                      <div className="font-bold text-blue-900">$230.000.000</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <div className="text-gray-600">Alcanzado</div>
                      <div className="font-bold text-green-900">$195.086.384</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "by-segment" && (
              <>
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    Vendedores del Segmento {selectedEntity ? `"${selectedEntity}"` : ""}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">JUAN PÉREZ</span>
                      <span className="text-gray-600">$15.230.120</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">MARÍA GONZÁLEZ</span>
                      <span className="text-gray-600">$12.564.890</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">PEDRO LÓPEZ</span>
                      <span className="text-gray-600">$8.450.760</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Clientes del Segmento</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">FERRETERIA CENTRAL</span>
                      <span className="text-gray-600">$8.230.120</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">CASA ROYAL</span>
                      <span className="text-gray-600">$6.564.890</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {view === "by-salesperson" && (
              <>
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    Clientes del Vendedor {selectedEntity ? `"${selectedEntity}"` : ""}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">PINTURERIA ARCOIRIS</span>
                      <span className="text-gray-600">$5.230.120</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">FERRETERIA SAN JOSE</span>
                      <span className="text-gray-600">$4.564.890</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">CONSTRUCTORA ABC</span>
                      <span className="text-gray-600">$3.450.760</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Productos Más Vendidos</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">LATEX SUPER BLANCO</span>
                      <span className="text-gray-600">450 uds</span>
                    </div>
                    <div className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                      <span className="font-medium">ESMALTE SINTETICO</span>
                      <span className="text-gray-600">320 uds</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Period indicator */}
            <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded border border-indigo-200">
              <Calendar className="h-3 w-3 text-indigo-600" />
              <div className="text-[10px] text-indigo-700">
                {selection ? (
                  <span>
                    Mostrando datos de: <strong>{selection.display}</strong>
                  </span>
                ) : (
                  <span className="text-gray-500">Selecciona un período para filtrar datos</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Preview */}
        <Card className="border-2 border-green-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Información de Filtros Aplicados</CardTitle>
            <CardDescription className="text-sm">
              Detalle de qué mostrará el dashboard con estos filtros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dashboard Layout Simulation */}
            <div className="space-y-3">
              {/* What will be shown based on view */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-semibold text-blue-900 mb-2">Secciones visibles:</div>
                <div className="space-y-1.5 text-xs text-blue-800">
                  {view === "all" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ KPIs principales (Ventas, Unidades, Clientes)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Gráficos de tendencias</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Tabla de segmentos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Top vendedores</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Top clientes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Top productos</span>
                      </div>
                    </>
                  )}
                  {view === "goals-only" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Metas globales y progreso</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <span className="text-gray-500">✗ Gráficos detallados</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <span className="text-gray-500">✗ Tablas de datos</span>
                      </div>
                    </>
                  )}
                  {view === "by-segment" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ KPIs del segmento {selectedEntity ? `"${selectedEntity}"` : "(todos)"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Vendedores del segmento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Clientes del segmento</span>
                      </div>
                      {selectedEntity && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          <span>✓ Meta del segmento (si existe)</span>
                        </div>
                      )}
                    </>
                  )}
                  {view === "by-salesperson" && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ KPIs del vendedor {selectedEntity ? `"${selectedEntity}"` : "(todos)"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Clientes del vendedor</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        <span>✓ Productos más vendidos</span>
                      </div>
                      {selectedEntity && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          <span>✓ Meta del vendedor (si existe)</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Period info */}
              {selection && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-xs font-semibold text-amber-900 mb-2">Período de datos:</div>
                  <div className="space-y-1 text-xs text-amber-800">
                    {selection.period === "full-year" && (
                      <>
                        <div>• Mostrando datos del año completo</div>
                        <div>• Años: {selection.years.join(", ")}</div>
                        {selection.years.length > 1 && (
                          <div>• Comparación entre {selection.years.length} años</div>
                        )}
                      </>
                    )}
                    {selection.period === "month" && (
                      <>
                        <div>• Mostrando datos de un mes específico</div>
                        <div>• Mes: {MONTHS[(selection.months?.[0] || 1) - 1]}</div>
                        <div>• Años: {selection.years.join(", ")}</div>
                        {selection.years.length > 1 && (
                          <div>• Comparando el mismo mes en {selection.years.length} años</div>
                        )}
                      </>
                    )}
                    {selection.period === "months" && (
                      <>
                        <div>• Mostrando datos de múltiples meses</div>
                        <div>• Meses: {selection.months?.map(m => MONTHS[m - 1].substring(0, 3)).join(", ")}</div>
                        <div>• Años: {selection.years.join(", ")}</div>
                        {selection.years.length > 1 && (
                          <div>• Comparando los mismos meses en {selection.years.length} años</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Entity filter info */}
              {selectedEntity && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-xs font-semibold text-purple-900 mb-2">Filtro de entidad:</div>
                  <div className="text-xs text-purple-800">
                    {view === "by-segment" && (
                      <div>• Solo datos del segmento: <span className="font-semibold">{selectedEntity}</span></div>
                    )}
                    {view === "by-salesperson" && (
                      <div>• Solo datos del vendedor: <span className="font-semibold">{selectedEntity}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ejemplos de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Comparar un mes entre varios años</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona años: 2025, 2024, 2023<br />
                  2. Selecciona mes: Marzo<br />
                  3. Click "Aplicar 1 mes"<br />
                  → Compara Marzo 2025 vs Marzo 2024 vs Marzo 2023
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Múltiples meses en varios años</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona años: 2025, 2024<br />
                  2. Selecciona meses: Ene, Feb, Mar<br />
                  3. Click "Aplicar 3 meses"<br />
                  → Compara Ene-Mar 2025 vs Ene-Mar 2024
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Años completos</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona años: 2025, 2024<br />
                  2. Click "Aplicar año completo"<br />
                  → Compara todo 2025 vs todo 2024
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Un mes en un año</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona año: 2025<br />
                  2. Selecciona mes: Octubre<br />
                  3. Click "Aplicar 1 mes"<br />
                  → Ver datos de Octubre 2025
                </div>
              </div>
            </div>
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
