import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, Search, Download, Check, X, Trash2, Eye, BarChart3, FileText, ExternalLink, Banknote, HandCoins, Upload, Loader2, Wallet, ChevronDown } from "lucide-react";
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
import GastosEmpresarialesDashboard from "./gastos-empresariales-dashboard";

const solicitarFondoSchema = z.object({
  monto: z.string().min(1, "El monto es requerido"),
  motivo: z.string().min(1, "El motivo es requerido"),
  centroCostos: z.string().min(1, "El centro de costos es requerido"),
  fechaTermino: z.string().min(1, "La fecha de término es requerida"),
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
  centroCostos: string;
  fechaInicio: string;
  fechaTermino: string;
  assignedToId: string;
  motivo?: string;
}

export default function GastosEmpresariales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [selectedGasto, setSelectedGasto] = useState<GastoEmpresarial | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [showSolicitarFondoDialog, setShowSolicitarFondoDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeMainTab, setActiveMainTab] = useState("rendicion");

  const solicitarFondoForm = useForm<SolicitarFondoFormData>({
    resolver: zodResolver(solicitarFondoSchema),
    defaultValues: {
      monto: "",
      motivo: "",
      centroCostos: "",
      fechaTermino: "",
    },
  });

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

  // Fetch gastos
  const { data: gastos = [], isLoading } = useQuery<GastoEmpresarial[]>({
    queryKey: ['/api/gastos-empresariales', estadoFilter, categoriaFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (estadoFilter !== 'all') params.append('estado', estadoFilter);
      if (categoriaFilter !== 'all') params.append('categoria', categoriaFilter);
      
      const response = await fetch(`/api/gastos-empresariales?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al cargar gastos');
      return response.json();
    }
  });

  // Fetch fondos activos del usuario para mostrar barras de progreso
  const canViewAllFunds = user?.role === 'admin' || user?.role === 'rrhh' || user?.role === 'recursos_humanos';
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

  // Calcular uso de cada fondo basado en gastos asociados
  const getFundUsage = (fundId: string) => {
    const fundGastos = gastos.filter(g => g.fundAllocationId === fundId && g.estado !== 'rechazado');
    const totalUsado = fundGastos.reduce((sum, g) => sum + parseFloat(g.monto || '0'), 0);
    return totalUsado;
  };

  // Aprobar mutation
  const aprobarMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/gastos-empresariales/${id}/aprobar`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto aprobado",
        description: "El gasto ha sido aprobado correctamente",
      });
      setShowApprovalDialog(false);
      setSelectedGasto(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aprobar el gasto",
        variant: "destructive",
      });
    }
  });

  // Rechazar mutation
  const rechazarMutation = useMutation({
    mutationFn: async ({ id, comentario }: { id: string; comentario: string }) => {
      return apiRequest(`/api/gastos-empresariales/${id}/rechazar`, {
        method: 'POST',
        data: { comentario }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/gastos-empresariales/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
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

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case 'aprobado':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobado</Badge>;
      case 'rechazado':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
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
            <TabsTrigger value="fondos" data-testid="tab-fondos" className="flex items-center gap-2 flex-shrink-0">
              <HandCoins className="h-4 w-4" />
              Gestión de Fondos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <GastosEmpresarialesDashboard embedded={true} />
          </TabsContent>

          <TabsContent value="rendicion" className="mt-4 space-y-4">
            {/* Action buttons for Rendición */}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button 
                variant="secondary"
                className="w-full sm:w-auto bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200" 
                data-testid="button-solicitar-fondo"
                onClick={() => setShowSolicitarFondoDialog(true)}
              >
                <HandCoins className="h-4 w-4 mr-2" />
                Solicitar Fondo
              </Button>
              <Link href="/gastos-empresariales/nuevo" className="w-full sm:w-auto">
                <Button className="w-full" data-testid="button-add-gasto">
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Gasto
                </Button>
              </Link>
            </div>

            {/* Fondos Asignados con barras de progreso - Collapsible */}
            {userFundAllocations.length > 0 && (
              <Collapsible defaultOpen={false} className="w-full">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 w-full">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-3 cursor-pointer hover:bg-blue-100/50 transition-colors rounded-t-lg">
                      <CardTitle className="text-lg flex items-center justify-between text-blue-800">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-5 w-5" />
                          Fondos Asignados
                          <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                            {userFundAllocations.length}
                          </Badge>
                        </div>
                        <ChevronDown className="h-5 w-5 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex flex-col gap-3 w-full">
                        {userFundAllocations.map((fund) => {
                          const montoInicial = parseFloat(fund.montoInicial || '0');
                          const montoUsado = fund.montoUsado ? parseFloat(fund.montoUsado) : getFundUsage(fund.id);
                          const saldoDisponible = montoInicial - montoUsado;
                          const porcentajeUsado = montoInicial > 0 ? (montoUsado / montoInicial) * 100 : 0;
                          const isOverBudget = porcentajeUsado > 100;
                          
                          return (
                            <div 
                              key={fund.id} 
                              className="bg-white rounded-lg p-4 shadow-sm border w-full"
                              data-testid={`fund-card-${fund.id}`}
                            >
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <h4 className="font-semibold text-base text-gray-900 truncate" title={fund.nombre || fund.motivo || 'Fondo sin nombre'}>
                                      {fund.nombre || fund.motivo || 'Fondo sin nombre'}
                                    </h4>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs flex-shrink-0 ${isOverBudget ? 'border-red-300 text-red-700 bg-red-50' : 'border-green-300 text-green-700 bg-green-50'}`}
                                    >
                                      {isOverBudget ? 'Excedido' : 'Activo'}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 sm:text-right flex-shrink-0">
                                    {canViewAllFunds && getColaboradorName(fund.assignedToId)}
                                    {canViewAllFunds && ' • '}{fund.centroCostos}
                                  </p>
                                </div>
                                
                                <Progress 
                                  value={Math.min(porcentajeUsado, 100)} 
                                  className={`h-3 w-full ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-600'}`}
                                />
                                
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <div className="flex flex-wrap gap-4">
                                    <span className="text-gray-600">
                                      Usado: <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                                        ${montoUsado.toLocaleString('es-CL')}
                                      </span>
                                    </span>
                                    <span className="text-gray-600">
                                      Total: <span className="font-semibold text-gray-900">
                                        ${montoInicial.toLocaleString('es-CL')}
                                      </span>
                                    </span>
                                  </div>
                                  <span className="text-gray-600">
                                    Disponible: <span className={`text-lg font-bold ${saldoDisponible < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      ${saldoDisponible.toLocaleString('es-CL')}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

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
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No se encontraron gastos
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
                      <TableCell>{getEstadoBadge(gasto.estado)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canApproveReject && gasto.estado === 'pendiente' && (
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
                          {user?.role === 'recursos_humanos' && gasto.fundingMode === 'con_fondo' && gasto.estado === 'aprobado' && (
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
            <GestionFondosContent embedded={true} />
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
                {getEstadoBadge(selectedGasto.estado)}
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
                        {format(new Date(selectedGasto.fechaEmision), 'dd/MM/yyyy', { locale: es })}
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
              {canApproveReject && selectedGasto.estado === 'pendiente' && (
                <>
                  <Separator />
                  <div className="flex justify-end gap-2">
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
                  </div>
                </>
              )}

              {/* RRHH puede auditar gastos con fondos asignados ya aprobados */}
              {user?.role === 'recursos_humanos' && selectedGasto.fundingMode === 'con_fondo' && selectedGasto.estado === 'aprobado' && (
                <>
                  <Separator />
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="font-semibold text-sm text-orange-800 mb-2">Auditoría RRHH</h3>
                    <p className="text-xs text-orange-700 mb-3">
                      Este gasto fue auto-aprobado por tener fondos asignados. Puedes rechazarlo si no procede.
                    </p>
                    <Button
                      variant="outline"
                      className="text-orange-600 border-orange-300 hover:bg-orange-100"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setComentarioRechazo("");
                        setShowRejectionDialog(true);
                      }}
                      data-testid="button-audit-reject-detail"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Rechazar Gasto
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Gasto</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de aprobar este gasto por {selectedGasto && formatCurrency(selectedGasto.monto)}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              data-testid="button-cancel-approve"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectedGasto && aprobarMutation.mutate(selectedGasto.id)}
              disabled={aprobarMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {aprobarMutation.isPending ? 'Aprobando...' : 'Aprobar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Gasto</DialogTitle>
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
                      id: selectedGasto.id,
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
    </>
  );
}
