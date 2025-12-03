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
import { Search, Edit, Plus, Trash2, Layers, Package, ChevronDown, ChevronRight, Palette, Box, DollarSign, Image, Loader2, MoveHorizontal, Unlink } from "lucide-react";
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

interface GroupWithVariations {
  id: string;
  nombre: string;
  descripcion?: string;
  imagenPrincipal?: string;
  categoria?: string;
  activo: boolean;
  variationCount: number;
  variations: Array<{
    id: string;
    priceListId: string;
    codigo: string;
    producto: string;
    precio: number;
    color?: string;
    unidad?: string;
    imagenUrl?: string;
    isMainVariant: boolean;
    activo: boolean;
  }>;
}

export default function ProductGroupsAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("true");
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // States for adding products to group
  const [productSearch, setProductSearch] = useState("");
  const [selectedUnidad, setSelectedUnidad] = useState<string>("all");
  const [selectedProductsToAdd, setSelectedProductsToAdd] = useState<any[]>([]);
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>({});
  const [mainVariantId, setMainVariantId] = useState<string | null>(null);
  
  // States for reassigning variations
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassigningVariation, setReassigningVariation] = useState<{id: string; producto: string; currentGroupId: string} | null>(null);
  const [selectedNewGroupId, setSelectedNewGroupId] = useState<string>("");

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };
  
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

  // Query para obtener grupos de productos CON variaciones
  const { data: groupsWithVariations = [], isLoading } = useQuery<GroupWithVariations[]>({
    queryKey: ['/api/ecommerce/admin/grupos', 'withVariations'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/grupos?withVariations=true');
      return response.json();
    }
  });

  // Filter groups based on search, category and status (case-insensitive)
  const filteredGroups = groupsWithVariations.filter(group => {
    // Search filter - case insensitive, trims whitespace
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      const nameLower = (group.nombre || '').toLowerCase().trim();
      const descLower = (group.descripcion || '').toLowerCase().trim();
      if (!nameLower.includes(searchLower) && !descLower.includes(searchLower)) {
        return false;
      }
    }
    // Category filter - case insensitive comparison
    if (selectedCategory !== 'all') {
      const groupCat = (group.categoria || '').toLowerCase().trim();
      const selectedCat = selectedCategory.toLowerCase().trim();
      if (groupCat !== selectedCat) {
        return false;
      }
    }
    // Status filter
    if (selectedStatus !== 'all') {
      const isActive = selectedStatus === 'true';
      if (group.activo !== isActive) {
        return false;
      }
    }
    return true;
  });

  // Alias for backward compatibility
  const groups = filteredGroups;

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

  // Mutación para reasignar variación a otro grupo
  const reassignVariationMutation = useMutation({
    mutationFn: async ({ variationId, newGroupId }: { variationId: string; newGroupId: string | null }) => {
      const response = await apiRequest(`/api/ecommerce/admin/variaciones/${variationId}/reasignar`, {
        method: 'POST',
        data: { newGroupId }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      setShowReassignDialog(false);
      setReassigningVariation(null);
      setSelectedNewGroupId("");
      toast({
        title: "Variación reasignada",
        description: "La variación se movió correctamente"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo reasignar la variación",
        variant: "destructive"
      });
    }
  });

  const handleReassignVariation = (variationId: string, producto: string, currentGroupId: string) => {
    setReassigningVariation({ id: variationId, producto, currentGroupId });
    setSelectedNewGroupId("");
    setShowReassignDialog(true);
  };

  const confirmReassign = () => {
    if (reassigningVariation) {
      reassignVariationMutation.mutate({
        variationId: reassigningVariation.id,
        newGroupId: selectedNewGroupId || null
      });
    }
  };

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

      {/* Tabla de grupos con variaciones expandibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Grupos ({groups.length})</span>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || groups.length === 0}
              onClick={() => {
                if (expandedGroups.size === groups.length && groups.length > 0) {
                  setExpandedGroups(new Set());
                } else {
                  setExpandedGroups(new Set(groups.map(g => g.id)));
                }
              }}
            >
              {expandedGroups.size === groups.length && groups.length > 0 ? "Colapsar todo" : "Expandir todo"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando grupos...</span>
            </div>
          ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const variations = group.variations || [];
              
              return (
                <div key={group.id} className="border rounded-lg overflow-hidden">
                  {/* Group header row */}
                  <div 
                    className="flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => toggleGroupExpansion(group.id)}
                  >
                    <button className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {/* Group image */}
                    <div className="w-12 h-12 rounded bg-background border flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {group.imagenPrincipal ? (
                        <img src={group.imagenPrincipal} alt="" className="w-full h-full object-cover" />
                      ) : variations[0]?.imagenUrl ? (
                        <img src={variations[0].imagenUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* Group info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{group.nombre}</div>
                      {group.descripcion && (
                        <div className="text-sm text-muted-foreground truncate">{group.descripcion}</div>
                      )}
                    </div>
                    
                    {/* Category */}
                    <div className="hidden sm:block">
                      {group.categoria ? (
                        <Badge variant="secondary">{group.categoria}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin categoría</span>
                      )}
                    </div>
                    
                    {/* Variation count */}
                    <Badge className="flex-shrink-0">
                      {variations.length} variante{variations.length !== 1 ? 's' : ''}
                    </Badge>
                    
                    {/* Status */}
                    <Badge variant={group.activo ? "default" : "secondary"} className="flex-shrink-0">
                      {group.activo ? "Activo" : "Inactivo"}
                    </Badge>
                    
                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
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
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditGroup(group as any)}
                        data-testid={`button-edit-group-${group.id}`}
                        title="Editar grupo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteGroup(group.id)}
                        data-testid={`button-delete-group-${group.id}`}
                        title="Eliminar grupo"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Expanded variations */}
                  {isExpanded && variations.length > 0 && (
                    <div className="bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Formato</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-20">Mover</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variations.map((variation) => (
                            <TableRow key={variation.id} className="hover:bg-muted/20">
                              <TableCell className="w-12">
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden">
                                  {variation.imagenUrl ? (
                                    <img src={variation.imagenUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Image className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {variation.codigo}
                                </code>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{variation.producto}</span>
                                  {variation.isMainVariant && (
                                    <Badge variant="outline" className="text-xs">Principal</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {variation.color ? (
                                  <div className="flex items-center gap-1.5">
                                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm">{variation.color}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {variation.unidad ? (
                                  <div className="flex items-center gap-1.5">
                                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-sm">{variation.unidad}</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm font-medium">
                                  <DollarSign className="h-3.5 w-3.5 text-green-600" />
                                  {variation.precio.toLocaleString('es-CL')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={variation.activo ? "default" : "secondary"} className="text-xs">
                                  {variation.activo ? "Activo" : "Inactivo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReassignVariation(variation.id, variation.producto, group.id)}
                                    title="Mover a otro grupo"
                                    data-testid={`button-move-variation-${variation.id}`}
                                  >
                                    <MoveHorizontal className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* Empty variations message */}
                  {isExpanded && variations.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground bg-background">
                      Este grupo no tiene variaciones asignadas.
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setManagingGroupId(group.id);
                          setShowProductsDialog(true);
                        }}
                        className="ml-1"
                      >
                        Agregar productos
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {groups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron grupos de productos
              </div>
            )}
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

      {/* Dialog para reasignar variación a otro grupo */}
      <Dialog open={showReassignDialog} onOpenChange={(open) => {
        setShowReassignDialog(open);
        if (!open) {
          setReassigningVariation(null);
          setSelectedNewGroupId("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveHorizontal className="h-5 w-5" />
              Mover Variación
            </DialogTitle>
            <DialogDescription>
              {reassigningVariation?.producto}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selecciona el grupo destino:</label>
              <Select value={selectedNewGroupId} onValueChange={setSelectedNewGroupId}>
                <SelectTrigger data-testid="select-new-group">
                  <SelectValue placeholder="Seleccionar grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ungroup__" data-testid="select-item-ungroup">
                    <div className="flex items-center gap-2">
                      <Unlink className="h-4 w-4 text-muted-foreground" />
                      <span>Sin grupo (desagrupar)</span>
                    </div>
                  </SelectItem>
                  {groupsWithVariations
                    .filter(g => g.id !== reassigningVariation?.currentGroupId)
                    .map(group => (
                      <SelectItem key={group.id} value={group.id} data-testid={`select-item-group-${group.id}`}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{group.nombre}</span>
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {group.variations?.length || 0}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowReassignDialog(false)}
                data-testid="button-cancel-reassign"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (selectedNewGroupId === "__ungroup__") {
                    reassignVariationMutation.mutate({
                      variationId: reassigningVariation!.id,
                      newGroupId: null
                    });
                  } else {
                    confirmReassign();
                  }
                }}
                disabled={!selectedNewGroupId || reassignVariationMutation.isPending}
                data-testid="button-confirm-reassign"
              >
                {reassignVariationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Moviendo...
                  </>
                ) : (
                  <>
                    <MoveHorizontal className="h-4 w-4 mr-2" />
                    Mover
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
