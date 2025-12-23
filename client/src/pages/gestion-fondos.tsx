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
import { Plus, Search, HandCoins, Upload, Loader2 } from "lucide-react";

const crearFondoSchema = z.object({
  presupuesto: z.string().min(1, "El presupuesto es requerido"),
  nombre: z.string().min(1, "El nombre del fondo es requerido"),
  idContabilidad: z.string().optional(),
  centroCostos: z.string().min(1, "El centro de costos es requerido"),
  abonosRecurrentes: z.string().default("no"),
  usuarioResponsable: z.string().min(1, "El usuario responsable es requerido"),
  beneficiario: z.string().optional(),
  participantes: z.string().optional(),
  fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
  fechaTermino: z.string().min(1, "La fecha de término es requerida"),
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
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("asignaciones");
  const [showCrearFondoDialog, setShowCrearFondoDialog] = useState(false);
  const [showSolicitarFondoDialog, setShowSolicitarFondoDialog] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedAllocation, setSelectedAllocation] = useState<FundAllocation | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const canManageFunds = user?.role === 'admin' || user?.role === 'recursos_humanos';

  // Fetch fund allocations
  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations'],
    queryFn: async () => {
      const response = await fetch('/api/fund-allocations', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
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
      idContabilidad: "",
      centroCostos: "",
      abonosRecurrentes: "no",
      usuarioResponsable: "",
      beneficiario: "",
      participantes: "",
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
          descripcion: data.idContabilidad ? `ID Contabilidad: ${data.idContabilidad}` : '',
          montoInicial: parseFloat(data.presupuesto),
          assignedToId: data.usuarioResponsable,
          fechaInicio: data.fechaInicio || null,
          fechaFin: data.fechaTermino || null,
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

  const handleCrearFondo = (data: CrearFondoFormData) => {
    crearFondoMutation.mutate(data);
  };

  const handleSolicitarFondo = (data: SolicitarFondoFormData) => {
    solicitarFondoMutation.mutate(data);
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
    switch (estado) {
      case 'solicitud':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Solicitud</Badge>;
      case 'pendiente':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case 'activo':
      case 'abierto':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activo</Badge>;
      case 'cerrado':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cerrado</Badge>;
      case 'rechazado':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
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

    const matchesTipo = tipoFilter === "all" || fondo.estado === tipoFilter;

    return matchesSearch && matchesTipo;
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
              <TableHead>Estado</TableHead>
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
                    <div>
                      <p className="font-medium text-sm">{fondo.nombre}</p>
                      {fondo.descripcion && (
                        <p className="text-xs text-gray-500">{fondo.descripcion}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(fondo.montoInicial || 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {formatCurrency(fondo.saldoDisponible || 0)}
                  </TableCell>
                  <TableCell>{getEstadoBadge(fondo.estado)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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
          <div className={`flex flex-col sm:flex-row gap-2 ${embedded ? 'ml-auto' : ''}`}>
            <Button 
              className="w-full sm:w-auto" 
              data-testid="button-crear-fondo"
              onClick={() => setShowCrearFondoDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear nuevo Fondo
            </Button>
            <Button 
              variant="secondary"
              className="w-full sm:w-auto" 
              data-testid="button-solicitar-fondo"
              onClick={() => setShowSolicitarFondoDialog(true)}
            >
              <HandCoins className="h-4 w-4 mr-2" />
              Solicitar Fondo
            </Button>
          </div>
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
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="operativo">Operativo</SelectItem>
              <SelectItem value="viático">Viático</SelectItem>
              <SelectItem value="proyecto">Proyecto</SelectItem>
              <SelectItem value="emergencia">Emergencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="solicitudes" data-testid="tab-solicitudes">Solicitudes</TabsTrigger>
            <TabsTrigger value="pendientes" data-testid="tab-pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="abiertos" data-testid="tab-abiertos">Abiertos</TabsTrigger>
            <TabsTrigger value="cerrados" data-testid="tab-cerrados">Cerrados</TabsTrigger>
            <TabsTrigger value="rechazados" data-testid="tab-rechazados">Rechazados</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitudes" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="pendientes" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="abiertos" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="cerrados" className="mt-4">
            {renderTable()}
          </TabsContent>
          <TabsContent value="rechazados" className="mt-4">
            {renderTable()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Crear Fondo */}
      <Dialog open={showCrearFondoDialog} onOpenChange={setShowCrearFondoDialog}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Crear nuevo Fondo</DialogTitle>
            <DialogDescription>
              Complete los datos para configurar el presupuesto y asignaciones.
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  name="idContabilidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID de Contabilidad</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-id-contabilidad" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={crearFondoForm.control}
                  name="centroCostos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Costos</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-centro-costos-crear">
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
                  control={crearFondoForm.control}
                  name="abonosRecurrentes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abonos Recurrentes</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-abonos">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Sí">Sí</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t border-gray-200" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={crearFondoForm.control}
                  name="usuarioResponsable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario Responsable</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-responsable">
                            <SelectValue placeholder="Asignar responsable..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="u1">Juan Pérez</SelectItem>
                          <SelectItem value="u2">María González</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={crearFondoForm.control}
                  name="beneficiario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beneficiario</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-beneficiario">
                            <SelectValue placeholder="Asignar beneficiario..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Externo">Externo</SelectItem>
                          <SelectItem value="Solicitante">Solicitante</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={crearFondoForm.control}
                name="participantes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participantes (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-participantes">
                          <SelectValue placeholder="Agregar participantes..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="team1">Equipo de Desarrollo</SelectItem>
                        <SelectItem value="team2">Equipo de Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t border-gray-200" />

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

              <DialogFooter className="sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCrearFondoDialog(false)}
                >
                  Cerrar
                </Button>
                <Button 
                  type="submit" 
                  disabled={crearFondoMutation.isPending}
                  data-testid="button-submit-crear-fondo"
                >
                  {crearFondoMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Fondo'
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
    </>
  );
}
