import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  Search,
  Users,
  CreditCard,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  Upload,
  FileDown,
  Eye,
  X,
  User,
  Building2,
  Calendar,
  Filter,
  RotateCcw,
  Plus,
  ShoppingCart,
  Gift,
  ChevronRight,
  BookOpen,
  MessageSquare,
  Trash2,
  AlertCircle,
  Send
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  crto: string | null;
  cpen: string | null;
  diprve: string | null;
  fevecren: string | null;
  gien: string | null;
  sien: string | null;
  ruen: string | null;
  comuna: string | null;
  provincia: string | null;
  oben: string | null;
  cnen: string | null;
  cnen2: string | null;
  purchasingContactName: string | null;
  totalTransactions?: number;
  totalSales?: number;
  lastTransactionDate?: string;
  salespersonName?: string;
  lastTransactionAmount?: number;
  salesSegment?: string;
}

interface BitacoraEntry {
  id: string;
  documentoTipo: string;
  documentoId: string;
  documentoNumero?: string;
  clienteNombre?: string;
  clienteRut?: string;
  nota: string;
  tipo: string;
  autorId: string;
  autorNombre: string;
  createdAt: string;
  updatedAt: string;
}

const BITACORA_TYPES = [
  { value: "nota", label: "Nota", icon: MessageSquare, color: "bg-gray-100 text-gray-700" },
  { value: "llamada", label: "Llamada", icon: Phone, color: "bg-blue-100 text-blue-700" },
  { value: "visita", label: "Visita", icon: MapPin, color: "bg-green-100 text-green-700" },
  { value: "seguimiento", label: "Seguimiento", icon: BookOpen, color: "bg-purple-100 text-purple-700" },
  { value: "problema", label: "Problema", icon: AlertCircle, color: "bg-red-100 text-red-700" },
];

const getTimeAgo = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const minutes = Math.floor(diffInMs / (1000 * 60));
    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return "ahora";
  } catch {
    return "";
  }
};

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

  // Bitácora state
  const [newBitacoraNota, setNewBitacoraNota] = useState("");
  const [newBitacoraTipo, setNewBitacoraTipo] = useState("nota");

  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nokoen: "",
    koen: "",
    rten: "",
    email: "",
    foen: "",
    dien: "",
    purchasingContactName: "",
  });

  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("");
  const [selectedCreditStatus, setSelectedCreditStatus] = useState<string>("");
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>("");
  const [selectedDebtStatus, setSelectedDebtStatus] = useState<string>("");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");

  const [filterBySales, setFilterBySales] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState<string>("today");
  const activeTab = "clientes";

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

  const { data: clientsData, isLoading, isFetching, error } = useQuery({
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
    placeholderData: keepPreviousData,
  });

  const clients = clientsData?.clients;
  const totalCount = clientsData?.totalCount || 0;
  const totalPages = clientsData?.totalPages || 1;

  const { data: segments } = useQuery<string[]>({
    queryKey: ['/api/goals/data/segments'],
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const { data: salespeople } = useQuery<string[]>({
    queryKey: ['/api/goals/data/salespeople'],
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const { data: businessTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/business-types'],
    staleTime: 10 * 60 * 1000,
  });

  const { data: entityTypes } = useQuery<string[]>({
    queryKey: ['/api/clients/entity-types'],
    staleTime: 10 * 60 * 1000,
  });

  // Bitácora query — loads entries for the selected client by name
  const { data: bitacoraEntries = [], isLoading: bitacoraLoading } = useQuery<BitacoraEntry[]>({
    queryKey: ["/api/bitacora", "cliente", selectedClient?.nokoen],
    queryFn: async () => {
      if (!selectedClient) return [];
      const params = new URLSearchParams({
        documentoTipo: "cliente",
        documentoId: selectedClient.koen || selectedClient.id,
      });
      const response = await fetch(`/api/bitacora?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedClient && isClientModalOpen,
  });

  // Create bitácora entry
  const createBitacoraMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Error al crear entrada");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      setNewBitacoraNota("");
      setNewBitacoraTipo("nota");
      toast({ title: "✅ Entrada agregada a la bitácora" });
    },
    onError: () => {
      toast({ title: "❌ Error al agregar entrada", variant: "destructive" });
    },
  });

  // Delete bitácora entry
  const deleteBitacoraMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/bitacora/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al eliminar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      toast({ title: "Entrada eliminada" });
    },
  });

  const handleAddBitacora = () => {
    if (!selectedClient || !newBitacoraNota.trim()) return;
    createBitacoraMutation.mutate({
      documentoTipo: "cliente",
      documentoId: selectedClient.koen || selectedClient.id,
      documentoNumero: selectedClient.koen || null,
      clienteNombre: selectedClient.nokoen,
      clienteRut: selectedClient.rten || null,
      nota: newBitacoraNota.trim(),
      tipo: newBitacoraTipo,
    });
  };

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const [, setLocation] = useLocation();

  // Open the unified client view (same view used from the dashboard).
  const openClientDetails = useCallback((client: Client) => {
    setLocation(`/client/${encodeURIComponent(client.nokoen)}`);
  }, [setLocation]);

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
        purchasingContactName: "",
      });
    },
    onError: (error) => {
      console.error('Error creating client:', error);
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar cliente');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients/search'] });
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el cliente",
        variant: "destructive",
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

  const getCreditStatus = (client: Client) => {
    const cpen = client.cpen?.trim().toUpperCase() || '';
    const diprve = client.diprve ? parseFloat(client.diprve) : 0;
    const crsd = client.crsd ? parseFloat(client.crsd) : 0;
    const crto = client.crto ? parseFloat(client.crto) : 0;

    // Determine credit type from payment condition
    if (cpen.includes('CREDITO') || diprve > 0) {
      // Client has credit
      const days = diprve > 0 ? diprve : (cpen.match(/(\d+)/) ? parseInt(cpen.match(/(\d+)/)![1]) : 0);
      if (crsd > 0) {
        return { status: "credito-con-deuda", text: `Crédito${days > 0 ? ` ${days}d` : ''} - Con deuda`, color: "bg-orange-500" };
      }
      return { status: "con-credito", text: `Crédito${days > 0 ? ` ${days} días` : ''}`, color: "bg-blue-500" };
    }
    if (cpen.includes('CHEQUE')) {
      return { status: "cheque", text: "Cheque", color: "bg-yellow-500" };
    }
    if (cpen.includes('CONTADO')) {
      return { status: "contado", text: "Contado", color: "bg-slate-500" };
    }
    if (cpen.includes('TRANSFERENCIA')) {
      return { status: "transferencia", text: "Transferencia", color: "bg-slate-400" };
    }
    if (cpen) {
      // Other payment conditions (EFECTIVO, MERCADO LIBRE, etc.)
      return { status: "otro", text: cpen.charAt(0) + cpen.slice(1).toLowerCase(), color: "bg-slate-400" };
    }
    // No data at all — check if they have credit amounts
    if (crto > 0 || crsd > 0) {
      return { status: "con-credito", text: crsd > 0 ? "Con deuda" : "Con crédito", color: crsd > 0 ? "bg-orange-500" : "bg-blue-500" };
    }
    return { status: "sin-datos", text: "Sin datos", color: "bg-gray-400" };
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

  if (isLoading && !clientsData) {
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
    <div className="space-y-8 px-2 md:px-4 pb-8 pt-8" data-testid="clients-page">
      {/* Modern Header with Gradient — matches Products page */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clientes</h1>
            </div>
            <p className="text-slate-300 text-sm md:text-base">
              Administra tu cartera de clientes y accede a beneficios del Market
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "clientes" && (
              <>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Plantilla</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={previewMutation.isPending || isImporting}
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Importar
                </Button>
                <Button
                  onClick={() => setIsNewClientModalOpen(true)}
                  size="sm"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white border-none gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo Cliente</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modern Stat Cards */}
      {!isLoading && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 px-1">
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Total Clientes</p>
                  <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-100">{totalCount.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">Segmentos</p>
                  <p className="text-2xl font-bold mt-1 text-amber-900 dark:text-amber-100">
                    {segments?.length || 0}
                  </p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur-sm">
                  <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clientes Tab Content */}
      {activeTab === "clientes" && (
        <>
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

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              {isFetching ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                type="text"
                placeholder="Buscar por nombre, RUT o código..."
                className="pl-10 h-11 rounded-xl border-muted bg-muted/30 focus:bg-background transition-colors"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-muted rounded-xl">
                <Checkbox
                  id="filter-sales"
                  checked={filterBySales}
                  onCheckedChange={(checked) => {
                    setFilterBySales(checked === true);
                    setCurrentPage(1);
                  }}
                />
                <Label
                  htmlFor="filter-sales"
                  className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <ShoppingCart className="h-3.5 w-3.5 text-indigo-500" />
                  Ventas:
                </Label>
                <Select
                  value={salesPeriod}
                  onValueChange={(value) => {
                    setSalesPeriod(value);
                    if (filterBySales) setCurrentPage(1);
                  }}
                  disabled={!filterBySales}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs border-none bg-transparent focus:ring-0">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="this_week">Esta semana</SelectItem>
                    <SelectItem value="this_month">Este mes</SelectItem>
                    <SelectItem value="last_30_days">Últimos 30 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="h-10 rounded-xl border-muted"
              >
                <RotateCcw className="h-4 w-4 mr-1.5 text-muted-foreground" />
                Limpiar
              </Button>
            </div>
          </div>

          {/* Results summary */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1">
            <Badge variant="outline" className="rounded-lg bg-muted/30 text-foreground/70 border-muted">
              {totalCount} Clientes encontrados
            </Badge>
            {generateSummaryChips().map((chip, idx) => (
              <Badge key={idx} variant="secondary" className="rounded-lg bg-indigo-50 text-indigo-700 border-indigo-100">
                {chip.label}: {chip.value}
              </Badge>
            ))}
          </div>

          {/* Desktop: Clients Table */}
          <Card className="hidden sm:block border-0 shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-[300px] font-semibold text-xs uppercase tracking-wider pl-6">Cliente</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Segmento</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Vendedor</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Última Compra</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-right pr-6">Monto Última Compra</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client) => {
                  const creditStatus = getCreditStatus(client);
                  return (
                    <TableRow
                      key={client.id}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openClientDetails(client)}
                    >
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                            {client.nokoen.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{client.nokoen}</p>
                            <p className="text-xs text-muted-foreground">#{client.koen || "S/C"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                          {client.salesSegment || "SIN SEGMENTO"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-sm text-muted-foreground font-medium">{client.salespersonName || "-"}</p>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          {client.lastTransactionDate
                            ? new Date(client.lastTransactionDate).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <p className="text-sm font-bold text-foreground">
                          {client.lastTransactionAmount ? formatCurrency(client.lastTransactionAmount) : "$0"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right py-4 pr-4">
                        <div className="flex justify-end gap-1">
                          {(!client.totalTransactions || client.totalTransactions === 0) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`¿Estás seguro de eliminar a "${client.nokoen}"?`)) {
                                  deleteClientMutation.mutate(client.id);
                                }
                              }}
                              className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                              title="Eliminar cliente"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <div className="p-2 rounded-lg group-hover:bg-background group-hover:shadow-sm transition-all text-muted-foreground group-hover:text-indigo-600">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {clients?.length === 0 && !isLoading && (
              <div className="text-center py-20">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {search ? "No se encontraron resultados" : "Sin clientes"}
                </h3>
                <p className="text-muted-foreground">
                  {search ? `No hay coincidencias para "${search}"` : "Tu lista de clientes aparecerá aquí."}
                </p>
              </div>
            )}
          </Card>

          {/* Mobile: Client Cards */}
          <div className="sm:hidden space-y-3">
            {clients?.map((client) => {
              const creditStatus = getCreditStatus(client);
              return (
                <Card
                  key={client.id}
                  className="border-0 shadow-sm rounded-xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => openClientDetails(client)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          {client.nokoen.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{client.nokoen}</p>
                          <p className="text-xs text-muted-foreground">#{client.koen}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold border-indigo-200 text-indigo-700 bg-indigo-50">
                        {client.salesSegment || "S/S"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-muted/30">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Vendedor</p>
                        <p className="text-sm text-foreground/70 truncate font-medium">{client.salespersonName || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Última Compra</p>
                        <p className="text-sm text-foreground/70 font-medium">
                          {client.lastTransactionDate
                            ? new Date(client.lastTransactionDate).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : "-"}
                        </p>
                        {client.lastTransactionAmount && (
                          <p className="font-bold text-foreground">{formatCurrency(client.lastTransactionAmount)}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1">
            <p className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando <span className="font-semibold text-foreground">{clients?.length}</span> de <span className="font-semibold text-foreground">{totalCount}</span> clientes
              <span className="hidden sm:inline text-muted-foreground/70 ml-1">
                (página {currentPage} de {totalPages})
              </span>
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="rounded-lg border-muted w-8 h-8 p-0"
                title="Primera página"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="11 17 6 12 11 7"></polyline>
                  <polyline points="18 17 13 12 18 7"></polyline>
                </svg>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="rounded-lg border-muted h-8"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              
              {/* Page numbers */}
              {totalPages <= 7 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`rounded-lg w-8 h-8 p-0 ${currentPage === page ? "bg-indigo-600 hover:bg-indigo-700" : "border-muted"}`}
                  >
                    {page}
                  </Button>
                ))
              ) : (
                <>
                  {currentPage <= 3 ? (
                    <>
                      {[1, 2, 3, 4].map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-lg w-8 h-8 p-0 ${currentPage === page ? "bg-indigo-600 hover:bg-indigo-700" : "border-muted"}`}
                        >
                          {page}
                        </Button>
                      ))}
                      <span className="text-muted-foreground px-1">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="rounded-lg w-8 h-8 p-0 border-muted"
                      >
                        {totalPages}
                      </Button>
                    </>
                  ) : currentPage >= totalPages - 2 ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        className="rounded-lg w-8 h-8 p-0 border-muted"
                      >
                        1
                      </Button>
                      <span className="text-muted-foreground px-1">...</span>
                      {[totalPages - 3, totalPages - 2, totalPages - 1, totalPages].map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-lg w-8 h-8 p-0 ${currentPage === page ? "bg-indigo-600 hover:bg-indigo-700" : "border-muted"}`}
                        >
                          {page}
                        </Button>
                      ))}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        className="rounded-lg w-8 h-8 p-0 border-muted"
                      >
                        1
                      </Button>
                      <span className="text-muted-foreground px-1">...</span>
                      {[currentPage - 1, currentPage, currentPage + 1].map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`rounded-lg w-8 h-8 p-0 ${currentPage === page ? "bg-indigo-600 hover:bg-indigo-700" : "border-muted"}`}
                        >
                          {page}
                        </Button>
                      ))}
                      <span className="text-muted-foreground px-1">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="rounded-lg w-8 h-8 p-0 border-muted"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="rounded-lg border-muted h-8"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="rounded-lg border-muted w-8 h-8 p-0"
                title="Última página"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7"></polyline>
                  <polyline points="6 17 11 12 6 7"></polyline>
                </svg>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Client Details Modal — Full CRM View */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-indigo-500/20">
                {selectedClient?.nokoen?.charAt(0) || "?"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate text-lg">{selectedClient?.nokoen}</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Código: {selectedClient?.koen || "S/C"} {selectedClient?.rten ? `· RUT: ${selectedClient.rten}` : ""}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4 pt-1">
              {/* Grid: Comuna, Región, Método de Pago */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Comuna */}
                <div className="p-3 rounded-xl bg-muted/30 border border-muted/50">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Comuna</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {selectedClient.comuna || "—"}
                  </p>
                </div>
                {/* Región */}
                <div className="p-3 rounded-xl bg-muted/30 border border-muted/50">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Región</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {selectedClient.provincia || "—"}
                  </p>
                </div>
                {/* Método de Pago */}
                <div className="p-3 rounded-xl bg-muted/30 border border-muted/50">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Método de Pago</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {selectedClient.cpen?.trim() || "—"}
                  </p>
                </div>
              </div>

              {/* Anotaciones del Cliente */}
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Anotaciones del Cliente</p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {selectedClient.oben?.trim() || "Sin anotaciones"}
                </p>
              </div>

              {/* Teléfonos de Contacto */}
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-400">Teléfonos de Contacto</p>
                </div>
                <div className="space-y-2">
                  {/* Teléfono principal */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{selectedClient.foen || "Sin teléfono principal"}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedClient.purchasingContactName
                          ? `Encargado: ${selectedClient.purchasingContactName}`
                          : "Contacto principal"}
                      </p>
                    </div>
                    {selectedClient.foen && (
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-50 text-blue-700 border-blue-200">Principal</Badge>
                    )}
                  </div>
                  {/* Contacto 2 (cnen) */}
                  {selectedClient.cnen && (
                    <div className="flex items-center justify-between gap-2 border-t border-blue-100 dark:border-blue-800/30 pt-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{selectedClient.cnen}</p>
                        <p className="text-xs text-muted-foreground">Contacto alternativo</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Secundario</Badge>
                    </div>
                  )}
                  {/* Contacto 3 (cnen2) */}
                  {selectedClient.cnen2 && (
                    <div className="flex items-center justify-between gap-2 border-t border-blue-100 dark:border-blue-800/30 pt-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{selectedClient.cnen2}</p>
                        <p className="text-xs text-muted-foreground">Contacto adicional</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Adicional</Badge>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Bitácora Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-foreground">Bitácora del Cliente</h3>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{bitacoraEntries.length} {bitacoraEntries.length === 1 ? "entrada" : "entradas"}</Badge>
                </div>

                {/* New entry form */}
                <div className="space-y-2 border rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/30 mb-3">
                  <div className="flex items-center gap-2">
                    <Select value={newBitacoraTipo} onValueChange={setNewBitacoraTipo}>
                      <SelectTrigger className="h-8 w-40 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BITACORA_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-1.5">
                              <t.icon className="h-3 w-3" />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="Escribir nota sobre este cliente..."
                    value={newBitacoraNota}
                    onChange={(e) => setNewBitacoraNota(e.target.value)}
                    className="min-h-[50px] text-sm rounded-lg resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddBitacora}
                    disabled={!newBitacoraNota.trim() || createBitacoraMutation.isPending}
                    className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {createBitacoraMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Agregar Entrada
                  </Button>
                </div>

                {/* Entries list */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {bitacoraLoading ? (
                    <div className="text-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                    </div>
                  ) : bitacoraEntries.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <BookOpen className="h-7 w-7 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Sin entradas en la bitácora</p>
                      <p className="text-[10px]">Agrega una nota para comenzar el seguimiento</p>
                    </div>
                  ) : (
                    bitacoraEntries.map((entry) => {
                      const typeConfig = BITACORA_TYPES.find(t => t.value === entry.tipo) || BITACORA_TYPES[0];
                      const TypeIcon = typeConfig.icon;
                      return (
                        <div key={entry.id} className="border rounded-xl p-3 space-y-1 bg-white dark:bg-gray-900 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={`${typeConfig.color} text-[10px] gap-1`}>
                                <TypeIcon className="w-2.5 h-2.5" />
                                {typeConfig.label}
                              </Badge>
                              <span className="text-[10px] text-gray-400">
                                {new Date(entry.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })} · {getTimeAgo(entry.createdAt)}
                              </span>
                            </div>
                            <button
                              onClick={() => deleteBitacoraMutation.mutate(entry.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{entry.nota}</p>
                          <p className="text-[10px] text-gray-400">por {entry.autorNombre}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Encargado de Compras
              </label>
              <Input
                value={newClientData.purchasingContactName}
                onChange={(e) => setNewClientData({ ...newClientData, purchasingContactName: e.target.value })}
                placeholder="Nombre del encargado de compras"
                className="mt-1"
                data-testid="input-client-purchasing-contact"
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
                  purchasingContactName: "",
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
