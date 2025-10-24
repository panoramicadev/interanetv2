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
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <CardTitle>Selector Principal</CardTitle>
              </div>
              <CardDescription>
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

                {/* Display Selected Period */}
                {selectedPeriod && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="font-medium text-sm text-blue-900">Período Seleccionado</div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Tipo:</span>
                            <Badge variant="secondary" className="ml-2">
                              {selectedPeriod.type === "year" && "Año"}
                              {selectedPeriod.type === "years" && "Años"}
                              {selectedPeriod.type === "month" && "Mes"}
                              {selectedPeriod.type === "months" && "Meses"}
                              {selectedPeriod.type === "range" && "Rango"}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-gray-600">Valor:</span>
                            <span className="ml-2 font-mono text-xs bg-white px-2 py-1 rounded break-all">
                              {selectedPeriod.value}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Visualización:</span>
                            <span className="ml-2 font-medium">{selectedPeriod.display}</span>
                          </div>
                          {selectedPeriod.startDate && (
                            <>
                              <div>
                                <span className="text-gray-600">Inicio:</span>
                                <span className="ml-2 font-mono text-xs">
                                  {selectedPeriod.startDate.toISOString().split('T')[0]}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Fin:</span>
                                <span className="ml-2 font-mono text-xs">
                                  {selectedPeriod.endDate?.toISOString().split('T')[0]}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Selector */}
          <Card className="border-2 border-purple-100">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-purple-600" />
                <CardTitle>Selector de Comparación</CardTitle>
              </div>
              <CardDescription>
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

              {/* Display Comparisons */}
              {comparisons.length > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div className="flex-1 space-y-3">
                      <div className="font-medium text-sm text-purple-900">
                        Períodos ({comparisons.length})
                      </div>
                      {comparisons.map((comp, index) => (
                        <div key={index} className="bg-white p-3 rounded border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span className="font-medium text-sm">{comp.display}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {comp.type === "year" && "Año"}
                            {comp.type === "years" && "Años"}
                            {comp.type === "month" && "Mes"}
                            {comp.type === "months" && "Meses"}
                            {comp.type === "range" && "Rango"}
                          </Badge>
                          <div className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded mt-2 break-all">
                            {comp.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
