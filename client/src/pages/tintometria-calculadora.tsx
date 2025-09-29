import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calculator, Palette, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Color, Envase } from '@shared/schema';

interface CostCalculation {
  colorId: string;
  envaseId: string;
  baseId: string;
  baseCost: number;
  pigmentsCost: number;
  envaseData: Envase;
  totalPaintCost: number;
  totalCost: number;
  suggestedPrice?: number;
}

export default function TintometriaCalculadora() {
  const { toast } = useToast();
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedEnvaseId, setSelectedEnvaseId] = useState('');
  const [calculation, setCalculation] = useState<CostCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Queries for colores and envases
  const { data: colores = [], isLoading: loadingColores } = useQuery<Color[]>({
    queryKey: ['/api/tintometria/colores'],
  });

  const { data: envases = [], isLoading: loadingEnvases } = useQuery<Envase[]>({
    queryKey: ['/api/tintometria/envases'],
  });

  const handleCalculate = async () => {
    if (!selectedColorId || !selectedEnvaseId) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor selecciona un color y un envase',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    try {
      const response = await apiRequest('/api/tintometria/calculate', {
        method: 'POST',
        data: {
          colorId: selectedColorId,
          envaseId: selectedEnvaseId,
        },
      });

      setCalculation(response as unknown as CostCalculation);
      toast({
        title: 'Cálculo realizado',
        description: 'El costo ha sido calculado exitosamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error en el cálculo',
        description: error.message || 'Error al calcular el costo',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const resetCalculation = () => {
    setSelectedColorId('');
    setSelectedEnvaseId('');
    setCalculation(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calculadora de Tintometría</h1>
          <p className="text-muted-foreground">
            Selecciona un color y envase para calcular el costo total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Selección de parámetros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Selección de Parámetros
            </CardTitle>
            <CardDescription>
              Elige el color y el envase para calcular el costo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="color-select">Color</Label>
              <Select 
                value={selectedColorId} 
                onValueChange={setSelectedColorId}
                disabled={loadingColores}
              >
                <SelectTrigger id="color-select" data-testid="select-color">
                  <SelectValue placeholder={loadingColores ? "Cargando colores..." : "Selecciona un color"} />
                </SelectTrigger>
                <SelectContent>
                  {colores.map((color: Color) => (
                    <SelectItem key={color.colorId} value={color.colorId}>
                      {color.nombreColor} ({color.colorId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="envase-select">Envase</Label>
              <Select 
                value={selectedEnvaseId} 
                onValueChange={setSelectedEnvaseId}
                disabled={loadingEnvases}
              >
                <SelectTrigger id="envase-select" data-testid="select-envase">
                  <SelectValue placeholder={loadingEnvases ? "Cargando envases..." : "Selecciona un envase"} />
                </SelectTrigger>
                <SelectContent>
                  {envases.map((envase: Envase) => (
                    <SelectItem key={envase.envaseId} value={envase.envaseId}>
                      {envase.envaseId} - {envase.capacidad} ({envase.material}) - {Number(envase.kgPorEnvase).toFixed(3)} kg
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCalculate}
                disabled={isCalculating || !selectedColorId || !selectedEnvaseId}
                className="flex-1"
                data-testid="button-calculate"
              >
                {isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calcular Costo
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={resetCalculation}
                data-testid="button-reset"
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados del cálculo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Resultado del Cálculo
            </CardTitle>
            <CardDescription>
              Desglose detallado de costos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!calculation ? (
              <div className="text-center text-muted-foreground py-8">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona un color y envase para ver el cálculo</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Color:</div>
                    <div data-testid="result-color">{calculation.colorId}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Envase:</div>
                    <div data-testid="result-envase">{calculation.envaseId}</div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Costo Base:</span>
                    <span data-testid="result-base-cost">
                      ${Number(calculation.baseCost).toLocaleString('es-CL')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Costo Pigmentos:</span>
                    <span data-testid="result-pigments-cost">
                      ${Number(calculation.pigmentsCost).toLocaleString('es-CL')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Subtotal Pintura:</span>
                    <span data-testid="result-paint-cost">
                      ${Number(calculation.totalPaintCost).toLocaleString('es-CL')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Costo Envase:</span>
                    <span data-testid="result-container-cost">
                      ${Number(calculation.envaseData.costoEnvaseClp).toLocaleString('es-CL')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-lg font-bold border-t pt-3">
                    <span>Costo Total:</span>
                    <span className="text-primary" data-testid="result-total-cost">
                      ${Number(calculation.totalCost).toLocaleString('es-CL')}
                    </span>
                  </div>

                  {calculation.suggestedPrice && (
                    <div className="flex justify-between text-lg font-bold bg-secondary/50 p-3 rounded-lg border-t">
                      <span>Precio Sugerido:</span>
                      <span className="text-green-600" data-testid="result-suggested-price">
                        ${Number(calculation.suggestedPrice).toLocaleString('es-CL')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
                  <div><strong>Capacidad:</strong> {Number(calculation.envaseData.kgPorEnvase).toFixed(3)} kg</div>
                  <div><strong>Material:</strong> {calculation.envaseData.material}</div>
                  <div><strong>Base utilizada:</strong> {calculation.baseId}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
          <CardDescription>
            Estado actual de los datos de tintometría
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary" data-testid="stat-colors">
                {colores.length}
              </div>
              <div className="text-sm text-muted-foreground">Colores disponibles</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary" data-testid="stat-envases">
                {envases.length}
              </div>
              <div className="text-sm text-muted-foreground">Envases disponibles</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-muted-foreground">
                --
              </div>
              <div className="text-sm text-muted-foreground">Recetas configuradas</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-muted-foreground">
                --
              </div>
              <div className="text-sm text-muted-foreground">Pigmentos registrados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}