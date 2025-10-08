import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Edit, Plus, Trash2, Layers } from "lucide-react";
import { insertEcommerceProductGroupSchema } from "@shared/schema";
import type { InsertEcommerceProductGroupInput } from "@shared/schema";

interface ProductGroup {
  id: string;
  nombre: string;
  descripcion?: string;
  imagenPrincipal?: string;
  categoria?: string;
  activo: boolean;
  orden: number;
  variantCount?: number;
  mainVariant?: any;
}

interface ProductVariant {
  id: string;
  priceListId: string;
  groupId?: string;
  variantLabel?: string;
  isMainVariant: boolean;
  activo: boolean;
  priceListProduct?: {
    producto: string;
    codigo: string;
    precio: number;
  };
}

export default function ProductGroupsAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("true");
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const form = useForm<InsertEcommerceProductGroupInput>({
    resolver: zodResolver(insertEcommerceProductGroupSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      categoria: "",
      activo: true,
      orden: 0
    }
  });

  // Query para obtener grupos de productos
  const { data: groups = [], isLoading } = useQuery<ProductGroup[]>({
    queryKey: ['/api/ecommerce/admin/grupos', { search: searchTerm, categoria: selectedCategory, activo: selectedStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory !== 'all') params.append('categoria', selectedCategory);
      if (selectedStatus !== 'all') params.append('activo', selectedStatus);
      
      const response = await apiRequest(`/api/ecommerce/admin/grupos?${params.toString()}`);
      return response.json();
    }
  });

  // Query para obtener categorías (reutiliza la misma de productos)
  const { data: categorias = [] } = useQuery<{id: string; nombre: string}[]>({
    queryKey: ['/api/ecommerce/admin/categorias'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/categorias');
      return response.json();
    }
  });

  // Mutación para crear grupo
  const createGroupMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/ecommerce/admin/grupos', {
        method: 'POST',
        data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      setShowGroupDialog(false);
      resetForm();
      toast({
        title: "Grupo creado",
        description: "El grupo de productos se creó correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el grupo",
        variant: "destructive"
      });
    }
  });

  // Mutación para actualizar grupo
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/ecommerce/admin/grupos/${id}`, {
        method: 'PATCH',
        data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      setShowGroupDialog(false);
      resetForm();
      toast({
        title: "Grupo actualizado",
        description: "El grupo de productos se actualizó correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el grupo",
        variant: "destructive"
      });
    }
  });

  // Mutación para eliminar grupo
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/ecommerce/admin/grupos/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      toast({
        title: "Grupo eliminado",
        description: "El grupo de productos se eliminó correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el grupo",
        variant: "destructive"
      });
    }
  });

  // Query para obtener productos disponibles (para asignar a grupos)
  const { data: availableProducts = [] } = useQuery<any[]>({
    queryKey: ['/api/ecommerce/admin/productos'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/productos');
      return response.json();
    },
    enabled: showProductsDialog
  });

  // Mutación para asignar producto a grupo
  const assignProductMutation = useMutation({
    mutationFn: async ({ productId, groupId, variantLabel, isMainVariant }: { productId: string; groupId: string; variantLabel: string; isMainVariant: boolean }) => {
      const response = await apiRequest(`/api/ecommerce/admin/productos/${productId}`, {
        method: 'PATCH',
        data: { groupId, variantLabel, isMainVariant }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      toast({
        title: "Producto asignado",
        description: "El producto se asignó al grupo correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el producto",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    form.reset({
      nombre: "",
      descripcion: "",
      categoria: "",
      activo: true,
      orden: 0
    });
    setEditingGroup(null);
  };

  const handleEditGroup = (group: ProductGroup) => {
    setEditingGroup(group);
    form.reset({
      nombre: group.nombre,
      descripcion: group.descripcion || "",
      categoria: group.categoria || "",
      activo: group.activo,
      orden: group.orden || 0
    });
    setShowGroupDialog(true);
  };

  const handleSaveGroup = form.handleSubmit((data) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data });
    } else {
      createGroupMutation.mutate(data);
    }
  });

  const handleDeleteGroup = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este grupo? Los productos se desagruparán.")) {
      deleteGroupMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Grupos de Productos
          </h2>
          <p className="text-muted-foreground">
            Gestiona grupos de productos con variaciones (colores, tamaños, etc.)
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowGroupDialog(true); }} data-testid="button-new-group">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Grupo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-groups"
            />
          </div>
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-all-categories">Todas las categorías</SelectItem>
            {categorias.filter((cat: any) => cat.nombre?.trim()).map((categoria: any) => (
              <SelectItem 
                key={categoria.id} 
                value={categoria.nombre}
                data-testid={`select-item-filter-category-${categoria.id}`}
              >
                {categoria.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-all-status">Todos</SelectItem>
            <SelectItem value="true" data-testid="select-item-active-status">Activos</SelectItem>
            <SelectItem value="false" data-testid="select-item-inactive-status">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de grupos */}
      <Card>
        <CardHeader>
          <CardTitle>Grupos ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Variantes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{group.nombre}</div>
                      {group.descripcion && (
                        <div className="text-sm text-muted-foreground">{group.descripcion}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {group.categoria ? (
                      <Badge variant="secondary">{group.categoria}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Sin categoría</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge>{group.variantCount || 0} variantes</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={group.activo ? "default" : "secondary"}>
                      {group.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setManagingGroupId(group.id);
                          setShowProductsDialog(true);
                        }}
                        data-testid={`button-manage-products-${group.id}`}
                        title="Gestionar productos del grupo"
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEditGroup(group)}
                        data-testid={`button-edit-group-${group.id}`}
                        title="Editar grupo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteGroup(group.id)}
                        data-testid={`button-delete-group-${group.id}`}
                        title="Eliminar grupo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {groups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron grupos de productos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para crear/editar grupo */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
            <DialogDescription>
              {editingGroup ? "Modifica los datos del grupo de productos" : "Crea un nuevo grupo para agrupar productos con variaciones"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del grupo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ej: Anticorrosivo Estructural Galón" 
                        data-testid="input-group-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Descripción del grupo..."
                        data-testid="textarea-group-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría (opcional)</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-group-category">
                          <SelectValue placeholder="Sin categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categorias.filter((cat: any) => cat.nombre?.trim()).map((categoria: any) => (
                          <SelectItem 
                            key={categoria.id} 
                            value={categoria.nombre}
                            data-testid={`select-item-category-${categoria.id}`}
                          >
                            {categoria.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4"
                        data-testid="checkbox-group-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Activo en la tienda</FormLabel>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowGroupDialog(false)}
                  data-testid="button-cancel-group"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
                  data-testid="button-save-group"
                >
                  {createGroupMutation.isPending || updateGroupMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar productos del grupo */}
      <Dialog open={showProductsDialog} onOpenChange={setShowProductsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Productos del Grupo</DialogTitle>
            <DialogDescription>
              Asigna productos al grupo seleccionándolos de la lista y definiendo su etiqueta de variante
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Productos en el grupo */}
            <div>
              <h3 className="font-medium mb-2">Productos en este grupo</h3>
              {managingGroupId && (
                <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                  {availableProducts.filter(p => p.groupId === managingGroupId).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay productos en este grupo. Usa el formulario de edición de producto para añadirlos.
                    </p>
                  ) : (
                    availableProducts
                      .filter(p => p.groupId === managingGroupId)
                      .map(product => (
                        <div 
                          key={product.id} 
                          className="flex items-center justify-between p-2 bg-muted rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{product.producto}</div>
                            <div className="text-sm text-muted-foreground">
                              Código: {product.codigo} | Variante: {product.variantLabel || "Sin etiqueta"}
                              {product.isMainVariant && <Badge className="ml-2" variant="default">Principal</Badge>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              assignProductMutation.mutate({
                                productId: product.id,
                                groupId: null as any,
                                variantLabel: null as any,
                                isMainVariant: false
                              });
                            }}
                            data-testid={`button-remove-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Para añadir productos a este grupo, ve a la pestaña "Productos", edita cada producto que quieras incluir, 
                selecciona este grupo en el campo "Grupo de producto" y define su etiqueta de variante (ej: "Blanco", "Gris", "Negro").
              </p>
              <Button
                variant="outline"
                onClick={() => setShowProductsDialog(false)}
                className="w-full"
                data-testid="button-close-products-dialog"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
