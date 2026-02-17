import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useFilter } from "@/contexts/FilterContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Download, Check, X, Trash2, Eye, BarChart3, FileText, ExternalLink, Banknote, HandCoins, Upload, Loader2, Wallet, ChevronDown, Pencil, Calendar } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageZoomViewer } from "@/components/ui/image-zoom-viewer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import GestionFondosContent from "./gestion-fondos";
import GastosEmpresarialesDashboard, { type DashboardExportHandle } from "./gastos-empresariales-dashboard";
import GastosFilterBar from "@/components/gastos-filter-bar";

const solicitarFondoSchema = z.object({
  monto: z.string().min(1, "El monto es requerido"),
  motivo: z.string().min(1, "El motivo es requerido"),
  centroCostos: z.string().min(1, "El centro de costos es requerido"),
  fechaTermino: z.string().min(1, "La fecha de término es requerida"),
  segmentCode: z.string().min(1, "El segmento es requerido"),
});

type SolicitarFondoFormData = z.infer<typeof solicitarFondoSchema>;

interface GastoEmpresarial {
  id: string;
  monto: string;
  descripcion: string;
  userId: string;
  centroCostos: string | null;
  categoria: string;
  tipoGasto: string;
  tipoDocumento: string | null;
  proveedor: string | null;
  rutProveedor: string | null;
  numeroDocumento: string | null;
  fechaEmision: string | null;
  archivoUrl: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  supervisorId: string | null;
  fechaAprobacion: string | null;
  comentarioRechazo: string | null;
  fundAllocationId: string | null;
  fundingMode: string | null;
  // Campos de aprobación de dos niveles
  estadoAprobacion?: 'pendiente_supervisor' | 'pendiente_rrhh' | 'aprobado' | 'rechazado' | null;
  supervisorAprobadorId?: string | null;
  fechaAprobacionSupervisor?: string | null;
  comentarioSupervisor?: string | null;
  rrhhAprobadorId?: string | null;
  fechaAprobacionRrhh?: string | null;
  comentarioRrhh?: string | null;
  comprobanteUrl?: string | null;
  segmentCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FundAllocation {
  id: string;
  nombre: string;
  montoInicial: string;
  montoUsado?: string;
  saldoDisponible?: string;
  estado: string;
  estadoAprobacion?: string;
  centroCostos: string;
  fechaInicio: string;
  fechaTermino: string;
  assignedToId: string;
  motivo?: string;
  segmentCode?: string;
  supervisorAprobadorId?: string;
  fechaAprobacionSupervisor?: string;
  comentarioSupervisor?: string;
  rrhhAprobadorId?: string;
  fechaAprobacionRrhh?: string;
  comentarioRrhh?: string;
}

export default function GastosEmpresariales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { gastosFilter, updateGastosFilter } = useFilter();
  const mes = gastosFilter.mes;
  const anio = gastosFilter.anio;
  const usuarioFilter = gastosFilter.usuarioFilter;
  const setMes = (v: string) => updateGastosFilter({ mes: v });
  const setAnio = (v: string) => updateGastosFilter({ anio: v });
  const setUsuarioFilter = (v: string) => updateGastosFilter({ usuarioFilter: v });
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [selectedGasto, setSelectedGasto] = useState<GastoEmpresarial | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [showSolicitarFondoDialog, setShowSolicitarFondoDialog] = useState(false);
  const [showCrearFondoDialog, setShowCrearFondoDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeMainTab, setActiveMainTab] = useState("rendicion");
  const dashboardRef = useRef<DashboardExportHandle>(null);
  const [, forceUpdate] = useState(0);
  const [showEditFechaDialog, setShowEditFechaDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});

  // Get salesperson's assigned segment (if any)
  const userAssignedSegment = (user as any)?.assignedSegment || null;
  const isSalesperson = user?.role === 'salesperson';
  const hasFixedSegment = isSalesperson && userAssignedSegment;

  const solicitarFondoForm = useForm<SolicitarFondoFormData>({
    resolver: zodResolver(solicitarFondoSchema),
    defaultValues: {
      monto: "",
      motivo: "",
      centroCostos: "",
      fechaTermino: "",
      segmentCode: hasFixedSegment ? userAssignedSegment : "",
    },
  });

  // Pre-select segment for salespeople when their assigned segment is loaded
  useEffect(() => {
    if (hasFixedSegment && solicitarFondoForm.getValues("segmentCode") !== userAssignedSegment) {
      solicitarFondoForm.setValue("segmentCode", userAssignedSegment);
    }
  }, [hasFixedSegment, userAssignedSegment, solicitarFondoForm]);

  // Fetch segments for the form
  const { data: segmentosData = [] } = useQuery<Array<{segment: string, totalSales: number, percentage: number}>>({
    queryKey: ['/api/sales/segments'],
  });
  // Extract just the segment names as strings
  const segmentos = segmentosData.map(s => s.segment).filter(Boolean);

  const solicitarFondoMutation = useMutation({
    mutationFn: async (data: SolicitarFondoFormData) => {
      return apiRequest('/api/fondos/solicitar', {
        method: 'POST',
        data: {
          ...data,
          monto: parseFloat(data.monto),
          tipo: 'solicitud',
          estado: 'solicitud',
          solicitante: user?.fullName || user?.username,
          solicitanteId: user?.id,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Solicitud enviada correctamente",
        description: "Tu solicitud ha sido procesada exitosamente. Verás el fondo asignado en caso de ser aprobada por el administrador del sistema.",
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
      setShowSolicitarFondoDialog(false);
      solicitarFondoForm.reset();
      setUploadedFiles([]);
      // Cambiar a la pestaña de Gestión de Fondos para que el usuario vea que quedó registrada
      setActiveMainTab('fondos');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la solicitud.",
        variant: "destructive",
      });
    },
  });

  const handleSolicitarFondo = (data: SolicitarFondoFormData) => {
    solicitarFondoMutation.mutate(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  // Fetch usuarios/colaboradores para mostrar nombres
  const { data: usuarios = [] } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople'],
  });

  // Función para obtener nombre de colaborador por ID
  const getColaboradorName = (userId: string): string => {
    const usuario = usuarios.find((u: any) => u.id === userId);
    if (!usuario) return 'Desconocido';
    const name = usuario.salespersonName || usuario.email || usuario.username || 'Desconocido';
    // Formatear nombre: inicial mayúscula
    return name
      .toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getDateRange = (month: string, year: string) => {
    const m = parseInt(month);
    const y = parseInt(year);
    const fechaDesde = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const fechaHasta = new Date(y, m, 0).toISOString().split('T')[0];
    return { fechaDesde, fechaHasta };
  };

  const { data: gastos = [], isLoading } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', mes, anio, usuarioFilter, estadoFilter, categoriaFilter],
    queryFn: async () => {
      const { fechaDesde, fechaHasta } = getDateRange(mes, anio);
      const params = new URLSearchParams();
      params.append('fechaDesde', fechaDesde);
      params.append('fechaHasta', fechaHasta);
      if (usuarioFilter !== 'todos') params.append('userId', usuarioFilter);
      if (estadoFilter !== 'all') params.append('estado', estadoFilter);
      if (categoriaFilter !== 'all') params.append('categoria', categoriaFilter);
      
      const response = await fetch(`/api/gastos-empresariales?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar gastos');
      return response.json();
    }
  });

  const targetUserId = usuarioFilter !== 'todos' ? usuarioFilter : user?.id;
  const { data: mesesConGastos = [] } = useQuery<Array<{mes: number, anio: number, cantidad: number, total: number}>>({
    queryKey: ['/api/gastos-empresariales/analytics/meses-con-gastos', targetUserId],
    queryFn: async () => {
      const response = await fetch(`/api/gastos-empresariales/analytics/meses-con-gastos?userId=${targetUserId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!targetUserId,
  });

  // Fetch fondos activos del usuario para mostrar barras de progreso
  const canViewAllFunds = user?.role === 'admin' || user?.role === 'recursos_humanos';
  const { data: userFundAllocations = [] } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations', 'active', user?.id, canViewAllFunds],
    queryFn: async () => {
      const response = await fetch(`/api/fund-allocations?estado=activo`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      const allFunds = await response.json();
      // Si es admin/rrhh, mostrar todos los fondos activos; si no, solo los del usuario
      if (canViewAllFunds) {
        return allFunds.filter((f: FundAllocation) => f.estado === 'activo');
      }
      return allFunds.filter((f: FundAllocation) => f.estado === 'activo' && f.assignedToId === user?.id);
    },
    enabled: !!user?.id,
  });

  // Fetch pending RRHH approvals count (for RRHH badge)
  const isRRHH = user?.role === 'recursos_humanos' || user?.role === 'admin';
  const { data: pendingRRHHAllocations = [] } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations/pending/rrhh'],
    enabled: isRRHH,
  });
  const pendingRRHHCount = pendingRRHHAllocations.length;

  const pendingApprovalsCount = isRRHH ? pendingRRHHCount : 0;

  // Aprobar mutation - determina el endpoint correcto según el tipo de gasto y rol
  const aprobarMutation = useMutation({
    mutationFn: async ({ gasto }: { gasto: GastoEmpresarial }) => {
      if (['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '')) {
        return apiRequest(`/api/gastos-empresariales/${gasto.id}/rrhh-approve`, {
          method: 'POST',
          data: {}
        });
      }
      return apiRequest(`/api/gastos-empresariales/${gasto.id}/aprobar`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/reembolsos/pendientes-rrhh'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/reembolsos/pendientes-supervisor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-usuario'] });
      toast({
        title: "Gasto aprobado",
        description: "El gasto ha sido aprobado correctamente",
      });
      setShowApprovalDialog(false);
      setSelectedGasto(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo aprobar el gasto",
        variant: "destructive",
      });
    }
  });

  // Rechazar mutation - determina el endpoint correcto según el tipo de gasto y rol
  const rechazarMutation = useMutation({
    mutationFn: async ({ gasto, comentario }: { gasto: GastoEmpresarial; comentario: string }) => {
      if (['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '')) {
        return apiRequest(`/api/gastos-empresariales/${gasto.id}/rrhh-reject`, {
          method: 'POST',
          data: { motivoRechazo: comentario }
        });
      }
      return apiRequest(`/api/gastos-empresariales/${gasto.id}/rechazar`, {
        method: 'POST',
        data: { comentario }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/reembolsos/pendientes-rrhh'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/reembolsos/pendientes-supervisor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-usuario'] });
      toast({
        title: "Gasto rechazado",
        description: "El gasto ha sido rechazado",
      });
      setShowRejectionDialog(false);
      setSelectedGasto(null);
      setComentarioRechazo("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar el gasto",
        variant: "destructive",
      });
    }
  });

  const editGastoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return apiRequest(`/api/gastos-empresariales/${id}/editar`, {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-usuario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-dia'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-categoria'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/meses-con-gastos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/summary'] });
      setShowEditFechaDialog(false);
      setSelectedGasto(null);
      toast({
        title: "Gasto actualizado",
        description: "Los datos del gasto han sido actualizados correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el gasto",
        variant: "destructive",
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/gastos-empresariales/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-usuario'] });
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive",
      });
    }
  });

  // Filter gastos based on search
  const filteredGastos = gastos.filter(gasto => {
    const matchesSearch = searchTerm === "" || 
      gasto.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gasto.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gasto.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getEstadoBadge = (gasto: GastoEmpresarial) => {
    if (gasto.estadoAprobacion) {
      switch (gasto.estadoAprobacion) {
        case 'pendiente_supervisor':
        case 'pendiente_rrhh':
          return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pendiente RRHH</Badge>;
        case 'aprobado':
          return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobado</Badge>;
        case 'rechazado':
          return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      }
    }
    
    switch (gasto.estado) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case 'aprobado':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobado</Badge>;
      case 'rechazado':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      default:
        return <Badge variant="outline">{gasto.estado}</Badge>;
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const canApproveReject = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'recursos_humanos';
  const canDelete = (gasto: GastoEmpresarial) => {
    return gasto.userId === user?.id && gasto.estado === 'pendiente' || user?.role === 'admin';
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Rendición de Gastos</h1>
            <p className="text-sm text-gray-500 mt-1">Gestiona y controla la rendición de gastos y fondos</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <TabsList className="flex w-full h-auto justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap pb-2 lg:pb-1 lg:grid lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="flex items-center gap-2 flex-shrink-0">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="rendicion" data-testid="tab-rendicion" className="flex items-center gap-2 flex-shrink-0">
              <Banknote className="h-4 w-4" />
              Rendición de Gastos
            </TabsTrigger>
            <TabsTrigger value="fondos" data-testid="tab-fondos" className="flex items-center gap-2 flex-shrink-0 relative">
              <HandCoins className="h-4 w-4" />
              Gestión de Fondos
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                  {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="sticky top-0 z-10 bg-white pt-3 pb-1">
            <GastosFilterBar
              mes={mes}
              setMes={setMes}
              anio={anio}
              setAnio={setAnio}
              usuarioFilter={usuarioFilter}
              setUsuarioFilter={setUsuarioFilter}
              actions={
                <>
                  {activeMainTab === 'dashboard' && dashboardRef.current?.canExport && (
                    <>
                      <Button 
                        size="sm"
                        onClick={() => dashboardRef.current?.handleExportPDF()}
                        disabled={!dashboardRef.current?.hasData || dashboardRef.current?.isGeneratingPDF || dashboardRef.current?.isLoadingUsers}
                        data-testid="button-export-pdf"
                      >
                        {dashboardRef.current?.isGeneratingPDF || dashboardRef.current?.isLoadingUsers ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-2" />
                        )}
                        {dashboardRef.current?.isGeneratingPDF ? 'Generando...' : dashboardRef.current?.isLoadingUsers ? 'Cargando...' : 'Exportar PDF'}
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => dashboardRef.current?.handleExportCSV()}
                        disabled={!dashboardRef.current?.hasData}
                        data-testid="button-export-csv"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar CSV
                      </Button>
                    </>
                  )}
                  {activeMainTab === 'rendicion' && (
                    <>
                      <Button 
                        variant="secondary"
                        size="sm"
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200" 
                        data-testid="button-solicitar-fondo"
                        onClick={() => setShowSolicitarFondoDialog(true)}
                      >
                        <HandCoins className="h-4 w-4 mr-2" />
                        Solicitar Fondo
                      </Button>
                      <Link href="/gastos-empresariales/nuevo">
                        <Button size="sm" data-testid="button-add-gasto">
                          <Plus className="h-4 w-4 mr-2" />
                          Añadir Gasto
                        </Button>
                      </Link>
                    </>
                  )}
                  {activeMainTab === 'fondos' && (user?.role === 'admin' || user?.role === 'recursos_humanos') && (
                    <Button 
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" 
                      data-testid="button-crear-fondo-top"
                      onClick={() => setShowCrearFondoDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Asignar Fondo
                    </Button>
                  )}
                </>
              }
            />
          </div>

          <TabsContent value="dashboard" className="mt-4">
            <GastosEmpresarialesDashboard ref={dashboardRef} embedded={true} onReady={() => forceUpdate(n => n + 1)} />
          </TabsContent>

          <TabsContent value="rendicion" className="mt-4 space-y-4">

            {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por descripción, categoría o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aprobado">Aprobado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-categoria">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="Combustibles">Combustibles</SelectItem>
              <SelectItem value="Colación">Colación</SelectItem>
              <SelectItem value="Gestión Ventas">Gestión Ventas</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Fecha</TableHead>
                  <TableHead className="min-w-[150px]">Colaborador</TableHead>
                  <TableHead className="min-w-[200px]">Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo Gasto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="min-w-[100px]">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Cargando gastos...
                    </TableCell>
                  </TableRow>
                ) : filteredGastos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-gray-500 space-y-2">
                        <p>No se encontraron gastos en {['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][parseInt(mes)]} {anio}</p>
                        {mesesConGastos.length > 0 && (
                          <div className="text-xs">
                            <p className="text-gray-400 mb-1">Meses con gastos registrados:</p>
                            <div className="flex flex-wrap justify-center gap-1">
                              {mesesConGastos.slice(0, 6).map(m => (
                                <button
                                  key={`${m.anio}-${m.mes}`}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                  onClick={() => {
                                    setMes(m.mes.toString());
                                    setAnio(m.anio.toString());
                                  }}
                                >
                                  {['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m.mes]} {m.anio} ({m.cantidad})
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGastos.map((gasto) => (
                    <TableRow 
                      key={gasto.id} 
                      data-testid={`row-gasto-${gasto.id}`}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        setSelectedGasto(gasto);
                        setShowDetailDialog(true);
                      }}
                    >
                      <TableCell className="text-sm">
                        {format(new Date(gasto.createdAt), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {getColaboradorName(gasto.userId)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium text-sm truncate" title={gasto.descripcion}>{gasto.descripcion}</p>
                          {gasto.proveedor && (
                            <p className="text-xs text-gray-500 truncate" title={gasto.proveedor}>{gasto.proveedor}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{gasto.categoria}</TableCell>
                      <TableCell className="text-sm">
                                        {gasto.fundingMode === 'con_fondo' ? (
                                          <span className="text-blue-600 font-medium">Con Fondos Asignados</span>
                                        ) : (
                                          <span>Reembolso</span>
                                        )}
                                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(gasto.monto)}
                      </TableCell>
                      <TableCell>{getEstadoBadge(gasto)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* RRHH puede aprobar/rechazar gastos pendientes (incluye pendiente_supervisor legacy) */}
                          {['admin', 'recursos_humanos'].includes(user?.role || '') && ['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '') && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGasto(gasto);
                                  setShowApprovalDialog(true);
                                }}
                                title="Aprobar"
                                data-testid={`button-approve-${gasto.id}`}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGasto(gasto);
                                  setComentarioRechazo("");
                                  setShowRejectionDialog(true);
                                }}
                                title="Rechazar"
                                data-testid={`button-reject-${gasto.id}`}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          {/* RRHH puede auditar gastos con fondos asignados ya aprobados */}
                          {user?.role === 'recursos_humanos' && gasto.fundingMode === 'con_fondo' && gasto.estado === 'aprobado' && !['pendiente_rrhh', 'pendiente_supervisor'].includes(gasto.estadoAprobacion || '') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGasto(gasto);
                                setComentarioRechazo("");
                                setShowRejectionDialog(true);
                              }}
                              title="Auditar/Rechazar"
                              data-testid={`button-audit-${gasto.id}`}
                            >
                              <X className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                          {['admin', 'recursos_humanos'].includes(user?.role || '') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGasto(gasto);
                                const createdDate = gasto.createdAt ? new Date(gasto.createdAt) : new Date();
                                setEditFormData({
                                  monto: gasto.monto || '',
                                  descripcion: gasto.descripcion || '',
                                  categoria: gasto.categoria || '',
                                  tipoDocumento: gasto.tipoDocumento || '',
                                  proveedor: gasto.proveedor || '',
                                  rutProveedor: gasto.rutProveedor || '',
                                  numeroDocumento: gasto.numeroDocumento || '',
                                  fechaEmision: gasto.fechaEmision || '',
                                  ruta: (gasto as any).ruta || '',
                                  clientes: (gasto as any).clientes || '',
                                  ciudad: (gasto as any).ciudad || '',
                                  fundingMode: gasto.fundingMode || 'reembolso',
                                  fundAllocationId: gasto.fundAllocationId || '',
                                  createdAt: `${createdDate.getFullYear()}-${String(createdDate.getMonth()+1).padStart(2,'0')}-${String(createdDate.getDate()).padStart(2,'0')}T${String(createdDate.getHours()).padStart(2,'0')}:${String(createdDate.getMinutes()).padStart(2,'0')}`,
                                });
                                setShowEditFechaDialog(true);
                              }}
                              title="Editar gasto"
                              data-testid={`button-edit-gasto-${gasto.id}`}
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {canDelete(gasto) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('¿Estás seguro de eliminar este gasto?')) {
                                  deleteMutation.mutate(gasto.id);
                                }
                              }}
                              data-testid={`button-delete-${gasto.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-gray-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGasto(gasto);
                              setShowDetailDialog(true);
                            }}
                            data-testid={`button-view-${gasto.id}`}
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="fondos" className="mt-4">
            <GestionFondosContent 
              embedded={true} 
              hideTopActions={true}
              externalCreateFundOpen={showCrearFondoDialog}
              onExternalCreateFundClose={() => setShowCrearFondoDialog(false)}
            />
          </TabsContent>
        </Tabs>
      </div>
      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Gasto</DialogTitle>
            <DialogDescription>
              Información completa del gasto empresarial
            </DialogDescription>
          </DialogHeader>
          
          {selectedGasto && (
            <div className="space-y-6">
              {/* Estado y Fecha */}
              <div className="flex items-center justify-between">
                {getEstadoBadge(selectedGasto)}
                <span className="text-sm text-gray-500">
                  Creado: {format(new Date(selectedGasto.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              </div>

              {/* Evidencia */}
              {selectedGasto.archivoUrl && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Evidencia Adjunta</h3>
                  {selectedGasto.archivoUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                      <ImageZoomViewer 
                        src={selectedGasto.archivoUrl} 
                        alt="Evidencia del gasto"
                      />
                      <div className="flex justify-center mt-3">
                        <a
                          href={selectedGasto.archivoUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                          data-testid="button-download-image"
                        >
                          <Download className="h-4 w-4" />
                          Descargar
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 bg-gray-50 flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Documento adjunto</p>
                        <p className="text-xs text-gray-500">Haz clic para abrir el archivo</p>
                      </div>
                      <a 
                        href={selectedGasto.archivoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <ExternalLink className="h-5 w-5 text-gray-600" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Información Principal */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Información del Gasto</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Colaborador</p>
                    <p className="font-bold text-lg">{getColaboradorName(selectedGasto.userId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Monto</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedGasto.monto)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Categoría</p>
                    <p className="font-medium">{selectedGasto.categoria}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tipo de Gasto</p>
                    <p className="font-medium">{selectedGasto.tipoGasto}</p>
                  </div>
                  {selectedGasto.centroCostos && (
                    <div>
                      <p className="text-xs text-gray-500">Centro de Costos</p>
                      <p className="font-medium">{selectedGasto.centroCostos}</p>
                    </div>
                  )}
                  {(selectedGasto as any).ruta && (
                    <div>
                      <p className="text-xs text-gray-500">Ruta</p>
                      <p className="font-medium">{(selectedGasto as any).ruta}</p>
                    </div>
                  )}
                  {(selectedGasto as any).clientes && (
                    <div>
                      <p className="text-xs text-gray-500">Cliente(s)</p>
                      <p className="font-medium">{(selectedGasto as any).clientes}</p>
                    </div>
                  )}
                  {(selectedGasto as any).ciudad && (
                    <div>
                      <p className="text-xs text-gray-500">Ciudad</p>
                      <p className="font-medium">{(selectedGasto as any).ciudad}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">Descripción</p>
                  <p className="font-medium mt-1">{selectedGasto.descripcion}</p>
                </div>
              </div>

              <Separator />

              {/* Información del Documento */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Información del Documento</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedGasto.tipoDocumento && (
                    <div>
                      <p className="text-xs text-gray-500">Tipo de Documento</p>
                      <p className="font-medium">{selectedGasto.tipoDocumento}</p>
                    </div>
                  )}
                  {selectedGasto.numeroDocumento && (
                    <div>
                      <p className="text-xs text-gray-500">Número de Documento</p>
                      <p className="font-medium">{selectedGasto.numeroDocumento}</p>
                    </div>
                  )}
                  {selectedGasto.proveedor && (
                    <div>
                      <p className="text-xs text-gray-500">Proveedor</p>
                      <p className="font-medium">{selectedGasto.proveedor}</p>
                    </div>
                  )}
                  {selectedGasto.rutProveedor && (
                    <div>
                      <p className="text-xs text-gray-500">RUT Proveedor</p>
                      <p className="font-medium">{selectedGasto.rutProveedor}</p>
                    </div>
                  )}
                  {selectedGasto.fechaEmision && (
                    <div>
                      <p className="text-xs text-gray-500">Fecha de Emisión</p>
                      <p className="font-medium">
                        {(() => {
                          const match = selectedGasto.fechaEmision!.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          if (match) {
                            return format(new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])), 'dd/MM/yyyy', { locale: es });
                          }
                          return format(new Date(selectedGasto.fechaEmision!), 'dd/MM/yyyy', { locale: es });
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Estado y Aprobación */}
              {(selectedGasto.estado === 'aprobado' || selectedGasto.estado === 'rechazado') && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Información de Revisión</h3>
                    {selectedGasto.fechaAprobacion && (
                      <div>
                        <p className="text-xs text-gray-500">Fecha de {selectedGasto.estado === 'aprobado' ? 'Aprobación' : 'Rechazo'}</p>
                        <p className="font-medium">
                          {format(new Date(selectedGasto.fechaAprobacion), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    )}
                    {selectedGasto.comentarioRechazo && (
                      <div>
                        <p className="text-xs text-gray-500">Motivo del Rechazo</p>
                        <p className="font-medium text-red-600 mt-1">{selectedGasto.comentarioRechazo}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <Separator />
              <div className="flex justify-end gap-2">
                {['admin', 'recursos_humanos'].includes(user?.role || '') && (
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      const createdDate = selectedGasto.createdAt ? new Date(selectedGasto.createdAt) : new Date();
                      setEditFormData({
                        monto: selectedGasto.monto || '',
                        descripcion: selectedGasto.descripcion || '',
                        categoria: selectedGasto.categoria || '',
                        tipoDocumento: selectedGasto.tipoDocumento || '',
                        proveedor: selectedGasto.proveedor || '',
                        rutProveedor: selectedGasto.rutProveedor || '',
                        numeroDocumento: selectedGasto.numeroDocumento || '',
                        fechaEmision: selectedGasto.fechaEmision || '',
                        ruta: (selectedGasto as any).ruta || '',
                        clientes: (selectedGasto as any).clientes || '',
                        ciudad: (selectedGasto as any).ciudad || '',
                        fundingMode: selectedGasto.fundingMode || 'reembolso',
                        fundAllocationId: selectedGasto.fundAllocationId || '',
                        createdAt: `${createdDate.getFullYear()}-${String(createdDate.getMonth()+1).padStart(2,'0')}-${String(createdDate.getDate()).padStart(2,'0')}T${String(createdDate.getHours()).padStart(2,'0')}:${String(createdDate.getMinutes()).padStart(2,'0')}`,
                      });
                      setShowDetailDialog(false);
                      setShowEditFechaDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                {canApproveReject && selectedGasto.estado === 'pendiente' && (
                  <>
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowRejectionDialog(true);
                      }}
                      data-testid="button-reject-detail"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rechazar
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowApprovalDialog(true);
                      }}
                      data-testid="button-approve-detail"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Aprobar
                    </Button>
                  </>
                )}
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={(open) => {
        setShowApprovalDialog(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGasto?.fundingMode === 'reembolso' 
                ? 'Aprobar Reembolso (RRHH)'
                : 'Aprobar Gasto (RRHH)'}
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de aprobar este gasto por {selectedGasto && formatCurrency(selectedGasto.monto)}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedGasto?.archivoUrl && (
              <p className="text-sm text-muted-foreground">
                El comprobante adjunto al gasto se asignará automáticamente.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowApprovalDialog(false);
                }}
                data-testid="button-cancel-approve"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedGasto) {
                    aprobarMutation.mutate({ 
                      gasto: selectedGasto
                    });
                  }
                }}
                disabled={aprobarMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {aprobarMutation.isPending ? 'Aprobando...' : 'Aprobar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedGasto?.fundingMode === 'reembolso' 
                ? 'Rechazar Reembolso (RRHH)'
                : 'Rechazar Gasto (RRHH)'}
            </DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo de este gasto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              placeholder="Motivo del rechazo..."
              value={comentarioRechazo}
              onChange={(e) => setComentarioRechazo(e.target.value)}
              rows={4}
              data-testid="textarea-rechazo"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionDialog(false);
                  setComentarioRechazo("");
                }}
                data-testid="button-cancel-reject"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedGasto && comentarioRechazo.trim()) {
                    rechazarMutation.mutate({
                      gasto: selectedGasto,
                      comentario: comentarioRechazo
                    });
                  }
                }}
                disabled={rechazarMutation.isPending || !comentarioRechazo.trim()}
                data-testid="button-confirm-reject"
              >
                {rechazarMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog Solicitar Fondo */}
      <Dialog open={showSolicitarFondoDialog} onOpenChange={setShowSolicitarFondoDialog}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Solicitar Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos y adjunte los respaldos necesarios.
            </DialogDescription>
          </DialogHeader>

          <Form {...solicitarFondoForm}>
            <form onSubmit={solicitarFondoForm.handleSubmit(handleSolicitarFondo)} className="space-y-6">
              <FormField
                control={solicitarFondoForm.control}
                name="monto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto a solicitar (CLP)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <Input
                          type="number"
                          placeholder="0"
                          className="pl-7"
                          {...field}
                          data-testid="input-monto-solicitud"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={solicitarFondoForm.control}
                name="motivo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de la solicitud</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Compra de insumos oficina central..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="input-motivo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={solicitarFondoForm.control}
                name="segmentCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Segmento</FormLabel>
                    {hasFixedSegment ? (
                      <>
                        <FormControl>
                          <Input 
                            value={userAssignedSegment} 
                            disabled 
                            className="bg-muted"
                            data-testid="input-segmento-fijo"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tu segmento asignado (no modificable)
                        </p>
                      </>
                    ) : (
                      <>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-segmento-solicitar">
                              <SelectValue placeholder="Seleccionar segmento..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {segmentos.length > 0 ? (
                              segmentos.map((seg) => (
                                <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="PINTOR">PINTOR</SelectItem>
                                <SelectItem value="CONSTRUCTOR">CONSTRUCTOR</SelectItem>
                                <SelectItem value="RETAIL">RETAIL</SelectItem>
                                <SelectItem value="INDUSTRIAL">INDUSTRIAL</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tu solicitud será aprobada por el supervisor de este segmento
                        </p>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={solicitarFondoForm.control}
                  name="centroCostos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Costos</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-centro-costos-solicitar">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Maipú">Maipú</SelectItem>
                          <SelectItem value="Concepción">Concepción</SelectItem>
                          <SelectItem value="Lautaro">Lautaro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={solicitarFondoForm.control}
                  name="fechaTermino"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de término</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-fecha-termino-solicitud" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Documentos de respaldo (opcional)</FormLabel>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer text-center group">
                  <input 
                    type="file" 
                    className="hidden" 
                    id="file-upload-solicitud" 
                    multiple 
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload-solicitud" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 font-medium">
                      Haz clic para subir o arrastra archivos aquí
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, PNG, JPG (Máx. 5MB)
                    </p>
                  </label>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowSolicitarFondoDialog(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={solicitarFondoMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                  data-testid="button-submit-solicitar-fondo"
                >
                  {solicitarFondoMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitud'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Edit Gasto Dialog - Full edit for admin/RRHH */}
      <Dialog open={showEditFechaDialog} onOpenChange={setShowEditFechaDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Editar Gasto
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del gasto. Puedes cambiar fechas, montos y detalles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de Creación</label>
                <Input
                  type="datetime-local"
                  value={editFormData.createdAt || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, createdAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de Emisión</label>
                <Input
                  type="date"
                  value={editFormData.fechaEmision || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, fechaEmision: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Gasto</label>
                <Select
                  value={editFormData.fundingMode || 'reembolso'}
                  onValueChange={(val) => {
                    setEditFormData(prev => ({
                      ...prev,
                      fundingMode: val,
                      fundAllocationId: val === 'reembolso' ? '' : prev.fundAllocationId,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de gasto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
                    <SelectItem value="con_fondo">Con Fondos Asignados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editFormData.fundingMode === 'con_fondo' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fondo Asignado</label>
                  <Select
                    value={editFormData.fundAllocationId || ''}
                    onValueChange={(val) => setEditFormData(prev => ({ ...prev, fundAllocationId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar fondo" />
                    </SelectTrigger>
                    <SelectContent>
                      {userFundAllocations.map((fund: any) => (
                        <SelectItem key={fund.id} value={fund.id}>
                          {fund.nombre} ({formatCurrency(fund.saldoDisponible || 0)} disponible)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto (CLP)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    type="number"
                    className="pl-7"
                    value={editFormData.monto || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, monto: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                <Select
                  value={editFormData.categoria || ''}
                  onValueChange={(val) => setEditFormData(prev => ({ ...prev, categoria: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Combustibles">Combustibles</SelectItem>
                    <SelectItem value="Colación">Colación</SelectItem>
                    <SelectItem value="Gestión Ventas">Gestión Ventas</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
              <Input
                value={editFormData.descripcion || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
                <Input
                  value={editFormData.proveedor || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, proveedor: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">RUT Proveedor</label>
                <Input
                  value={editFormData.rutProveedor || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, rutProveedor: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Documento</label>
                <Select
                  value={editFormData.tipoDocumento || ''}
                  onValueChange={(val) => setEditFormData(prev => ({ ...prev, tipoDocumento: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Boleta">Boleta</SelectItem>
                    <SelectItem value="Factura">Factura</SelectItem>
                    <SelectItem value="Recibo">Recibo</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">N° Documento</label>
                <Input
                  value={editFormData.numeroDocumento || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, numeroDocumento: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ruta</label>
                <Input
                  value={editFormData.ruta || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, ruta: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cliente(s)</label>
                <Input
                  value={editFormData.clientes || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, clientes: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
                <Input
                  value={editFormData.ciudad || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowEditFechaDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedGasto) {
                    editGastoMutation.mutate({
                      id: selectedGasto.id,
                      data: editFormData,
                    });
                  }
                }}
                disabled={editGastoMutation.isPending}
              >
                {editGastoMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
