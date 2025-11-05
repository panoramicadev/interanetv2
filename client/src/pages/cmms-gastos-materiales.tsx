import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Plus, Receipt, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

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
  adjuntoUrl: string | null;
  createdAt: string;
  proveedor?: {
    id: string;
    nombre: string;
  };
}

const gastoSchema = z.object({
  fecha: z.string().min(1, "La fecha es requerida"),
  item: z.string().min(1, "El ítem es requerido"),
  descripcion: z.string().optional(),
  cantidad: z.string().min(1, "La cantidad es requerida"),
  costoUnitario: z.string().min(1, "El costo unitario es requerido"),
  area: z.string().optional().nullable(),
  otId: z.string().optional().nullable(),
  proveedorId: z.string().optional().nullable(),
});

type GastoFormValues = z.infer<typeof gastoSchema>;

const AREAS = [
  { value: null, label: "Sin asignar" },
  { value: "administracion", label: "Administración" },
  { value: "produccion", label: "Producción" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "bodega_materias_primas", label: "Bodega Materias Primas" },
  { value: "bodega_productos_terminados", label: "Bodega Productos Terminados" },
];

export default function CMmsGastosMateriales() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [filterArea, setFilterArea] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<GastoFormValues>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      item: "",
      descripcion: "",
      cantidad: "",
      costoUnitario: "",
      area: null,
      otId: null,
      proveedorId: null,
    },
  });

  // Fetch gastos
  const { data: gastos, isLoading } = useQuery<GastoMaterial[]>({
    queryKey: ["/api/cmms/gastos-materiales", selectedYear, selectedMonth, filterArea],
    queryFn: async () => {
      const params = new URLSearchParams({
        anio: selectedYear,
        mes: selectedMonth,
        ...(filterArea !== "all" && { area: filterArea }),
      });
      const response = await fetch(`/api/cmms/gastos-materiales?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar gastos');
      return response.json();
    }
  });

  // Fetch proveedores for dropdown
  const { data: proveedores } = useQuery<Array<{ id: string; nombre: string }>>({
    queryKey: ["/api/cmms/proveedores"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: GastoFormValues) => {
      const cantidad = parseFloat(data.cantidad);
      const costoUnitario = parseFloat(data.costoUnitario);
      const costoTotal = cantidad * costoUnitario;

      return apiRequest("/api/cmms/gastos-materiales", {
        method: "POST",
        data: {
          ...data,
          cantidad: data.cantidad,
          costoUnitario: data.costoUnitario,
          costoTotal: costoTotal.toString(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/gastos-materiales"] });
      toast({
        title: "Gasto registrado",
        description: "El gasto ha sido registrado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo registrar el gasto.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = () => {
    form.reset({
      fecha: new Date().toISOString().split('T')[0],
      item: "",
      descripcion: "",
      cantidad: "",
      costoUnitario: "",
      area: null,
      otId: null,
      proveedorId: null,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    form.reset();
  };

  const handleSubmit = (data: GastoFormValues) => {
    createMutation.mutate(data);
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy");
  };

  // Calculate totals
  const totalGastos = gastos?.reduce((sum, g) => sum + parseFloat(g.costoTotal), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando gastos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-gastos-materiales">
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
                <Receipt className="h-8 w-8" />
                Gastos de Materiales
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Registro de gastos en materiales de mantención
              </p>
            </div>
          </div>
          <Button onClick={handleOpenDialog} data-testid="button-create">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Gasto
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total del Período</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-gastos">
              {formatCurrency(totalGastos)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {gastos?.length || 0} registro(s)
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <label className="text-sm font-medium mb-2 block">Mes</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Enero</SelectItem>
                    <SelectItem value="2">Febrero</SelectItem>
                    <SelectItem value="3">Marzo</SelectItem>
                    <SelectItem value="4">Abril</SelectItem>
                    <SelectItem value="5">Mayo</SelectItem>
                    <SelectItem value="6">Junio</SelectItem>
                    <SelectItem value="7">Julio</SelectItem>
                    <SelectItem value="8">Agosto</SelectItem>
                    <SelectItem value="9">Septiembre</SelectItem>
                    <SelectItem value="10">Octubre</SelectItem>
                    <SelectItem value="11">Noviembre</SelectItem>
                    <SelectItem value="12">Diciembre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Área</label>
                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger data-testid="select-area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
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

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos Registrados ({gastos?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ítem</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Costo Unit.</TableHead>
                    <TableHead>Costo Total</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Proveedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No hay gastos registrados en este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    gastos?.map((gasto) => (
                      <TableRow key={gasto.id} data-testid={`row-gasto-${gasto.id}`}>
                        <TableCell>{formatDate(gasto.fecha)}</TableCell>
                        <TableCell className="font-medium">{gasto.item}</TableCell>
                        <TableCell className="max-w-xs truncate">{gasto.descripcion || "-"}</TableCell>
                        <TableCell>{parseFloat(gasto.cantidad).toFixed(2)}</TableCell>
                        <TableCell>{formatCurrency(gasto.costoUnitario)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(gasto.costoTotal)}</TableCell>
                        <TableCell>{gasto.area || "-"}</TableCell>
                        <TableCell>{gasto.proveedor?.nombre || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
              <DialogDescription>
                Completa los datos del gasto en materiales de mantención
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha */}
                  <FormField
                    control={form.control}
                    name="fecha"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-fecha" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Ítem */}
                  <FormField
                    control={form.control}
                    name="item"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ítem *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Rodamiento SKF 6205" data-testid="input-item" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Cantidad */}
                  <FormField
                    control={form.control}
                    name="cantidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad *</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ej: 2" data-testid="input-cantidad" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Costo Unitario */}
                  <FormField
                    control={form.control}
                    name="costoUnitario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo Unitario (CLP) *</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ej: 15000" data-testid="input-costo-unitario" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Área */}
                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Área</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <SelectTrigger data-testid="select-form-area">
                            <SelectValue placeholder="Seleccionar área" />
                          </SelectTrigger>
                          <SelectContent>
                            {AREAS.map((area) => (
                              <SelectItem key={area.value || "null"} value={area.value || "null"}>
                                {area.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Proveedor */}
                  <FormField
                    control={form.control}
                    name="proveedorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || undefined}
                        >
                          <SelectTrigger data-testid="select-proveedor">
                            <SelectValue placeholder="Seleccionar proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Sin asignar</SelectItem>
                            {proveedores?.map((prov) => (
                              <SelectItem key={prov.id} value={prov.id}>
                                {prov.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descripción */}
                  <FormField
                    control={form.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detalles adicionales" rows={3} data-testid="textarea-descripcion" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    Registrar Gasto
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
