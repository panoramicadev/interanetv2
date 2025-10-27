import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import { Calendar } from "lucide-react";

interface YearMonthSelection {
  years: number[];
  period: "full-year" | "month" | "custom-range";
  month?: number;
  startDate?: Date;
  endDate?: Date;
  display: string;
}

export default function DateSelectorDemo() {
  const [selection, setSelection] = useState<YearMonthSelection | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Selector Principal</h1>
          <p className="text-gray-600">
            Selecciona años y meses para comparar períodos
          </p>
        </div>

        {/* Main Selector Card */}
        <Card className="border-2 border-blue-100">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <CardTitle className="text-base font-semibold">Selector Principal</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Selecciona año(s), mes(es) o rango
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">
                  Período:
                </label>
                <YearMonthSelector
                  value={selection}
                  onChange={setSelection}
                />
              </div>

              {/* Display Selected Period */}
              {selection && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900">
                      {selection.display}
                    </div>
                    <div className="text-xs text-blue-700 mt-0.5">
                      {selection.period === "full-year" && "Año(s) completo(s)"}
                      {selection.period === "month" && `Mes específico comparado en ${selection.years.length} año(s)`}
                    </div>
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
                  2. Click "Continuar a meses"<br />
                  3. Selecciona "Marzo"<br />
                  → Compara Marzo 2025 vs Marzo 2024 vs Marzo 2023
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Comparar años completos</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona años: 2025, 2024<br />
                  2. Click "Aplicar año completo"<br />
                  → Compara todo 2025 vs todo 2024
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Un solo año completo</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona año: 2025<br />
                  2. Click "Aplicar año completo"<br />
                  → Ver datos de 2025
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded border">
                <div className="font-medium mb-1">Un mes específico en un año</div>
                <div className="text-gray-600 text-xs">
                  1. Selecciona año: 2025<br />
                  2. Click "Continuar a meses"<br />
                  3. Selecciona "Octubre"<br />
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
              {JSON.stringify(selection, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
