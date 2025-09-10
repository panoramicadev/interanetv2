import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, CreditCard, TrendingUp, MapPin, Phone, Mail, Upload, FileDown, Eye, X, User, Building2, Calendar, Filter, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Client {
  id: string;
  koen: string | null;
  nokoen: string;
  rten: string | null;
  email: string | null;
  foen: string | null;
  dien: string | null;
  crlt: string | null; // Credit limit
  cren: string | null; // Available credit
  crsd: string | null; // Credit balance/debt
  gien: string | null; // Business type
  sien: string | null; // Industry sector
  totalTransactions?: number;
  totalSales?: number;
  lastTransactionDate?: string;
}

const formatCurrency = (amount: string | number | null) => {
  if (!amount) return "CLP $0";
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(numAmount);
};

const formatDate = (date: string | null) => {
  if (!date) return "Sin datos";
  return new Date(date).toLocaleDateString('es-CL');
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  
  // Filter states
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [selectedCreditStatus, setSelectedCreditStatus] = useState<string>("");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("");
  const [selectedDebtStatus, setSelectedDebtStatus] = useState<string>("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");
  
  const itemsPerPage = 20;

  // Debounce search input - wait 600ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page when searching
    }, 600);

    return () => clearTimeout(timer);
  }, [search]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['/api/clients', debouncedSearch, currentPage, selectedSegment, selectedSalesperson, selectedCreditStatus, selectedBusinessType, selectedDebtStatus, selectedEntityType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedSegment) params.set('segment', selectedSegment);
      if (selectedSalesperson) params.set('salesperson', selectedSalesperson);
      if (selectedCreditStatus) params.set('creditStatus', selectedCreditStatus);
      if (selectedBusinessType) params.set('businessType', selectedBusinessType);
      if (selectedDebtStatus) params.set('debtStatus', selectedDebtStatus);
      if (selectedEntityType) params.set('entityType', selectedEntityType);
      params.set('limit', itemsPerPage.toString());
      params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      const response = await fetch(`/api/clients?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }
      return response.json() as Promise<Client[]>;
    },
  });

  // Fetch filter data
  const { data: segments } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ['/api/goals/data/salespeople'],
  });

  const { data: businessTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/business-types'],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes since business types don't change often
  });

  const { data: entityTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/entity-types'],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes since entity types don't change often
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const openClientDetails = useCallback((client: Client) => {
    setSelectedClient(client);
    setIsClientModalOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedSegment("");
    setSelectedSalesperson("");
    setSelectedCreditStatus("");
    setSelectedBusinessType("");
    setSelectedDebtStatus("");
    setSelectedEntityType("");
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = selectedSegment || selectedSalesperson || selectedCreditStatus || selectedBusinessType || selectedDebtStatus || selectedEntityType;

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/clients/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar el archivo');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data.preview);
      setShowImportPreview(true);
      toast({
        title: "Archivo procesado",
        description: `${data.preview.totalClients} clientes listos para importar`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar el archivo",
        variant: "destructive",
      });
    }
  });

  // Import mutation with progress tracking
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsImporting(true);
      setImportProgress("🚀 Iniciando importación súper rápida...");
      
      // Show progress toast
      toast({
        title: "Importando clientes",
        description: "Procesando archivo con nueva tecnología optimizada...",
      });
      
      setTimeout(() => {
        setImportProgress("📋 Analizando duplicados en memoria...");
      }, 500);
      
      setTimeout(() => {
        setImportProgress("⚡ Procesando en lotes de 500 clientes...");
      }, 1000);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/clients/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        setIsImporting(false);
        setImportProgress("");
        throw new Error(errorData.message || 'Error al importar clientes');
      }
      
      setImportProgress("✅ Importación completada en segundos!");
      return response.json();
    },
    onSuccess: (data) => {
      setIsImporting(false);
      setImportProgress("");
      
      const { inserted, updated, skipped } = data;
      const total = (inserted || 0) + (updated || 0);
      
      toast({
        title: "🎉 ¡Importación súper rápida completada!",
        description: `${total} clientes procesados: ${inserted || 0} nuevos, ${updated || 0} actualizados${skipped ? `, ${skipped} errores` : ''}`,
        duration: 5000,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setSelectedFile(null);
      setShowImportPreview(false);
      setPreviewData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      setIsImporting(false);
      setImportProgress("");
      
      toast({
        title: "❌ Error en la importación",
        description: error instanceof Error ? error.message : "Error al importar clientes",
        variant: "destructive",
        duration: 7000,
      });
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      previewMutation.mutate(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const downloadTemplate = () => {
    const csvContent = `KOEN;NOKOEN;RTEN;EMAIL;CRLT;CREN;CRSD;SIEN;GIEN;DIEN;FOEN;COMUNA;PROVINCIA
45;DISTRIBUIDORA PORTLAND S.A.;87.690.900-6;dteprod@pjportland.cl;0;0;0;Dist. Prod. Químicos y materias Primas;Distribuidor;Miraflores 222 Piso 15;+56912345678;SANTIAGO;METROPOLITANA`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_clientes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCreditStatus = (available: string | null, limit: string | null, debt: string | null) => {
    if (!limit) return { status: "sin-limite", text: "Sin límite", color: "bg-gray-500" };
    
    const availableNum = available ? parseFloat(available) : 0;
    const limitNum = parseFloat(limit);
    const debtNum = debt ? parseFloat(debt) : 0;
    
    const usagePercentage = ((limitNum - availableNum) / limitNum) * 100;
    
    if (debtNum > 0) return { status: "con-deuda", text: "Con deuda", color: "bg-red-500" };
    if (usagePercentage > 80) return { status: "limite-alto", text: "Límite alto", color: "bg-orange-500" };
    if (usagePercentage > 50) return { status: "limite-medio", text: "Uso moderado", color: "bg-yellow-500" };
    return { status: "limite-bajo", text: "Buen estado", color: "bg-green-500" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Cargando clientes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-2">Error al cargar clientes</p>
          <p className="text-gray-600">Por favor, intenta nuevamente más tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-3 sm:m-4 space-y-6" data-testid="clients-page">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200/60 px-4 lg:px-6 py-4 lg:py-6 rounded-2xl shadow-sm">
        <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Gestión de Clientes</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {clients?.length || 0} clientes registrados
              </p>
            </div>
          </div>
          <div className="flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:space-x-3">
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <FileDown className="h-4 w-4 mr-2" />
              Plantilla CSV
            </Button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-clients"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={previewMutation.isPending || isImporting}
                data-testid="button-import-clients"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Importar CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Preview */}
      {showImportPreview && previewData && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Vista Previa de Importación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{previewData.totalClients}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Clientes en CSV</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{previewData.wouldInsert}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Nuevos</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{previewData.wouldUpdate}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Actualizaciones</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{previewData.existingClients}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Existentes</div>
              </div>
            </div>
            
            {previewData.sampleData && previewData.sampleData.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Muestra de datos:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {previewData.sampleData.map((client: any, index: number) => (
                    <div key={index} className="text-sm bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="font-medium">{client.nokoen}</span>
                      {client.rten && <span className="text-gray-600 ml-2">({client.rten})</span>}
                      {client.email && <span className="text-gray-600 ml-2">{client.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Progress indicator */}
            {isImporting && importProgress && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                  <span className="text-blue-800 font-medium" data-testid="text-import-progress">
                    {importProgress}
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <Button 
                onClick={handleImport} 
                disabled={isImporting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-confirm-import"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isImporting ? "Procesando..." : "Confirmar Importación"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowImportPreview(false);
                  setSelectedFile(null);
                  setPreviewData(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                data-testid="button-cancel-import"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre, RUT o código del cliente..."
              className="pl-10"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="input-search-clients"
            />
            {search && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="text-xs text-gray-400">
                  {search !== debouncedSearch ? "Escribiendo..." : ""}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-3 items-start lg:items-center">
            <div className="flex items-center gap-2 col-span-full lg:col-span-1">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
            </div>

            <Select value={selectedSegment} onValueChange={(value) => {
              setSelectedSegment(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-segment-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-segment">
                <SelectValue placeholder="Todos los segmentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los segmentos</SelectItem>
                {segments?.map((segment) => (
                  <SelectItem key={segment} value={segment}>
                    {segment}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSalesperson} onValueChange={(value) => {
              setSelectedSalesperson(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-salesperson-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-salesperson">
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {salespeople?.map((salesperson) => (
                  <SelectItem key={salesperson} value={salesperson}>
                    {salesperson}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCreditStatus} onValueChange={(value) => {
              setSelectedCreditStatus(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-credit-status-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-credit-status">
                <SelectValue placeholder="Estado de crédito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="excellent">Excelente</SelectItem>
                <SelectItem value="good">Bueno</SelectItem>
                <SelectItem value="limited">Limitado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedBusinessType} onValueChange={(value) => {
              setSelectedBusinessType(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-business-type-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-business-type">
                <SelectValue placeholder="Tipo de negocio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {businessTypes?.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedDebtStatus} onValueChange={(value) => {
              setSelectedDebtStatus(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-debt-status-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-debt-status">
                <SelectValue placeholder="Estado de deuda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="con_deuda">Con Deuda</SelectItem>
                <SelectItem value="sin_deuda">Sin Deuda</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedEntityType} onValueChange={(value) => {
              setSelectedEntityType(value === "all" ? "" : value);
              setCurrentPage(1);
            }} data-testid="select-entity-type-filter">
              <SelectTrigger className="w-full sm:w-48" data-testid="select-entity-type">
                <SelectValue placeholder="Tipo de entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {entityTypes?.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="flex items-center gap-2"
                data-testid="button-clear-filters"
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <div className="font-medium mb-2">Filtros activos:</div>
              <div className="flex flex-wrap gap-2">
                {[
                  ...(selectedSegment ? [{ label: 'Segmento', value: selectedSegment }] : []),
                  ...(selectedSalesperson ? [{ label: 'Vendedor', value: selectedSalesperson }] : []),
                  ...(selectedCreditStatus ? [{ label: 'Crédito', value: selectedCreditStatus }] : []),
                  ...(selectedBusinessType ? [{ label: 'Negocio', value: selectedBusinessType }] : []),
                  ...(selectedDebtStatus ? [{ label: 'Deuda', value: selectedDebtStatus === 'con_deuda' ? 'Con Deuda' : 'Sin Deuda' }] : []),
                  ...(selectedEntityType ? [{ label: 'Entidad', value: selectedEntityType }] : [])
                ].map((filter, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    <span className="font-medium">{filter.label}:</span>
                    <span className="ml-1">{filter.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clients List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold min-w-[200px] sm:min-w-0">Cliente</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">RUT</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="font-semibold min-w-[120px] sm:min-w-0">Crédito</TableHead>
                  <TableHead className="font-semibold min-w-[100px] sm:min-w-0">Ventas</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold w-20">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client) => {
                  const creditStatus = getCreditStatus(client.cren, client.crlt, client.crsd);
                  
                  return (
                    <TableRow key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`row-client-${client.id}`}>
                      <TableCell className="font-medium min-w-[200px] sm:min-w-0">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {client.nokoen}
                          </div>
                          <div className="text-sm text-gray-500">
                            Código: {client.koen || "N/A"}
                          </div>
                          <div className="text-xs text-gray-400 sm:hidden mt-1">
                            RUT: {client.rten || "N/A"}
                          </div>
                          {client.gien && (
                            <div className="text-xs text-gray-400 mt-1">
                              {client.gien}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm">
                          {client.rten || "N/A"}
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <Mail className="h-3 w-3 mr-1" />
                              <span className="truncate max-w-[150px]">{client.email}</span>
                            </div>
                          )}
                          {client.foen && (
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <Phone className="h-3 w-3 mr-1" />
                              {client.foen}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="min-w-[120px] sm:min-w-0">
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500 hidden sm:inline">Límite:</span>
                            <div className="font-semibold text-green-600">
                              {formatCurrency(client.crlt)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 hidden sm:inline">Disponible:</span>
                            <div className="font-semibold text-blue-600">
                              {formatCurrency(client.cren)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="min-w-[100px] sm:min-w-0">
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500 hidden sm:inline">Total:</span>
                            <div className="font-semibold text-indigo-600">
                              {formatCurrency(client.totalSales || 0)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {client.totalTransactions || 0} transacciones
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={`${creditStatus.color} text-white text-xs`}>
                          {creditStatus.text}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => openClientDetails(client)}
                          data-testid={`button-view-client-${client.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {clients?.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {search ? "No se encontraron clientes" : "No hay clientes disponibles"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {search 
              ? `No hay clientes que coincidan con "${search}"`
              : "Los clientes aparecerán aquí una vez que sean importados"
            }
          </p>
        </div>
      )}

      {/* Pagination */}
      {clients && clients.length >= itemsPerPage && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            Anterior
          </Button>
          <span className="flex items-center px-4 py-2 text-sm text-gray-600">
            Página {currentPage}
          </span>
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={clients.length < itemsPerPage}
            data-testid="button-next-page"
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Client Details Modal */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-primary" />
              <span>Detalles del Cliente</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Building2 className="h-4 w-4" />
                      <span>Información Básica</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nombre del Cliente</label>
                      <p className="text-lg font-semibold">{selectedClient.nokoen}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Código Cliente</label>
                      <p className="font-medium">{selectedClient.koen || "N/A"}</p>
                    </div>
                    {selectedClient.rten && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">RUT</label>
                        <p className="font-medium">{selectedClient.rten}</p>
                      </div>
                    )}
                    {selectedClient.gien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Tipo de Negocio</label>
                        <p className="font-medium">{selectedClient.gien}</p>
                      </div>
                    )}
                    {selectedClient.sien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Sector Industrial</label>
                        <p className="font-medium">{selectedClient.sien}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>Información de Contacto</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedClient.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="font-medium flex items-center">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {selectedClient.email}
                        </p>
                      </div>
                    )}
                    {selectedClient.foen && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Teléfono</label>
                        <p className="font-medium flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {selectedClient.foen}
                        </p>
                      </div>
                    )}
                    {selectedClient.dien && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Dirección</label>
                        <p className="font-medium flex items-start">
                          <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                          <span>{selectedClient.dien}</span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Credit Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <CreditCard className="h-4 w-4" />
                    <span>Información de Crédito</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedClient.crlt)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Límite de Crédito</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(selectedClient.cren)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Crédito Disponible</div>
                    </div>
                    {selectedClient.crsd && parseFloat(selectedClient.crsd) > 0 && (
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(selectedClient.crsd)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Deuda Pendiente</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <Badge className={`${getCreditStatus(selectedClient.cren, selectedClient.crlt, selectedClient.crsd).color} text-white`}>
                      {getCreditStatus(selectedClient.cren, selectedClient.crlt, selectedClient.crsd).text}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Sales Statistics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Estadísticas de Ventas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatCurrency(selectedClient.totalSales || 0)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total en Ventas</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedClient.totalTransactions || 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Transacciones</div>
                    </div>
                    {selectedClient.lastTransactionDate && (
                      <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-lg font-bold text-orange-600 flex items-center justify-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(selectedClient.lastTransactionDate)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Última Compra</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}