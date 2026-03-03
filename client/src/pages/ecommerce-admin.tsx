import React, { useState, useMemo } from "react";
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
import { ShoppingCart, Search, Edit, Tag, Eye, EyeOff, Plus, Upload, FileArchive, CheckCircle, AlertCircle, ExternalLink, CloudUpload, Package, Image, Clock, XCircle, Layers, Users, Phone, Mail, Link as LinkIcon, Check, X, Loader2, User, ChevronDown, ChevronRight } from "lucide-react";
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
  precio: number;
  precioOriginal?: number;
  categoria?: string;
  descripcion?: string;
  activo: boolean;
  imagenUrl?: string;
  stock?: number;
  groupId?: string | null;
  variantLabel?: string | null;
  isMainVariant?: boolean;
  productFamily?: string | null;
  color?: string | null;
  variantParentSku?: string | null;
  variantGenericDisplayName?: string | null;
  variantIndex?: number;
}

interface ProductGroup {
  parentSku: string;
  displayName: string;
  products: ProductoEcommerce[];
  mainProduct: ProductoEcommerce;
}

interface CategoriaEcommerce {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  productoCount: number;
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

  // Estado para grupos expandidos en la vista de productos
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Estado para importación de productos CSV
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportProgress, setCsvImportProgress] = useState<{ status: string; count: number }>({ status: '', count: 0 });

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


  // Obtener familias y colores únicos de los productos existentes
  const uniqueFamilies = React.useMemo(() => {
    const families = new Set(productos.map(p => p.productFamily).filter(Boolean) as string[]);
    return Array.from(families).sort();
  }, [productos]);

  const uniqueColors = React.useMemo(() => {
    const colors = new Set(productos.map(p => p.color).filter(Boolean) as string[]);
    return Array.from(colors).sort();
  }, [productos]);

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

  // Mutación para importar productos desde CSV de catálogo
  const importCatalogMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      const response = await apiRequest('/api/ecommerce/admin/productos/import-catalog', {
        method: 'POST',
        data: { data: csvData }
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCsvImporting(false);
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      toast({
        title: 'Importación completada',
        description: `${data.productsCreated} productos creados, ${data.productsUpdated} actualizados`,
      });
    },
    onError: (error: any) => {
      setCsvImporting(false);
      toast({
        variant: 'destructive',
        title: 'Error en importación',
        description: error.message || 'No se pudieron importar los productos',
      });
    },
  });

  // Mutación para limpiar todos los productos
  const clearProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/ecommerce/admin/productos/clear-all', {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/productos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/admin/categorias'] });
      toast({
        title: 'Productos eliminados',
        description: `Se eliminaron ${data.deletedCount} registros`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron eliminar los productos',
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

  // Agrupar productos por variantParentSku
  const groupedProducts = useMemo(() => {
    const groups: Map<string, ProductGroup> = new Map();
    const standalone: ProductoEcommerce[] = [];

    for (const product of filteredProducts) {
      const parentSku = product.variantParentSku;

      if (parentSku) {
        if (!groups.has(parentSku)) {
          groups.set(parentSku, {
            parentSku,
            displayName: product.variantGenericDisplayName || product.producto,
            products: [],
            mainProduct: product,
          });
        }
        const group = groups.get(parentSku)!;
        group.products.push(product);

        // El producto con variantIndex 0 es el principal
        if ((product.variantIndex ?? 0) === 0) {
          group.mainProduct = product;
          group.displayName = product.variantGenericDisplayName || product.producto;
        }
      } else {
        standalone.push(product);
      }
    }

    // Ordenar variantes por variantIndex dentro de cada grupo
    groups.forEach(group => {
      group.products.sort((a, b) => (a.variantIndex ?? 0) - (b.variantIndex ?? 0));
    });

    return { groups: Array.from(groups.values()), standalone };
  }, [filteredProducts]);

  // Toggle grupo expandido
  const toggleGroupExpand = (parentSku: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentSku)) {
        newSet.delete(parentSku);
      } else {
        newSet.add(parentSku);
      }
      return newSet;
    });
  };

  // Funciones auxiliares
  const handleEditProduct = (product: ProductoEcommerce) => {
    setEditingProduct(product);
    setProductCategoria(product.categoria || "");
    setProductDescripcion(product.descripcion || "");
    setProductImagen(product.imagenUrl || "");
    setProductPrecio(product.precio.toString());
    setProductActivo(product.activo);
    setProductFamily(product.productFamily || "");
    setProductColor(product.color || "");
    setShowProductDialog(true);
  };

  const handleSaveProduct = () => {
    if (!editingProduct) return;

    const updates: any = {
      categoria: productCategoria,
      descripcion: productDescripcion,
      imagenUrl: productImagen,
      precio: parseFloat(productPrecio),
      activo: productActivo,
      productFamily: productFamily.trim() || null,
      color: productColor.trim() || null,
    };

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

  // Función para manejar importación de CSV de catálogo
  const handleCsvImport = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Archivo inválido',
        description: 'Por favor selecciona un archivo CSV',
        variant: 'destructive',
      });
      return;
    }

    setCsvImporting(true);
    setCsvImportProgress({ status: 'Leyendo archivo...', count: 0 });

    try {
      const text = await file.text();
      const Papa = await import('papaparse');

      Papa.default.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvImportProgress({ status: 'Importando productos...', count: results.data.length });
            importCatalogMutation.mutate(results.data as any[]);
          } else {
            setCsvImporting(false);
            toast({
              title: 'CSV vacío',
              description: 'El archivo no contiene datos para importar',
              variant: 'destructive',
            });
          }
        },
        error: (error: any) => {
          setCsvImporting(false);
          toast({
            title: 'Error al leer CSV',
            description: error.message,
            variant: 'destructive',
          });
        }
      });
    } catch (error: any) {
      setCsvImporting(false);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo leer el archivo',
        variant: 'destructive',
      });
    }
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
    <div className="space-y-8 px-2 md:px-4 pb-8">
      {/* Modern Header with Gradient */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuración eCommerce</h1>
              <p className="text-slate-300 text-sm md:text-base">Configura catálogos y categorías de tu tienda online</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
              onClick={() => window.open('/tienda', '_blank')}
              data-testid="button-view-store"
            >
              <ExternalLink className="h-4 w-4" />
              Ver la Tienda
            </Button>

            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="button-new-category">
                  <Plus className="h-4 w-4" />
                  Nueva Categoría
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Modern Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1">
          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Total Productos</p>
                  <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-100">{stats.totalProductos}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Productos Activos</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-900 dark:text-emerald-100">{stats.productosActivos}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">Categorías</p>
                  <p className="text-2xl font-bold mt-1 text-amber-900 dark:text-amber-100">{stats.totalCategorias}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/50 dark:to-purple-900/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600/70 dark:text-purple-400/70 uppercase tracking-wider">Pedidos</p>
                  <p className="text-2xl font-bold mt-1 text-purple-900 dark:text-purple-100">{stats.ventasMes}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Catálogos Públicos - Solo Admin */}
      {isAdmin && (
        <div className="space-y-6">
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
        </div>
      )}

    </div>
  );
}