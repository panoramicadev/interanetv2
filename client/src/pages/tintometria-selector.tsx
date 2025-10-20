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
import { Badge } from '@/components/ui/badge';
import { Calculator, Palette, Package, Droplets } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import type { Color, Envase, Base } from '@shared/schema';

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

// Paleta de colores predefinida basada en los colores típicos de pinturas
const colorPalette = [
  { name: 'Blanco', hex: '#FFFFFF', keywords: ['blanco', 'white', 'nieve'] },
  { name: 'Rojo', hex: '#DC2626', keywords: ['rojo', 'red', 'cereza'] },
  { name: 'Azul', hex: '#2563EB', keywords: ['azul', 'blue', 'océano', 'marino'] },
  { name: 'Verde', hex: '#16A34A', keywords: ['verde', 'green', 'bosque'] },
  { name: 'Amarillo', hex: '#EAB308', keywords: ['amarillo', 'yellow', 'sol'] },
  { name: 'Gris', hex: '#6B7280', keywords: ['gris', 'gray', 'perla'] },
  { name: 'Negro', hex: '#1F2937', keywords: ['negro', 'black', 'profundo'] },
  { name: 'Beige', hex: '#D4A574', keywords: ['beige', 'arena', 'tierra'] },
  { name: 'Violeta', hex: '#7C3AED', keywords: ['violeta', 'purple', 'real'] },
  { name: 'Naranja', hex: '#EA580C', keywords: ['naranja', 'orange', 'atardecer'] },
];

export default function TintometriaSelector() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Verificar permisos de acceso
  if (!user || (user.role !== 'admin' && user.role !== 'laboratorio')) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-center text-muted-foreground">
            No tiene permisos para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }
  
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [selectedBase, setSelectedBase] = useState<Base | null>(null);
  const [selectedEnvase, setSelectedEnvase] = useState<Envase | null>(null);
  const [calculation, setCalculation] = useState<CostCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Queries para obtener datos
  const { data: colores = [], isLoading: loadingColores } = useQuery<Color[]>({
    queryKey: ['/api/tintometria/colores'],
  });

  const { data: bases = [], isLoading: loadingBases } = useQuery<Base[]>({
    queryKey: ['/api/tintometria/bases'],
  });

  const { data: envases = [], isLoading: loadingEnvases } = useQuery<Envase[]>({
    queryKey: ['/api/tintometria/envases'],
  });

  // Función para encontrar el color más parecido
  const findMatchingColor = (paletteColor: typeof colorPalette[0]) => {
    return colores.find(color => 
      paletteColor.keywords.some(keyword => 
        color.nombreColor.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  };

  // Función para manejar selección de color desde la paleta
  const handleColorSelect = (paletteColor: typeof colorPalette[0]) => {
    const matchingColor = findMatchingColor(paletteColor);
    if (matchingColor) {
      setSelectedColor(matchingColor);
      // Auto-seleccionar la base compatible
      const compatibleBase = bases.find(base => base.baseId === matchingColor.baseId);
      if (compatibleBase) {
        setSelectedBase(compatibleBase);
      }
      setCalculation(null); // Reset calculation
    } else {
      toast({
        title: 'Color no disponible',
        description: `No hay un color ${paletteColor.name} disponible en el catálogo`,
        variant: 'destructive',
      });
    }
  };

  // Función para calcular costo
  const handleCalculate = async () => {
    if (!selectedColor || !selectedEnvase) {
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
          colorId: selectedColor.colorId,
          envaseId: selectedEnvase.envaseId,
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

  const resetSelection = () => {
    setSelectedColor(null);
    setSelectedBase(null);
    setSelectedEnvase(null);
    setCalculation(null);
  };

  // Filtrar envases por material
  const envasesPlastico = envases.filter(e => e.material === 'Plástico');
  const envasesMetal = envases.filter(e => e.material === 'Metálico');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Palette className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Selector de Colores Panorámica</h1>
          <p className="text-muted-foreground">
            Elige tu color ideal y obtén el costo inmediatamente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Paleta de Colores */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Paleta de Colores
            </CardTitle>
            <CardDescription>
              Selecciona el color que deseas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {colorPalette.map((color, index) => {
                const matchingColor = findMatchingColor(color);
                const isSelected = selectedColor?.colorId === matchingColor?.colorId;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleColorSelect(color)}
                    disabled={!matchingColor}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-200
                      ${isSelected 
                        ? 'border-primary ring-2 ring-primary ring-offset-2' 
                        : 'border-border hover:border-primary/50'
                      }
                      ${!matchingColor ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                    `}
                    data-testid={`color-${color.name.toLowerCase()}`}
                  >
                    <div 
                      className="w-full h-12 rounded-md mb-2 border"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div className="text-sm font-medium text-center">{color.name}</div>
                    {matchingColor && (
                      <div className="text-xs text-muted-foreground text-center mt-1">
                        {matchingColor.nombreColor}
                      </div>
                    )}
                    {!matchingColor && (
                      <Badge variant="secondary" className="absolute top-1 right-1 text-xs">
                        N/D
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
            
            {selectedColor && (
              <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                <div className="text-sm font-medium">Color seleccionado:</div>
                <div className="text-sm text-muted-foreground">{selectedColor.nombreColor}</div>
                <div className="text-xs text-muted-foreground">Código: {selectedColor.colorId}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selección de Base y Envase */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Configuración
            </CardTitle>
            <CardDescription>
              Base y tipo de envase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Base seleccionada automáticamente */}
            <div className="space-y-2">
              <Label>Base (seleccionada automáticamente)</Label>
              <div className={`p-3 rounded-md border ${selectedBase ? 'bg-secondary/50' : 'bg-muted'}`}>
                {selectedBase ? (
                  <div>
                    <div className="font-medium">{selectedBase.baseId}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedBase.tipoBase} - {selectedBase.colorBase}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${Number(selectedBase.costoKgClp).toLocaleString('es-CL')}/kg
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Selecciona un color primero
                  </div>
                )}
              </div>
            </div>

            {/* Selección de envase */}
            <div className="space-y-3">
              <Label>Tipo de Envase</Label>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Envases Plásticos</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {envasesPlastico.map((envase) => (
                      <button
                        key={envase.envaseId}
                        onClick={() => {
                          setSelectedEnvase(envase);
                          setCalculation(null);
                        }}
                        className={`
                          p-3 text-left rounded-md border transition-colors
                          ${selectedEnvase?.envaseId === envase.envaseId
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                          }
                        `}
                        data-testid={`envase-${envase.envaseId}`}
                      >
                        <div className="text-sm font-medium">
                          {envase.capacidad} - {Number(envase.kgPorEnvase).toFixed(1)} kg
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${Number(envase.costoEnvaseClp).toLocaleString('es-CL')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Envases Metálicos</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {envasesMetal.map((envase) => (
                      <button
                        key={envase.envaseId}
                        onClick={() => {
                          setSelectedEnvase(envase);
                          setCalculation(null);
                        }}
                        className={`
                          p-3 text-left rounded-md border transition-colors
                          ${selectedEnvase?.envaseId === envase.envaseId
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                          }
                        `}
                        data-testid={`envase-${envase.envaseId}`}
                      >
                        <div className="text-sm font-medium">
                          {envase.capacidad} - {Number(envase.kgPorEnvase).toFixed(1)} kg
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${Number(envase.costoEnvaseClp).toLocaleString('es-CL')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCalculate}
                disabled={isCalculating || !selectedColor || !selectedEnvase}
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
                    Calcular Precio
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={resetSelection}
                data-testid="button-reset"
              >
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultado del Cálculo */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Precio Final
            </CardTitle>
            <CardDescription>
              Costo detallado de tu selección
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!calculation ? (
              <div className="text-center text-muted-foreground py-8">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Configura tu producto para ver el precio</p>
                {selectedColor && selectedEnvase && (
                  <p className="text-sm mt-2">¡Listo para calcular!</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumen de selección */}
                <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Color:</span>
                    <span data-testid="result-color">{selectedColor?.nombreColor}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Envase:</span>
                    <span data-testid="result-envase">
                      {selectedEnvase?.capacidad} {selectedEnvase?.material}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Cantidad:</span>
                    <span>{Number(selectedEnvase?.kgPorEnvase).toFixed(2)} kg</span>
                  </div>
                </div>

                {/* Desglose de costos */}
                <div className="space-y-3">
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
                  
                  <div className="flex justify-between text-sm border-t pt-2">
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
                    <span>Precio Total:</span>
                    <span className="text-primary" data-testid="result-total-cost">
                      ${Number(calculation.totalCost).toLocaleString('es-CL')}
                    </span>
                  </div>

                  {calculation.suggestedPrice && (
                    <div className="flex justify-between text-lg font-bold bg-green-50 dark:bg-green-950 p-3 rounded-lg border">
                      <span>Precio Público:</span>
                      <span className="text-green-600 dark:text-green-400" data-testid="result-suggested-price">
                        ${Number(calculation.suggestedPrice).toLocaleString('es-CL')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}