import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, AlertCircle, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PresupuestoMantencion {
  id: string;
  anio: number;
  mes: number;
  area: string | null;
  presupuestoAsignado: string;
  presupuestoEjecutado: string;
  createdAt: string;
  updatedAt: string;
}

interface MantencionPlanificada {
  id: string;
  equipoId: string | null;
  equipoNombre: string;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  costoEstimado: string;
  mes: number;
  anio: number;
  area: string | null;
  estado: string;
  prioridad: string;
  notas: string | null;
}

interface GastoMaterial {
  id: string;
  fecha: string;
  item: string;
  descripcion: string | null;
  cantidad: string;
  costoUnitario: string;
  costoTotal: string;
  area: string | null;
  otId: string | null;
  proveedorId: string | null;
  createdAt: string;
}

const presupuestoSchema = z.object({
  anio: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  area: z.string().optional().nullable(),
  presupuestoAsignado: z.coerce.number().min(0, "El presupuesto debe ser mayor o igual a 0"),
});

type PresupuestoFormValues = z.infer<typeof presupuestoSchema>;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const AREAS = [
  { value: null, label: "Global (Todas las áreas)" },
  { value: "administracion", label: "Administración" },
  { value: "produccion", label: "Producción" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "bodega_materias_primas", label: "Bodega Materias Primas" },
  { value: "bodega_productos_terminados", label: "Bodega Productos Terminados" },
];

export default function CMmsPresupuesto() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedArea, setSelectedArea] = useState<string>("global");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState<PresupuestoMantencion | null>(null);
  const [selectedMes, setSelectedMes] = useState<number | null>(null);

  const form = useForm<PresupuestoFormValues>({
    resolver: zodResolver(presupuestoSchema),
    defaultValues: {
      anio: currentYear,
      mes: 1,
      area: null,
      presupuestoAsignado: 0,
    },
  });

  // Fetch presupuestos
  const { data: presupuestos, isLoading } = useQuery<PresupuestoMantencion[]>({
    queryKey: ["/api/cmms/presupuesto", selectedYear, selectedArea],
    queryFn: async () => {
      const params = new URLSearchParams({
        anio: selectedYear,
        ...(selectedArea !== "global" && { area: selectedArea }),
      });
      const response = await fetch(`/api/cmms/presupuesto?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar presupuestos');
      return response.json();
    }
  });

  // Fetch mantenciones planificadas
  const { data: mantencionesPlanificadas, isLoading: isLoadingPlanificadas } = useQuery<MantencionPlanificada[]>({
    queryKey: ["/api/cmms/mantenciones-planificadas", selectedYear, selectedArea],
    queryFn: async () => {
      const params = new URLSearchParams({
        anio: selectedYear,
        ...(selectedArea !== "global" && { area: selectedArea }),
      });
      const response = await fetch(`/api/cmms/mantenciones-planificadas?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar mantenciones planificadas');
      return response.json();
    }
  });

  // Fetch gastos de materiales
  const { data: gastosResponse, isLoading: isLoadingGastos } = useQuery<{
    data: GastoMaterial[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ["/api/cmms/gastos-materiales", selectedYear, selectedArea],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: "1",
        pageSize: "10000", // Request all records for the year
        ...(selectedArea !== "global" && { area: selectedArea }),
      });
      const response = await fetch(`/api/cmms/gastos-materiales?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar gastos de materiales');
      return response.json();
    }
  });

  const gastosMateriales = gastosResponse?.data || [];

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PresupuestoFormValues) => {
      const existing = presupuestos?.find(
        p => p.anio === data.anio && 
        p.mes === data.mes && 
        (p.area === data.area || (!p.area && !data.area))
      );

      if (existing) {
        return apiRequest(`/api/cmms/presupuesto/${existing.id}`, {
          method: "PATCH",
          data,
        });
      } else {
        return apiRequest("/api/cmms/presupuesto", {
          method: "POST",
          data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/presupuesto"] });
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto ha sido guardado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar el presupuesto.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (mes?: number, presupuesto?: PresupuestoMantencion) => {
    const mesActual = mes ?? presupuesto?.mes ?? 1;
    setSelectedMes(mesActual);
    
    if (presupuesto) {
      setEditingPresupuesto(presupuesto);
      form.reset({
        anio: presupuesto.anio,
        mes: presupuesto.mes,
        area: presupuesto.area,
        presupuestoAsignado: parseFloat(presupuesto.presupuestoAsignado),
      });
    } else {
      setEditingPresupuesto(null);
      form.reset({
        anio: parseInt(selectedYear),
        mes: mesActual,
        area: selectedArea === "global" ? null : selectedArea,
        presupuestoAsignado: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPresupuesto(null);
    setSelectedMes(null);
    form.reset();
  };

  const handleSubmit = (data: PresupuestoFormValues) => {
    saveMutation.mutate(data);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getDesvioPercentage = (asignado: string, ejecutado: string) => {
    const asig = parseFloat(asignado);
    const ejec = parseFloat(ejecutado);
    if (asig === 0) return 0;
    return ((ejec - asig) / asig) * 100;
  };

  const getDesvioColor = (desvio: number) => {
    if (desvio > 10) return "text-red-500";
    if (desvio > 0) return "text-yellow-500";
    return "text-green-500";
  };

  const getDesvioIcon = (desvio: number) => {
    if (desvio > 10) return <AlertCircle className="h-4 w-4" />;
    if (desvio > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  // Calculate presupuesto asignado = base + mantenciones (planificada + aprobado + completado)
  const getPresupuestoAsignado = (mes: number) => {
    const presupuesto = presupuestos?.find(p => 
      p.mes === mes && 
      p.anio === Number(selectedYear) &&
      (selectedArea === 'global' ? !p.area : p.area === selectedArea)
    );
    const base = presupuesto ? parseFloat(presupuesto.presupuestoAsignado) : 0;
    
    // Sumar mantenciones planificadas, aprobadas y completadas del mes
    const mantAsignadas = mantencionesPlanificadas
      ?.filter(m => m.mes === mes && ['planificado', 'aprobado', 'completado'].includes(m.estado))
      .reduce((sum, m) => sum + parseFloat(m.costoEstimado), 0) || 0;
    
    return base + mantAsignadas;
  };

  // Calculate presupuesto ejecutado = base + gastos materiales + mantenciones completadas
  const getPresupuestoEjecutado = (mes: number) => {
    const presupuesto = presupuestos?.find(p => 
      p.mes === mes && 
      p.anio === Number(selectedYear) &&
      (selectedArea === 'global' ? !p.area : p.area === selectedArea)
    );
    const base = presupuesto ? parseFloat(presupuesto.presupuestoEjecutado) : 0;
    
    // Sumar gastos de materiales del mes (usar UTC para evitar problemas de zona horaria)
    const gastosDelMes = gastosMateriales
      ?.filter(g => {
        const fecha = new Date(g.fecha);
        return fecha.getUTCMonth() + 1 === mes;
      })
      .reduce((sum, g) => sum + parseFloat(g.costoTotal), 0) || 0;
    
    // Sumar mantenciones planificadas completadas del mes
    const mantCompletadas = mantencionesPlanificadas
      ?.filter(m => m.mes === mes && m.estado === 'completado')
      .reduce((sum, m) => sum + parseFloat(m.costoEstimado), 0) || 0;
    
    return base + gastosDelMes + mantCompletadas;
  };

  // Prepare data for chart
  const chartData = {
    labels: MESES,
    datasets: [
      {
        label: 'Presupuesto Asignado',
        data: MESES.map((_, idx) => getPresupuestoAsignado(idx + 1)),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Presupuesto Ejecutado',
        data: MESES.map((_, idx) => getPresupuestoEjecutado(idx + 1)),
        backgroundColor: 'rgba(234, 88, 12, 0.5)',
        borderColor: 'rgb(234, 88, 12)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Presupuesto Asignado vs Ejecutado',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  // Calculate totals
  const totalAsignado = MESES.reduce((sum, _, idx) => sum + getPresupuestoAsignado(idx + 1), 0);
  const totalEjecutado = MESES.reduce((sum, _, idx) => sum + getPresupuestoEjecutado(idx + 1), 0);
  const totalDesvio = getDesvioPercentage(totalAsignado.toString(), totalEjecutado.toString());

  if (isLoading || isLoadingPlanificadas || isLoadingGastos) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando presupuestos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-presupuesto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/cmms")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-title">
                <DollarSign className="h-8 w-8" />
                Presupuesto Anual
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Configuración y seguimiento del presupuesto de mantención
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Año</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="select-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                    <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                    <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Área</label>
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger data-testid="select-area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (Todas)</SelectItem>
                    <SelectItem value="administracion">Administración</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                    <SelectItem value="laboratorio">Laboratorio</SelectItem>
                    <SelectItem value="bodega_materias_primas">Bodega Materias Primas</SelectItem>
                    <SelectItem value="bodega_productos_terminados">Bodega Productos Terminados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Asignado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-asignado">
                {formatCurrency(totalAsignado)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ejecutado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-ejecutado">
                {formatCurrency(totalEjecutado)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desvío Total</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-2 ${getDesvioColor(totalDesvio)}`} data-testid="text-total-desvio">
                {getDesvioIcon(totalDesvio)}
                {totalDesvio.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Table */}
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto Mensual {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Presupuesto Asignado</TableHead>
                    <TableHead>Presupuesto Ejecutado</TableHead>
                    <TableHead>Desvío (%)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MESES.map((mes, idx) => {
                    const mesNum = idx + 1;
                    const presupuesto = presupuestos?.find(p => 
                      p.mes === mesNum && 
                      p.anio === Number(selectedYear) &&
                      (selectedArea === 'global' ? !p.area : p.area === selectedArea)
                    );
                    const asignado = getPresupuestoAsignado(mesNum);
                    const ejecutado = getPresupuestoEjecutado(mesNum);
                    const desvio = getDesvioPercentage(asignado.toString(), ejecutado.toString());

                    return (
                      <TableRow key={mesNum} data-testid={`row-mes-${mesNum}`}>
                        <TableCell className="font-medium">{mes}</TableCell>
                        <TableCell>{formatCurrency(asignado)}</TableCell>
                        <TableCell>{formatCurrency(ejecutado)}</TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1 ${getDesvioColor(desvio)}`}>
                            {getDesvioIcon(desvio)}
                            {desvio.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          {asignado > 0 ? (
                            <Badge variant={desvio > 10 ? "destructive" : desvio > 0 ? "secondary" : "default"}>
                              {desvio > 10 ? "Sobrepresupuesto" : desvio > 0 ? "En seguimiento" : "Normal"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Sin configurar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(mesNum, presupuesto)}
                            data-testid={`button-edit-${mesNum}`}
                          >
                            <Edit className="h-4 w-4" />
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

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gráfico Anual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] flex items-center justify-center">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPresupuesto ? "Editar Presupuesto" : "Configurar Presupuesto"}
              </DialogTitle>
              <DialogDescription>
                {selectedMes && `Mes: ${MESES[selectedMes - 1]} ${selectedYear}`}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Presupuesto Asignado */}
                <FormField
                  control={form.control}
                  name="presupuestoAsignado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presupuesto Asignado (CLP) *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01" 
                          placeholder="Ej: 1000000" 
                          data-testid="input-presupuesto-asignado"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-submit"
                  >
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
