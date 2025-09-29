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
const ColorWheel = ({ onColorSelect, selectedHex }: { 
  onColorSelect: (hex: string) => void;
  selectedHex: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawn, setIsDrawn] = useState(false);

  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
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
      for (let r = 30; r < radius; r += 2) {
        const saturation = ((r - 30) / (radius - 30)) * 100;
        const lightness = 50;
        
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
    
    if (distance >= 30 && distance <= radius) {
      // Calculate angle and convert to hue
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      
      const hue = angle;
      const saturation = ((distance - 30) / (radius - 30)) * 100;
      const lightness = 50;
      
      const hexColor = hslToHex(hue, saturation, lightness);
      onColorSelect(hexColor);
    } else if (distance <= 30) {
      // White center clicked
      onColorSelect('#FFFFFF');
    }
    
    // Check clicks on bottom sections
    const bottomY = centerY + radius + 20;
    if (y >= bottomY && y <= bottomY + 30) {
      if (x >= centerX - 60 && x <= centerX - 20) {
        // White clicked
        onColorSelect('#FFFFFF');
      } else if (x >= centerX - 20 && x <= centerX + 20) {
        // Gray clicked
        onColorSelect('#808080');
      } else if (x >= centerX + 20 && x <= centerX + 60) {
        // Black clicked
        onColorSelect('#000000');
      }
    }
  };

  React.useEffect(() => {
    if (!isDrawn) {
      drawColorWheel();
    }
  }, [drawColorWheel, isDrawn]);

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
      {selectedHex && (
        <div className="text-center p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center justify-center gap-3">
            <div 
              className="w-8 h-8 rounded border-2 border-border"
              style={{ backgroundColor: selectedHex }}
            />
            <div>
              <div className="font-medium text-sm">Color seleccionado</div>
              <div className="text-lg font-mono">{selectedHex}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function TintometriaCalculadora() {
  const { toast } = useToast();
  const [selectedHex, setSelectedHex] = useState('');
  const [selectedTipoBase, setSelectedTipoBase] = useState('');
  const [selectedTipoProducto, setSelectedTipoProducto] = useState('');
  const [selectedEnvaseId, setSelectedEnvaseId] = useState('');
  const [calculation, setCalculation] = useState<CostCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Queries para obtener datos
  const { data: envases = [], isLoading: loadingEnvases } = useQuery<Envase[]>({
    queryKey: ['/api/tintometria/envases'],
  });

  const { data: bases = [], isLoading: loadingBases } = useQuery({
    queryKey: ['/api/tintometria/bases'],
  });

  const handleCalculate = async () => {
    if (!selectedHex || !selectedTipoBase || !selectedTipoProducto || !selectedEnvaseId) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    try {
      // Por ahora solo mostramos los valores seleccionados
      // Aquí se implementará la lógica de cálculo real
      const mockCalculation = {
        colorId: selectedHex,
        envaseId: selectedEnvaseId,
        baseId: selectedTipoBase,
        baseCost: 1250,
        pigmentsCost: 350,
        envaseData: envases.find(e => e.envaseId === selectedEnvaseId)!,
        totalPaintCost: 1600,
        totalCost: 2450,
        suggestedPrice: 3675
      };
      
      setCalculation(mockCalculation);
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
    setSelectedHex('');
    setSelectedTipoBase('');
    setSelectedTipoProducto('');
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
                onColorSelect={setSelectedHex} 
                selectedHex={selectedHex}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-base">Tipo de Base</Label>
              <Select value={selectedTipoBase} onValueChange={setSelectedTipoBase}>
                <SelectTrigger id="tipo-base" data-testid="select-tipo-base">
                  <SelectValue placeholder="Selecciona tipo de base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agua">Base al Agua</SelectItem>
                  <SelectItem value="solvente">Base Solvente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-producto">Tipo de Producto</Label>
              <Select value={selectedTipoProducto} onValueChange={setSelectedTipoProducto}>
                <SelectTrigger id="tipo-producto" data-testid="select-tipo-producto">
                  <SelectValue placeholder="Selecciona tipo de producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="esmalte">Esmalte</SelectItem>
                  <SelectItem value="latex">Látex</SelectItem>
                  <SelectItem value="barniz">Barniz</SelectItem>
                  <SelectItem value="primer">Primer</SelectItem>
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
                disabled={isCalculating || !selectedHex || !selectedTipoBase || !selectedTipoProducto || !selectedEnvaseId}
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
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: selectedHex }}
                      />
                      <span data-testid="result-color">{selectedHex}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Envase:</div>
                    <div data-testid="result-envase">{calculation.envaseId}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Base:</div>
                    <div data-testid="result-base">{selectedTipoBase}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Producto:</div>
                    <div data-testid="result-producto">{selectedTipoProducto}</div>
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
              <div className="text-2xl font-bold text-primary" data-testid="stat-bases">
                {bases.length}
              </div>
              <div className="text-sm text-muted-foreground">Bases disponibles</div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-muted-foreground">
                4
              </div>
              <div className="text-sm text-muted-foreground">Tipos de producto</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}