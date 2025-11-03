import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Calendar, TrendingUp, Users, ChevronDown, ChevronRight } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface HistoricalSalesData {
  year: number;
  month?: number;
  salespersonCode: string;
  salespersonName: string;
  clientCode: string;
  clientName: string;
  segment: string;
  totalSales: number;
  purchaseFrequency: number;
}

interface ManualProjection {
  id?: string;
  year: number;
  month?: number;
  salespersonCode: string;
  salespersonName?: string;
  clientCode: string;
  clientName?: string;
  projectedAmount: number;
  segment?: string;
}

interface ClientYearlyData {
  clientCode: string;
  clientName: string;
  segment: string;
  purchaseFrequency: number;
  yearlyData: Record<number, number>; // year -> totalSales
  projectedData: Record<number, number>; // year -> projectedAmount
  monthlyData?: Record<string, number>; // "year-month" -> totalSales
  monthlyProjectedData?: Record<string, number>; // "year-month" -> projectedAmount
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

// Map segment codes to readable names
const SEGMENT_NAMES: Record<string, string> = {
  'FERRETERIAS': 'Ferretería',
  'CONSTRUCCION': 'Construcción',
  'DIGITAL': 'Digital',
  'MCT': 'Fábrica',
  'PANORAMICA STORE': 'Panorámica Store',
  'FABRICACION MODULAR': 'Fábrica',
  'CLIENTES NO HABITUALES': 'No Habituales',
  'RETAIL': 'Retail',
  'MERCADO PUBLICO': 'Mercado Público',
};

export default function ProyeccionManualPage() {
  const { toast } = useToast();
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [futureYear, setFutureYear] = useState<number | null>(null);
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Helper function to get segment display name
  const getSegmentName = (segmentCode: string): string => {
    return SEGMENT_NAMES[segmentCode] || segmentCode;
  };

  // Toggle row expansion
  const toggleRowExpansion = (clientCode: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(clientCode)) {
      newExpanded.delete(clientCode);
    } else {
      newExpanded.add(clientCode);
    }
    setExpandedRows(newExpanded);
  };

  // Fetch available years
  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ['/api/proyecciones/years'],
  });

  // Fetch salespeople list
  const { data: salespeopleData = [] } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ['/api/proyecciones/salespeople'],
  });

  // Fetch historical data
  const { data: historicalData = [], isLoading: isLoadingHistorical } = useQuery<HistoricalSalesData[]>({
    queryKey: ['/api/proyecciones/historico', selectedYears.join(','), selectedMonths.join(','), selectedSalesperson],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedYears.length > 0) {
        params.append('years', selectedYears.join(','));
      }
      if (selectedMonths.length > 0) {
        params.append('months', selectedMonths.join(','));
      }
      if (selectedSalesperson !== 'all') {
        params.append('salespersonCode', selectedSalesperson);
      }
      const response = await fetch(`/api/proyecciones/historico?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch historical data');
      return response.json();
    },
    enabled: selectedYears.length > 0,
  });

  // Fetch manual projections
  const { data: manualProjections = [] } = useQuery<ManualProjection[]>({
    queryKey: ['/api/proyecciones/manual', futureYear ? [...selectedYears, futureYear].join(',') : selectedYears.join(','), selectedMonths.join(','), selectedSalesperson],
    queryFn: async () => {
      const params = new URLSearchParams();
      const years = futureYear ? [...selectedYears, futureYear] : selectedYears;
      if (years.length > 0) {
        params.append('years', years.join(','));
      }
      if (selectedMonths.length > 0) {
        params.append('months', selectedMonths.join(','));
      }
      if (selectedSalesperson !== 'all') {
        params.append('salespersonCode', selectedSalesperson);
      }
      const response = await fetch(`/api/proyecciones/manual?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch manual projections');
      return response.json();
    },
    enabled: selectedYears.length > 0 || !!futureYear,
  });

  // Mutation to save projection
  const saveProjectionMutation = useMutation({
    mutationFn: async (projection: Partial<ManualProjection>) => {
      return await apiRequest('/api/proyecciones/manual', {
        method: 'POST',
        data: projection,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proyecciones/manual'] });
      toast({ title: 'Proyección guardada exitosamente' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'No se pudo guardar la proyección',
        variant: 'destructive'
      });
    },
  });

  // Use salespeople from API
  const salespeople = useMemo(() => {
    return salespeopleData.sort((a, b) => a.name.localeCompare(b.name));
  }, [salespeopleData]);

  // Process data for table display
  const processedData = useMemo(() => {
    const clientMap = new Map<string, ClientYearlyData>();

    // Process historical sales
    historicalData.forEach(item => {
      const key = `${item.salespersonCode}_${item.clientCode}`;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          clientCode: item.clientCode,
          clientName: item.clientName,
          segment: item.segment,
          purchaseFrequency: item.purchaseFrequency,
          yearlyData: {},
          projectedData: {},
          monthlyData: {},
          monthlyProjectedData: {},
        });
      }
      const client = clientMap.get(key)!;
      
      // If month is specified, it's monthly data
      if (item.month) {
        const monthKey = `${item.year}-${item.month}`;
        client.monthlyData = client.monthlyData || {};
        client.monthlyData[monthKey] = item.totalSales;
      } else {
        // Yearly aggregated data
        client.yearlyData[item.year] = item.totalSales;
      }
    });

    // Process manual projections
    manualProjections.forEach(proj => {
      const key = `${proj.salespersonCode}_${proj.clientCode}`;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          clientCode: proj.clientCode,
          clientName: proj.clientName || '',
          segment: proj.segment || '',
          purchaseFrequency: 0,
          yearlyData: {},
          projectedData: {},
          monthlyData: {},
          monthlyProjectedData: {},
        });
      }
      const client = clientMap.get(key)!;
      
      // If month is specified, it's monthly projection
      if (proj.month) {
        const monthKey = `${proj.year}-${proj.month}`;
        client.monthlyProjectedData = client.monthlyProjectedData || {};
        client.monthlyProjectedData[monthKey] = proj.projectedAmount;
      } else {
        // Yearly projection
        client.projectedData[proj.year] = proj.projectedAmount;
      }
    });

    return Array.from(clientMap.values()).sort((a, b) => {
      // Sort by total sales across all years (descending)
      const totalA = Object.values(a.yearlyData).reduce((sum, val) => sum + val, 0);
      const totalB = Object.values(b.yearlyData).reduce((sum, val) => sum + val, 0);
      return totalB - totalA;
    });
  }, [historicalData, manualProjections]);

  // All years to display (selected + future)
  const allYears = useMemo(() => {
    const years = [...selectedYears];
    if (futureYear && !years.includes(futureYear)) {
      years.push(futureYear);
    }
    return years.sort((a, b) => a - b);
  }, [selectedYears, futureYear]);

  const handleSaveProjection = (clientCode: string, clientName: string, segment: string, year: number, value: number, month?: number) => {
    const salespersonData = historicalData.find(h => h.clientCode === clientCode);
    
    saveProjectionMutation.mutate({
      year,
      month,
      salespersonCode: selectedSalesperson !== 'all' ? selectedSalesperson : salespersonData?.salespersonCode || '',
      salespersonName: salespersonData?.salespersonName || '',
      clientCode,
      clientName,
      segment,
      projectedAmount: value,
    });

    // Clear editing state
    const key = month ? `${clientCode}_${year}_${month}` : `${clientCode}_${year}`;
    const newEditingCells = { ...editingCells };
    delete newEditingCells[key];
    setEditingCells(newEditingCells);
  };

  const handleCellEdit = (clientCode: string, year: number, value: string, month?: number) => {
    const key = month ? `${clientCode}_${year}_${month}` : `${clientCode}_${year}`;
    const numValue = parseFloat(value) || 0;
    setEditingCells({ ...editingCells, [key]: numValue });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalRow = useMemo(() => {
    const totals: Record<number, number> = {};
    allYears.forEach(year => {
      totals[year] = processedData.reduce((sum, client) => {
        const historicalValue = client.yearlyData[year] || 0;
        const projectedValue = client.projectedData[year] || 0;
        return sum + historicalValue + projectedValue;
      }, 0);
    });
    return totals;
  }, [allYears, processedData]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Proyección Manual</CardTitle>
          <CardDescription>
            Selecciona años y vendedor para analizar y proyectar ventas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Year Multi-select */}
            <div className="space-y-2">
              <Label>Años Históricos</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="select-years"
                  >
                    {selectedYears.length > 0 
                      ? `${selectedYears.length} año${selectedYears.length > 1 ? 's' : ''} seleccionado${selectedYears.length > 1 ? 's' : ''}`
                      : "Seleccionar años"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-3" align="start">
                  <div className="space-y-2">
                    {availableYears.map(year => (
                      <div key={year} className="flex items-center space-x-2">
                        <Checkbox
                          id={`year-${year}`}
                          checked={selectedYears.includes(year)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedYears([...selectedYears, year].sort((a, b) => a - b));
                            } else {
                              setSelectedYears(selectedYears.filter(y => y !== year));
                            }
                          }}
                          data-testid={`checkbox-year-${year}`}
                        />
                        <label
                          htmlFor={`year-${year}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {year}
                        </label>
                      </div>
                    ))}
                    {availableYears.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay años disponibles</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedYears.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedYears.map(year => (
                    <Badge key={year} variant="secondary" className="text-xs">
                      {year}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => setSelectedYears(selectedYears.filter(y => y !== year))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Month Multi-select */}
            <div className="space-y-2">
              <Label>Meses</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    data-testid="select-months"
                  >
                    {selectedMonths.length > 0 
                      ? `${selectedMonths.length} mes${selectedMonths.length > 1 ? 'es' : ''} seleccionado${selectedMonths.length > 1 ? 's' : ''}`
                      : "Todos los meses"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-3 max-h-80 overflow-y-auto" align="start">
                  <div className="space-y-2">
                    {MONTHS.map(month => (
                      <div key={month.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`month-${month.value}`}
                          checked={selectedMonths.includes(month.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMonths([...selectedMonths, month.value].sort((a, b) => a - b));
                            } else {
                              setSelectedMonths(selectedMonths.filter(m => m !== month.value));
                            }
                          }}
                          data-testid={`checkbox-month-${month.value}`}
                        />
                        <label
                          htmlFor={`month-${month.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {month.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedMonths.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedMonths.map(month => (
                    <Badge key={month} variant="secondary" className="text-xs">
                      {MONTHS.find(m => m.value === month)?.label}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => setSelectedMonths(selectedMonths.filter(m => m !== month))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Salesperson Filter */}
            <div className="space-y-2">
              <Label htmlFor="salesperson">Vendedor</Label>
              <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
                <SelectTrigger id="salesperson" data-testid="select-salesperson">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {salespeople.map(sp => (
                    <SelectItem key={sp.code} value={sp.code}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Future Year */}
            <div className="space-y-2">
              <Label htmlFor="futureYear">Agregar Año Futuro</Label>
              <div className="flex gap-2">
                <Input
                  id="futureYear"
                  type="number"
                  min={new Date().getFullYear()}
                  max={2050}
                  placeholder="Ej: 2026"
                  data-testid="input-future-year"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      if (value && value >= new Date().getFullYear()) {
                        setFutureYear(value);
                      }
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => {
                    const input = document.getElementById('futureYear') as HTMLInputElement;
                    const value = parseInt(input.value);
                    if (value && value >= new Date().getFullYear()) {
                      setFutureYear(value);
                      input.value = '';
                    }
                  }}
                  data-testid="button-add-future-year"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {futureYear && (
                <Badge variant="secondary" className="mt-2">
                  Año futuro: {futureYear}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-4 w-4 p-0"
                    onClick={() => setFutureYear(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {selectedYears.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clientes</p>
                  <p className="text-2xl font-bold">{processedData.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Años Analizados</p>
                  <p className="text-2xl font-bold">{selectedYears.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vendedores</p>
                  <p className="text-2xl font-bold">
                    {selectedSalesperson === 'all' ? salespeople.length : 1}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      {selectedYears.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Cliente y Año</CardTitle>
            <CardDescription>
              Histórico de ventas y proyecciones. Haz clic en las celdas del año futuro para editar proyecciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Frecuencia</TableHead>
                    {allYears.map(year => (
                      <TableHead key={year} className="text-right min-w-[150px]">
                        {year}
                        {futureYear === year && (
                          <Badge variant="outline" className="ml-2">Futuro</Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHistorical ? (
                    <TableRow>
                      <TableCell colSpan={allYears.length + 4} className="text-center">
                        Cargando datos...
                      </TableCell>
                    </TableRow>
                  ) : processedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={allYears.length + 4} className="text-center">
                        No hay datos disponibles para los filtros seleccionados
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {processedData.map((client) => {
                        const totalPeriod = allYears.reduce((sum, year) => {
                          return sum + (client.yearlyData[year] || 0) + (client.projectedData[year] || 0);
                        }, 0);

                        const isExpanded = expandedRows.has(client.clientCode);
                        
                        return (
                          <>
                            <TableRow key={client.clientCode} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="sticky left-0 bg-background z-10">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleRowExpansion(client.clientCode)}
                                    className="hover:bg-accent rounded p-1"
                                    data-testid={`button-expand-${client.clientCode}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                  <span className="font-medium">{client.clientName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{getSegmentName(client.segment)}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {client.purchaseFrequency} días
                              </TableCell>
                            {allYears.map((year, yearIndex) => {
                              const cellKey = `${client.clientCode}_${year}`;
                              const historicalValue = client.yearlyData[year] || 0;
                              const projectedValue = client.projectedData[year] || 0;
                              const currentTotal = historicalValue + projectedValue;
                              const isEditing = cellKey in editingCells;
                              const isFuture = year === futureYear;

                              // Calculate percentage vs previous year
                              let percentageChange: number | null = null;
                              if (yearIndex > 0) {
                                const previousYear = allYears[yearIndex - 1];
                                const previousHistorical = client.yearlyData[previousYear] || 0;
                                const previousProjected = client.projectedData[previousYear] || 0;
                                const previousTotal = previousHistorical + previousProjected;
                                
                                if (previousTotal > 0 && currentTotal > 0) {
                                  percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
                                }
                              }

                              if (isFuture) {
                                // Editable cell for future year
                                return (
                                  <TableCell key={year} className="text-right">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          defaultValue={editingCells[cellKey] || projectedValue || ''}
                                          onChange={(e) => handleCellEdit(client.clientCode, year, e.target.value)}
                                          className="w-full"
                                          autoFocus
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            const value = editingCells[cellKey] || projectedValue || 0;
                                            handleSaveProjection(
                                              client.clientCode,
                                              client.clientName,
                                              client.segment,
                                              year,
                                              value
                                            );
                                          }}
                                        >
                                          <Save className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setEditingCells({ ...editingCells, [cellKey]: projectedValue })}
                                        className="w-full text-right hover:bg-accent rounded p-1 cursor-pointer"
                                      >
                                        {projectedValue > 0 ? (
                                          <div className="flex flex-col items-end">
                                            <span className="text-blue-600 font-semibold">
                                              {formatCurrency(projectedValue)}
                                            </span>
                                            {percentageChange !== null && (
                                              <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </button>
                                    )}
                                  </TableCell>
                                );
                              } else {
                                // Historical data (read-only)
                                return (
                                  <TableCell key={year} className="text-right">
                                    {historicalValue > 0 ? (
                                      <div className="flex flex-col items-end">
                                        <span>{formatCurrency(historicalValue)}</span>
                                        {percentageChange !== null && (
                                          <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    ) : '-'}
                                  </TableCell>
                                );
                              }
                            })}
                            </TableRow>
                            
                            {/* Monthly breakdown rows when expanded */}
                            {isExpanded && selectedMonths.length > 0 && (
                              <>
                                {selectedMonths.map(monthNum => {
                                  const monthLabel = MONTHS.find(m => m.value === monthNum)?.label || `Mes ${monthNum}`;
                                  
                                  return (
                                    <TableRow key={`${client.clientCode}-month-${monthNum}`} className="bg-muted/30">
                                      <TableCell className="sticky left-0 bg-muted/30 z-10 pl-12 text-sm text-muted-foreground">
                                        {monthLabel}
                                      </TableCell>
                                      <TableCell colSpan={2}></TableCell>
                                      {allYears.map(year => {
                                        const monthKey = `${year}-${monthNum}`;
                                        const cellKey = `${client.clientCode}_${year}_${monthNum}`;
                                        const monthlyValue = client.monthlyData?.[monthKey] || 0;
                                        const monthlyProjectedValue = client.monthlyProjectedData?.[monthKey] || 0;
                                        const isEditingMonth = cellKey in editingCells;
                                        const isFuture = year === futureYear;
                                        
                                        if (isFuture) {
                                          // Editable cell for future year months
                                          return (
                                            <TableCell key={year} className="text-right text-sm">
                                              {isEditingMonth ? (
                                                <div className="flex items-center gap-1">
                                                  <Input
                                                    type="number"
                                                    defaultValue={editingCells[cellKey] || monthlyProjectedValue || ''}
                                                    onChange={(e) => handleCellEdit(client.clientCode, year, e.target.value, monthNum)}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                  />
                                                  <Button
                                                    size="sm"
                                                    onClick={() => {
                                                      const value = editingCells[cellKey] || monthlyProjectedValue || 0;
                                                      handleSaveProjection(
                                                        client.clientCode,
                                                        client.clientName,
                                                        client.segment,
                                                        year,
                                                        value,
                                                        monthNum
                                                      );
                                                    }}
                                                  >
                                                    <Save className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => setEditingCells({ ...editingCells, [cellKey]: monthlyProjectedValue })}
                                                  className="w-full text-right hover:bg-accent rounded p-1 cursor-pointer"
                                                >
                                                  {monthlyProjectedValue > 0 ? (
                                                    <span className="text-blue-600 font-semibold text-sm">
                                                      {formatCurrency(monthlyProjectedValue)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                  )}
                                                </button>
                                              )}
                                            </TableCell>
                                          );
                                        } else {
                                          // Historical monthly data (read-only)
                                          return (
                                            <TableCell key={year} className="text-right text-sm text-muted-foreground">
                                              {monthlyValue > 0 ? formatCurrency(monthlyValue) : '-'}
                                            </TableCell>
                                          );
                                        }
                                      })}
                                    </TableRow>
                                  );
                                })}
                              </>
                            )}
                          </>
                        );
                      })}
                      {/* Total Row */}
                      <TableRow className="bg-accent font-bold">
                        <TableCell className="sticky left-0 bg-accent z-10">TOTAL</TableCell>
                        <TableCell colSpan={2}></TableCell>
                        {allYears.map(year => (
                          <TableCell key={year} className="text-right">
                            {formatCurrency(totalRow[year] || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedYears.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Selecciona uno o más años para comenzar el análisis</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
