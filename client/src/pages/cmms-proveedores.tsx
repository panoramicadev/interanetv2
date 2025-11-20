import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { canAccessCMMSFull, canEditCMMS, canDeleteCMMS } from "@/lib/cmmsPermissions";
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
import { ArrowLeft, Plus, Pencil, Trash2, Users, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProveedorMantencion {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  especialidad: string | null;
  evaluacion: string | null;
  costoPromedioHora: string | null;
  notas: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  especialidad: z.string().optional(),
  evaluacion: z.string().optional(),
  costoPromedioHora: z.string().optional(),
  notas: z.string().optional(),
  activo: z.boolean().default(true),
});

type ProveedorFormValues = z.infer<typeof proveedorSchema>;

export default function CMmsProveedores() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Permisos basados en rol
  const canAccessFull = canAccessCMMSFull(user?.role);
  const canEdit = canEditCMMS(user?.role);
  const canDelete = canDeleteCMMS(user?.role);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<ProveedorMantencion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proveedorToDelete, setProveedorToDelete] = useState<string | null>(null);

  const form = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      especialidad: "",
      evaluacion: "",
      costoPromedioHora: "",
      notas: "",
      activo: true,
    },
  });

  // Fetch proveedores
  const { data: proveedores, isLoading } = useQuery<ProveedorMantencion[]>({
    queryKey: ["/api/cmms/proveedores"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProveedorFormValues) => {
      return apiRequest("/api/cmms/proveedores", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/proveedores"] });
      toast({
        title: "Proveedor creado",
        description: "El proveedor ha sido creado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el proveedor.",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProveedorFormValues }) => {
      return apiRequest(`/api/cmms/proveedores/${id}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/proveedores"] });
      toast({
        title: "Proveedor actualizado",
        description: "El proveedor ha sido actualizado exitosamente.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el proveedor.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/cmms/proveedores/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmms/proveedores"] });
      toast({
        title: "Proveedor eliminado",
        description: "El proveedor ha sido eliminado exitosamente.",
      });
      setDeleteDialogOpen(false);
      setProveedorToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el proveedor.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (proveedor?: ProveedorMantencion) => {
    if (proveedor) {
      setEditingProveedor(proveedor);
      form.reset({
        nombre: proveedor.nombre,
        contacto: proveedor.contacto || "",
        telefono: proveedor.telefono || "",
        email: proveedor.email || "",
        especialidad: proveedor.especialidad || "",
        evaluacion: proveedor.evaluacion || "",
        costoPromedioHora: proveedor.costoPromedioHora || "",
        notas: proveedor.notas || "",
        activo: proveedor.activo,
      });
    } else {
      setEditingProveedor(null);
      form.reset({
        nombre: "",
        contacto: "",
        telefono: "",
        email: "",
        especialidad: "",
        evaluacion: "",
        costoPromedioHora: "",
        notas: "",
        activo: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProveedor(null);
    form.reset();
  };

  const handleSubmit = (data: ProveedorFormValues) => {
    if (editingProveedor) {
      updateMutation.mutate({ id: editingProveedor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteClick = (id: string) => {
    setProveedorToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (proveedorToDelete) {
      deleteMutation.mutate(proveedorToDelete);
    }
  };

  // Filter proveedores
  const filteredProveedores = proveedores?.filter((proveedor) => {
    const matchesSearch = proveedor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor.especialidad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proveedor.contacto?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEstado = filterEstado === "all" || 
      (filterEstado === "activo" && proveedor.activo) ||
      (filterEstado === "inactivo" && !proveedor.activo);

    return matchesSearch && matchesEstado;
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "N/A";
    const num = parseFloat(value);
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(num);
  };

  const renderStars = (rating: string | null) => {
    if (!rating) return "Sin evaluar";
    const num = parseFloat(rating);
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < num ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
        <span className="text-sm text-muted-foreground ml-1">({num.toFixed(1)})</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando proveedores...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8" data-testid="page-cmms-proveedores">
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
                <Users className="h-8 w-8" />
                Proveedores Externos
              </h1>
              <p className="text-muted-foreground" data-testid="text-subtitle">
                Gestión de proveedores de mantención
              </p>
            </div>
          </div>
          {canAccessFull && (
            <Button onClick={() => handleOpenDialog()} data-testid="button-create">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Proveedor
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder="Buscar por nombre, especialidad o contacto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger data-testid="select-estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Proveedores ({filteredProveedores?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead>Evaluación</TableHead>
                    <TableHead>Costo/Hora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProveedores?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No se encontraron proveedores
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProveedores?.map((proveedor) => (
                      <TableRow key={proveedor.id} data-testid={`row-proveedor-${proveedor.id}`}>
                        <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {proveedor.contacto && <div className="text-sm">{proveedor.contacto}</div>}
                            {proveedor.telefono && <div className="text-sm text-muted-foreground">{proveedor.telefono}</div>}
                            {proveedor.email && <div className="text-sm text-muted-foreground">{proveedor.email}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{proveedor.especialidad || "N/A"}</TableCell>
                        <TableCell>{renderStars(proveedor.evaluacion)}</TableCell>
                        <TableCell>{formatCurrency(proveedor.costoPromedioHora)}</TableCell>
                        <TableCell>
                          <Badge variant={proveedor.activo ? "default" : "secondary"}>
                            {proveedor.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(proveedor)}
                                data-testid={`button-edit-${proveedor.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(proveedor.id)}
                                data-testid={`button-delete-${proveedor.id}`}
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
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
              </DialogTitle>
              <DialogDescription>
                {editingProveedor
                  ? "Actualiza la información del proveedor"
                  : "Completa los datos del nuevo proveedor"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre */}
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Mantenciones XYZ Ltda." data-testid="input-nombre" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contacto */}
                  <FormField
                    control={form.control}
                    name="contacto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Persona de Contacto</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Juan Pérez" data-testid="input-contacto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Teléfono */}
                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: +56912345678" data-testid="input-telefono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="Ej: contacto@proveedor.cl" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Especialidad */}
                  <FormField
                    control={form.control}
                    name="especialidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Especialidad</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Electricidad Industrial" data-testid="input-especialidad" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Evaluación */}
                  <FormField
                    control={form.control}
                    name="evaluacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Evaluación (1-5)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-testid="select-evaluacion">
                            <SelectValue placeholder="Seleccionar evaluación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Muy malo</SelectItem>
                            <SelectItem value="2">2 - Malo</SelectItem>
                            <SelectItem value="3">3 - Regular</SelectItem>
                            <SelectItem value="4">4 - Bueno</SelectItem>
                            <SelectItem value="5">5 - Excelente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Costo Promedio por Hora */}
                  <FormField
                    control={form.control}
                    name="costoPromedioHora"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Costo Promedio por Hora (CLP)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ej: 25000" data-testid="input-costo-hora" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Estado */}
                  <FormField
                    control={form.control}
                    name="activo"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Estado</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "true")} 
                          value={field.value ? "true" : "false"}
                        >
                          <SelectTrigger data-testid="select-activo">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Activo</SelectItem>
                            <SelectItem value="false">Inactivo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notas */}
                  <FormField
                    control={form.control}
                    name="notas"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notas</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Observaciones adicionales" rows={3} data-testid="textarea-notas" />
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
                    {editingProveedor ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el proveedor de forma permanente. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                data-testid="button-cancel-delete"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
