import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Building2, Edit, Trash2, X, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Obra, InsertObra } from "@shared/schema";

interface Client {
  id: string;
  nokoen: string;
}

interface ObraWithClient extends Obra {
  clienteNombre?: string;
}

export default function ObrasPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState<string>("all");
  const [selectedEstado, setSelectedEstado] = useState<string>("all");
  const [showNewObraDialog, setShowNewObraDialog] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [obraToDelete, setObraToDelete] = useState<Obra | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InsertObra>>({
    clienteId: "",
    nombre: "",
    direccion: "",
    descripcion: "",
    estado: "activa",
    fechaInicio: undefined,
    fechaEstimadaFin: undefined,
  });

  // Fetch obras
  const { data: obras = [], isLoading: loadingObras, refetch } = useQuery<ObraWithClient[]>({
    queryKey: ['/api/obras', selectedClienteId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClienteId && selectedClienteId !== 'all') {
        params.append('clienteId', selectedClienteId);
      }
      const queryString = params.toString();
      const url = `/api/obras${queryString ? `?${queryString}` : ''}`;
      const response = await apiRequest(url);
      const obrasData = await response.json();
      
      // Fetch clients to get client names
      const clientsResponse = await apiRequest('/api/clients/search?q=');
      const clients = await clientsResponse.json();
      
      // Map client names to obras
      return obrasData.map((obra: Obra) => {
        const client = clients.find((c: Client) => c.id === obra.clienteId);
        return {
          ...obra,
          clienteNombre: client?.nokoen || 'Cliente no encontrado'
        };
      });
    },
  });

  // Fetch clients for select dropdown
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients/search'],
    queryFn: async () => {
      const response = await apiRequest('/api/clients/search?q=');
      return response.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertObra) => {
      const response = await apiRequest('/api/obras', {
        method: 'POST',
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      handleCloseDialog();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertObra> }) => {
      const response = await apiRequest(`/api/obras/${id}`, {
        method: 'PUT',
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      handleCloseDialog();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obras/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/obras'] });
      setShowDeleteDialog(false);
      setObraToDelete(null);
    },
  });

  const handleOpenNewDialog = () => {
    setEditingObra(null);
    setFormData({
      clienteId: "",
      nombre: "",
      direccion: "",
      descripcion: "",
      estado: "activa",
      fechaInicio: undefined,
      fechaEstimadaFin: undefined,
    });
    setShowNewObraDialog(true);
  };

  const handleOpenEditDialog = (obra: Obra) => {
    setEditingObra(obra);
    setFormData({
      clienteId: obra.clienteId,
      nombre: obra.nombre,
      direccion: obra.direccion,
      descripcion: obra.descripcion || "",
      estado: obra.estado,
      fechaInicio: obra.fechaInicio || undefined,
      fechaEstimadaFin: obra.fechaEstimadaFin || undefined,
    });
    setShowNewObraDialog(true);
  };

  const handleCloseDialog = () => {
    setShowNewObraDialog(false);
    setEditingObra(null);
    setFormData({
      clienteId: "",
      nombre: "",
      direccion: "",
      descripcion: "",
      estado: "activa",
      fechaInicio: undefined,
      fechaEstimadaFin: undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clienteId || !formData.nombre || !formData.direccion) {
      return;
    }

    const submitData: InsertObra = {
      clienteId: formData.clienteId,
      nombre: formData.nombre,
      direccion: formData.direccion,
      descripcion: formData.descripcion,
      estado: formData.estado || "activa",
      fechaInicio: formData.fechaInicio,
      fechaEstimadaFin: formData.fechaEstimadaFin,
    };

    if (editingObra) {
      updateMutation.mutate({ id: editingObra.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDeleteClick = (obra: Obra) => {
    setObraToDelete(obra);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (obraToDelete) {
      deleteMutation.mutate(obraToDelete.id);
    }
  };

  // Filter obras
  const filteredObras = obras.filter((obra) => {
    const matchesSearch = 
      searchTerm === "" ||
      obra.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      obra.direccion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (obra.clienteNombre && obra.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCliente = 
      selectedClienteId === "all" || obra.clienteId === selectedClienteId;
    
    const matchesEstado = 
      selectedEstado === "all" || obra.estado === selectedEstado;

    return matchesSearch && matchesCliente && matchesEstado;
  });

  const estadoBadgeVariant = (estado: string) => {
    switch (estado) {
      case "activa":
        return "default";
      case "completada":
        return "secondary";
      case "cancelada":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Obras</h1>
            <p className="text-muted-foreground">
              Administra proyectos y obras asignadas a clientes
            </p>
          </div>
          <Button onClick={handleOpenNewDialog} data-testid="button-nueva-obra">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Obra
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, dirección o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-obras"
                  />
                </div>
              </div>

              {/* Cliente filter */}
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                  <SelectTrigger data-testid="select-cliente-filter">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nokoen}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado filter */}
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={selectedEstado} onValueChange={setSelectedEstado}>
                  <SelectTrigger data-testid="select-estado-filter">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear filters */}
            {(searchTerm || selectedClienteId !== "all" || selectedEstado !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedClienteId("all");
                  setSelectedEstado("all");
                }}
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Obras table */}
        <Card>
          <CardContent className="p-0">
            {loadingObras ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredObras.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay obras</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedClienteId !== "all" || selectedEstado !== "all"
                    ? "No se encontraron obras con los filtros aplicados."
                    : "Comienza creando tu primera obra."}
                </p>
                <Button onClick={handleOpenNewDialog} data-testid="button-primera-obra">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Obra
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                    <TableHead>Fecha Fin Estimada</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredObras.map((obra) => (
                    <TableRow key={obra.id} data-testid={`row-obra-${obra.id}`}>
                      <TableCell className="font-medium">{obra.nombre}</TableCell>
                      <TableCell>{obra.clienteNombre}</TableCell>
                      <TableCell className="max-w-xs truncate">{obra.direccion}</TableCell>
                      <TableCell>
                        <Badge variant={estadoBadgeVariant(obra.estado)} data-testid={`badge-estado-${obra.id}`}>
                          {obra.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {obra.fechaInicio ? new Date(obra.fechaInicio).toLocaleDateString('es-CL') : '-'}
                      </TableCell>
                      <TableCell>
                        {obra.fechaEstimadaFin ? new Date(obra.fechaEstimadaFin).toLocaleDateString('es-CL') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog(obra)}
                            data-testid={`button-edit-${obra.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(obra)}
                            data-testid={`button-delete-${obra.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showNewObraDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingObra ? "Editar Obra" : "Nueva Obra"}
            </DialogTitle>
            <DialogDescription>
              {editingObra
                ? "Modifica los datos de la obra"
                : "Completa la información para crear una nueva obra"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="clienteId">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.clienteId}
                onValueChange={(value) => setFormData({ ...formData, clienteId: value })}
              >
                <SelectTrigger id="clienteId" data-testid="select-cliente">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nokoen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre de la Obra <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Edificio Las Condes"
                required
                data-testid="input-nombre"
              />
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion">
                Dirección <span className="text-destructive">*</span>
              </Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Ej: Av. Providencia 123, Santiago"
                required
                data-testid="input-direccion"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion || ""}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción opcional de la obra..."
                rows={3}
                data-testid="textarea-descripcion"
              />
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={formData.estado}
                onValueChange={(value: "activa" | "completada" | "cancelada") =>
                  setFormData({ ...formData, estado: value })
                }
              >
                <SelectTrigger id="estado" data-testid="select-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha Inicio */}
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha de Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={formData.fechaInicio || ""}
                  onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value || undefined })}
                  data-testid="input-fecha-inicio"
                />
              </div>

              {/* Fecha Fin Estimada */}
              <div className="space-y-2">
                <Label htmlFor="fechaEstimadaFin">Fecha Fin Estimada</Label>
                <Input
                  id="fechaEstimadaFin"
                  type="date"
                  value={formData.fechaEstimadaFin || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fechaEstimadaFin: e.target.value || undefined })
                  }
                  data-testid="input-fecha-fin"
                />
              </div>
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
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingObra ? "Actualizar" : "Crear Obra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la obra "{obraToDelete?.nombre}"? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setObraToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
