import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShoppingCart, Search, Edit, Tag, Eye, EyeOff, Plus, Upload, FileArchive, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface ProductoEcommerce {
  id: string;
  codigo: string;
  producto: string;
  unidad?: string;
  precio: number; // Precio para ecommerce (canalDigital o lista)
  precioOriginal?: number; // Precio de lista original
  categoria?: string;
  descripcion?: string;
  activo: boolean; // Si está activo en la tienda
  imagenUrl?: string;
  stock?: number;
}

interface CategoriaEcommerce {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  productoCount: number;
}

export default function EcommerceAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("true");
  const [editingProduct, setEditingProduct] = useState<ProductoEcommerce | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  
  // Estados para edición de producto
  const [productCategoria, setProductCategoria] = useState("");
  const [productDescripcion, setProductDescripcion] = useState("");
  const [productImagen, setProductImagen] = useState("");
  const [productPrecio, setProductPrecio] = useState("");
  const [productActivo, setProductActivo] = useState(false);
  
  // Estados para nueva categoría
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  
  // Estados para importador ZIP
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, results: [] as any[] });
  
  const { toast } = useToast();

  // Query para obtener productos de ecommerce (basados en lista de precios)
  const { data: productos = [], isLoading } = useQuery<ProductoEcommerce[]>({
    queryKey: ['/api/ecommerce/admin/productos', { search: searchTerm, categoria: selectedCategory, activo: selectedStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory !== 'all') params.append('categoria', selectedCategory);
      if (selectedStatus !== 'all') params.append('activo', selectedStatus);
      
      const response = await apiRequest(`/api/ecommerce/admin/productos?${params.toString()}`);
      return response.json();
    }
  });

  // Query para obtener categorías
  const { data: categorias = [] } = useQuery<CategoriaEcommerce[]>({
    queryKey: ['/api/ecommerce/admin/categorias'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/categorias');
      return response.json();
    }
  });

  // Query para obtener estadísticas
  const { data: stats } = useQuery({
    queryKey: ['/api/ecommerce/admin/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/stats');
      return response.json();
    }
  });

  // Mutación para actualizar producto
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ProductoEcommerce> }) => {
      console.log('🔄 [FRONTEND] Iniciando actualización de producto:', {
        id: data.id,
        updates: data.updates,
        url: `/api/ecommerce/admin/productos/${data.id}`
      });
      
      try {
        const response = await apiRequest(`/api/ecommerce/admin/productos/${data.id}`, {
          method: 'PATCH',
          data: data.updates
        });
        
        console.log('✅ [FRONTEND] Respuesta del servidor recibida:', {
          status: response.status,
          ok: response.ok
        });
        
        const result = await response.json();
        console.log('✅ [FRONTEND] Producto actualizado exitosamente:', result);
        return result;
      } catch (error) {
        console.error('❌ [FRONTEND] Error en actualización de producto:', {
          error,
          id: data.id,
          updates: data.updates
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [FRONTEND] Mutación exitosa, invalidando queries...');
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      setShowProductDialog(false);
      setEditingProduct(null);
      toast({
        title: "Producto actualizado",
        description: "Los cambios se guardaron correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [FRONTEND] Error en mutación:', error);
      
      // Extract more detailed error information
      let errorMessage = "No se pudo actualizar el producto.";
      if (error?.message) {
        errorMessage += ` (${error.message})`;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para alternar estado activo del producto
  const toggleProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/ecommerce/admin/productos/${id}/toggle`, {
        method: 'PATCH'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      toast({
        title: "Estado actualizado",
        description: "El producto fue actualizado correctamente.",
      });
    }
  });

  // Mutación para crear categoría
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { nombre: string; descripcion?: string }) => {
      const response = await apiRequest('/api/ecommerce/admin/categorias', {
        method: 'POST',
        data
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      setShowCategoryDialog(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      toast({
        title: "Categoría creada",
        description: "La nueva categoría se creó correctamente.",
      });
    }
  });

  // Mutación para importar imágenes desde ZIP
  const uploadZipMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('zipFile', file);
      
      const response = await fetch('/api/ecommerce/admin/upload-images', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al procesar ZIP');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setUploadProgress(data);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      toast({
        title: "Importación completada",
        description: `Se procesaron ${data.processed}/${data.total} imágenes correctamente.`,
      });
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error en la importación",
        description: error.message || "No se pudo procesar el archivo ZIP.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  // Filtrar productos
  const filteredProducts = productos.filter(product => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (!product.codigo.toLowerCase().includes(searchLower) && 
          !product.producto.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    
    if (selectedCategory !== 'all' && product.categoria !== selectedCategory) {
      return false;
    }
    
    if (selectedStatus !== 'all') {
      const isActive = selectedStatus === 'true';
      if (product.activo !== isActive) return false;
    }
    
    return true;
  });

  // Funciones auxiliares
  const handleEditProduct = (product: ProductoEcommerce) => {
    setEditingProduct(product);
    setProductCategoria(product.categoria || "");
    setProductDescripcion(product.descripcion || "");
    setProductImagen(product.imagenUrl || "");
    setProductPrecio(product.precio.toString());
    setProductActivo(product.activo);
    setShowProductDialog(true);
  };

  const handleSaveProduct = () => {
    if (!editingProduct) return;
    
    updateProductMutation.mutate({
      id: editingProduct.id,
      updates: {
        categoria: productCategoria,
        descripcion: productDescripcion,
        imagenUrl: productImagen,
        precio: parseFloat(productPrecio),
        activo: productActivo
      }
    });
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    
    createCategoryMutation.mutate({
      nombre: newCategoryName.trim(),
      descripcion: newCategoryDescription.trim() || undefined
    });
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString()}`;
  };

  // Funciones para importador ZIP
  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten archivos ZIP.",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "Archivo muy grande",
        description: "El archivo ZIP no debe exceder 50MB.",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    setUploadProgress({ processed: 0, total: 0, results: [] });
    uploadZipMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Panel eCommerce
          </h1>
          <p className="text-muted-foreground">
            Gestiona los productos que aparecen en tu tienda online
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => window.open('/tienda', '_blank')}
            data-testid="button-view-store"
          >
            <ExternalLink className="h-4 w-4" />
            Ver la Tienda
          </Button>
          
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" data-testid="button-new-category">
                <Plus className="h-4 w-4" />
                Nueva Categoría
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProductos}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.productosActivos}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorías</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCategorias}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas Este Mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(stats.ventasMes)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Importador ZIP de Imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            Importador de Imágenes ZIP
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sube un archivo ZIP con imágenes. Los archivos deben llamarse igual que el código del producto (ej: PCA106BLANC02.png)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Zona de Drag & Drop */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isUploading 
                  ? 'border-yellow-300 bg-yellow-50' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              data-testid="dropzone-images"
            >
              {isUploading ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                  <div>
                    <p className="font-medium">Procesando imágenes ZIP...</p>
                    {uploadProgress.total > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {uploadProgress.processed} de {uploadProgress.total} procesadas
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-lg font-medium">Arrastra tu archivo ZIP aquí</p>
                    <p className="text-sm text-muted-foreground">
                      o haz clic para seleccionar (máximo 50MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    id="zip-upload"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    data-testid="input-zip-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('zip-upload')?.click()}
                    data-testid="button-select-zip"
                  >
                    Seleccionar Archivo
                  </Button>
                </div>
              )}
            </div>

            {/* Resultados de la última importación */}
            {uploadProgress.results.length > 0 && (
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Última Importación ({uploadProgress.processed}/{uploadProgress.total})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {uploadProgress.results.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        result.success 
                          ? 'bg-green-50 text-green-800' 
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      <span className="font-mono text-xs">{result.fileName}</span>
                      {result.success && (
                        <span>→ {result.productCode}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-products"
            />
          </div>
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categorias.filter(cat => cat.nombre?.trim()).map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.nombre}>
                {categoria.nombre} ({categoria.productoCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Productos ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.codigo}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{product.producto}</div>
                      {product.unidad && (
                        <div className="text-sm text-muted-foreground">{product.unidad}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.categoria ? (
                      <Badge variant="secondary">{product.categoria}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Sin categoría</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(product.precio)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.activo}
                        onCheckedChange={() => toggleProductMutation.mutate(product.id)}
                        data-testid={`switch-product-${product.id}`}
                      />
                      {product.activo ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProduct(product)}
                      data-testid={`button-edit-${product.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron productos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para editar producto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Configura las propiedades del producto para la tienda online.
            </DialogDescription>
          </DialogHeader>
          
          {editingProduct && (
            <div className="space-y-4">
              <div>
                <Label>Producto</Label>
                <div className="p-3 bg-muted rounded-md">
                  <div className="font-medium">{editingProduct.producto}</div>
                  <div className="text-sm text-muted-foreground">Código: {editingProduct.codigo}</div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="categoria">Categoría</Label>
                <Select value={productCategoria} onValueChange={setProductCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin-categoria">Sin categoría</SelectItem>
                    {categorias.filter(cat => cat.nombre?.trim()).map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.nombre}>
                        {categoria.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="precio">Precio eCommerce</Label>
                <Input
                  id="precio"
                  type="number"
                  step="0.01"
                  value={productPrecio}
                  onChange={(e) => setProductPrecio(e.target.value)}
                  data-testid="input-product-price"
                />
              </div>
              
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={productDescripcion}
                  onChange={(e) => setProductDescripcion(e.target.value)}
                  placeholder="Descripción del producto para la tienda..."
                  data-testid="textarea-product-description"
                />
              </div>
              
              <div>
                <Label htmlFor="imagen">URL de Imagen</Label>
                <Input
                  id="imagen"
                  value={productImagen}
                  onChange={(e) => setProductImagen(e.target.value)}
                  placeholder="https://..."
                  data-testid="input-product-image"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="activo"
                  checked={productActivo}
                  onCheckedChange={setProductActivo}
                  data-testid="switch-product-active"
                />
                <Label htmlFor="activo">Producto activo en la tienda</Label>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveProduct}
                  disabled={updateProductMutation.isPending}
                  data-testid="button-save-product"
                >
                  {updateProductMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para nueva categoría */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crea una nueva categoría para organizar tus productos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nombre de la categoría</Label>
              <Input
                id="category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej: Pinturas, Herramientas, etc."
                data-testid="input-category-name"
              />
            </div>
            
            <div>
              <Label htmlFor="category-description">Descripción (opcional)</Label>
              <Textarea
                id="category-description"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Descripción de la categoría..."
                data-testid="textarea-category-description"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                data-testid="button-save-category"
              >
                {createCategoryMutation.isPending ? "Creando..." : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}