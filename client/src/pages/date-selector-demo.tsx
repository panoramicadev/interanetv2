import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UnifiedDateSelector } from "@/components/dashboard/unified-date-selector";
import { ComparisonSelector } from "@/components/dashboard/comparison-selector";
import { Calendar, GitCompare, Info } from "lucide-react";

interface DateSelection {
  type: "year" | "years" | "month" | "months" | "range";
  value: string;
  display: string;
  startDate?: Date;
  endDate?: Date;
}

export default function DateSelectorDemo() {
  const [selectedPeriod, setSelectedPeriod] = useState<DateSelection | null>(null);
  const [comparisons, setComparisons] = useState<DateSelection[]>([]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Selector de Fechas Simplificado</h1>
          <p className="text-gray-600">
            Un solo calendario para seleccionar años, meses o rangos de fechas
          </p>
        </div>

        {/* Selectors in Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Period Selector */}
          <Card className="border-2 border-blue-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <CardTitle className="text-sm font-semibold">Selector Principal</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Selecciona año(s), mes(es) o rango
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 w-20">
                    Período:
                  </label>
                  <UnifiedDateSelector
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                    label="Seleccionar período"
                  />
                </div>

                {/* Display Selected Period - Minimalista */}
                {selectedPeriod && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-900">
                      {selectedPeriod.display}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Selector */}
          <Card className="border-2 border-purple-100">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-purple-600 flex-shrink-0" />
                <CardTitle className="text-sm font-semibold">Selector de Comparación</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Compara hasta 3 períodos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">
                  Comparar:
                </label>
                <ComparisonSelector
                  value={comparisons}
                  onChange={setComparisons}
                />
              </div>

              {/* Display Comparisons - Minimalista */}
              {comparisons.length > 0 && (
                <div className="space-y-2">
                  {comparisons.map((comp, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-purple-900">
                        {comp.display}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Usage Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ejemplos de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Un año</div>
                <div className="text-gray-600">Selecciona "2025" en la pestaña Año</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Múltiples años</div>
                <div className="text-gray-600">Selecciona "2023, 2024, 2025" en la pestaña Año</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Un mes</div>
                <div className="text-gray-600">Selecciona "Octubre 2025" en la pestaña Mes</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Varios meses</div>
                <div className="text-gray-600">Selecciona "Ene-Mar 2025" en la pestaña Mes</div>
              </div>
              <div className="p-3 bg-gray-50 rounded border col-span-2">
                <div className="font-medium mb-1">Rango personalizado</div>
                <div className="text-gray-600">Selecciona dos fechas en la pestaña Rango</div>
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
              {JSON.stringify({ selectedPeriod, comparisons }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
