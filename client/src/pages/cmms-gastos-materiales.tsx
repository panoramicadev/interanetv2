import { useState, useRef, useEffect } from "react";
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
import { ArrowLeft, Plus, Receipt, DollarSign, Trash2, Download, Upload, Check, AlertCircle, Edit, ChevronLeft, ChevronRight } from "lucide-react";
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

interface FilaParseada {
  fila: number;
  estado: 'valido' | 'error';
  error?: string;
  datos: any;
}

interface PreviewData {
  totalFilas: number;
  filasValidas: number;
  filasConError: number;
  filasParseadas: FilaParseada[];
  errores: Array<{ fila: number; error: string }>;
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
  { value: "servicios_generales", label: "Servicios Generales" },
  { value: "mantencion", label: "Mantención" },
  { value: "comercial", label: "Comercial" },
];

export default function CMmsGastosMateriales() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gastoToDelete, setGastoToDelete] = useState<GastoMaterial | null>(null);
  const [gastoToEdit, setGastoToEdit] = useState<GastoMaterial | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch gastos with server-side pagination
  const { data: gastosResponse, isLoading } = useQuery<{
    data: GastoMaterial[];
    total: number;
    costoPeriodo: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ["/api/cmms/gastos-materiales", selectedYear, selectedMonth, filterArea, currentPage, PAGE_SIZE],
    queryFn: async () => {
      const params = new URLSearchParams({
        anio: selectedYear,
        page: currentPage.toString(),
        pageSize: PAGE_SIZE.toString(),
        ...(selectedMonth !== "all" && { mes: selectedMonth }),
        ...(filterArea !== "all" && { area: filterArea }),
      });
      const response = await fetch(`/api/cmms/gastos-materiales?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Error al cargar gastos');
      return response.json();
    }
  });

  const gastos = gastosResponse?.data || [];
  const totalRecords = gastosResponse?.total || 0;
  const costoPeriodo = gastosResponse?.costoPeriodo || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonth, filterArea]);

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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GastoFormValues }) => {
      const cantidad = parseFloat(data.cantidad);
      const costoUnitario = parseFloat(data.costoUnitario);
      const costoTotal = cantidad * costoUnitario;

      return apiRequest(`/api/cmms/gastos-materiales/${id}`, {
        method: "PUT",
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
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/presupuesto"] });
      toast({
        title: "Gasto actualizado",
        description: "El gasto ha sido actualizado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el gasto.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/cmms/gastos-materiales/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Invalidate both gastos and presupuesto queries since presupuesto ejecutado is calculated dynamically
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/gastos-materiales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/presupuesto"] });
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado exitosamente.",
      });
      setDeleteDialogOpen(false);
      setGastoToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto.",
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
    setGastoToEdit(null);
    form.reset();
  };

  const handleOpenEditDialog = (gasto: GastoMaterial) => {
    setGastoToEdit(gasto);
    // Parse fecha directly as string to avoid timezone issues
    const fechaStr = gasto.fecha.split('T')[0]; // Extract YYYY-MM-DD
    form.reset({
      fecha: fechaStr,
      item: gasto.item,
      descripcion: gasto.descripcion || "",
      cantidad: gasto.cantidad,
      costoUnitario: gasto.costoUnitario,
      area: gasto.area,
      otId: gasto.otId,
      proveedorId: gasto.proveedorId,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (data: GastoFormValues) => {
    if (gastoToEdit) {
      updateMutation.mutate({ id: gastoToEdit.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleOpenDeleteDialog = (gasto: GastoMaterial) => {
    setGastoToDelete(gasto);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (gastoToDelete) {
      deleteMutation.mutate(gastoToDelete.id);
    }
  };

  const handleDescargarPlantilla = async () => {
    try {
      const response = await fetch('/api/cmms/gastos-materiales/plantilla-excel', {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Error al descargar plantilla');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_gastos_materiales.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Plantilla descargada",
        description: "La plantilla Excel se ha descargado exitosamente",
      });
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast({
        title: "Error",
        description: "Error al descargar la plantilla Excel",
        variant: "destructive",
      });
    }
  };

  const handleExportar = async () => {
    try {
      const params = new URLSearchParams({
        anio: selectedYear,
        ...(selectedMonth !== "all" && { mes: selectedMonth }),
        ...(filterArea !== "all" && { area: filterArea }),
      });

      const response = await fetch(`/api/cmms/gastos-materiales-export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Error al exportar gastos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'gastos_materiales.xlsx';

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Excel exportado",
        description: `Se han exportado ${totalRecords} registros exitosamente`,
      });
    } catch (error) {
      console.error('Error al exportar gastos:', error);
      toast({
        title: "Error",
        description: "Error al exportar los gastos a Excel",
        variant: "destructive",
      });
    }
  };

  const handleImportarExcel = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSelectedFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Primero obtener preview sin guardar
      const response = await fetch('/api/cmms/gastos-materiales/importar-excel?preview=true', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al procesar Excel');
      }

      const preview: PreviewData = await response.json();

      setPreviewData(preview);
      setPreviewDialogOpen(true);

    } catch (error: any) {
      console.error('Error al procesar Excel:', error);
      toast({
        title: "Error",
        description: error.message || "Error al procesar el archivo Excel",
        variant: "destructive",
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setPreviewDialogOpen(false);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Ahora sí importar con preview=false (default)
      const response = await fetch('/api/cmms/gastos-materiales/importar-excel', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al importar Excel');
      }

      const result = await response.json();

      toast({
        title: "✅ Importación exitosa",
        description: `${result.gastosCreados} gastos creados correctamente${result.errores && result.errores.length > 0 ? `, ${result.errores.length} filas con errores` : ''}`,
      });

      // Invalidar queries para recargar datos
      queryClient.invalidateQueries({ queryKey: ['/api/cmms/gastos-materiales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cmms/presupuesto'] });

    } catch (error: any) {
      console.error('Error al importar Excel:', error);
      toast({
        title: "Error",
        description: error.message || "Error al importar el archivo Excel",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      setPreviewData(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelPreview = () => {
    setPreviewDialogOpen(false);
    setPreviewData(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  // Total de la página actual (no se usa, pero se mantiene por compatibilidad)
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
        <div className="space-y-4 md:space-y-0 md:flex md:flex-col md:gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/cmms")}
              data-testid="button-back"
              className="flex-shrink-0"
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleDescargarPlantilla}
              data-testid="button-descargar-plantilla"
              className="flex-grow"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={handleImportarExcel}
              disabled={isImporting}
              data-testid="button-importar-excel"
              className="flex-grow"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importando..." : "Importar Excel"}
            </Button>
            <Button
              variant="default"
              onClick={handleExportar}
              data-testid="button-exportar"
              className="bg-green-600 hover:bg-green-700 flex-grow"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar a Excel
            </Button>
            <Button
              onClick={handleOpenDialog}
              data-testid="button-create"
              className="flex-grow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Gasto
            </Button>
          </div>
        </div>

        {/* Hidden file input for Excel import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          data-testid="input-file-excel"
        />

        {/* Summary Card - Total del Periodo (dinámico con filtros) */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Total del Periodo</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-total-periodo">
              {formatCurrency(costoPeriodo)}
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1" data-testid="text-total-registros">
              {totalRecords} registro(s)
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
                    <SelectItem value="all">Todos los meses</SelectItem>
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
                    <SelectItem value="servicios_generales">Servicios Generales</SelectItem>
                    <SelectItem value="mantencion">Mantención</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
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
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Fecha</TableHead>
                    <TableHead className="max-w-[200px]">Ítem</TableHead>
                    <TableHead className="text-right w-[80px]">Cant.</TableHead>
                    <TableHead className="text-right w-[100px]">C. Unit.</TableHead>
                    <TableHead className="text-right w-[120px]">C. Total</TableHead>
                    <TableHead className="w-[120px]">Área</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastos?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No hay gastos registrados en este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    gastos?.map((gasto) => (
                      <TableRow key={gasto.id} data-testid={`row-gasto-${gasto.id}`}>
                        <TableCell className="text-sm">{formatDate(gasto.fecha)}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={gasto.item}>
                          {gasto.item}
                        </TableCell>
                        <TableCell className="text-right text-sm">{parseFloat(gasto.cantidad).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(gasto.costoUnitario)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(gasto.costoTotal)}</TableCell>
                        <TableCell className="text-sm capitalize">
                          {gasto.area?.replace(/_/g, ' ') || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditDialog(gasto)}
                              data-testid={`button-edit-${gasto.id}`}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteDialog(gasto)}
                              data-testid={`button-delete-${gasto.id}`}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {totalRecords > 0 && (
              <div className="mt-4 overflow-hidden">
                <div className="flex flex-wrap justify-center sm:justify-between items-center">
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, totalRecords)} de {totalRecords} registros
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-2 px-3 text-sm">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                      className="flex-shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="whitespace-nowrap">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                      className="flex-shrink-0"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{gastoToEdit ? "Editar Gasto" : "Registrar Nuevo Gasto"}</DialogTitle>
              <DialogDescription>
                {gastoToEdit ? "Modifica los datos del gasto" : "Completa los datos del gasto en materiales de mantención"}
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
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {gastoToEdit ? "Actualizar Gasto" : "Registrar Gasto"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este gasto?
              </DialogDescription>
            </DialogHeader>
            {gastoToDelete && (
              <div className="space-y-2">
                <p className="text-sm"><strong>Ítem:</strong> {gastoToDelete.item}</p>
                <p className="text-sm"><strong>Fecha:</strong> {formatDate(gastoToDelete.fecha)}</p>
                <p className="text-sm"><strong>Costo Total:</strong> {formatCurrency(gastoToDelete.costoTotal)}</p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setGastoToDelete(null);
                }}
                data-testid="button-cancel-delete"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={(open) => {
          if (!open) handleCancelPreview();
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Vista Previa de Importación</DialogTitle>
              <DialogDescription>
                Revisa los datos antes de confirmar la importación
              </DialogDescription>
            </DialogHeader>

            {previewData && (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">{previewData.totalFilas}</div>
                        <div className="text-sm text-muted-foreground">Total de filas</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{previewData.filasValidas}</div>
                        <div className="text-sm text-muted-foreground">Filas válidas</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{previewData.filasConError}</div>
                        <div className="text-sm text-muted-foreground">Filas con error</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla con scroll */}
                <div className="flex-1 overflow-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-16">Estado</TableHead>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Ítem</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo Unit.</TableHead>
                        <TableHead className="text-right">Costo Total</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.filasParseadas.map((fila) => (
                        <TableRow key={fila.fila} className={fila.estado === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                          <TableCell>
                            {fila.estado === 'valido' ? (
                              <Check className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`icon-valid-${fila.fila}`} />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" data-testid={`icon-error-${fila.fila}`} />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{fila.fila}</TableCell>
                          <TableCell className="text-sm">{fila.datos['Fecha (YYYY-MM-DD)'] || fila.datos['Fecha'] || '-'}</TableCell>
                          <TableCell className="text-sm">{fila.datos['Item'] || '-'}</TableCell>
                          <TableCell className="text-right text-sm">{fila.datos['Cantidad'] || '-'}</TableCell>
                          <TableCell className="text-right text-sm">{fila.datos['Costo Unitario'] ? new Intl.NumberFormat('es-CL').format(fila.datos['Costo Unitario']) : '-'}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {fila.datos['Costo Total'] ? formatCurrency(fila.datos['Costo Total']) : '-'}
                          </TableCell>
                          <TableCell className="text-sm">{fila.datos['Área'] || fila.datos['Area'] || '-'}</TableCell>
                          <TableCell className="text-sm text-red-600 dark:text-red-400">{fila.error || ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Errores detallados si hay */}
                {previewData.errores && previewData.errores.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                    <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                      Errores Detectados ({previewData.errores.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {previewData.errores.slice(0, 10).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-700 dark:text-red-300">
                          • Fila {err.fila}: {err.error}
                        </p>
                      ))}
                      {previewData.errores.length > 10 && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                          ...y {previewData.errores.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelPreview}
                data-testid="button-cancel-preview"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || !previewData || previewData.filasValidas === 0}
                data-testid="button-confirm-import"
              >
                {isImporting ? "Importando..." : `Confirmar e Importar (${previewData?.filasValidas || 0} registros)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
