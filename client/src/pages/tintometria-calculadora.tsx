import React, { useState, useRef, useCallback } from 'react';
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

// Color wheel component
const ColorWheel = ({ onColorSelect, selectedColor }: { 
  onColorSelect: (color: Color) => void;
  selectedColor: Color | null;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawn, setIsDrawn] = useState(false);
  
  const { data: colores = [] } = useQuery<Color[]>({
    queryKey: ['/api/tintometria/colores'],
  });

  // Paleta de colores con posiciones angulares
  const colorMap = [
    { angle: 0, color: '#FF0000', name: 'Rojo', keywords: ['rojo', 'red', 'cereza'] },
    { angle: 30, color: '#FF8000', name: 'Naranja', keywords: ['naranja', 'orange', 'atardecer'] },
    { angle: 60, color: '#FFFF00', name: 'Amarillo', keywords: ['amarillo', 'yellow', 'sol'] },
    { angle: 90, color: '#80FF00', name: 'Lima', keywords: ['lima', 'lime'] },
    { angle: 120, color: '#00FF00', name: 'Verde', keywords: ['verde', 'green', 'bosque'] },
    { angle: 150, color: '#00FF80', name: 'Verde Azul', keywords: ['verde', 'azul'] },
    { angle: 180, color: '#00FFFF', name: 'Cian', keywords: ['cian', 'cyan'] },
    { angle: 210, color: '#0080FF', name: 'Azul Claro', keywords: ['azul', 'blue'] },
    { angle: 240, color: '#0000FF', name: 'Azul', keywords: ['azul', 'blue', 'océano', 'marino'] },
    { angle: 270, color: '#8000FF', name: 'Violeta', keywords: ['violeta', 'purple', 'real'] },
    { angle: 300, color: '#FF00FF', name: 'Magenta', keywords: ['magenta'] },
    { angle: 330, color: '#FF0080', name: 'Rosa', keywords: ['rosa', 'pink'] },
    { angle: -1, color: '#FFFFFF', name: 'Blanco', keywords: ['blanco', 'white', 'nieve'] },
    { angle: -2, color: '#808080', name: 'Gris', keywords: ['gris', 'gray', 'perla'] },
    { angle: -3, color: '#000000', name: 'Negro', keywords: ['negro', 'black', 'profundo'] },
  ];

  const findMatchingColor = (colorInfo: typeof colorMap[0]) => {
    return colores.find(color => 
      colorInfo.keywords.some(keyword => 
        color.nombreColor.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  };

  const drawColorWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw color wheel
    const segments = 360;
    for (let i = 0; i < segments; i++) {
      const angle = (i * Math.PI * 2) / segments;
      const nextAngle = ((i + 1) * Math.PI * 2) / segments;
      
      const hue = (i / segments) * 360;
      
      // Draw multiple rings for saturation
      for (let r = 0; r < radius; r += 2) {
        const saturation = (r / radius) * 100;
        const lightness = 50 + (1 - r / radius) * 30; // Lighter towards center
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, angle, nextAngle);
        ctx.lineWidth = 2;
        ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.stroke();
      }
    }
    
    // Draw white center
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw black, gray, white sections at bottom
    const bottomY = centerY + radius + 20;
    const sectionWidth = 40;
    
    // White
    ctx.beginPath();
    ctx.rect(centerX - 60, bottomY, sectionWidth, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Gray
    ctx.beginPath();
    ctx.rect(centerX - 20, bottomY, sectionWidth, 30);
    ctx.fillStyle = '#808080';
    ctx.fill();
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Black
    ctx.beginPath();
    ctx.rect(centerX + 20, bottomY, sectionWidth, 30);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    setIsDrawn(true);
  }, []);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // Check if click is in the wheel
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= radius) {
      // Calculate angle
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      
      // Find closest color
      let closestColor = colorMap[0];
      let minDiff = 360;
      
      for (const colorInfo of colorMap) {
        if (colorInfo.angle < 0) continue; // Skip special colors
        const diff = Math.abs(angle - colorInfo.angle);
        const diffWrapped = Math.abs(angle - colorInfo.angle + 360);
        const diffWrapped2 = Math.abs(angle - colorInfo.angle - 360);
        const minColorDiff = Math.min(diff, diffWrapped, diffWrapped2);
        
        if (minColorDiff < minDiff) {
          minDiff = minColorDiff;
          closestColor = colorInfo;
        }
      }
      
      const matchingColor = findMatchingColor(closestColor);
      if (matchingColor) {
        onColorSelect(matchingColor);
      }
    }
    
    // Check clicks on bottom sections
    const bottomY = centerY + radius + 20;
    if (y >= bottomY && y <= bottomY + 30) {
      if (x >= centerX - 60 && x <= centerX - 20) {
        // White clicked
        const whiteColor = findMatchingColor(colorMap.find(c => c.angle === -1)!);
        if (whiteColor) onColorSelect(whiteColor);
      } else if (x >= centerX - 20 && x <= centerX + 20) {
        // Gray clicked
        const grayColor = findMatchingColor(colorMap.find(c => c.angle === -2)!);
        if (grayColor) onColorSelect(grayColor);
      } else if (x >= centerX + 20 && x <= centerX + 60) {
        // Black clicked
        const blackColor = findMatchingColor(colorMap.find(c => c.angle === -3)!);
        if (blackColor) onColorSelect(blackColor);
      }
    }
  };

  React.useEffect(() => {
    if (colores.length > 0 && !isDrawn) {
      drawColorWheel();
    }
  }, [colores, drawColorWheel, isDrawn]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={350}
        className="cursor-pointer border rounded-lg"
        onClick={handleCanvasClick}
        data-testid="color-wheel"
      />
      {selectedColor && (
        <div className="text-center p-3 bg-secondary/50 rounded-lg">
          <div className="font-medium">{selectedColor.nombreColor}</div>
          <div className="text-sm text-muted-foreground">Código: {selectedColor.colorId}</div>
        </div>
      )}
    </div>
  );
};

export default function TintometriaCalculadora() {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [selectedEnvaseId, setSelectedEnvaseId] = useState('');
  const [calculation, setCalculation] = useState<CostCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Query for envases
  const { data: colores = [] } = useQuery<Color[]>({
    queryKey: ['/api/tintometria/colores'],
  });

  const { data: envases = [], isLoading: loadingEnvases } = useQuery<Envase[]>({
    queryKey: ['/api/tintometria/envases'],
  });

  const handleCalculate = async () => {
    if (!selectedColor || !selectedEnvaseId) {
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
    setSelectedColor(null);
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
              <Label>Color</Label>
              <ColorWheel 
                onColorSelect={setSelectedColor} 
                selectedColor={selectedColor}
              />
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
                disabled={isCalculating || !selectedColor || !selectedEnvaseId}
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
                    <div data-testid="result-color">{selectedColor?.nombreColor}</div>
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