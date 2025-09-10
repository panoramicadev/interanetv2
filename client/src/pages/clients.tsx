import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, CreditCard, TrendingUp, MapPin, Phone, Mail, Upload, FileDown } from "lucide-react";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const itemsPerPage = 20;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['/api/clients', search, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', itemsPerPage.toString());
      params.set('offset', ((currentPage - 1) * itemsPerPage).toString());
      
      const response = await fetch(`/api/clients?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }
      return response.json() as Promise<Client[]>;
    },
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
  };

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
    <div className="space-y-6" data-testid="clients-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Clientes</h1>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="text-sm">
            {clients?.length || 0} clientes
          </Badge>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
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
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients?.map((client) => {
          const creditStatus = getCreditStatus(client.cren, client.crlt, client.crsd);
          
          return (
            <Card key={client.id} className="hover:shadow-lg transition-shadow" data-testid={`card-client-${client.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                    {client.nokoen}
                  </CardTitle>
                  <Badge className={`${creditStatus.color} text-white text-xs`}>
                    {creditStatus.text}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Código: {client.koen || "N/A"}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Basic Info */}
                <div className="space-y-2">
                  {client.rten && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CreditCard className="h-4 w-4 mr-2" />
                      RUT: {client.rten}
                    </div>
                  )}
                  
                  {client.gien && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {client.gien}
                    </div>
                  )}
                  
                  {client.dien && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 mr-2" />
                      {client.dien.length > 40 ? client.dien.substring(0, 40) + "..." : client.dien}
                    </div>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-1">
                  {client.email && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4 mr-2" />
                      {client.email}
                    </div>
                  )}
                  
                  {client.foen && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4 mr-2" />
                      {client.foen}
                    </div>
                  )}
                </div>

                {/* Credit Info */}
                <div className="border-t pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Límite de crédito:</span>
                      <div className="font-semibold text-green-600">
                        {formatCurrency(client.crlt)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Crédito disponible:</span>
                      <div className="font-semibold text-blue-600">
                        {formatCurrency(client.cren)}
                      </div>
                    </div>
                  </div>
                  
                  {client.crsd && parseFloat(client.crsd) > 0 && (
                    <div className="text-sm">
                      <span className="text-gray-500">Deuda:</span>
                      <div className="font-semibold text-red-600">
                        {formatCurrency(client.crsd)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction Stats */}
                <div className="border-t pt-3 space-y-1">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Total ventas:</span>
                      <div className="font-semibold text-indigo-600">
                        {formatCurrency(client.totalSales || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Transacciones:</span>
                      <div className="font-semibold">
                        {client.totalTransactions || 0}
                      </div>
                    </div>
                  </div>
                  
                  {client.lastTransactionDate && (
                    <div className="text-sm">
                      <span className="text-gray-500">Última compra:</span>
                      <div className="font-medium">
                        {formatDate(client.lastTransactionDate)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t pt-3">
                  <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-client-${client.id}`}>
                    Ver detalles
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
    </div>
  );
}