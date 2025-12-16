import React, { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShoppingCart, Search, Edit, Tag, Eye, EyeOff, Plus, Upload, FileArchive, CheckCircle, AlertCircle, ExternalLink, CloudUpload, Package, Image, Clock, XCircle, Layers, Users, Phone, Mail, Link as LinkIcon, Check, X, Loader2, User } from "lucide-react";
import ProductGroupsAdmin from "@/components/product-groups-admin";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
  groupId?: string | null; // ID del grupo de producto
  variantLabel?: string | null; // Etiqueta de la variante (ej: "Blanco", "Gris")
  isMainVariant?: boolean; // Si es la variante principal del grupo
  productFamily?: string | null; // Familia del producto (ej: "ANTICORROSIVO ESTRUCTURAL")
  color?: string | null; // Color del producto (ej: "BLANCO", "GRIS")
}

interface CategoriaEcommerce {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  productoCount: number;
}

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
  createdAt: string;
  updatedAt: string;
}

interface ProductVariant {
  id: string;
  priceListId: string;
  groupId?: string;
  variantLabel?: string;
  isMainVariant: boolean;
  activo: boolean;
  priceListProduct?: any;
}

interface SalespersonUser {
  id: string;
  salespersonName: string;
  email?: string | null;
  role: string;
  isActive: boolean;
  publicSlug?: string | null;
  profileImageUrl?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  bio?: string | null;
  catalogEnabled?: boolean;
}

const catalogFormSchema = z.object({
  publicSlug: z.string()
    .regex(/^[a-z0-9-]+$/, "Slug debe contener solo letras minúsculas, números y guiones")
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres"),
  publicEmail: z.string().email("Email inválido").or(z.literal("")).optional(),
  publicPhone: z.string().optional(),
  bio: z.string().max(500, "Máximo 500 caracteres").optional(),
  catalogEnabled: z.boolean(),
});

type CatalogFormData = z.infer<typeof catalogFormSchema>;

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
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [productGroupId, setProductGroupId] = useState<string>("");
  const [productVariantLabel, setProductVariantLabel] = useState("");
  const [productIsMainVariant, setProductIsMainVariant] = useState(false);
  const [productFamily, setProductFamily] = useState("");
  const [productColor, setProductColor] = useState("");
  
  // Estados para nueva categoría
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  
  // Estados para importador ZIP con sistema de jobs
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, results: [] as any[] });
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'scanning' | 'processing' | 'completed' | 'error'>('idle');
  const [currentFile, setCurrentFile] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Estados para catálogos públicos
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [selectedCatalogUser, setSelectedCatalogUser] = useState<SalespersonUser | null>(null);
  const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);
  
  // Estados para selección masiva de productos
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState<string>("");
  
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const catalogForm = useForm<CatalogFormData>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      publicSlug: '',
      publicEmail: '',
      publicPhone: '',
      bio: '',
      catalogEnabled: false,
    },
  });

  // Query para obtener productos de ecommerce (basados en lista de precios)
  // El filtrado por búsqueda se hace localmente para evitar recargas por cada letra
  const { data: productos = [], isLoading } = useQuery<ProductoEcommerce[]>({
    queryKey: ['/api/ecommerce/admin/productos', { categoria: selectedCategory, activo: selectedStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
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
    },
    staleTime: 0,
    refetchOnMount: true
  });

  // Query para obtener grupos de productos
  const { data: grupos = [] } = useQuery<ProductGroup[]>({
    queryKey: ['/api/ecommerce/admin/grupos'],
    queryFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/grupos');
      return response.json();
    }
  });

  // Obtener familias y colores únicos de los productos existentes
  const uniqueFamilies = React.useMemo(() => {
    const families = new Set(productos.map(p => p.productFamily).filter(Boolean) as string[]);
    return Array.from(families).sort();
  }, [productos]);

  const uniqueColors = React.useMemo(() => {
    const colors = new Set(productos.map(p => p.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [productos]);

  // Mutación para asignar múltiples productos a un grupo
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ productIds, groupId }: { productIds: string[]; groupId: string }) => {
      const response = await apiRequest('/api/ecommerce/admin/productos/bulk-assign', {
        method: 'POST',
        data: { productIds, groupId }
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/grupos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      setSelectedProducts(new Set());
      setShowBulkAssignModal(false);
      setBulkTargetGroupId("");
      toast({
        title: "Productos asignados",
        description: `Se asignaron ${data.count || selectedProducts.size} productos al grupo`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron asignar los productos",
        variant: "destructive"
      });
    }
  });

  // Toggle selección de producto
  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Seleccionar/deseleccionar todos los productos filtrados
  const toggleSelectAll = () => {
    const allSelected = filteredProducts.every(p => selectedProducts.has(p.id));
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        filteredProducts.forEach(p => newSet.delete(p.id));
      } else {
        filteredProducts.forEach(p => newSet.add(p.id));
      }
      return newSet;
    });
  };

  // Ejecutar asignación masiva
  const handleBulkAssign = () => {
    if (selectedProducts.size === 0 || !bulkTargetGroupId) {
      toast({
        title: "Selección incompleta",
        description: "Selecciona productos y un grupo destino",
        variant: "destructive"
      });
      return;
    }
    bulkAssignMutation.mutate({
      productIds: Array.from(selectedProducts),
      groupId: bulkTargetGroupId
    });
  };

  // Query para obtener vendedores (solo admin)
  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<SalespersonUser[]>({
    queryKey: ['/api/users/salespeople'],
    enabled: isAdmin,
  });

  // Mutación para actualizar catálogo de vendedor
  const updateCatalogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CatalogFormData }) => {
      const normalizedData = {
        publicSlug: data.publicSlug,
        catalogEnabled: data.catalogEnabled,
        publicEmail: data.publicEmail?.trim() || null,
        publicPhone: data.publicPhone?.trim() || null,
        bio: data.bio?.trim() || null,
      };
      return await apiRequest(`/api/users/salespeople/${id}`, {
        method: 'PUT',
        data: normalizedData,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Catálogo actualizado',
        description: 'La configuración del catálogo se guardó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users/salespeople'] });
      setIsCatalogDialogOpen(false);
      setSelectedCatalogUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el catálogo',
      });
    },
  });

  // Funciones auxiliares para catálogos
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const openCatalogEditDialog = (salesperson: SalespersonUser) => {
    setSelectedCatalogUser(salesperson);
    catalogForm.reset({
      publicSlug: salesperson.publicSlug || generateSlug(salesperson.salespersonName),
      publicEmail: salesperson.publicEmail || salesperson.email || '',
      publicPhone: salesperson.publicPhone || '',
      bio: salesperson.bio || '',
      catalogEnabled: salesperson.catalogEnabled ?? false,
    });
    setIsCatalogDialogOpen(true);
  };

  const onCatalogSubmit = (data: CatalogFormData) => {
    if (!selectedCatalogUser) return;
    updateCatalogMutation.mutate({ id: selectedCatalogUser.id, data });
  };

  const filteredSalespeople = salespeople.filter(sp => {
    if (!catalogSearchTerm) return sp.role === 'salesperson' || sp.role === 'supervisor';
    const search = catalogSearchTerm.toLowerCase();
    return (
      (sp.role === 'salesperson' || sp.role === 'supervisor') &&
      (sp.salespersonName.toLowerCase().includes(search) ||
       sp.email?.toLowerCase().includes(search) ||
       sp.publicSlug?.toLowerCase().includes(search))
    );
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

  // Nueva mutación para iniciar job de importación de imágenes ZIP
  const uploadZipMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadStatus('uploading');
      setCurrentFile('Subiendo archivo ZIP...');
      setUploadError('');
      
      const formData = new FormData();
      formData.append('zipFile', file);
      
      const response = await fetch('/api/ecommerce/admin/upload-images', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al iniciar importación');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Iniciar polling del job
      const jobId = data.jobId;
      setCurrentJobId(jobId);
      setUploadStatus('scanning');
      setCurrentFile('Escaneando archivo ZIP...');
      
      console.log(`🔄 [ZIP IMPORT] Job iniciado: ${jobId}, comenzando polling...`);
      
      // Iniciar polling cada 1 segundo
      const interval = setInterval(() => {
        pollJobStatus(jobId);
      }, 1000);
      
      setPollingInterval(interval);
      
      toast({
        title: "Importación iniciada",
        description: "El archivo ZIP se está procesando en segundo plano.",
      });
    },
    onError: (error: any) => {
      console.error('❌ [ZIP IMPORT] Error iniciando importación:', error);
      setUploadStatus('error');
      setCurrentFile('');
      setUploadError(error.message || "No se pudo iniciar la importación");
      
      toast({
        title: "Error en la importación",
        description: error.message || "No se pudo iniciar la importación.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  // Función para hacer polling del status del job
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await apiRequest(`/api/ecommerce/admin/upload-images/${jobId}/status`);
      const jobData = await response.json();
      
      console.log(`📊 [ZIP IMPORT] Job ${jobId} status:`, jobData.status, `(${jobData.processedFiles}/${jobData.totalFiles})`);
      
      // Actualizar estado basado en el progreso del job
      setProgressData(jobData.progressData);
      
      if (jobData.totalFiles > 0) {
        setUploadProgress({
          processed: jobData.processedFiles,
          total: jobData.totalFiles,
          results: jobData.resultData?.results || []
        });
      }
      
      // Actualizar información de archivo actual
      if (jobData.progressData?.currentFile) {
        setCurrentFile(jobData.progressData.currentFile);
      } else if (jobData.progressData?.phase === 'scanning') {
        setCurrentFile('Escaneando archivo ZIP...');
      } else if (jobData.progressData?.phase === 'processing') {
        const batch = jobData.progressData.currentBatch || 0;
        const totalBatches = jobData.progressData.totalBatches || 0;
        setCurrentFile(`Procesando lote ${batch}/${totalBatches}...`);
      } else if (jobData.progressData?.phase === 'completed') {
        setCurrentFile('');
      }
      
      // Actualizar estado principal
      if (jobData.status === 'processing') {
        if (jobData.progressData?.phase === 'scanning') {
          setUploadStatus('scanning');
        } else {
          setUploadStatus('processing');
        }
      } else if (jobData.status === 'success' || jobData.status === 'partial') {
        // Job completado
        setUploadStatus('completed');
        setCurrentFile('');
        
        // Limpiar polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // Invalidar queries para refrescar productos
        queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
        
        // Mostrar resultado final
        const successCount = jobData.successfulFiles || 0;
        const errorCount = jobData.failedFiles || 0;
        
        toast({
          title: "Importación completada",
          description: `✅ ${successCount} imágenes procesadas exitosamente${errorCount > 0 ? `, ❌ ${errorCount} errores` : ''}`,
          variant: errorCount > 0 ? "destructive" : "default"
        });
        
        setIsUploading(false);
        setCurrentJobId(null);
        
      } else if (jobData.status === 'error') {
        // Error en el job
        setUploadStatus('error');
        setCurrentFile('');
        setUploadError(jobData.errorMessage || 'Error procesando ZIP');
        
        // Limpiar polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        toast({
          title: "Error en la importación",
          description: jobData.errorMessage || "Error procesando el archivo ZIP.",
          variant: "destructive",
        });
        
        setIsUploading(false);
        setCurrentJobId(null);
      }
      
    } catch (error) {
      console.error('❌ [ZIP IMPORT] Error consultando status del job:', error);
      
      // En caso de error de polling, continuar intentando por un tiempo
      // pero si falla varias veces, detener el polling
    }
  };

  // Limpiar polling al desmontar componente
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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
    setProductGroupId(product.groupId || "");
    setProductVariantLabel(product.variantLabel || "");
    setProductIsMainVariant(product.isMainVariant || false);
    setProductFamily(product.productFamily || "");
    setProductColor(product.color || "");
    setShowProductDialog(true);
  };

  const handleSaveProduct = () => {
    if (!editingProduct) return;
    
    // Solo enviar datos de variante si hay un grupo seleccionado
    const updates: any = {
      categoria: productCategoria,
      descripcion: productDescripcion,
      imagenUrl: productImagen,
      precio: parseFloat(productPrecio),
      activo: productActivo,
      productFamily: productFamily.trim() || null,
      color: productColor.trim() || null,
    };

    if (productGroupId) {
      updates.groupId = productGroupId;
      updates.variantLabel = productVariantLabel || null;
      updates.isMainVariant = productIsMainVariant;
    } else {
      // Si no hay grupo, limpiar campos de variante
      updates.groupId = null;
      updates.variantLabel = null;
      updates.isMainVariant = false;
    }
    
    updateProductMutation.mutate({
      id: editingProduct.id,
      updates
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
    return `$${price.toLocaleString('es-CL')}`;
  };

  // Mutación para subir imagen individual
  const uploadSingleImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/ecommerce/admin/upload-single-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir imagen');
      }
      
      return response.json();
    },
    onSuccess: (data, file) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      
      // Actualizar uploadProgress para mostrar el resultado
      setUploadProgress({
        processed: 1,
        total: 1,
        results: [{
          fileName: file.name,
          success: data.matched,
          productCode: data.productCode,
          message: data.message
        }]
      });
      
      toast({
        title: "Imagen importada",
        description: data.matched ? `Imagen asociada a: ${data.productName}` : "Imagen subida pero sin producto asociado",
      });
    },
    onError: (error: any, file) => {
      // Mostrar error en uploadProgress también
      setUploadProgress({
        processed: 1,
        total: 1,
        results: [{
          fileName: file.name,
          success: false,
          productCode: '',
          message: error.message
        }]
      });
      
      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutación para subir imagen para un producto específico
  const uploadProductImageMutation = useMutation({
    mutationFn: async ({ file, productId, productCode }: { file: File; productId: string; productCode: string }) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('productId', productId);
      formData.append('productCode', productCode);
      
      const response = await fetch('/api/ecommerce/admin/upload-product-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al subir imagen');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setProductImagen(data.imageUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      setUploadingProductImage(false);
      toast({
        title: "Imagen actualizada",
        description: "La imagen del producto se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      setUploadingProductImage(false);
      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Funciones para importador ZIP e imágenes sueltas
  const handleMultipleFiles = async (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    
    if (filesArray.length === 0) return;
    
    // Si solo hay un archivo, usar lógica simple
    if (filesArray.length === 1) {
      handleFileUpload(filesArray[0]);
      return;
    }
    
    // Filtrar solo imágenes válidas
    const imageFiles = filesArray.filter(file => {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isImage && isValidSize;
    });
    
    if (imageFiles.length === 0) {
      toast({
        title: "No hay archivos válidos",
        description: "Solo se permiten imágenes JPG/PNG/GIF/WEBP (máx 10MB cada una).",
        variant: "destructive",
      });
      return;
    }
    
    // Notificar archivos descartados
    const invalidCount = filesArray.length - imageFiles.length;
    if (invalidCount > 0) {
      toast({
        title: "Algunos archivos fueron descartados",
        description: `${invalidCount} archivo(s) no válido(s) o muy grande(s).`,
      });
    }
    
    // Resetear progreso
    const allResults: any[] = [];
    setUploadProgress({ processed: 0, total: imageFiles.length, results: [] });
    
    console.log(`📸 [MULTI-IMAGE] Subiendo ${imageFiles.length} imágenes...`);
    
    // Subir cada imagen secuencialmente
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      console.log(`📸 [MULTI-IMAGE] Procesando ${i + 1}/${imageFiles.length}: ${file.name}`);
      
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch('/api/ecommerce/admin/upload-single-image', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
          allResults.push({
            fileName: file.name,
            success: data.matched,
            productCode: data.productCode,
            message: data.message
          });
        } else {
          allResults.push({
            fileName: file.name,
            success: false,
            productCode: '',
            message: data.message || 'Error al subir'
          });
        }
      } catch (error: any) {
        console.error(`❌ Error subiendo ${file.name}:`, error);
        allResults.push({
          fileName: file.name,
          success: false,
          productCode: '',
          message: error.message
        });
      }
      
      // Actualizar progreso
      setUploadProgress({ 
        processed: i + 1, 
        total: imageFiles.length, 
        results: allResults 
      });
    }
    
    // Invalidar cache de productos
    queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
    
    const successCount = allResults.filter(r => r.success).length;
    const errorCount = allResults.filter(r => !r.success).length;
    
    toast({
      title: "Importación completada",
      description: `✅ ${successCount} exitosa(s), ${errorCount > 0 ? `❌ ${errorCount} con errores` : ''}`,
    });
  };
  
  const handleFileUpload = (file: File) => {
    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    
    if (!isZip && !isImage) {
      toast({
        title: "Archivo inválido",
        description: "Solo se permiten archivos ZIP o imágenes (JPG, PNG, GIF, WEBP).",
        variant: "destructive",
      });
      return;
    }
    
    // Validar tamaño según tipo de archivo
    if (isImage && file.size > 10 * 1024 * 1024) { // 10MB limit para imágenes
      toast({
        title: "Imagen muy grande",
        description: "Las imágenes no deben exceder 10MB.",
        variant: "destructive",
      });
      return;
    }
    
    if (isZip && file.size > 100 * 1024 * 1024) { // 100MB limit para ZIP
      toast({
        title: "Archivo muy grande",
        description: "Los archivos ZIP no deben exceder 100MB.",
        variant: "destructive",
      });
      return;
    }
    
    if (isImage) {
      // Subir imagen individual
      console.log('📸 [IMAGE IMPORT] Subiendo imagen individual:', file.name);
      uploadSingleImageMutation.mutate(file);
      return;
    }
    
    // Resetear estados para ZIP
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress({ processed: 0, total: 0, results: [] });
    setCurrentFile('');
    setUploadError('');
    
    console.log('🚀 [ZIP IMPORT] Iniciando importación de:', file.name);
    uploadZipMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleMultipleFiles(files);
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
          <Link href="/shopify-products">
            <Button variant="outline" className="flex items-center gap-2" data-testid="button-shopify-products">
              <Layers className="h-4 w-4" />
              Productos con Variantes
            </Button>
          </Link>
          
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

      {/* Tabs para organizar Productos, Grupos y Catálogos */}
      <Tabs defaultValue="productos" className="w-full">
        <TabsList className={`grid w-full max-w-lg ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="productos" data-testid="tab-productos">
            <Package className="h-4 w-4 mr-2" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="grupos" data-testid="tab-grupos">
            <Layers className="h-4 w-4 mr-2" />
            Grupos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="catalogos" data-testid="tab-catalogos">
              <Users className="h-4 w-4 mr-2" />
              Catálogos
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="productos" className="space-y-6 mt-6">
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
              <CardTitle className="text-sm font-medium">Pedidos Solicitados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ventasMes}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Importador de Imágenes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-primary" />
            Importador de Imágenes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sube imágenes de productos. Los archivos deben llamarse igual que el código del producto (ej: PCA106BLANC02.png)
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Estado del progreso y zona de drag & drop */}
            {uploadStatus === 'error' && uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-800">
                  <XCircle className="h-5 w-5" />
                  <h4 className="font-medium">Error en la importación</h4>
                </div>
                <p className="text-sm text-red-700">{uploadError}</p>
                <div className="text-xs text-red-600 bg-red-100 p-2 rounded font-mono">
                  Problema detectado: Fallo en autenticación de almacenamiento en la nube (Error 401 - Unauthorized)
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setUploadStatus('idle');
                    setUploadError('');
                  }}
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  Intentar de nuevo
                </Button>
              </div>
            )}
            
            {/* Progress Bar para proceso activo */}
            {isUploading && uploadStatus !== 'error' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-blue-800">
                  {uploadStatus === 'uploading' && <CloudUpload className="h-5 w-5 animate-pulse" />}
                  {uploadStatus === 'scanning' && <Package className="h-5 w-5 animate-bounce" />}
                  {uploadStatus === 'processing' && <Image className="h-5 w-5 animate-spin" />}
                  {uploadStatus === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  <h4 className="font-medium">
                    {uploadStatus === 'uploading' && 'Subiendo imágenes...'}
                    {uploadStatus === 'scanning' && 'Analizando imágenes...'}
                    {uploadStatus === 'processing' && 'Procesando y subiendo imágenes...'}
                    {uploadStatus === 'completed' && 'Importación completada'}
                  </h4>
                </div>
                
                {currentFile && (
                  <p className="text-sm text-blue-700">{currentFile}</p>
                )}
                
                {/* Progress bar visual */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-blue-600">
                    <span>Progreso</span>
                    <span>
                      {uploadProgress.total > 0 
                        ? `${uploadProgress.processed}/${uploadProgress.total}` 
                        : 'Preparando...'
                      }
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: uploadProgress.total > 0 
                          ? `${(uploadProgress.processed / uploadProgress.total) * 100}%`
                          : uploadStatus === 'uploading' ? '30%' 
                          : uploadStatus === 'scanning' ? '50%'
                          : uploadStatus === 'processing' ? '80%' : '100%'
                      }}
                    />
                  </div>
                </div>
                
                {/* Pasos del proceso */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className={`flex items-center gap-1 ${uploadStatus === 'uploading' ? 'text-blue-600 font-medium' : uploadStatus === 'scanning' || uploadStatus === 'processing' || uploadStatus === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                    <CloudUpload className="h-3 w-3" />
                    <span>Subir</span>
                  </div>
                  <div className={`flex items-center gap-1 ${uploadStatus === 'scanning' ? 'text-blue-600 font-medium' : uploadStatus === 'processing' || uploadStatus === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                    <Package className="h-3 w-3" />
                    <span>Extraer</span>
                  </div>
                  <div className={`flex items-center gap-1 ${uploadStatus === 'processing' ? 'text-blue-600 font-medium' : uploadStatus === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>
                    <Image className="h-3 w-3" />
                    <span>Procesar</span>
                  </div>
                  <div className={`flex items-center gap-1 ${uploadStatus === 'completed' ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                    <CheckCircle className="h-3 w-3" />
                    <span>Completar</span>
                  </div>
                </div>
              </div>
            )}

            {/* Zona de Drag & Drop */}
            {!isUploading && uploadStatus !== 'error' && (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                data-testid="dropzone-images"
              >
                <div className="space-y-3">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-lg font-medium">Arrastra imágenes aquí</p>
                    <p className="text-sm text-muted-foreground">
                      Imágenes JPG/PNG/GIF/WEBP (max 10MB)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Las imágenes se asocian automáticamente por nombre de archivo = SKU
                    </p>
                  </div>
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleMultipleFiles(files);
                      }
                    }}
                    data-testid="input-zip-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    data-testid="button-select-images"
                  >
                    Seleccionar Imágenes
                  </Button>
                </div>
              </div>
            )}

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
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Productos ({filteredProducts.length})</CardTitle>
            {selectedProducts.size > 0 && (
              <Badge variant="secondary">
                {selectedProducts.size} seleccionados
              </Badge>
            )}
          </div>
          {selectedProducts.size > 0 && (
            <Button 
              onClick={() => setShowBulkAssignModal(true)}
              data-testid="button-assign-to-group"
            >
              <Layers className="h-4 w-4 mr-2" />
              Asignar a Grupo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.has(p.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4"
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="w-20">Imagen</TableHead>
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
                <TableRow 
                  key={product.id}
                  className={selectedProducts.has(product.id) ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="h-4 w-4"
                        data-testid={`checkbox-product-${product.id}`}
                      />
                      <span 
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${product.groupId ? 'bg-green-500' : 'bg-gray-400'}`}
                        title={product.groupId ? 'Agrupado' : 'Sin agrupar'}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.imagenUrl ? (
                      <img 
                        src={product.imagenUrl} 
                        alt={product.producto}
                        className="w-12 h-12 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                        <span className="text-[8px] text-gray-400 text-center px-1">Sin imagen</span>
                      </div>
                    )}
                  </TableCell>
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
              
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Clasificación para Catálogo Público
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Estos campos determinan cómo se agrupa el producto en el catálogo público de vendedores.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="productFamily">Familia de Producto</Label>
                    <div className="relative">
                      <Input
                        id="productFamily"
                        value={productFamily}
                        onChange={(e) => setProductFamily(e.target.value.toUpperCase())}
                        placeholder="Ej: ANTICORROSIVO ESTRUCTURAL"
                        list="family-suggestions"
                        data-testid="input-product-family"
                      />
                      <datalist id="family-suggestions">
                        {uniqueFamilies.map(family => (
                          <option key={family} value={family} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="productColor">Color</Label>
                    <div className="relative">
                      <Input
                        id="productColor"
                        value={productColor}
                        onChange={(e) => setProductColor(e.target.value.toUpperCase())}
                        placeholder="Ej: BLANCO, GRIS"
                        list="color-suggestions"
                        data-testid="input-product-color"
                      />
                      <datalist id="color-suggestions">
                        {uniqueColors.map(color => (
                          <option key={color} value={color} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
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
                <Label htmlFor="imagen">Imagen del Producto</Label>
                {productImagen && (
                  <div className="mb-3 p-3 bg-muted rounded-lg">
                    <img 
                      src={productImagen} 
                      alt={editingProduct.producto} 
                      className="w-full h-48 object-contain rounded"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ESin imagen%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Input
                    id="imagen"
                    value={productImagen}
                    onChange={(e) => setProductImagen(e.target.value)}
                    placeholder="https://... o sube una imagen"
                    data-testid="input-product-image"
                  />
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="product-image-upload"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && editingProduct) {
                          setUploadingProductImage(true);
                          uploadProductImageMutation.mutate({
                            file,
                            productId: editingProduct.id,
                            productCode: editingProduct.codigo
                          });
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => document.getElementById('product-image-upload')?.click()}
                      disabled={uploadingProductImage}
                      data-testid="button-upload-product-image"
                    >
                      {uploadingProductImage ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-pulse" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Subir Imagen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Agrupación de variantes (opcional)</h3>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="grupo">Grupo de producto</Label>
                    <Select value={productGroupId || undefined} onValueChange={setProductGroupId}>
                      <SelectTrigger data-testid="select-product-group">
                        <SelectValue placeholder="Sin grupo (producto individual)" />
                      </SelectTrigger>
                      <SelectContent>
                        {grupos.filter(g => g.activo).map((grupo) => (
                          <SelectItem 
                            key={grupo.id} 
                            value={grupo.id}
                            data-testid={`select-item-group-${grupo.id}`}
                          >
                            {grupo.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {productGroupId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-8 px-2 text-xs"
                        onClick={() => setProductGroupId("")}
                        data-testid="button-clear-group"
                      >
                        Quitar del grupo
                      </Button>
                    )}
                  </div>
                  
                  {productGroupId && (
                    <>
                      <div>
                        <Label htmlFor="variantLabel">Etiqueta de variante</Label>
                        <Input
                          id="variantLabel"
                          value={productVariantLabel}
                          onChange={(e) => setProductVariantLabel(e.target.value)}
                          placeholder="Ej: Blanco, Gris, Negro, 1L, 4L..."
                          data-testid="input-variant-label"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Nombre que verán los clientes para diferenciar esta variante
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isMainVariant"
                          checked={productIsMainVariant}
                          onChange={(e) => setProductIsMainVariant(e.target.checked)}
                          className="h-4 w-4"
                          data-testid="checkbox-main-variant"
                        />
                        <Label htmlFor="isMainVariant">Variante principal del grupo</Label>
                      </div>
                    </>
                  )}
                </div>
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
        </TabsContent>

        <TabsContent value="grupos" className="mt-6">
          <ProductGroupsAdmin />
        </TabsContent>

        {/* Pestaña de Catálogos Públicos - Solo Admin */}
        {isAdmin && (
          <TabsContent value="catalogos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Catálogos Públicos de Vendedores</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Habilita y configura el catálogo público para cada vendedor
                </p>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    value={catalogSearchTerm}
                    onChange={(e) => setCatalogSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-catalog-search"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingSalespeople ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSalespeople.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No se encontraron vendedores
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredSalespeople.map(salesperson => (
                      <div
                        key={salesperson.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`catalog-user-row-${salesperson.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{salesperson.salespersonName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {salesperson.publicSlug ? (
                                <span className="flex items-center gap-1">
                                  <LinkIcon className="h-3 w-3" />
                                  /catalogo/{salesperson.publicSlug}
                                </span>
                              ) : (
                                <span className="italic">Sin URL configurada</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {salesperson.catalogEnabled ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <X className="h-3 w-3 mr-1" />
                              Inactivo
                            </Badge>
                          )}

                          {salesperson.catalogEnabled && salesperson.publicSlug && (
                            <a
                              href={`/catalogo/${salesperson.publicSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                              data-testid={`catalog-preview-${salesperson.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCatalogEditDialog(salesperson)}
                            data-testid={`catalog-edit-${salesperson.id}`}
                          >
                            Configurar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dialog para editar catálogo */}
            <Dialog open={isCatalogDialogOpen} onOpenChange={setIsCatalogDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Configurar Catálogo Público</DialogTitle>
                  <DialogDescription>
                    {selectedCatalogUser?.salespersonName}
                  </DialogDescription>
                </DialogHeader>

                <Form {...catalogForm}>
                  <form onSubmit={catalogForm.handleSubmit(onCatalogSubmit)} className="space-y-4">
                    <FormField
                      control={catalogForm.control}
                      name="catalogEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Catálogo Habilitado</FormLabel>
                            <FormDescription>
                              Activa el catálogo público para este vendedor
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="catalog-switch-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL del Catálogo</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                /catalogo/
                              </span>
                              <Input
                                {...field}
                                placeholder="nombre-vendedor"
                                data-testid="catalog-input-slug"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            URL amigable para compartir (solo letras minúsculas, números y guiones)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email de Contacto</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                placeholder="vendedor@empresa.cl"
                                className="pl-10"
                                data-testid="catalog-input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="publicPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono de Contacto</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="+56 9 1234 5678"
                                className="pl-10"
                                data-testid="catalog-input-phone"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={catalogForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Biografía</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Breve descripción del vendedor..."
                              rows={3}
                              data-testid="catalog-input-bio"
                            />
                          </FormControl>
                          <FormDescription>
                            Máximo 500 caracteres
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCatalogDialogOpen(false)}
                        data-testid="catalog-button-cancel"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateCatalogMutation.isPending}
                        data-testid="catalog-button-save"
                      >
                        {updateCatalogMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal para asignar productos a grupo */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Productos a Grupo</DialogTitle>
            <DialogDescription>
              {selectedProducts.size} producto(s) seleccionado(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-group-select">Selecciona el grupo destino</Label>
              <Select value={bulkTargetGroupId} onValueChange={setBulkTargetGroupId}>
                <SelectTrigger id="bulk-group-select" data-testid="select-bulk-group">
                  <SelectValue placeholder="Seleccionar grupo..." />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((grupo) => (
                    <SelectItem key={grupo.id} value={grupo.id}>
                      {grupo.nombre} ({grupo.variantCount || 0} variantes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkAssignModal(false);
                  setBulkTargetGroupId("");
                }}
                data-testid="button-cancel-bulk-assign"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkAssign}
                disabled={!bulkTargetGroupId || bulkAssignMutation.isPending}
                data-testid="button-confirm-bulk-assign"
              >
                {bulkAssignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-2" />
                    Asignar
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