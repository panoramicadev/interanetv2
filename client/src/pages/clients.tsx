import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Search, Users, CreditCard, TrendingUp, MapPin, Phone, Mail, Upload, FileDown, Eye, X, User, Building2, Calendar, Filter, RotateCcw, Plus, ShoppingCart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";

interface Client {
  id: string;
  koen: string | null;
  nokoen: string;
  rten: string | null;
  email: string | null;
  foen: string | null;
  dien: string | null;
  crlt: string | null;
  cren: string | null;
  crsd: string | null;
  gien: string | null;
  sien: string | null;
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
  const { user } = useAuth();
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
  
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nokoen: "",
    koen: "",
    rten: "",
    email: "",
    foen: "",
    dien: "",
  });
  
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [selectedCreditStatus, setSelectedCreditStatus] = useState<string>("");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("");
  const [selectedDebtStatus, setSelectedDebtStatus] = useState<string>("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");
  
  const [filterBySales, setFilterBySales] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState<string>("today");
  
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [localSelectedSegment, setLocalSelectedSegment] = useState(selectedSegment);
  const [localSelectedSalesperson, setLocalSelectedSalesperson] = useState(selectedSalesperson);
  const [localSelectedCreditStatus, setLocalSelectedCreditStatus] = useState(selectedCreditStatus);
  const [localSelectedBusinessType, setLocalSelectedBusinessType] = useState(selectedBusinessType);
  const [localSelectedDebtStatus, setLocalSelectedDebtStatus] = useState(selectedDebtStatus);
  const [localSelectedEntityType, setLocalSelectedEntityType] = useState(selectedEntityType);
  
  const itemsPerPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 600);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (user && user.role === 'salesperson' && 'salespersonName' in user) {
      setSelectedSalesperson(user.salespersonName as string);
    }
  }, [user]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clientsData, isLoading, error } = useQuery({
    queryKey: ['/api/clients', debouncedSearch, currentPage, selectedSegment, selectedSalesperson, selectedCreditStatus, selectedBusinessType, selectedDebtStatus, selectedEntityType, filterBySales, salesPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedSegment) params.set('segment', selectedSegment);
      if (selectedSalesperson) params.set('salesperson', selectedSalesperson);
      if (selectedCreditStatus) params.set('creditStatus', selectedCreditStatus);
      if (selectedBusinessType) params.set('businessType', selectedBusinessType);
      if (selectedDebtStatus) params.set('debtStatus', selectedDebtStatus);
      if (selectedEntityType) params.set('entityType', selectedEntityType);
      if (filterBySales) params.set('salesPeriod', salesPeriod);
      params.set('limit', itemsPerPage.toString());
      params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      const response = await apiRequest(`/api/clients?${params}`);
      return response.json() as Promise<{
        clients: Client[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
    },
  });

  const clients = clientsData?.clients;
  const totalCount = clientsData?.totalCount || 0;

  const { data: segments } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ['/api/goals/data/salespeople'],
  });

  const { data: businessTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/business-types'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: entityTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/entity-types'],
    staleTime: 10 * 60 * 1000,
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
    setFilterBySales(false);
    setSalesPeriod("today");
    setCurrentPage(1);
  }, []);

  const clearLocalFilters = () => {
    setLocalSelectedSegment("");
    setLocalSelectedSalesperson("");
    setLocalSelectedCreditStatus("");
    setLocalSelectedBusinessType("");
    setLocalSelectedDebtStatus("");
    setLocalSelectedEntityType("");
  };

  const handleDrawerOpen = () => {
    setLocalSelectedSegment(selectedSegment);
    setLocalSelectedSalesperson(selectedSalesperson);
    setLocalSelectedCreditStatus(selectedCreditStatus);
    setLocalSelectedBusinessType(selectedBusinessType);
    setLocalSelectedDebtStatus(selectedDebtStatus);
    setLocalSelectedEntityType(selectedEntityType);
    setIsDrawerOpen(true);
  };

  const handleApplyFilters = () => {
    setSelectedSegment(localSelectedSegment);
    setSelectedSalesperson(localSelectedSalesperson);
    setSelectedCreditStatus(localSelectedCreditStatus);
    setSelectedBusinessType(localSelectedBusinessType);
    setSelectedDebtStatus(localSelectedDebtStatus);
    setSelectedEntityType(localSelectedEntityType);
    setCurrentPage(1);
    setIsDrawerOpen(false);
  };

  const hasActiveFilters = selectedSegment || selectedSalesperson || selectedCreditStatus || selectedBusinessType || selectedDebtStatus || selectedEntityType || filterBySales;

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

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsImporting(true);
      setImportProgress("🚀 Iniciando importación súper rápida...");
      
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
      
      // Create abort controller for timeout (10 minutes for large files)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes
      
      try {
        const response = await fetch('/api/clients/import', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json();
          setIsImporting(false);
          setImportProgress("");
          throw new Error(errorData.message || 'Error al importar clientes');
        }
        
        setImportProgress("✅ Importación completada en segundos!");
        return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        setIsImporting(false);
        setImportProgress("");
        
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('La importación tardó demasiado. El archivo puede ser muy grande. Intenta con un archivo más pequeño.');
        }
        throw error;
      }
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

  const createClientMutation = useMutation({
    mutationFn: async (clientData: typeof newClientData) => {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear cliente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients/search'] });
      setIsNewClientModalOpen(false);
      setNewClientData({
        nokoen: "",
        koen: "",
        rten: "",
        email: "",
        foen: "",
        dien: "",
      });
    },
    onError: (error) => {
      console.error('Error creating client:', error);
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

  const handleCreateClient = () => {
    if (!newClientData.nokoen.trim()) {
      return;
    }
    createClientMutation.mutate(newClientData);
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

  const generateSummaryChips = () => {
    const chips = [];
    if (selectedSegment) chips.push({ label: 'Segmento', value: selectedSegment });
    if (selectedSalesperson) chips.push({ label: 'Vendedor', value: selectedSalesperson });
    if (selectedCreditStatus) chips.push({ label: 'Crédito', value: selectedCreditStatus });
    if (selectedBusinessType) chips.push({ label: 'Negocio', value: selectedBusinessType });
    if (selectedDebtStatus) chips.push({ label: 'Deuda', value: selectedDebtStatus === 'con_deuda' ? 'Con Deuda' : 'Sin Deuda' });
    if (selectedEntityType) chips.push({ label: 'Entidad', value: selectedEntityType });
    return chips;
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
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200/60 px-3 sm:px-4 lg:px-6 py-4 rounded-2xl shadow-sm">
        {/* Title and Actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Gestión de Clientes
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount} clientes registrados
            </p>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center gap-2 ml-4">
            <Button 
              variant="outline" 
              onClick={downloadTemplate} 
              data-testid="button-download-template" 
              size="sm"
              className="rounded-xl border-gray-200 shadow-sm"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Plantilla
            </Button>
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
              size="sm"
              className="rounded-xl shadow-sm"
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar
            </Button>
            <Button 
              onClick={() => setIsNewClientModalOpen(true)}
              data-testid="button-new-client"
              size="sm"
              className="rounded-xl shadow-sm bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="flex sm:hidden gap-2 mb-4">
          <Button 
            variant="outline" 
            onClick={downloadTemplate} 
            data-testid="button-download-template-mobile" 
            size="sm"
            className="flex-1 rounded-xl border-gray-200 shadow-sm text-xs"
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            Plantilla
          </Button>
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={previewMutation.isPending || isImporting}
            data-testid="button-import-clients-mobile"
            size="sm"
            className="flex-1 rounded-xl shadow-sm text-xs"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            Importar
          </Button>
          <Button 
            onClick={() => setIsNewClientModalOpen(true)}
            data-testid="button-new-client-mobile"
            size="sm"
            className="flex-1 rounded-xl shadow-sm text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo
          </Button>
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

      {/* Search and Mobile Filter Button */}
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

          {/* Sales Period Filter */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Checkbox
                id="filter-sales"
                checked={filterBySales}
                onCheckedChange={(checked) => {
                  setFilterBySales(checked === true);
                  setCurrentPage(1);
                }}
                data-testid="checkbox-filter-sales"
              />
              <label 
                htmlFor="filter-sales" 
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-1.5"
              >
                <ShoppingCart className="h-4 w-4 text-green-600" />
                Con ventas en:
              </label>
            </div>
            
            <Select
              value={salesPeriod}
              onValueChange={(value) => {
                setSalesPeriod(value);
                if (filterBySales) setCurrentPage(1);
              }}
              disabled={!filterBySales}
            >
              <SelectTrigger 
                className={`w-[140px] h-9 ${!filterBySales ? 'opacity-50' : ''}`}
                data-testid="select-sales-period"
              >
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="this_week">Esta semana</SelectItem>
                <SelectItem value="last_week">Semana pasada</SelectItem>
                <SelectItem value="this_month">Este mes</SelectItem>
                <SelectItem value="last_month">Mes pasado</SelectItem>
                <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
                <SelectItem value="last_90_days">Últimos 90 días</SelectItem>
                <SelectItem value="this_year">Este año</SelectItem>
              </SelectContent>
            </Select>

            {filterBySales && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Filtro activo
              </Badge>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Mobile: Client Cards */}
      <div className="block sm:hidden space-y-3">
        {clients?.map((client) => {
          const creditStatus = getCreditStatus(client.cren, client.crlt, client.crsd);
          
          return (
            <Card 
              key={client.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => window.location.href = `/client/${encodeURIComponent(client.nokoen)}`}
              data-testid={`card-client-${client.id}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header: Name and Status */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                      {client.nokoen}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Código: {client.koen || "N/A"}
                    </p>
                    {client.rten && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        RUT: {client.rten}
                      </p>
                    )}
                  </div>
                  <Badge className={`${creditStatus.color} text-white text-xs shrink-0`}>
                    {creditStatus.text}
                  </Badge>
                </div>

                {/* Business Type */}
                {client.gien && (
                  <div className="flex items-center text-xs text-gray-600">
                    <Building2 className="h-3 w-3 mr-1.5 text-gray-400" />
                    {client.gien}
                  </div>
                )}

                <Separator />

                {/* Credit Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Límite</p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(client.crlt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Disponible</p>
                    <p className="text-sm font-semibold text-blue-600">
                      {formatCurrency(client.cren)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Sales Info */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Total Ventas</p>
                    <p className="text-sm font-semibold text-indigo-600">
                      {formatCurrency(client.totalSales || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Transacciones</p>
                    <p className="text-sm font-semibold text-purple-600">
                      {client.totalTransactions || 0}
                    </p>
                  </div>
                </div>

                {/* Contact Info */}
                {(client.email || client.foen) && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center text-xs text-gray-600">
                          <Mail className="h-3 w-3 mr-1.5 text-gray-400" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.foen && (
                        <div className="flex items-center text-xs text-gray-600">
                          <Phone className="h-3 w-3 mr-1.5 text-gray-400" />
                          {client.foen}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop: Clients Table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">RUT</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="font-semibold">Crédito</TableHead>
                  <TableHead className="font-semibold">Ventas</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold w-20">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client) => {
                  const creditStatus = getCreditStatus(client.cren, client.crlt, client.crsd);
                  
                  return (
                    <TableRow 
                      key={client.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" 
                      onClick={() => window.location.href = `/client/${encodeURIComponent(client.nokoen)}`}
                      data-testid={`row-client-${client.id}`}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {client.nokoen}
                          </div>
                          <div className="text-sm text-gray-500">
                            Código: {client.koen || "N/A"}
                          </div>
                          {client.gien && (
                            <div className="text-xs text-gray-400 mt-1">
                              {client.gien}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
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
                      
                      <TableCell>
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500">Límite: </span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(client.crlt)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Disponible: </span>
                            <span className="font-semibold text-blue-600">
                              {formatCurrency(client.cren)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-500">Total: </span>
                            <span className="font-semibold text-indigo-600">
                              {formatCurrency(client.totalSales || 0)}
                            </span>
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
                      
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link href={`/client/${encodeURIComponent(client.nokoen)}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            data-testid={`button-view-client-${client.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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

      {/* New Client Modal */}
      <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center">
              <Plus className="h-5 w-5 mr-2 text-green-600" />
              Nuevo Cliente
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={newClientData.nokoen}
                onChange={(e) => setNewClientData({ ...newClientData, nokoen: e.target.value })}
                placeholder="Nombre del cliente"
                className="mt-1"
                data-testid="input-client-name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Código de Cliente
              </label>
              <Input
                value={newClientData.koen}
                onChange={(e) => setNewClientData({ ...newClientData, koen: e.target.value })}
                placeholder="Código único del cliente"
                className="mt-1"
                data-testid="input-client-code"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                RUT
              </label>
              <Input
                value={newClientData.rten}
                onChange={(e) => setNewClientData({ ...newClientData, rten: e.target.value })}
                placeholder="12.345.678-9"
                className="mt-1"
                data-testid="input-client-rut"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <Input
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="mt-1"
                data-testid="input-client-email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Teléfono
              </label>
              <Input
                value={newClientData.foen}
                onChange={(e) => setNewClientData({ ...newClientData, foen: e.target.value })}
                placeholder="+56 9 1234 5678"
                className="mt-1"
                data-testid="input-client-phone"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Dirección
              </label>
              <Input
                value={newClientData.dien}
                onChange={(e) => setNewClientData({ ...newClientData, dien: e.target.value })}
                placeholder="Dirección completa"
                className="mt-1"
                data-testid="input-client-address"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsNewClientModalOpen(false);
                setNewClientData({
                  nokoen: "",
                  koen: "",
                  rten: "",
                  email: "",
                  foen: "",
                  dien: "",
                });
              }}
              data-testid="button-cancel-new-client"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateClient}
              disabled={!newClientData.nokoen.trim() || createClientMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-save-new-client"
            >
              {createClientMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Cliente
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
