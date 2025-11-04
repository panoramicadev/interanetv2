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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const currentYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [futureYear, setFutureYear] = useState<number>(2026); // Siempre inicia en 2026
  const [editingCells, setEditingCells] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientSegment, setNewClientSegment] = useState("");

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

  // Fetch available years (exclude 2026 as it's a future year)
  const { data: rawAvailableYears = [] } = useQuery<number[]>({
    queryKey: ['/api/proyecciones/years'],
  });
  
  // Filter out 2026 and any future years from historical years
  const availableYears = useMemo(() => {
    return rawAvailableYears.filter(year => year < 2026);
  }, [rawAvailableYears]);

  // Fetch salespeople list
  const { data: salespeopleData = [] } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ['/api/proyecciones/salespeople'],
  });

  // Fetch segments list
  const { data: segmentsData = [] } = useQuery<Array<{ code: string; name: string }>>({
    queryKey: ['/api/proyecciones/segments'],
  });

  // Fetch historical data
  const { data: historicalData = [], isLoading: isLoadingHistorical } = useQuery<HistoricalSalesData[]>({
    queryKey: ['/api/proyecciones/historico', selectedYears.join(','), selectedMonths.join(','), selectedSalesperson, selectedSegment],
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
      if (selectedSegment !== 'all') {
        params.append('segment', selectedSegment);
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
    queryKey: ['/api/proyecciones/manual', futureYear ? [...selectedYears, futureYear].join(',') : selectedYears.join(','), selectedMonths.join(','), selectedSalesperson, selectedSegment],
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
      if (selectedSegment !== 'all') {
        params.append('segment', selectedSegment);
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

  // Helper to normalize client code (remove accents and special characters)
  const normalizeClientCode = (name: string): string => {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  };

  // Mutation to add future client
  const addFutureClientMutation = useMutation({
    mutationFn: async ({ clientName, segment }: { clientName: string; segment: string }) => {
      // Validate inputs
      const trimmedName = clientName.trim();
      const trimmedSegment = segment.trim();
      
      if (!trimmedName) {
        throw new Error('El nombre del cliente es requerido');
      }
      if (!trimmedSegment) {
        throw new Error('El segmento es requerido');
      }
      if (selectedSalesperson === 'all') {
        throw new Error('Debes seleccionar un vendedor específico para agregar un cliente futuro');
      }

      const salespersonInfo = salespeopleData.find(s => s.code === selectedSalesperson);
      const normalizedCode = normalizeClientCode(trimmedName);
      
      // Create initial projection with $0 for January to make the client appear
      return await apiRequest('/api/proyecciones/manual', {
        method: 'POST',
        data: {
          year: futureYear,
          month: 1,
          salespersonCode: selectedSalesperson,
          salespersonName: salespersonInfo?.name || selectedSalesperson,
          clientCode: `FUTURO-${normalizedCode}`,
          clientName: trimmedName,
          segment: trimmedSegment,
          projectedAmount: 0,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proyecciones/manual'] });
      setShowAddClientDialog(false);
      setNewClientName("");
      setNewClientSegment("");
      toast({ title: 'Cliente futuro agregado exitosamente' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo agregar el cliente futuro',
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
    const clientMap = new Map<string, ClientYearlyData & { segmentSales: Record<string, number> }>();

    // Process historical sales - backend already groups by client name
    historicalData.forEach(item => {
      const key = item.clientCode; // Backend now uses clientName as clientCode
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          clientCode: item.clientCode,
          clientName: item.clientName,
          segment: item.segment,
          purchaseFrequency: 0,
          yearlyData: {},
          projectedData: {},
          monthlyData: {},
          monthlyProjectedData: {},
          segmentSales: {},
        });
      }
      const client = clientMap.get(key)!;
      
      // Track sales by segment to find the primary one
      if (!client.segmentSales[item.segment]) {
        client.segmentSales[item.segment] = 0;
      }
      client.segmentSales[item.segment] += item.totalSales;
      
      // Sum purchase frequency across all records
      client.purchaseFrequency += item.purchaseFrequency;
      
      // ALWAYS store in monthly data for consistency
      if (item.month) {
        const monthKey = `${item.year}-${item.month}`;
        if (!client.monthlyData) client.monthlyData = {};
        client.monthlyData[monthKey] = (client.monthlyData[monthKey] || 0) + item.totalSales;
      } else {
        // If no month specified, it's yearly total - add directly to yearlyData
        client.yearlyData[item.year] = (client.yearlyData[item.year] || 0) + item.totalSales;
      }
    });
    
    // Post-process each client
    clientMap.forEach((client) => {
      // Determine primary segment (segment with most sales)
      if (Object.keys(client.segmentSales).length > 0) {
        const primarySegment = Object.entries(client.segmentSales)
          .sort(([, salesA], [, salesB]) => salesB - salesA)[0][0];
        client.segment = primarySegment;
      }
      
      // If we have monthly data but no yearly totals, calculate yearly totals from monthly
      if (client.monthlyData) {
        Object.keys(client.monthlyData).forEach(monthKey => {
          const year = parseInt(monthKey.split('-')[0]);
          if (!client.yearlyData[year]) {
            client.yearlyData[year] = 0;
          }
          // Sum monthly data into yearly totals
          client.yearlyData[year] += client.monthlyData![monthKey];
        });
      }
    });

    // Process manual projections - use clientCode (which is now clientName)
    manualProjections.forEach(proj => {
      const key = proj.clientCode;
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
          segmentSales: {},
        });
      }
      const client = clientMap.get(key)!;
      
      // If month is specified, it's monthly projection
      if (proj.month) {
        const monthKey = `${proj.year}-${proj.month}`;
        client.monthlyProjectedData = client.monthlyProjectedData || {};
        client.monthlyProjectedData[monthKey] = (client.monthlyProjectedData[monthKey] || 0) + proj.projectedAmount;
      } else {
        // Yearly projection - sum if multiple projections exist (legacy, should not be used)
        client.projectedData[proj.year] = (client.projectedData[proj.year] || 0) + proj.projectedAmount;
      }
    });
    
    // Calculate yearly projection totals from monthly projections
    // This MUST override any legacy yearly projections
    clientMap.forEach((client) => {
      // First, reset all yearly projections that have monthly data OR are future years
      // This ensures we always calculate from months, even if sum is 0
      const yearsToReset = new Set<number>();
      
      // Collect years that have monthly data
      if (client.monthlyProjectedData) {
        Object.keys(client.monthlyProjectedData).forEach(monthKey => {
          const year = parseInt(monthKey.split('-')[0]);
          yearsToReset.add(year);
        });
      }
      
      // Also reset any future years (>= 2026) to ensure they calculate from months only
      Object.keys(client.projectedData).forEach(yearStr => {
        const year = parseInt(yearStr);
        if (year >= 2026) {
          yearsToReset.add(year);
        }
      });
      
      // Reset identified years to 0 (will be recalculated from months)
      yearsToReset.forEach(year => {
        client.projectedData[year] = 0;
      });
      
      // Now calculate totals from monthly data
      if (client.monthlyProjectedData) {
        Object.keys(client.monthlyProjectedData).forEach(monthKey => {
          const year = parseInt(monthKey.split('-')[0]);
          client.projectedData[year] += client.monthlyProjectedData![monthKey];
        });
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

  // Always show annual view with expandable months (never show monthly columns)
  const showMonthlyView = false;

  // All periods to display (months or years)
  const allPeriods = useMemo(() => {
    if (showMonthlyView) {
      // Generate year-month combinations
      const periods: Array<{ year: number; month: number; label: string }> = [];
      allYears.forEach(year => {
        selectedMonths.forEach(month => {
          const monthLabel = MONTHS.find(m => m.value === month)?.label || `Mes ${month}`;
          periods.push({
            year,
            month,
            label: `${monthLabel} ${year}`
          });
        });
      });
      return periods;
    }
    return [];
  }, [allYears, selectedMonths, showMonthlyView]);

  const handleSaveProjection = (clientCode: string, clientName: string, segment: string, year: number, value: number, month?: number) => {
    // Validate that a specific salesperson is selected (not 'all')
    if (selectedSalesperson === 'all' || !selectedSalesperson) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar un vendedor específico para guardar proyecciones',
        variant: 'destructive'
      });
      return;
    }
    
    const salespersonCode = selectedSalesperson;
    
    // Find salesperson name from the salespeople list
    const salespersonInfo = salespeopleData.find(s => s.code === salespersonCode);
    
    saveProjectionMutation.mutate({
      year, // Use the year being projected (futureYear), not from filters
      month, // Optional month if editing monthly breakdown
      salespersonCode: salespersonCode,
      salespersonName: salespersonInfo?.name || salespersonCode,
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
    if (showMonthlyView) {
      // Calculate totals by period (year-month)
      const totals: Record<string, number> = {};
      allPeriods.forEach(period => {
        const key = `${period.year}-${period.month}`;
        totals[key] = processedData.reduce((sum, client) => {
          const historicalValue = client.monthlyData?.[key] || 0;
          const projectedValue = client.monthlyProjectedData?.[key] || 0;
          return sum + historicalValue + projectedValue;
        }, 0);
      });
      return totals as Record<string | number, number>;
    } else {
      // Calculate totals by year
      const totals: Record<number, number> = {};
      allYears.forEach(year => {
        totals[year] = processedData.reduce((sum, client) => {
          const historicalValue = client.yearlyData[year] || 0;
          const projectedValue = client.projectedData[year] || 0;
          return sum + historicalValue + projectedValue;
        }, 0);
      });
      return totals as Record<string | number, number>;
    }
  }, [allYears, processedData, allPeriods, showMonthlyView]);

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

            {/* Segment Filter */}
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger id="segment" data-testid="select-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los segmentos</SelectItem>
                  {segmentsData.map(seg => (
                    <SelectItem key={seg.code} value={seg.code}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Future Year */}
            <div className="space-y-2">
              <Label htmlFor="futureYear">Año Futuro</Label>
              <Select
                value={futureYear.toString()}
                onValueChange={(value) => {
                  if (value) {
                    setFutureYear(parseInt(value));
                  }
                }}
              >
                <SelectTrigger id="futureYear" data-testid="select-future-year">
                  <SelectValue placeholder="Selecciona año" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => 2026 + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="mt-2">
                Año futuro seleccionado: {futureYear}
              </Badge>
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
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Ventas por Cliente y Año</CardTitle>
                <CardDescription>
                  Histórico de ventas y proyecciones mensuales. Expande cada cliente para ver el desglose por mes. El total anual se calcula automáticamente sumando los 12 meses.
                </CardDescription>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button 
                        onClick={() => setShowAddClientDialog(true)}
                        disabled={selectedSalesperson === 'all'}
                        data-testid="button-add-future-client"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Cliente Futuro
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {selectedSalesperson === 'all' && (
                    <TooltipContent>
                      <p>Selecciona un vendedor específico para agregar clientes futuros</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Frecuencia</TableHead>
                    {showMonthlyView ? (
                      allPeriods.map(period => (
                        <TableHead key={`${period.year}-${period.month}`} className="text-right min-w-[130px]">
                          {period.label}
                          {futureYear === period.year && (
                            <Badge variant="outline" className="ml-1 text-xs">Futuro</Badge>
                          )}
                        </TableHead>
                      ))
                    ) : (
                      allYears.map(year => (
                        <TableHead key={year} className="text-right min-w-[150px]">
                          {year}
                          {futureYear === year && (
                            <Badge variant="outline" className="ml-2">Futuro</Badge>
                          )}
                        </TableHead>
                      ))
                    )}
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
                            {showMonthlyView ? (
                              // MONTHLY VIEW: Show columns for each selected month
                              allPeriods.map((period, periodIndex) => {
                                const monthKey = `${period.year}-${period.month}`;
                                const cellKey = `${client.clientCode}_${period.year}_${period.month}`;
                                const historicalValue = client.monthlyData?.[monthKey] || 0;
                                const projectedValue = client.monthlyProjectedData?.[monthKey] || 0;
                                const currentTotal = historicalValue + projectedValue;
                                const isEditing = cellKey in editingCells;
                                const isFuture = period.year === futureYear;

                                // Calculate percentage vs previous period
                                let percentageChange: number | null = null;
                                if (periodIndex > 0) {
                                  const previousPeriod = allPeriods[periodIndex - 1];
                                  const previousKey = `${previousPeriod.year}-${previousPeriod.month}`;
                                  const previousHistorical = client.monthlyData?.[previousKey] || 0;
                                  const previousProjected = client.monthlyProjectedData?.[previousKey] || 0;
                                  const previousTotal = previousHistorical + previousProjected;
                                  
                                  if (previousTotal > 0 && currentTotal > 0) {
                                    percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
                                  }
                                }

                                if (isFuture) {
                                  // Editable cell for future month
                                  return (
                                    <TableCell key={monthKey} className="text-right">
                                      {isEditing ? (
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="number"
                                            defaultValue={editingCells[cellKey] || projectedValue || ''}
                                            onChange={(e) => handleCellEdit(client.clientCode, period.year, e.target.value, period.month)}
                                            className="w-full text-sm"
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
                                                period.year,
                                                value,
                                                period.month
                                              );
                                            }}
                                          >
                                            <Save className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            if (selectedSalesperson === 'all' || !selectedSalesperson) {
                                              toast({
                                                title: 'Error',
                                                description: 'Debes seleccionar un vendedor específico para editar proyecciones',
                                                variant: 'destructive'
                                              });
                                              return;
                                            }
                                            setEditingCells({ ...editingCells, [cellKey]: projectedValue });
                                          }}
                                          className="w-full text-right hover:bg-accent rounded p-1 cursor-pointer"
                                        >
                                          {projectedValue > 0 ? (
                                            <div className="flex flex-col items-end">
                                              <span className="text-blue-600 font-semibold text-sm">
                                                {formatCurrency(projectedValue)}
                                              </span>
                                              {percentageChange !== null && (
                                                <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                          )}
                                        </button>
                                      )}
                                    </TableCell>
                                  );
                                } else {
                                  // Historical monthly data (read-only)
                                  return (
                                    <TableCell key={monthKey} className="text-right">
                                      {historicalValue > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-sm">{formatCurrency(historicalValue)}</span>
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
                              })
                            ) : (
                              // YEARLY VIEW: Show columns for each year
                              allYears.map((year, yearIndex) => {
                                const cellKey = `${client.clientCode}_${year}`;
                                const isFuture = year === futureYear;

                                // ALWAYS calculate total from monthly data (historical + projected)
                                const monthlyHistoricalTotal = MONTHS.reduce((sum, month) => {
                                  const monthKey = `${year}-${month.value}`;
                                  return sum + (client.monthlyData?.[monthKey] || 0);
                                }, 0);

                                const monthlyProjectedTotal = MONTHS.reduce((sum, month) => {
                                  const monthKey = `${year}-${month.value}`;
                                  return sum + (client.monthlyProjectedData?.[monthKey] || 0);
                                }, 0);

                                // Total for this year (sum of all 12 months historical + projected)
                                const currentTotal = monthlyHistoricalTotal + monthlyProjectedTotal;
                                
                                // Calculate percentage vs previous year
                                let percentageChange: number | null = null;
                                if (yearIndex > 0) {
                                  const previousYear = allYears[yearIndex - 1];
                                  
                                  // Calculate previous year total from monthly data
                                  const prevMonthlyHistorical = MONTHS.reduce((sum, month) => {
                                    const monthKey = `${previousYear}-${month.value}`;
                                    return sum + (client.monthlyData?.[monthKey] || 0);
                                  }, 0);

                                  const prevMonthlyProjected = MONTHS.reduce((sum, month) => {
                                    const monthKey = `${previousYear}-${month.value}`;
                                    return sum + (client.monthlyProjectedData?.[monthKey] || 0);
                                  }, 0);

                                  const previousTotal = prevMonthlyHistorical + prevMonthlyProjected;
                                  
                                  if (previousTotal > 0 && currentTotal > 0) {
                                    percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
                                  }
                                }

                                if (isFuture) {
                                  // Future year: show only projected amount
                                  const displayValue = monthlyProjectedTotal;

                                  // Read-only cell for future year (total calculated from months)
                                  return (
                                    <TableCell key={year} className="text-right bg-muted/20" title={`Total automático: suma de 12 meses`}>
                                      {displayValue > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <div className="flex items-center gap-1">
                                            <span className="text-blue-600 font-semibold">
                                              {formatCurrency(displayValue)}
                                            </span>
                                            <span className="text-xs text-muted-foreground" title="Total automático calculado de 12 meses">∑</span>
                                          </div>
                                          {percentageChange !== null && (
                                            <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                  );
                                } else {
                                  // Historical year: show historical + projected from monthly data
                                  const displayValue = currentTotal;
                                  
                                  return (
                                    <TableCell key={year} className="text-right" title={`Total automático: suma de 12 meses (${formatCurrency(monthlyHistoricalTotal)} histórico + ${formatCurrency(monthlyProjectedTotal)} proyectado)`}>
                                      {displayValue > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <div className="flex items-center gap-1">
                                            <span>{formatCurrency(displayValue)}</span>
                                            {monthlyProjectedTotal > 0 && (
                                              <span className="text-xs text-muted-foreground" title="Incluye proyecciones">∑</span>
                                            )}
                                          </div>
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
                              })
                            )}
                            </TableRow>
                            
                            {/* Monthly breakdown rows when expanded */}
                            {isExpanded && (
                              <>
                                {MONTHS.filter(month => {
                                  // If no filter, show all months
                                  if (selectedMonths.length === 0) return true;
                                  
                                  // If month is in filter, show it
                                  if (selectedMonths.includes(month.value)) return true;
                                  
                                  // If month has any data (historical or projected) in any year, show it
                                  const hasData = allYears.some(year => {
                                    const monthKey = `${year}-${month.value}`;
                                    const hasHistorical = (client.monthlyData?.[monthKey] || 0) > 0;
                                    const hasProjected = (client.monthlyProjectedData?.[monthKey] || 0) > 0;
                                    return hasHistorical || hasProjected;
                                  });
                                  
                                  return hasData;
                                }).map(month => {
                                  const monthNum = month.value;
                                  const monthLabel = month.label;
                                  
                                  return (
                                    <TableRow key={`${client.clientCode}-month-${monthNum}`} className="bg-muted/30">
                                      <TableCell className="sticky left-0 bg-muted/30 z-10 pl-12 text-sm text-muted-foreground">
                                        {monthLabel}
                                      </TableCell>
                                      <TableCell colSpan={2}></TableCell>
                                      {allYears.map((year, monthYearIndex) => {
                                        const monthKey = `${year}-${monthNum}`;
                                        const cellKey = `${client.clientCode}_${year}_${monthNum}`;
                                        const monthlyValue = client.monthlyData?.[monthKey] || 0;
                                        const monthlyProjectedValue = client.monthlyProjectedData?.[monthKey] || 0;
                                        const currentTotal = monthlyValue + monthlyProjectedValue;
                                        const isEditingMonth = cellKey in editingCells;
                                        const isFuture = year === futureYear;

                                        // Calculate percentage vs same month previous year
                                        let percentageChange: number | null = null;
                                        if (monthYearIndex > 0) {
                                          const previousYear = allYears[monthYearIndex - 1];
                                          const previousKey = `${previousYear}-${monthNum}`;
                                          const previousMonthly = client.monthlyData?.[previousKey] || 0;
                                          const previousProjected = client.monthlyProjectedData?.[previousKey] || 0;
                                          const previousTotal = previousMonthly + previousProjected;
                                          
                                          if (previousTotal > 0 && currentTotal > 0) {
                                            percentageChange = ((currentTotal - previousTotal) / previousTotal) * 100;
                                          }
                                        }
                                        
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
                                                  onClick={() => {
                                                    if (selectedSalesperson === 'all' || !selectedSalesperson) {
                                                      toast({
                                                        title: 'Error',
                                                        description: 'Debes seleccionar un vendedor específico para editar proyecciones',
                                                        variant: 'destructive'
                                                      });
                                                      return;
                                                    }
                                                    setEditingCells({ ...editingCells, [cellKey]: monthlyProjectedValue });
                                                  }}
                                                  className="w-full text-right hover:bg-accent rounded p-1 cursor-pointer"
                                                >
                                                  {monthlyProjectedValue > 0 ? (
                                                    <div className="flex flex-col items-end">
                                                      <span className="text-blue-600 font-semibold text-sm">
                                                        {formatCurrency(monthlyProjectedValue)}
                                                      </span>
                                                      {percentageChange !== null && (
                                                        <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                          {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                                        </span>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                  )}
                                                </button>
                                              )}
                                            </TableCell>
                                          );
                                        } else {
                                          // Historical monthly data (read-only)
                                          return (
                                            <TableCell key={year} className="text-right text-sm">
                                              {monthlyValue > 0 ? (
                                                <div className="flex flex-col items-end">
                                                  <span className="text-muted-foreground">{formatCurrency(monthlyValue)}</span>
                                                  {percentageChange !== null && (
                                                    <span className={`text-xs ${percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                      {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}%
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
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
                        {showMonthlyView ? (
                          allPeriods.map(period => (
                            <TableCell key={`${period.year}-${period.month}`} className="text-right">
                              {formatCurrency(totalRow[`${period.year}-${period.month}`] || 0)}
                            </TableCell>
                          ))
                        ) : (
                          allYears.map(year => (
                            <TableCell key={year} className="text-right">
                              {formatCurrency(totalRow[year] || 0)}
                            </TableCell>
                          ))
                        )}
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

      {/* Add Future Client Dialog */}
      <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
        <DialogContent data-testid="dialog-add-future-client">
          <DialogHeader>
            <DialogTitle>Agregar Cliente Futuro</DialogTitle>
            <DialogDescription>
              Crea un cliente ficticio para proyectar ventas futuras. El cliente aparecerá en la tabla y podrás ingresar proyecciones mensuales.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-client-name">Nombre del Cliente</Label>
              <Input
                id="new-client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Ej: Empresa Constructora ABC"
                data-testid="input-new-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-segment">Segmento</Label>
              <Select value={newClientSegment} onValueChange={setNewClientSegment}>
                <SelectTrigger id="new-client-segment" data-testid="select-new-client-segment">
                  <SelectValue placeholder="Selecciona un segmento" />
                </SelectTrigger>
                <SelectContent>
                  {segmentsData.map(seg => (
                    <SelectItem key={seg.code} value={seg.code}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSalesperson === 'all' && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Debes seleccionar un vendedor específico antes de agregar un cliente futuro.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddClientDialog(false);
                setNewClientName("");
                setNewClientSegment("");
              }}
              data-testid="button-cancel-add-client"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                addFutureClientMutation.mutate({
                  clientName: newClientName,
                  segment: newClientSegment
                });
              }}
              disabled={addFutureClientMutation.isPending || selectedSalesperson === 'all' || !newClientName.trim() || !newClientSegment}
              data-testid="button-save-add-client"
            >
              {addFutureClientMutation.isPending ? 'Guardando...' : 'Agregar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
