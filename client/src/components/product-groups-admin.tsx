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
import { Search, Edit, Plus, Trash2, Layers, Package } from "lucide-react";
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
  
  // States for adding products to group
  const [productSearch, setProductSearch] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("all");
  const [selectedProductsToAdd, setSelectedProductsToAdd] = useState<any[]>([]);
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>({});
  const [mainVariantId, setMainVariantId] = useState<string | null>(null);
  
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
  const { data: availableProducts = [], isLoading: loadingProducts } = useQuery<any[]>({
    queryKey: ['/api/ecommerce/admin/productos', 'all'],
    queryFn: async () => {
      // No enviamos filtro activo para obtener TODOS los productos (activos e inactivos)
      const response = await apiRequest('/api/ecommerce/admin/productos?activo=true');
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

  const resetAddProductForm = () => {
    setSelectedProductsToAdd([]);
    setVariantLabels({});
    setMainVariantId(null);
    setProductSearch("");
    setSelectedUnidad("all");
  };

  const toggleProductSelection = (product: any) => {
    setSelectedProductsToAdd(prev => {
      const isSelected = prev.some(p => p.id === product.id);
      if (isSelected) {
        // Remove product
        const newSelected = prev.filter(p => p.id !== product.id);
        // Clean up variant label and main variant if it was this product
        setVariantLabels(labels => {
          const newLabels = { ...labels };
          delete newLabels[product.id];
          return newLabels;
        });
        if (mainVariantId === product.id) {
          setMainVariantId(null);
        }
        return newSelected;
      } else {
        // Add product and auto-fill variant label with last word of product name
        const words = product.producto.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        // Capitalize first letter
        const autoVariantLabel = lastWord.charAt(0).toUpperCase() + lastWord.slice(1).toLowerCase();
        
        setVariantLabels(labels => ({
          ...labels,
          [product.id]: autoVariantLabel
        }));
        
        return [...prev, product];
      }
    });
  };

  const handleAddProductsToGroup = async () => {
    if (selectedProductsToAdd.length === 0 || !managingGroupId) {
      toast({
        title: "Error",
        description: "Selecciona al menos un producto",
        variant: "destructive"
      });
      return;
    }

    // Validate that all selected products have variant labels
    const missingLabels = selectedProductsToAdd.filter(p => !variantLabels[p.id]?.trim());
    if (missingLabels.length > 0) {
      toast({
        title: "Error",
        description: "Todos los productos seleccionados deben tener una etiqueta de variante",
        variant: "destructive"
      });
      return;
    }

    // Add all products sequentially
    let successCount = 0;
    for (const product of selectedProductsToAdd) {
      try {
        await assignProductMutation.mutateAsync({
          productId: product.id,
          groupId: managingGroupId,
          variantLabel: variantLabels[product.id],
          isMainVariant: mainVariantId === product.id
        });
        successCount++;
      } catch (error) {
        console.error(`Error adding product ${product.id}:`, error);
      }
    }

    // Force refetch of products to update the list
    await queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
    await queryClient.refetchQueries({ queryKey: ['/api/ecommerce/admin/productos', 'all'] });

    toast({
      title: "Productos añadidos",
      description: `Se añadieron ${successCount} producto(s) al grupo correctamente`
    });

    resetAddProductForm();
  };

  // Get unique unidades from available products
  const uniqueUnidades = Array.from(
    new Set(
      availableProducts
        .filter(p => p.unidad)
        .map(p => p.unidad)
    )
  ).sort();

  // Filter available products (not in this group)
  const availableProductsToAdd = availableProducts.filter(p => {
    // Not in current group
    if (p.groupId === managingGroupId) return false;
    
    // Search filter
    if (productSearch !== "" && 
        !p.producto?.toLowerCase().includes(productSearch.toLowerCase()) &&
        !p.codigo?.toLowerCase().includes(productSearch.toLowerCase())) {
      return false;
    }
    
    // Unidad filter
    if (selectedUnidad !== "all" && p.unidad !== selectedUnidad) {
      return false;
    }
    
    return true;
  });

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
      <Dialog open={showProductsDialog} onOpenChange={(open) => {
        setShowProductsDialog(open);
        if (!open) resetAddProductForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Productos del Grupo</DialogTitle>
            <DialogDescription>
              Asigna productos al grupo seleccionándolos de la lista y definiendo su etiqueta de variante
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Productos en el grupo */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos en este grupo
              </h3>
              {managingGroupId && (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-muted/30">
                  {availableProducts.filter(p => p.groupId === managingGroupId).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay productos en este grupo aún.
                    </p>
                  ) : (
                    availableProducts
                      .filter(p => p.groupId === managingGroupId)
                      .map(product => (
                        <div 
                          key={product.id} 
                          className="flex items-center justify-between p-3 bg-background rounded border"
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
                              if (confirm("¿Quitar este producto del grupo?")) {
                                assignProductMutation.mutate({
                                  productId: product.id,
                                  groupId: null as any,
                                  variantLabel: null as any,
                                  isMainVariant: false
                                });
                              }
                            }}
                            data-testid={`button-remove-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Añadir productos */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Añadir Producto
              </h3>
              
              {/* Buscador de productos */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar producto por nombre o código..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-product"
                    />
                  </div>
                  
                  <Select value={selectedUnidad} onValueChange={setSelectedUnidad}>
                    <SelectTrigger data-testid="select-unidad-filter">
                      <SelectValue placeholder="Filtrar por tipo de envase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los envases</SelectItem>
                      {uniqueUnidades.map(unidad => (
                        <SelectItem key={unidad} value={unidad}>
                          {unidad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lista de productos disponibles */}
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {loadingProducts ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Cargando productos...
                    </p>
                  ) : availableProductsToAdd.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      <p>{productSearch ? "No se encontraron productos" : "Todos los productos ya están asignados"}</p>
                      <p className="text-xs mt-2">Total productos: {availableProducts.length}</p>
                    </div>
                  ) : (
                    availableProductsToAdd.slice(0, 30).map(product => {
                      const isSelected = selectedProductsToAdd.some(p => p.id === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 border-b hover:bg-muted/50 transition-colors ${
                            isSelected ? 'bg-primary/10' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductSelection(product)}
                            className="h-4 w-4"
                            data-testid={`checkbox-select-product-${product.id}`}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{product.producto}</div>
                            <div className="text-sm text-muted-foreground">
                              Código: {product.codigo}
                              {product.unidad && ` | Envase: ${product.unidad}`}
                              {' | Precio: $' + new Intl.NumberFormat('es-CL').format(product.precio)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Formulario de variantes para productos seleccionados */}
                {selectedProductsToAdd.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-lg space-y-4 border-2 border-primary/20">
                    <div className="font-medium">
                      {selectedProductsToAdd.length} producto(s) seleccionado(s)
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedProductsToAdd.map(product => (
                        <div key={product.id} className="bg-background p-3 rounded border space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{product.producto}</div>
                              <div className="text-xs text-muted-foreground">{product.codigo}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleProductSelection(product)}
                              className="h-6 w-6 p-0"
                            >
                              ✕
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            <Input
                              placeholder='Ej: "Blanco", "Negro", "Gris"'
                              value={variantLabels[product.id] || ''}
                              onChange={(e) => setVariantLabels(prev => ({
                                ...prev,
                                [product.id]: e.target.value
                              }))}
                              className="text-sm"
                              data-testid={`input-variant-label-${product.id}`}
                            />
                            
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="mainVariant"
                                checked={mainVariantId === product.id}
                                onChange={() => setMainVariantId(product.id)}
                                className="h-3 w-3"
                                data-testid={`radio-main-variant-${product.id}`}
                              />
                              <label className="text-xs text-muted-foreground">
                                Variante principal
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetAddProductForm}
                        className="flex-1"
                        data-testid="button-cancel-add-products"
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddProductsToGroup}
                        disabled={assignProductMutation.isPending || selectedProductsToAdd.some(p => !variantLabels[p.id]?.trim())}
                        className="flex-1"
                        data-testid="button-confirm-add-products"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Añadir {selectedProductsToAdd.length} Producto(s)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowProductsDialog(false);
                  resetAddProductForm();
                }}
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
