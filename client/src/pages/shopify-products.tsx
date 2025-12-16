import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Package, Search, Plus, Upload, Trash2, Edit, Eye, ChevronDown, ChevronRight, Layers, Tag, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface ShopifyProductOption {
  id: string;
  productId: string;
  name: string;
  values: string[];
  position: number;
}

interface ShopifyProductVariant {
  id: string;
  productId: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  inventoryQuantity: number;
  weight: string | null;
  weightUnit: string | null;
  packagingUnit: string | null;
  packagingUnitName: string | null;
  amountPerPackage: number | null;
  imageUrl: string | null;
  available: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: 'draft' | 'active' | 'archived';
  featuredImageUrl: string | null;
  category: string | null;
  handle: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  options: ShopifyProductOption[];
  variants: ShopifyProductVariant[];
}

export default function ShopifyProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopifyProduct | null>(null);
  const [editingVariant, setEditingVariant] = useState<ShopifyProductVariant | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { toast } = useToast();

  const { data: products = [], isLoading } = useQuery<ShopifyProduct[]>({
    queryKey: ['/api/shopify/products', { category: selectedCategory, status: selectedStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      
      const response = await apiRequest(`/api/shopify/products?${params.toString()}`);
      return response.json();
    }
  });

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.title.toLowerCase().includes(term) ||
      p.handle.toLowerCase().includes(term) ||
      p.variants.some(v => v.sku?.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [products]);

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/shopify/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar producto');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopify/products'] });
      toast({ title: "Producto eliminado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar producto", variant: "destructive" });
    }
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/shopify/variants/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar variante');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopify/products'] });
      toast({ title: "Variante eliminada correctamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar variante", variant: "destructive" });
    }
  });

  const importCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/shopify/products/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al importar');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shopify/products'] });
      toast({ 
        title: "Importación completada",
        description: `${data.productsCreated} productos, ${data.variantsCreated} variantes`
      });
      setShowImportDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error en importación", description: error.message, variant: "destructive" });
    }
  });

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      await importCsvMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const formatPrice = (price: string | null) => {
    if (!price) return '$0';
    const num = parseFloat(price);
    return `$${num.toLocaleString('es-CL')}`;
  };

  const getVariantTitle = (variant: ShopifyProductVariant) => {
    const parts = [variant.option1, variant.option2, variant.option3].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : (variant.sku || 'Sin opciones');
  };

  const totalProducts = products.length;
  const totalVariants = products.reduce((sum, p) => sum + p.variants.length, 0);
  const activeProducts = products.filter(p => p.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/ecommerce-admin">
          <Button variant="ghost" size="sm" data-testid="btn-back-ecommerce">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Ecommerce
          </Button>
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Productos con Variantes
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-products">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Variantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-variants">{totalVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-active-products">{activeProducts}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>Catálogo de Productos</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowImportDialog(true)} variant="outline" data-testid="btn-import-csv">
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
              <Button onClick={() => { setEditingProduct(null); setShowProductDialog(true); }} data-testid="btn-add-product">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, handle o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]" data-testid="select-category">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px]" data-testid="select-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="archived">Archivados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando productos...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay productos. Importa un CSV o crea uno nuevo.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map(product => (
                <div key={product.id} className="border rounded-lg" data-testid={`product-row-${product.id}`}>
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(product.id)}
                  >
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                        {expandedProducts.has(product.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      {product.featuredImageUrl ? (
                        <img 
                          src={product.featuredImageUrl} 
                          alt={product.title} 
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium" data-testid={`product-title-${product.id}`}>{product.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.variants.length} variante{product.variants.length !== 1 ? 's' : ''} 
                          {product.vendor && ` • ${product.vendor}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={product.status === 'active' ? 'default' : product.status === 'draft' ? 'secondary' : 'outline'}>
                        {product.status === 'active' ? 'Activo' : product.status === 'draft' ? 'Borrador' : 'Archivado'}
                      </Badge>
                      {product.category && (
                        <Badge variant="outline">
                          <Tag className="h-3 w-3 mr-1" />
                          {product.category}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setShowProductDialog(true); }}
                        data-testid={`btn-edit-product-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteProductMutation.mutate(product.id); }}
                        data-testid={`btn-delete-product-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {expandedProducts.has(product.id) && (
                    <div className="border-t bg-muted/30 p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-sm">Variantes</h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedProductId(product.id); setEditingVariant(null); setShowVariantDialog(true); }}
                          data-testid={`btn-add-variant-${product.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Agregar Variante
                        </Button>
                      </div>
                      
                      {product.options.length > 0 && (
                        <div className="mb-3 flex gap-4 text-sm">
                          {product.options.map(opt => (
                            <div key={opt.id}>
                              <span className="font-medium">{opt.name}:</span>{' '}
                              <span className="text-muted-foreground">{opt.values.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variante</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[100px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {product.variants.map(variant => (
                            <TableRow key={variant.id} data-testid={`variant-row-${variant.id}`}>
                              <TableCell className="font-medium">{getVariantTitle(variant)}</TableCell>
                              <TableCell className="font-mono text-sm">{variant.sku || '-'}</TableCell>
                              <TableCell>{formatPrice(variant.price)}</TableCell>
                              <TableCell>{variant.inventoryQuantity}</TableCell>
                              <TableCell>
                                <Badge variant={variant.available ? 'default' : 'secondary'}>
                                  {variant.available ? 'Disponible' : 'No disponible'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSelectedProductId(product.id); setEditingVariant(variant); setShowVariantDialog(true); }}
                                    data-testid={`btn-edit-variant-${variant.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteVariantMutation.mutate(variant.id)}
                                    data-testid={`btn-delete-variant-${variant.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Productos desde CSV</DialogTitle>
            <DialogDescription>
              El CSV debe tener la estructura con campos como productId, name, variant_parentSku, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-primary font-medium">Seleccionar archivo CSV</span>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  data-testid="input-csv-upload"
                />
              </Label>
              <p className="text-sm text-muted-foreground mt-2">
                Los productos se agruparán por variant_parentSku
              </p>
            </div>
            {isUploading && (
              <div className="text-center text-sm text-muted-foreground">
                Procesando archivo...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProductDialog 
        open={showProductDialog} 
        onOpenChange={setShowProductDialog}
        product={editingProduct}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/shopify/products'] });
          setShowProductDialog(false);
        }}
      />

      <VariantDialog
        open={showVariantDialog}
        onOpenChange={setShowVariantDialog}
        productId={selectedProductId}
        variant={editingVariant}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/shopify/products'] });
          setShowVariantDialog(false);
        }}
      />
    </div>
  );
}

function ProductDialog({ 
  open, 
  onOpenChange, 
  product, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  product: ShopifyProduct | null;
  onSave: () => void;
}) {
  const [title, setTitle] = useState(product?.title || '');
  const [description, setDescription] = useState(product?.description || '');
  const [vendor, setVendor] = useState(product?.vendor || '');
  const [category, setCategory] = useState(product?.category || '');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(product?.status || 'draft');
  
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { title, description, vendor, category, status };
      if (product) {
        const res = await apiRequest(`/api/shopify/products/${product.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al actualizar');
      } else {
        const res = await apiRequest('/api/shopify/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al crear');
      }
    },
    onSuccess: () => {
      toast({ title: product ? "Producto actualizado" : "Producto creado" });
      onSave();
    },
    onError: () => {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="product-title">Nombre</Label>
            <Input 
              id="product-title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre del producto"
              data-testid="input-product-title"
            />
          </div>
          <div>
            <Label htmlFor="product-desc">Descripción</Label>
            <Textarea 
              id="product-desc" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del producto"
              data-testid="input-product-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product-vendor">Proveedor</Label>
              <Input 
                id="product-vendor" 
                value={vendor} 
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Marca/Proveedor"
                data-testid="input-product-vendor"
              />
            </div>
            <div>
              <Label htmlFor="product-category">Categoría</Label>
              <Input 
                id="product-category" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Categoría"
                data-testid="input-product-category"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="product-status">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger data-testid="select-product-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!title || saveMutation.isPending} data-testid="btn-save-product">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog({ 
  open, 
  onOpenChange, 
  productId,
  variant, 
  onSave 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  variant: ShopifyProductVariant | null;
  onSave: () => void;
}) {
  const [sku, setSku] = useState(variant?.sku || '');
  const [price, setPrice] = useState(variant?.price || '0');
  const [option1, setOption1] = useState(variant?.option1 || '');
  const [option2, setOption2] = useState(variant?.option2 || '');
  const [inventoryQuantity, setInventoryQuantity] = useState(variant?.inventoryQuantity || 0);
  const [available, setAvailable] = useState(variant?.available ?? true);
  
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { sku, price, option1, option2, inventoryQuantity, available };
      if (variant) {
        const res = await apiRequest(`/api/shopify/variants/${variant.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al actualizar');
      } else if (productId) {
        const res = await apiRequest(`/api/shopify/products/${productId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Error al crear');
      }
    },
    onSuccess: () => {
      toast({ title: variant ? "Variante actualizada" : "Variante creada" });
      onSave();
    },
    onError: () => {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{variant ? 'Editar Variante' : 'Nueva Variante'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="variant-sku">SKU</Label>
            <Input 
              id="variant-sku" 
              value={sku} 
              onChange={(e) => setSku(e.target.value)}
              placeholder="Código SKU"
              data-testid="input-variant-sku"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant-option1">Opción 1 (ej: Color)</Label>
              <Input 
                id="variant-option1" 
                value={option1} 
                onChange={(e) => setOption1(e.target.value)}
                placeholder="BLANCO, NEGRO, etc."
                data-testid="input-variant-option1"
              />
            </div>
            <div>
              <Label htmlFor="variant-option2">Opción 2 (ej: Formato)</Label>
              <Input 
                id="variant-option2" 
                value={option2} 
                onChange={(e) => setOption2(e.target.value)}
                placeholder="GALÓN, TINETA, etc."
                data-testid="input-variant-option2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant-price">Precio</Label>
              <Input 
                id="variant-price" 
                type="number"
                value={price} 
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                data-testid="input-variant-price"
              />
            </div>
            <div>
              <Label htmlFor="variant-stock">Stock</Label>
              <Input 
                id="variant-stock" 
                type="number"
                value={inventoryQuantity} 
                onChange={(e) => setInventoryQuantity(parseInt(e.target.value) || 0)}
                placeholder="0"
                data-testid="input-variant-stock"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="variant-available"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="rounded"
              data-testid="checkbox-variant-available"
            />
            <Label htmlFor="variant-available">Disponible para venta</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="btn-save-variant">
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
