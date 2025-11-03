import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Calendar, TrendingUp, Users, ChevronDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface HistoricalSalesData {
  year: number;
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
}

export default function ProyeccionManualPage() {
  const { toast } = useToast();
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [futureYear, setFutureYear] = useState<number | null>(null);
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});

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
    queryKey: ['/api/proyecciones/historico', { 
      years: selectedYears.join(','),
      salespersonCode: selectedSalesperson !== 'all' ? selectedSalesperson : undefined,
    }],
    enabled: selectedYears.length > 0,
  });

  // Fetch manual projections
  const { data: manualProjections = [] } = useQuery<ManualProjection[]>({
    queryKey: ['/api/proyecciones/manual', {
      years: futureYear ? [...selectedYears, futureYear].join(',') : selectedYears.join(','),
      salespersonCode: selectedSalesperson !== 'all' ? selectedSalesperson : undefined,
    }],
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
        });
      }
      const client = clientMap.get(key)!;
      client.yearlyData[item.year] = item.totalSales;
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
        });
      }
      const client = clientMap.get(key)!;
      client.projectedData[proj.year] = proj.projectedAmount;
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

  const handleSaveProjection = (clientCode: string, clientName: string, segment: string, year: number, value: number) => {
    const salespersonData = historicalData.find(h => h.clientCode === clientCode);
    
    saveProjectionMutation.mutate({
      year,
      salespersonCode: selectedSalesperson !== 'all' ? selectedSalesperson : salespersonData?.salespersonCode || '',
      salespersonName: salespersonData?.salespersonName || '',
      clientCode,
      clientName,
      segment,
      projectedAmount: value,
    });

    // Clear editing state
    const key = `${clientCode}_${year}`;
    const newEditingCells = { ...editingCells };
    delete newEditingCells[key];
    setEditingCells(newEditingCells);
  };

  const handleCellEdit = (clientCode: string, year: number, value: string) => {
    const key = `${clientCode}_${year}`;
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <TableHead className="text-right font-bold">Total Período</TableHead>
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

                        return (
                          <TableRow key={client.clientCode}>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">
                              {client.clientName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{client.segment}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{client.purchaseFrequency}</TableCell>
                            {allYears.map(year => {
                              const cellKey = `${client.clientCode}_${year}`;
                              const historicalValue = client.yearlyData[year] || 0;
                              const projectedValue = client.projectedData[year] || 0;
                              const isEditing = cellKey in editingCells;
                              const isFuture = year === futureYear;

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
                                          <span className="text-blue-600 font-semibold">
                                            {formatCurrency(projectedValue)}
                                          </span>
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
                                    {historicalValue > 0 ? formatCurrency(historicalValue) : '-'}
                                  </TableCell>
                                );
                              }
                            })}
                            <TableCell className="text-right font-bold">
                              {formatCurrency(totalPeriod)}
                            </TableCell>
                          </TableRow>
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
                        <TableCell className="text-right">
                          {formatCurrency(Object.values(totalRow).reduce((sum, val) => sum + val, 0))}
                        </TableCell>
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
