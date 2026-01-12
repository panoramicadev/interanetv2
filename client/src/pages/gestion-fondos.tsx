import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Search, HandCoins, Upload, Loader2, Check, X, Eye, Trash2 } from "lucide-react";

const crearFondoSchema = z.object({
  presupuesto: z.string().min(1, "El presupuesto es requerido"),
  nombre: z.string().min(1, "El nombre del fondo es requerido"),
  usuarioResponsable: z.string().min(1, "Debe seleccionar a quién asignar el fondo"),
  fechaInicio: z.string().optional(),
  fechaTermino: z.string().optional(),
});

const solicitarFondoSchema = z.object({
  monto: z.string().min(1, "El monto es requerido"),
  motivo: z.string().min(1, "El motivo es requerido"),
  centroCostos: z.string().min(1, "El centro de costos es requerido"),
  fechaTermino: z.string().min(1, "La fecha de término es requerida"),
});

type CrearFondoFormData = z.infer<typeof crearFondoSchema>;
type SolicitarFondoFormData = z.infer<typeof solicitarFondoSchema>;

interface GestionFondosProps {
  embedded?: boolean;
}

interface FundAllocation {
  id: string;
  nombre: string;
  descripcion?: string;
  montoInicial: string;
  assignedToId: string;
  assignedById: string;
  estado: string;
  fechaInicio?: string;
  fechaFin?: string;
  createdAt: string;
  saldoDisponible?: number;
  totalComprometido?: number;
  totalAprobado?: number;
}

export default function GestionFondos({ embedded = false }: GestionFondosProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("asignaciones");
  const [showCrearFondoDialog, setShowCrearFondoDialog] = useState(false);
  const [showSolicitarFondoDialog, setShowSolicitarFondoDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedAllocation, setSelectedAllocation] = useState<FundAllocation | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveFile, setApproveFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isUploadingApproval, setIsUploadingApproval] = useState(false);
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [crearFondoComprobante, setCrearFondoComprobante] = useState<File | null>(null);
  const [isUploadingCrearFondo, setIsUploadingCrearFondo] = useState(false);
  const [showConfirmAsignacionDialog, setShowConfirmAsignacionDialog] = useState(false);
  const [showSupervisorApproveDialog, setShowSupervisorApproveDialog] = useState(false);
  const [supervisorApproveComment, setSupervisorApproveComment] = useState("");
  const [pendingAsignacionData, setPendingAsignacionData] = useState<CrearFondoFormData | null>(null);

  const canManageFunds = user?.role === 'admin' || user?.role === 'recursos_humanos';
  const isSupervisor = user?.role === 'supervisor';
  const isRRHH = user?.role === 'admin' || user?.role === 'recursos_humanos' || user?.role === 'rrhh';

  // Fetch fund allocations
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations'],
    queryFn: async () => {
      const response = await fetch('/api/fund-allocations', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch pending supervisor approvals (for supervisors only)
  const { data: pendingSupervisorApprovals = [] } = useQuery<any[]>({
    queryKey: ['/api/fund-allocations/pending/supervisor'],
    queryFn: async () => {
      const response = await fetch('/api/fund-allocations/pending/supervisor', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isSupervisor,
  });

  // Fetch pending RRHH approvals (for RRHH only)
  const { data: pendingRRHHApprovals = [] } = useQuery<any[]>({
    queryKey: ['/api/fund-allocations/pending/rrhh'],
    queryFn: async () => {
      const response = await fetch('/api/fund-allocations/pending/rrhh', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isRRHH,
  });

  // Fetch summary
  const { data: summary } = useQuery<{
    totalAsignado: number;
    totalComprometido: number;
    totalAprobado: number;
    saldoDisponible: number;
    asignacionesActivas: number;
  }>({
    queryKey: ['/api/fund-allocations/summary/global'],
    queryFn: async () => {
      const response = await fetch('/api/fund-allocations/summary/global', { credentials: 'include' });
      if (!response.ok) return { totalAsignado: 0, totalComprometido: 0, totalAprobado: 0, saldoDisponible: 0, asignacionesActivas: 0 };
      return response.json();
    },
  });

  // Fetch salespeople for assignment
  const { data: salespeople = [] } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople'],
  });

  const isLoading = isLoadingAllocations;
  const fondos = allocations;

  const crearFondoForm = useForm<CrearFondoFormData>({
    resolver: zodResolver(crearFondoSchema),
    defaultValues: {
      presupuesto: "",
      nombre: "",
      usuarioResponsable: "",
      fechaInicio: "",
      fechaTermino: "",
    },
  });

  const solicitarFondoForm = useForm<SolicitarFondoFormData>({
    resolver: zodResolver(solicitarFondoSchema),
    defaultValues: {
      monto: "",
      motivo: "",
      centroCostos: "",
      fechaTermino: "",
    },
  });

  const crearFondoMutation = useMutation({
    mutationFn: async (data: CrearFondoFormData) => {
      return apiRequest('/api/fund-allocations', {
        method: 'POST',
        data: {
          nombre: data.nombre,
          montoInicial: parseFloat(data.presupuesto),
          assignedToId: data.usuarioResponsable,
          fechaInicio: data.fechaInicio || null,
          fechaTermino: data.fechaTermino || null,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Fondo asignado",
        description: "El fondo se ha asignado exitosamente al colaborador.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
      setShowCrearFondoDialog(false);
      crearFondoForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el fondo.",
        variant: "destructive",
      });
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
        title: "Solicitud enviada",
        description: "Tu solicitud de fondo ha sido enviada para aprobación.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fondos'] });
      setShowSolicitarFondoDialog(false);
      solicitarFondoForm.reset();
      setUploadedFiles([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo enviar la solicitud.",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ allocationId, comprobanteUrl }: { allocationId: string; comprobanteUrl: string }) => {
      return apiRequest(`/api/fund-allocations/${allocationId}/approve`, {
        method: 'POST',
        data: { comprobanteUrl },
      });
    },
    onSuccess: () => {
      toast({
        title: "Fondo aprobado",
        description: "El fondo ha sido aprobado y está activo.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
      setShowApproveDialog(false);
      setApproveFile(null);
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo aprobar el fondo.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ allocationId, motivoRechazo }: { allocationId: string; motivoRechazo: string }) => {
      return apiRequest(`/api/fund-allocations/${allocationId}/reject`, {
        method: 'POST',
        data: { motivoRechazo },
      });
    },
    onSuccess: () => {
      toast({
        title: "Fondo rechazado",
        description: "El fondo ha sido rechazado.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo rechazar el fondo.",
        variant: "destructive",
      });
    },
  });

  const deleteFundMutation = useMutation({
    mutationFn: async (fundId: string) => {
      return apiRequest(`/api/fund-allocations/${fundId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Fondo eliminado",
        description: "El fondo ha sido eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el fondo.",
        variant: "destructive",
      });
    },
  });

  // Supervisor approval/rejection mutations
  const supervisorApproveMutation = useMutation({
    mutationFn: async ({ allocationId, comentario }: { allocationId: string; comentario?: string }) => {
      return apiRequest(`/api/fund-allocations/${allocationId}/supervisor-approve`, {
        method: 'POST',
        data: { comentario },
      });
    },
    onSuccess: () => {
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud ha sido aprobada y enviada a RRHH para aprobación final.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/pending/supervisor'] });
      setShowApproveDialog(false);
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo aprobar la solicitud.",
        variant: "destructive",
      });
    },
  });

  const supervisorRejectMutation = useMutation({
    mutationFn: async ({ allocationId, comentario }: { allocationId: string; comentario: string }) => {
      return apiRequest(`/api/fund-allocations/${allocationId}/supervisor-reject`, {
        method: 'POST',
        data: { comentario },
      });
    },
    onSuccess: () => {
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud ha sido rechazada.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/pending/supervisor'] });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedAllocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo rechazar la solicitud.",
        variant: "destructive",
      });
    },
  });

  const handleCrearFondo = async (data: CrearFondoFormData) => {
    // RRHH debe subir comprobante obligatoriamente
    if (!crearFondoComprobante) {
      toast({
        title: "Comprobante requerido",
        description: "Debe adjuntar el comprobante de transferencia para asignar el fondo.",
        variant: "destructive",
      });
      return;
    }

    // Mostrar diálogo de confirmación
    setPendingAsignacionData(data);
    setShowConfirmAsignacionDialog(true);
  };

  const confirmarAsignacionFondo = async () => {
    if (!pendingAsignacionData || !crearFondoComprobante) return;

    const data = pendingAsignacionData;
    setIsUploadingCrearFondo(true);
    setShowConfirmAsignacionDialog(false);
    
    try {
      // Primero subir el comprobante
      const formData = new FormData();
      formData.append('file', crearFondoComprobante);
      formData.append('fundId', 'new'); // Indicar que es un fondo nuevo
      
      const uploadResponse = await fetch('/api/fund-allocations/upload-comprobante', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Error al subir el comprobante');
      }
      
      const uploadResult = await uploadResponse.json();
      const comprobanteUrlUploaded = uploadResult.url;
      
      // Crear el fondo con estado activo (aprobado) y comprobante
      await apiRequest('/api/fund-allocations', {
        method: 'POST',
        data: {
          nombre: data.nombre,
          montoInicial: parseFloat(data.presupuesto),
          assignedToId: data.usuarioResponsable,
          fechaInicio: data.fechaInicio || null,
          fechaTermino: data.fechaTermino || null,
          estado: 'activo',
          comprobanteUrl: comprobanteUrlUploaded,
        },
      });
      
      toast({
        title: "Fondo asignado y aprobado",
        description: "El fondo se ha asignado y aprobado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fund-allocations/summary/global'] });
      setShowCrearFondoDialog(false);
      crearFondoForm.reset();
      setCrearFondoComprobante(null);
      setPendingAsignacionData(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el fondo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCrearFondo(false);
    }
  };

  const handleSolicitarFondo = (data: SolicitarFondoFormData) => {
    solicitarFondoMutation.mutate(data);
  };

  const handleApprove = async () => {
    console.log('[handleApprove] Called with:', { selectedAllocation, approveFile });
    if (!selectedAllocation || !approveFile) {
      console.log('[handleApprove] Missing data:', { selectedAllocation: !!selectedAllocation, approveFile: !!approveFile });
      return;
    }
    
    setIsUploadingApproval(true);
    try {
      const formData = new FormData();
      formData.append('file', approveFile);
      formData.append('fundId', selectedAllocation.id);
      
      console.log('[handleApprove] Uploading file to fondos/comprobante...');
      const uploadResponse = await fetch('/api/fund-allocations/upload-comprobante', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[handleApprove] Upload failed:', errorText);
        throw new Error('Error al subir el archivo');
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('[handleApprove] Upload result:', uploadResult);
      const comprobanteUrl = uploadResult.url;
      
      console.log('[handleApprove] Calling approve mutation:', { allocationId: selectedAllocation.id, comprobanteUrl });
      approveMutation.mutate({ allocationId: selectedAllocation.id, comprobanteUrl });
    } catch (error: any) {
      console.error('[handleApprove] Error:', error);
      toast({
        title: "Error",
        description: error.message || "Error al subir el comprobante",
        variant: "destructive",
      });
    } finally {
      setIsUploadingApproval(false);
    }
  };

  const handleReject = () => {
    if (!selectedAllocation || !rejectReason.trim()) return;
    
    // If the allocation is pending supervisor approval and user is supervisor, use supervisor rejection
    if (selectedAllocation.estadoAprobacion === 'pendiente_supervisor' && isSupervisor) {
      supervisorRejectMutation.mutate({ allocationId: selectedAllocation.id, comentario: rejectReason });
    } else {
      // Otherwise use RRHH rejection
      rejectMutation.mutate({ allocationId: selectedAllocation.id, motivoRechazo: rejectReason });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getEstadoBadge = (estado: string) => {
    const baseClasses = "whitespace-nowrap text-xs";
    switch (estado) {
      case 'solicitud':
        return <Badge variant="outline" className={`${baseClasses} bg-blue-50 text-blue-700 border-blue-200`}>Solicitud</Badge>;
      case 'pendiente_supervisor':
        return <Badge variant="outline" className={`${baseClasses} bg-orange-50 text-orange-700 border-orange-200`}>Pendiente Supervisor</Badge>;
      case 'pendiente_rrhh':
        return <Badge variant="outline" className={`${baseClasses} bg-purple-50 text-purple-700 border-purple-200`}>Aprobado por Supervisor</Badge>;
      case 'pendiente':
      case 'pendiente_aprobacion':
        return <Badge variant="outline" className={`${baseClasses} bg-orange-50 text-orange-700 border-orange-200`}>Pendiente</Badge>;
      case 'activo':
      case 'abierto':
        return <Badge variant="outline" className={`${baseClasses} bg-green-50 text-green-700 border-green-200`}>Activo</Badge>;
      case 'cerrado':
        return <Badge variant="outline" className={`${baseClasses} bg-gray-50 text-gray-700 border-gray-200`}>Cerrado</Badge>;
      case 'rechazado':
        return <Badge variant="outline" className={`${baseClasses} bg-red-50 text-red-700 border-red-200`}>Rechazado</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}>{estado}</Badge>;
    }
  };

  const getAssigneeName = (userId: string) => {
    const person = salespeople.find((s: any) => s.id === userId);
    if (!person) return 'Desconocido';
    const name = person.salespersonName || person.email || 'Usuario';
    return name.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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

  const filteredFondos = fondos.filter((fondo: FundAllocation) => {
    const assigneeName = getAssigneeName(fondo.assignedToId);
    const matchesSearch = searchTerm === "" || 
      fondo.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fondo.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assigneeName.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const renderTable = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Fecha</TableHead>
              <TableHead className="min-w-[150px]">Asignado a</TableHead>
              <TableHead className="min-w-[150px]">Nombre del Fondo</TableHead>
              <TableHead className="text-right">Monto Inicial</TableHead>
              <TableHead className="text-right">Saldo Disponible</TableHead>
              <TableHead className="min-w-[100px]">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Cargando asignaciones...
                </TableCell>
              </TableRow>
            ) : filteredFondos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay asignaciones de fondos registradas
                </TableCell>
              </TableRow>
            ) : (
              filteredFondos.map((fondo: FundAllocation) => (
                <TableRow 
                  key={fondo.id} 
                  data-testid={`row-fondo-${fondo.id}`}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    setSelectedAllocation(fondo);
                    setShowDetailDialog(true);
                  }}
                >
                  <TableCell className="text-sm">
                    {fondo.createdAt ? new Date(fondo.createdAt).toLocaleDateString('es-CL') : '-'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {getAssigneeName(fondo.assignedToId)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[150px] sm:max-w-[250px]">
                      <p className="font-medium text-sm truncate" title={fondo.nombre}>{fondo.nombre}</p>
                      {fondo.descripcion && (
                        <p className="text-xs text-gray-500 truncate" title={fondo.descripcion}>{fondo.descripcion}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(fondo.montoInicial || 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatCurrency(fondo.saldoDisponible || 0)}
                  </TableCell>
                  <TableCell>{getEstadoBadge(fondo.estadoAprobacion || fondo.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canManageFunds && (fondo.estado === 'pendiente_rrhh' || fondo.estadoAprobacion === 'pendiente_rrhh') && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`button-approve-${fondo.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAllocation(fondo);
                              setShowApproveDialog(true);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            data-testid={`button-reject-${fondo.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAllocation(fondo);
                              setShowRejectDialog(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-view-${fondo.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAllocation(fondo);
                          setShowDetailDialog(true);
                        }}
                      >
                        Ver
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`button-delete-${fondo.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('¿Estás seguro de eliminar este fondo? Esta acción no se puede deshacer.')) {
                              deleteFundMutation.mutate(fondo.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <>
      <div className={embedded ? "space-y-4" : "p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {!embedded && (
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Fondos</h1>
              <p className="text-sm text-gray-500 mt-1">Administra solicitudes y asignación de fondos</p>
            </div>
          )}
          {canManageFunds && (
            <div className={`${embedded ? 'ml-auto' : ''}`}>
              <Button 
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md" 
                data-testid="button-crear-fondo"
                onClick={() => setShowCrearFondoDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Asignar Fondo
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por descripción o solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Total Asignado</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(summary.totalAsignado || 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Comprometido</div>
              <div className="text-xl font-bold text-yellow-600">{formatCurrency(summary.totalComprometido || 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Aprobado</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(summary.totalAprobado || 0)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Disponible</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(summary.saldoDisponible || 0)}</div>
            </Card>
          </div>
        )}

        {/* Supervisor Pending Approvals Section */}
        {isSupervisor && pendingSupervisorApprovals.length > 0 && (
          <Card className="p-4 mb-4 border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 mb-3">
              <HandCoins className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">Solicitudes Pendientes de Aprobación ({pendingSupervisorApprovals.length})</h3>
            </div>
            <div className="space-y-3">
              {pendingSupervisorApprovals.map((allocation: any) => {
                const solicitante = salespeople.find((s: any) => s.id === allocation.assignedToId);
                return (
                  <div key={allocation.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium">{allocation.nombre}</div>
                      <div className="text-sm text-gray-500">
                        Solicitante: {solicitante?.salespersonName || 'Desconocido'} • 
                        Segmento: {allocation.segmentCode} • 
                        Monto: {formatCurrency(parseFloat(allocation.montoInicial))}
                      </div>
                      {allocation.motivo && (
                        <div className="text-sm text-gray-600 mt-1">Motivo: {allocation.motivo}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          setSelectedAllocation(allocation);
                          setShowSupervisorApproveDialog(true);
                        }}
                        disabled={supervisorApproveMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => {
                          setSelectedAllocation(allocation);
                          setShowRejectDialog(true);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* RRHH Pending Approvals Section */}
        {isRRHH && pendingRRHHApprovals.length > 0 && (
          <Card className="p-4 mb-4 border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 mb-3">
              <HandCoins className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-purple-800">Solicitudes Pendientes de Aprobación RRHH ({pendingRRHHApprovals.length})</h3>
            </div>
            <div className="space-y-3">
              {pendingRRHHApprovals.map((allocation: any) => {
                const solicitante = salespeople.find((s: any) => s.id === allocation.assignedToId);
                return (
                  <div key={allocation.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium">{allocation.nombre}</div>
                      <div className="text-sm text-gray-500">
                        Solicitante: {solicitante?.salespersonName || 'Desconocido'} • 
                        Segmento: {allocation.segmentCode} • 
                        Monto: {formatCurrency(parseFloat(allocation.montoInicial))}
                      </div>
                      {allocation.comentarioSupervisor && (
                        <div className="text-sm text-green-600 mt-1">
                          ✓ Aprobado por supervisor: {allocation.comentarioSupervisor}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          setSelectedAllocation(allocation);
                          setShowApproveDialog(true);
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => {
                          setSelectedAllocation(allocation);
                          setShowRejectDialog(true);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full h-auto justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap pb-2 lg:pb-1 lg:grid lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="asignaciones" data-testid="tab-asignaciones" className="flex-shrink-0">Asignaciones</TabsTrigger>
            <TabsTrigger value="activos" data-testid="tab-activos" className="flex-shrink-0">Activos</TabsTrigger>
            <TabsTrigger value="cerrados" data-testid="tab-cerrados" className="flex-shrink-0">Cerrados</TabsTrigger>
          </TabsList>

          <TabsContent value="asignaciones" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="activos" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="cerrados" className="mt-4">
            {renderTable()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Asignar Fondo */}
      <Dialog open={showCrearFondoDialog} onOpenChange={setShowCrearFondoDialog}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Asignar Fondo</DialogTitle>
            <DialogDescription>
              Asigna un monto a un vendedor o supervisor.
            </DialogDescription>
          </DialogHeader>

          <Form {...crearFondoForm}>
            <form onSubmit={crearFondoForm.handleSubmit(handleCrearFondo)} className="space-y-6">
              <FormField
                control={crearFondoForm.control}
                name="presupuesto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuesto del Fondo (CLP)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <Input
                          type="number"
                          placeholder="0"
                          className="pl-7"
                          {...field}
                          data-testid="input-presupuesto"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={crearFondoForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Fondo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Fondos por rendir Diciembre 2025"
                        {...field}
                        data-testid="input-nombre-fondo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={crearFondoForm.control}
                name="usuarioResponsable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignado a:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-asignado-a">
                          <SelectValue placeholder="Seleccionar vendedor o supervisor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {salespeople.map((person: any) => {
                          const displayName = person.salespersonName || person.email || 'Usuario';
                          const formattedName = displayName.split(' ').map((word: string) => 
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                          ).join(' ');
                          return (
                            <SelectItem key={person.id} value={person.id}>
                              {formattedName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={crearFondoForm.control}
                  name="fechaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Inicio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-fecha-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={crearFondoForm.control}
                  name="fechaTermino"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Término</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-fecha-termino" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Campo obligatorio de comprobante */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Comprobante de Transferencia <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCrearFondoComprobante(file);
                      }
                    }}
                    className="hidden"
                    id="comprobante-asignacion"
                    data-testid="input-comprobante-asignacion"
                  />
                  <label 
                    htmlFor="comprobante-asignacion"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-8 w-8 text-gray-400" />
                    {crearFondoComprobante ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">{crearFondoComprobante.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Click para subir comprobante (imagen o PDF)
                      </span>
                    )}
                  </label>
                </div>
                {!crearFondoComprobante && (
                  <p className="text-xs text-amber-600">
                    El comprobante es obligatorio para asignar fondos directamente.
                  </p>
                )}
              </div>

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCrearFondoDialog(false);
                    setCrearFondoComprobante(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isUploadingCrearFondo || !crearFondoComprobante}
                  data-testid="button-submit-asignar-fondo"
                >
                  {isUploadingCrearFondo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Asignando...
                    </>
                  ) : (
                    'Asignar Fondo'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog Solicitar Fondo */}
      <Dialog open={showSolicitarFondoDialog} onOpenChange={setShowSolicitarFondoDialog}>
        <DialogContent className="max-w-xl">
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
                <FormLabel>Documentos de respaldo</FormLabel>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors cursor-pointer text-center group">
                  <input 
                    type="file" 
                    className="hidden" 
                    id="file-upload" 
                    multiple 
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
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
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          ×
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

      {/* Dialog Aprobar Fondo */}
      <Dialog open={showApproveDialog} onOpenChange={(open) => {
        setShowApproveDialog(open);
        if (!open) {
          setApproveFile(null);
          setSelectedAllocation(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar Asignación de Fondo</DialogTitle>
            <DialogDescription>
              Suba el comprobante de transferencia para aprobar esta asignación.
            </DialogDescription>
          </DialogHeader>

          {selectedAllocation && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Asignado a:</span>
                  <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.assignedToId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Monto:</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(selectedAllocation.montoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nombre del Fondo:</span>
                  <span className="text-sm font-medium">{selectedAllocation.nombre}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comprobante de Transferencia</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer text-center">
                  <input 
                    type="file" 
                    className="hidden" 
                    id="approve-file-upload"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setApproveFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="approve-file-upload" className="cursor-pointer w-full h-full flex flex-col items-center justify-center">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {approveFile ? approveFile.name : 'Subir comprobante'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, PNG, JPG
                    </p>
                  </label>
                </div>
              </div>

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowApproveDialog(false);
                    setApproveFile(null);
                    setSelectedAllocation(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleApprove}
                  disabled={!approveFile || isUploadingApproval || approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-confirm-approve"
                >
                  {isUploadingApproval || approveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aprobando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Aprobar Fondo
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Rechazar Fondo */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        setShowRejectDialog(open);
        if (!open) {
          setRejectReason("");
          setSelectedAllocation(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar Asignación de Fondo</DialogTitle>
            <DialogDescription>
              Indique el motivo del rechazo para esta asignación.
            </DialogDescription>
          </DialogHeader>

          {selectedAllocation && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Asignado a:</span>
                  <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.assignedToId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Monto:</span>
                  <span className="text-sm font-bold">{formatCurrency(selectedAllocation.montoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nombre del Fondo:</span>
                  <span className="text-sm font-medium">{selectedAllocation.nombre}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo del Rechazo</label>
                <Textarea
                  placeholder="Explique por qué se rechaza esta asignación..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px]"
                  data-testid="input-reject-reason"
                />
              </div>

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectReason("");
                    setSelectedAllocation(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || rejectMutation.isPending || supervisorRejectMutation.isPending}
                  variant="destructive"
                  data-testid="button-confirm-reject"
                >
                  {rejectMutation.isPending || supervisorRejectMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Rechazando...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Rechazar Solicitud
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Aprobación Supervisor */}
      <Dialog open={showSupervisorApproveDialog} onOpenChange={(open) => {
        setShowSupervisorApproveDialog(open);
        if (!open) {
          setSupervisorApproveComment("");
          setSelectedAllocation(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Aprobación</DialogTitle>
            <DialogDescription>
              ¿Está seguro que desea aprobar esta solicitud de fondo? Se enviará a RRHH para aprobación final.
            </DialogDescription>
          </DialogHeader>

          {selectedAllocation && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Solicitante:</span>
                  <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.assignedToId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Monto:</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(parseFloat(selectedAllocation.montoInicial))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Segmento:</span>
                  <span className="text-sm font-medium">{selectedAllocation.segmentCode}</span>
                </div>
                {selectedAllocation.motivo && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Motivo:</span>
                    <span className="text-sm bg-white p-2 rounded border">{selectedAllocation.motivo}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comentario (opcional)</label>
                <Textarea
                  placeholder="Agregue un comentario para RRHH..."
                  value={supervisorApproveComment}
                  onChange={(e) => setSupervisorApproveComment(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowSupervisorApproveDialog(false);
                    setSupervisorApproveComment("");
                    setSelectedAllocation(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    if (selectedAllocation) {
                      supervisorApproveMutation.mutate({ 
                        allocationId: selectedAllocation.id, 
                        comentario: supervisorApproveComment || undefined 
                      });
                      setShowSupervisorApproveDialog(false);
                      setSupervisorApproveComment("");
                    }
                  }}
                  disabled={supervisorApproveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {supervisorApproveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aprobando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Confirmar Aprobación
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Ver Detalle del Fondo */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        setShowDetailDialog(open);
        if (!open) {
          setSelectedAllocation(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Fondo</DialogTitle>
            <DialogDescription>
              Información completa de la asignación de fondo.
            </DialogDescription>
          </DialogHeader>

          {selectedAllocation && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-gray-500">Estado:</span>
                  <span>{getEstadoBadge(selectedAllocation.estado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Nombre del Fondo:</span>
                  <span className="text-sm font-medium">{selectedAllocation.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Monto Inicial:</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(selectedAllocation.montoInicial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Asignado a:</span>
                  <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.assignedToId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Asignado por:</span>
                  <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.assignedById)}</span>
                </div>
                {selectedAllocation.centroCostos && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Centro de Costos:</span>
                    <span className="text-sm font-medium">{selectedAllocation.centroCostos}</span>
                  </div>
                )}
                {selectedAllocation.motivo && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Motivo:</span>
                    <span className="text-sm bg-white p-2 rounded border">{selectedAllocation.motivo}</span>
                  </div>
                )}
                {selectedAllocation.fechaInicio && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Fecha de Inicio:</span>
                    <span className="text-sm font-medium">{new Date(selectedAllocation.fechaInicio).toLocaleDateString('es-CL')}</span>
                  </div>
                )}
                {selectedAllocation.fechaTermino && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Fecha de Término:</span>
                    <span className="text-sm font-medium">{new Date(selectedAllocation.fechaTermino).toLocaleDateString('es-CL')}</span>
                  </div>
                )}
                {selectedAllocation.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Fecha de Creación:</span>
                    <span className="text-sm font-medium">{new Date(selectedAllocation.createdAt).toLocaleDateString('es-CL')}</span>
                  </div>
                )}
                {selectedAllocation.fechaAprobacion && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Fecha de Aprobación:</span>
                    <span className="text-sm font-medium">{new Date(selectedAllocation.fechaAprobacion).toLocaleDateString('es-CL')}</span>
                  </div>
                )}
                {selectedAllocation.aprobadoPorId && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Aprobado por:</span>
                    <span className="text-sm font-medium">{getAssigneeName(selectedAllocation.aprobadoPorId)}</span>
                  </div>
                )}
                {selectedAllocation.comprobanteUrl && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Comprobante de Transferencia:</span>
                    <button 
                      onClick={() => {
                        setComprobanteUrl(selectedAllocation.comprobanteUrl);
                        setShowComprobanteModal(true);
                      }}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                      Ver comprobante
                    </button>
                  </div>
                )}
                {selectedAllocation.motivoRechazo && (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500 text-red-600">Motivo de Rechazo:</span>
                    <span className="text-sm bg-red-50 p-2 rounded border border-red-200 text-red-700">{selectedAllocation.motivoRechazo}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="sm:justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowDetailDialog(false);
                    setSelectedAllocation(null);
                  }}
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Ver Comprobante */}
      <Dialog open={showComprobanteModal} onOpenChange={setShowComprobanteModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Comprobante de Transferencia</DialogTitle>
          </DialogHeader>
          {comprobanteUrl && (
            <div className="flex flex-col items-center gap-4">
              {comprobanteUrl.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full">
                  <iframe 
                    src={comprobanteUrl} 
                    className="w-full h-[70vh] border rounded"
                    title="Comprobante PDF"
                  />
                </div>
              ) : (
                <img 
                  src={comprobanteUrl} 
                  alt="Comprobante de transferencia" 
                  className="max-w-full max-h-[70vh] object-contain rounded shadow-lg"
                />
              )}
              <a 
                href={comprobanteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Abrir en nueva pestaña
              </a>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComprobanteModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de asignación */}
      <Dialog open={showConfirmAsignacionDialog} onOpenChange={setShowConfirmAsignacionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <HandCoins className="h-5 w-5" />
              Confirmar Asignación
            </DialogTitle>
            <DialogDescription className="pt-4 text-base">
              Estás próximo a asignar{' '}
              <span className="font-bold text-green-600">
                {pendingAsignacionData ? formatCurrency(parseFloat(pendingAsignacionData.presupuesto)) : '$0'}
              </span>{' '}
              a{' '}
              <span className="font-bold text-blue-600">
                {pendingAsignacionData ? 
                  (salespeople.find((p: any) => p.id === pendingAsignacionData.usuarioResponsable)?.salespersonName || 
                   salespeople.find((p: any) => p.id === pendingAsignacionData.usuarioResponsable)?.email || 
                   'Usuario')
                  .split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
                  : 'Usuario'}
              </span>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
            <p className="text-sm text-amber-800 font-medium">
              ¿Deseas confirmar esta operación?
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Recuerda que el fondo se aprobará automáticamente al confirmar.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConfirmAsignacionDialog(false);
                setPendingAsignacionData(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmarAsignacionFondo}
              disabled={isUploadingCrearFondo}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirmar-asignacion"
            >
              {isUploadingCrearFondo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Sí, Confirmar Asignación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
