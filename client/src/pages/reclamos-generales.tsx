import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, 
  FileText, 
  BarChart3, 
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  X,
  Camera,
  Loader2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  AlertCircle,
  Building2
} from "lucide-react";
import type { ReclamoGeneral, ReclamoGeneralPhoto } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Client {
  id: string;
  nokoen: string;
  koen: string;
}

interface ReclamoWithDetails extends ReclamoGeneral {
  photos: ReclamoGeneralPhoto[];
  historial: Array<{
    id: string;
    estadoAnterior: string | null;
    estadoNuevo: string;
    userName: string;
    notas: string | null;
    createdAt: string;
  }>;
}

const GRAVEDAD_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { value: 'media', label: 'Media', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
];

const TIPO_RECLAMO_OPTIONS = [
  { value: 'calidad_producto', label: 'Calidad de Producto' },
  { value: 'color', label: 'Color' },
  { value: 'tiempo_entrega', label: 'Tiempo de Entrega' },
  { value: 'cantidad_faltante', label: 'Cantidad Faltante' },
  { value: 'empaque_dañado', label: 'Empaque Dañado' },
  { value: 'producto_incorrecto', label: 'Producto Incorrecto' },
  { value: 'aplicacion', label: 'Aplicación' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  'registrado': { 
    label: 'Registrado', 
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    icon: FileText
  },
  'en_revision_tecnica': { 
    label: 'En Revisión Técnica', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: User
  },
  'en_laboratorio': { 
    label: 'En Laboratorio', 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    icon: BarChart3
  },
  'en_produccion': { 
    label: 'En Producción', 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    icon: Building2
  },
  'cerrado': { 
    label: 'Cerrado', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: CheckCircle2
  },
};

export default function ReclamosGeneralesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("mis-reclamos");
  const [showNewReclamoModal, setShowNewReclamoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showResolucionLaboratorioModal, setShowResolucionLaboratorioModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; description?: string } | null>(null);
  const [showResolucionViewModal, setShowResolucionViewModal] = useState(false);
  const [selectedReclamoId, setSelectedReclamoId] = useState<string | null>(null);
  const [informeResolutivo, setInformeResolutivo] = useState("");
  const [informeLaboratorio, setInformeLaboratorio] = useState("");
  const [resolucionPhotos, setResolucionPhotos] = useState<File[]>([]);
  const [resolucionPreviewUrls, setResolucionPreviewUrls] = useState<string[]>([]);
  const [resolucionUploadProgress, setResolucionUploadProgress] = useState({ current: 0, total: 0 });
  const resolucionFileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterGravedad, setFilterGravedad] = useState<string>("all");
  
  // Form states
  const [formData, setFormData] = useState({
    clientName: '',
    clientRut: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    productName: '',
    productSku: '',
    lote: '',
    description: '',
    gravedad: 'media',
  });
  
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [debouncedClientSearchTerm, setDebouncedClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  
  // Photo upload states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce client search term (same as tomador-pedidos)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientSearchTerm(clientSearchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [clientSearchTerm]);

  // Compress image function
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Resize if larger than 1920px
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo obtener contexto del canvas'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.8 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  };

  // Get user's reclamos
  const { data: reclamos = [], isLoading: reclamosLoading } = useQuery<ReclamoGeneral[]>({
    queryKey: ['/api/reclamos-generales', 'vendedorId', user?.id, 'role', user?.role],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Laboratorio debe ver todos los reclamos sin filtrar
      if (user?.id && user.role !== 'laboratorio') {
        params.append('vendedorId', user.id);
      }
      const url = `/api/reclamos-generales?${params.toString()}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al obtener reclamos');
      return response.json();
    },
    enabled: !!user && (user.role === 'salesperson' || user.role === 'admin' || user.role === 'supervisor' || user.role === 'tecnico_obra' || user.role === 'laboratorio'),
  });

  // Get reclamo details
  const { data: reclamoDetails, isLoading: detailsLoading} = useQuery<ReclamoWithDetails>({
    queryKey: ['/api/reclamos-generales', selectedReclamoId, 'details'],
    queryFn: async () => {
      const response = await fetch(`/api/reclamos-generales/${selectedReclamoId}/details`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al obtener detalles del reclamo');
      return response.json();
    },
    enabled: !!selectedReclamoId && typeof selectedReclamoId === 'string',
  });

  // Get resolución photos
  const { data: resolucionPhotosData = [], isLoading: resolucionPhotosLoading } = useQuery<any[]>({
    queryKey: ['/api/reclamos-generales', selectedReclamoId, 'resolucion-photos'],
    queryFn: async () => {
      const response = await fetch(`/api/reclamos-generales/${selectedReclamoId}/resolucion-photos`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al obtener fotos de resolución');
      return response.json();
    },
    enabled: !!selectedReclamoId && typeof selectedReclamoId === 'string' && showResolucionViewModal,
  });

  // Get clients for dropdown (same structure as tomador-pedidos)
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/clients', { search: debouncedClientSearchTerm }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedClientSearchTerm) params.set('search', debouncedClientSearchTerm);
      params.set('limit', '50'); // Limit results for performance
      params.set('offset', '0'); // Always start from first page
      
      const response = await fetch(`/api/clients?${params}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json() as Promise<{
        clients: Client[];
        totalCount: number;
        currentPage: number;
        totalPages: number;
      }>;
    },
    enabled: debouncedClientSearchTerm.length >= 2, // Only search when user has typed at least 2 characters
  });
  
  // Extract clients array from response (same as tomador-pedidos)
  const clients = clientsData?.clients || [];

  // Create reclamo mutation
  const createReclamoMutation = useMutation({
    mutationFn: async (data: any): Promise<ReclamoGeneral> => {
      const response = await apiRequest('/api/reclamos-generales', {
        method: 'POST',
        data: data,
      });
      return await response.json();
    },
    onSuccess: async (reclamo: ReclamoGeneral) => {
      console.log('Reclamo creado con ID:', reclamo.id);
      
      // Upload photos if any (using compressed previews)
      if (previewUrls.length > 0) {
        setUploadProgress({ current: 0, total: previewUrls.length });
        
        try {
          // Upload all photos - abort on first failure
          for (let i = 0; i < previewUrls.length; i++) {
            await apiRequest(`/api/reclamos-generales/${reclamo.id}/photos`, {
              method: 'POST',
              data: {
                photoUrl: previewUrls[i],
                description: selectedFiles[i]?.name || `Foto ${i + 1}`,
              },
            });
            setUploadProgress({ current: i + 1, total: previewUrls.length });
          }
          
          // All photos uploaded successfully
          queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
          toast({
            title: "Reclamo creado",
            description: `El reclamo ha sido registrado exitosamente con ${previewUrls.length} foto(s).`,
          });
          resetForm();
          setShowNewReclamoModal(false);
          setUploadProgress({ current: 0, total: 0 });
          
        } catch (error) {
          // Photo upload failed - rollback by deleting the reclamo
          setUploadProgress({ current: 0, total: 0 });
          console.error('Error uploading photos, rolling back reclamo:', error);
          
          try {
            // Delete the reclamo that was just created
            await apiRequest(`/api/reclamos-generales/${reclamo.id}`, {
              method: 'DELETE',
            });
            
            toast({
              title: "Error al crear reclamo",
              description: "No se pudieron subir las fotos. Por favor, intente nuevamente.",
              variant: "destructive",
            });
          } catch (deleteError) {
            console.error('Error deleting reclamo during rollback:', deleteError);
            toast({
              title: "Error crítico",
              description: "Hubo un problema al crear el reclamo. Por favor, contacte al administrador.",
              variant: "destructive",
            });
          }
          
          // Invalidate queries to refresh the list
          queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
        }
      }
    },
    onError: (error: any) => {
      setUploadProgress({ current: 0, total: 0 });
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el reclamo",
        variant: "destructive",
      });
    },
  });

  // Cerrar reclamo mutation
  const cerrarReclamoMutation = useMutation({
    mutationFn: async ({ reclamoId, notas }: { reclamoId: string; notas: string }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/cerrar`, {
        method: 'POST',
        data: { notas },
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Reclamo cerrado",
        description: "El reclamo ha sido cerrado exitosamente.",
      });
      setShowCerrarModal(false);
      setInformeResolutivo("");
      setSelectedReclamoId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as any)?.message || "No se pudo cerrar el reclamo",
        variant: "destructive",
      });
    },
  });

  // Subir resolución del laboratorio con evidencia
  const resolucionLaboratorioMutation = useMutation({
    mutationFn: async ({ reclamoId, informe, photos }: { reclamoId: string; informe: string; photos: Array<{ photoUrl: string; description?: string }> }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/resolucion-laboratorio`, {
        method: 'POST',
        data: { informe, photos },
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Resolución enviada",
        description: "La resolución del laboratorio ha sido registrada con éxito.",
      });
      setShowResolucionLaboratorioModal(false);
      setInformeLaboratorio("");
      setResolucionPhotos([]);
      setResolucionPreviewUrls([]);
      setResolucionUploadProgress({ current: 0, total: 0 });
      setSelectedReclamoId(null);
    },
    onError: (error) => {
      setResolucionUploadProgress({ current: 0, total: 0 });
      toast({
        title: "Error",
        description: (error as any)?.message || "No se pudo subir la resolución",
        variant: "destructive",
      });
    },
  });

  // Delete reclamo mutation (solo admin y tecnico_obra)
  const deleteReclamoMutation = useMutation({
    mutationFn: async (reclamoId: string) => {
      await apiRequest(`/api/reclamos-generales/${reclamoId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Reclamo eliminado",
        description: "El reclamo ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el reclamo",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      clientName: '',
      clientRut: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      productName: '',
      productSku: '',
      lote: '',
      description: '',
      gravedad: 'media',
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setClientSearchTerm("");
    setUploadProgress({ current: 0, total: 0 });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "Advertencia",
        description: "Solo se aceptan archivos de imagen",
        variant: "destructive",
      });
    }
    
    if (imageFiles.length === 0) return;
    
    // Compress and create preview URLs
    toast({
      title: "Procesando imágenes",
      description: `Comprimiendo ${imageFiles.length} imagen(es)...`,
    });
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    for (const file of imageFiles) {
      try {
        const compressedUrl = await compressImage(file);
        newFiles.push(file);
        newPreviews.push(compressedUrl);
      } catch (error) {
        console.error('Error comprimiendo imagen:', error);
        toast({
          title: "Error",
          description: `No se pudo procesar ${file.name}. Intente con otra imagen.`,
          variant: "destructive",
        });
      }
    }
    
    // Only add files that were successfully compressed
    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setPreviewUrls(prev => [...prev, ...newPreviews]);
    }
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Funciones para fotos de evidencia de resolución del laboratorio
  const handleResolucionFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "Advertencia",
        description: "Solo se aceptan archivos de imagen",
        variant: "destructive",
      });
    }
    
    if (imageFiles.length === 0) return;
    
    // Compress and create preview URLs
    toast({
      title: "Procesando imágenes",
      description: `Comprimiendo ${imageFiles.length} imagen(es)...`,
    });
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    for (const file of imageFiles) {
      try {
        const compressedUrl = await compressImage(file);
        newFiles.push(file);
        newPreviews.push(compressedUrl);
      } catch (error) {
        console.error('Error comprimiendo imagen:', error);
        toast({
          title: "Error",
          description: `No se pudo procesar ${file.name}. Intente con otra imagen.`,
          variant: "destructive",
        });
      }
    }
    
    // Only add files that were successfully compressed
    if (newFiles.length > 0) {
      setResolucionPhotos(prev => [...prev, ...newFiles]);
      setResolucionPreviewUrls(prev => [...prev, ...newPreviews]);
    }
    
    // Clear the file input
    if (resolucionFileInputRef.current) {
      resolucionFileInputRef.current.value = '';
    }
  };

  const removeResolucionFile = (index: number) => {
    setResolucionPhotos(prev => prev.filter((_, i) => i !== index));
    setResolucionPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitResolucion = async () => {
    if (!informeLaboratorio.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar el informe de resolución",
        variant: "destructive",
      });
      return;
    }
    
    if (resolucionPreviewUrls.length === 0) {
      toast({
        title: "Error",
        description: "Debe adjuntar al menos una foto de evidencia",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedReclamoId) return;

    // Prepare photos array
    const photos = resolucionPreviewUrls.map(photoUrl => ({
      photoUrl,
      description: "Evidencia de resolución del laboratorio"
    }));

    resolucionLaboratorioMutation.mutate({
      reclamoId: selectedReclamoId,
      informe: informeLaboratorio,
      photos
    });
  };

  const handleSubmit = () => {
    if (!formData.clientName || !formData.productName || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    
    if (previewUrls.length === 0) {
      toast({
        title: "Error",
        description: "Debe adjuntar al menos una foto del reclamo",
        variant: "destructive",
      });
      return;
    }
    
    // Verify all files were compressed successfully
    if (previewUrls.length !== selectedFiles.length) {
      toast({
        title: "Error",
        description: "Algunas fotos no se procesaron correctamente. Por favor, elimínelas y vuelva a intentar.",
        variant: "destructive",
      });
      return;
    }

    createReclamoMutation.mutate({
      clientName: formData.clientName,
      clientRut: formData.clientRut || null,
      clientEmail: formData.clientEmail || null,
      clientPhone: formData.clientPhone || null,
      clientAddress: formData.clientAddress || null,
      productName: formData.productName,
      productSku: formData.productSku || null,
      lote: formData.lote || null,
      description: formData.description,
      gravedad: formData.gravedad,
      estado: 'registrado',
    });
  };

  const filteredReclamos = reclamos.filter(reclamo => {
    const matchesSearch = reclamo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reclamo.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'all' || reclamo.estado === filterEstado;
    const matchesGravedad = filterGravedad === 'all' || reclamo.gravedad === filterGravedad;
    return matchesSearch && matchesEstado && matchesGravedad;
  });

  const getDaysSinceRegistro = (fecha: string) => {
    const now = new Date();
    const registro = new Date(fecha);
    const diff = Math.floor((now.getTime() - registro.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getSLAStatus = (reclamo: ReclamoGeneral) => {
    if (reclamo.estado === 'cerrado') return null;
    
    if (reclamo.derivadoLaboratorio && !reclamo.fechaRespuestaLaboratorio) {
      const envioDate = reclamo.fechaEnvioLaboratorio || reclamo.fechaRegistro;
      const days = getDaysSinceRegistro(envioDate ? envioDate.toString() : '');
      if (days > 3) {
        return { type: 'danger', message: `SLA vencido: ${days} días sin respuesta de laboratorio` };
      } else if (days === 3) {
        return { type: 'warning', message: 'SLA por vencer: respuesta de laboratorio pendiente' };
      }
    }
    
    return null;
  };

  if (!user || (user.role !== 'salesperson' && user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'tecnico_obra' && user.role !== 'laboratorio')) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              No tiene permisos para acceder a esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reclamos de Clientes</h1>
          <p className="text-muted-foreground">Gestión de reclamos y seguimiento</p>
        </div>
        <Button 
          onClick={() => setShowNewReclamoModal(true)}
          data-testid="button-create-reclamo"
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Reclamo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-reclamos">
          <TabsTrigger value="mis-reclamos" data-testid="tab-mis-reclamos">
            <FileText className="h-4 w-4 mr-2" />
            Mis Reclamos
          </TabsTrigger>
          <TabsTrigger value="estadisticas" data-testid="tab-estadisticas">
            <BarChart3 className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mis-reclamos" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente, descripción..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-reclamos"
                    />
                  </div>
                </div>
                <div>
                  <Label>Estado</Label>
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger data-testid="select-filter-estado">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      {Object.entries(ESTADO_LABELS).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gravedad</Label>
                  <Select value={filterGravedad} onValueChange={setFilterGravedad}>
                    <SelectTrigger data-testid="select-filter-gravedad">
                      <SelectValue placeholder="Todas las gravedades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las gravedades</SelectItem>
                      {GRAVEDAD_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reclamos list */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Reclamos</CardTitle>
              <CardDescription>
                {filteredReclamos.length} reclamo(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reclamosLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredReclamos.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">
                  No hay reclamos registrados
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredReclamos.map((reclamo) => {
                    const estadoInfo = ESTADO_LABELS[reclamo.estado];
                    const gravedadInfo = GRAVEDAD_OPTIONS.find(g => g.value === reclamo.gravedad);
                    const slaStatus = getSLAStatus(reclamo);
                    const Icon = estadoInfo?.icon || FileText;
                    
                    return (
                      <Card key={reclamo.id} className="hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold" data-testid={`text-reclamo-cliente-${reclamo.id}`}>
                                  {reclamo.clientName}
                                </h3>
                                <Badge className={gravedadInfo?.color} data-testid={`badge-gravedad-${reclamo.id}`}>
                                  {gravedadInfo?.label}
                                </Badge>
                                <Badge className={estadoInfo?.color} data-testid={`badge-estado-${reclamo.id}`}>
                                  <Icon className="h-3 w-3 mr-1" />
                                  {estadoInfo?.label}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {reclamo.description}
                              </p>
                              
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(reclamo.fechaRegistro || ''), "dd MMM yyyy", { locale: es })}
                                </span>
                                {reclamo.productName && (
                                  <span>Producto: {reclamo.productName}</span>
                                )}
                                {reclamo.tecnicoName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {reclamo.tecnicoName}
                                  </span>
                                )}
                              </div>
                              
                              {slaStatus && (
                                <div className={`flex items-center gap-2 text-sm ${
                                  slaStatus.type === 'danger' ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                  <AlertTriangle className="h-4 w-4" />
                                  {slaStatus.message}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReclamoId(reclamo.id);
                                  setShowDetailModal(true);
                                }}
                                data-testid={`button-view-reclamo-${reclamo.id}`}
                                className="w-full sm:w-auto"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Detalle
                              </Button>

                              {user?.role === 'laboratorio' && reclamo.estado === 'en_laboratorio' && !reclamo.informeLaboratorio && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReclamoId(reclamo.id);
                                    setShowResolucionLaboratorioModal(true);
                                  }}
                                  data-testid={`button-resolucion-laboratorio-${reclamo.id}`}
                                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Resolución Laboratorio
                                </Button>
                              )}
                              
                              {reclamo.estado !== 'cerrado' && user?.role === 'tecnico_obra' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReclamoId(reclamo.id);
                                    setShowCerrarModal(true);
                                  }}
                                  data-testid={`button-cerrar-reclamo-${reclamo.id}`}
                                  className="w-full sm:w-auto"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Cerrar
                                </Button>
                              )}

                              {(user?.role === 'admin' || user?.role === 'tecnico_obra') && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm('¿Está seguro que desea eliminar este reclamo? Esta acción no se puede deshacer.')) {
                                      deleteReclamoMutation.mutate(reclamo.id);
                                    }
                                  }}
                                  disabled={deleteReclamoMutation.isPending}
                                  data-testid={`button-delete-reclamo-${reclamo.id}`}
                                  className="w-full sm:w-auto"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Eliminar
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estadisticas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Reclamos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reclamos.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reclamos.filter(r => r.estado !== 'cerrado').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">En Laboratorio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reclamos.filter(r => r.estado === 'en_laboratorio').length}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">SLA Vencido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {reclamos.filter(r => {
                    const sla = getSLAStatus(r);
                    return sla?.type === 'danger';
                  }).length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Reclamo Dialog */}
      <Dialog open={showNewReclamoModal} onOpenChange={setShowNewReclamoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle>Nuevo Reclamo de Cliente</DialogTitle>
            <DialogDescription>
              Complete la información del reclamo y adjunte fotos
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente <span className="text-red-500">*</span></Label>
              <div className="relative" ref={clientDropdownRef}>
                <Input
                  id="cliente"
                  placeholder="Buscar cliente..."
                  value={clientSearchTerm}
                  onChange={(e) => {
                    setClientSearchTerm(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  data-testid="input-cliente"
                />
                {showClientDropdown && clients.length > 0 && (
                  <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto shadow-lg border-2">
                    <CardContent className="p-2">
                      {clients.map((client) => (
                        <div
                          key={client.id}
                          className="p-2 hover:bg-accent cursor-pointer rounded"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              clientName: client.koen,
                              clientRut: client.nokoen,
                            }));
                            setClientSearchTerm(client.koen);
                            setShowClientDropdown(false);
                          }}
                          data-testid={`option-cliente-${client.id}`}
                        >
                          <div className="font-medium">{client.koen}</div>
                          <div className="text-xs text-muted-foreground">{client.nokoen}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Gravedad */}
            <div className="space-y-2">
              <Label htmlFor="gravedad">Gravedad <span className="text-red-500">*</span></Label>
              <Select 
                value={formData.gravedad} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, gravedad: value }))}
              >
                <SelectTrigger data-testid="select-gravedad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAVEDAD_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción del Reclamo <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                placeholder="Describa detalladamente el reclamo del cliente..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                data-testid="textarea-description"
              />
            </div>

            {/* Producto Afectado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Producto Afectado <span className="text-red-500">*</span></Label>
                <Input
                  id="productName"
                  placeholder="Nombre del producto"
                  value={formData.productName}
                  onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                  data-testid="input-product-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lote">Lote</Label>
                <Input
                  id="lote"
                  placeholder="Número de lote"
                  value={formData.lote}
                  onChange={(e) => setFormData(prev => ({ ...prev, lote: e.target.value }))}
                  data-testid="input-lote"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="productSku">SKU</Label>
                <Input
                  id="productSku"
                  placeholder="SKU del producto"
                  value={formData.productSku}
                  onChange={(e) => setFormData(prev => ({ ...prev, productSku: e.target.value }))}
                  data-testid="input-product-sku"
                />
              </div>
            </div>

            {/* Photos Upload */}
            <div className="space-y-2">
              <Label>Fotos <span className="text-red-500">*</span></Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-photos"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-photos"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar Fotos
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Se requiere al menos una foto del reclamo
                </p>
              </div>
              
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFile(index)}
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowNewReclamoModal(false);
              }}
              data-testid="button-cancel-reclamo"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createReclamoMutation.isPending}
              data-testid="button-submit-reclamo"
            >
              {createReclamoMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {uploadProgress.total > 0 ? (
                `Subiendo foto ${uploadProgress.current}/${uploadProgress.total}...`
              ) : createReclamoMutation.isPending ? (
                'Creando reclamo...'
              ) : (
                'Crear Reclamo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Detalle del Reclamo</DialogTitle>
            {/* Botón para laboratorio debajo del título */}
            {user?.role === 'laboratorio' && reclamoDetails && reclamoDetails.estado === 'en_laboratorio' && !reclamoDetails.informeLaboratorio && (
              <Button
                onClick={() => {
                  setShowDetailModal(false);
                  setShowResolucionLaboratorioModal(true);
                }}
                className="mt-2 w-full"
                data-testid="button-subir-resolucion"
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir Resolución del Laboratorio
              </Button>
            )}
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : reclamoDetails ? (
            <div className="space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-semibold">{reclamoDetails.clientName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha Registro</Label>
                  <p>{format(new Date(reclamoDetails.fechaRegistro || ''), "dd MMMM yyyy HH:mm", { locale: es })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1">
                    <Badge className={ESTADO_LABELS[reclamoDetails.estado]?.color}>
                      {ESTADO_LABELS[reclamoDetails.estado]?.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gravedad</Label>
                  <div className="mt-1">
                    <Badge className={GRAVEDAD_OPTIONS.find(g => g.value === reclamoDetails.gravedad)?.color}>
                      {GRAVEDAD_OPTIONS.find(g => g.value === reclamoDetails.gravedad)?.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-muted-foreground">Descripción</Label>
                <p className="mt-1">{reclamoDetails.description}</p>
              </div>

              {/* Product info */}
              {reclamoDetails.productName && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Producto Afectado</Label>
                    <p>{reclamoDetails.productName}</p>
                  </div>
                  {reclamoDetails.lote && (
                    <div>
                      <Label className="text-muted-foreground">Lote</Label>
                      <p>{reclamoDetails.lote}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Photos */}
              {reclamoDetails.photos && reclamoDetails.photos.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Fotos</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    {reclamoDetails.photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photoUrl}
                          alt={photo.description || 'Foto del reclamo'}
                          className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setSelectedImage({ url: photo.photoUrl, description: photo.description || undefined });
                            setShowImageModal(true);
                          }}
                          data-testid={`img-reclamo-${photo.id}`}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-b">
                          <Eye className="h-3 w-3 inline mr-1" />
                          Ver imagen
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial */}
              {reclamoDetails.historial && reclamoDetails.historial.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Historial de Cambios</Label>
                  <div className="mt-2 space-y-2">
                    {reclamoDetails.historial.map((entry) => {
                      const isResolucionEntry = entry.notas?.includes('Resolución de laboratorio agregada');
                      return (
                        <Card 
                          key={entry.id}
                          className={isResolucionEntry ? 'cursor-pointer hover:bg-accent transition-colors' : ''}
                          onClick={() => {
                            if (isResolucionEntry && reclamoDetails.informeLaboratorio) {
                              setShowResolucionViewModal(true);
                            }
                          }}
                          data-testid={isResolucionEntry ? 'card-resolucion-clickeable' : undefined}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {entry.estadoAnterior && (
                                    <>
                                      <Badge variant="outline" className="text-xs">
                                        {ESTADO_LABELS[entry.estadoAnterior]?.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">→</span>
                                    </>
                                  )}
                                  <Badge className={ESTADO_LABELS[entry.estadoNuevo]?.color + " text-xs"}>
                                    {ESTADO_LABELS[entry.estadoNuevo]?.label}
                                  </Badge>
                                </div>
                                {entry.notas && (
                                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    {entry.notas}
                                    {isResolucionEntry && <Eye className="h-3 w-3 ml-1" />}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {entry.userName} - {format(new Date(entry.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No se encontró el reclamo</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Cerrar Reclamo Modal */}
      <Dialog open={showCerrarModal} onOpenChange={setShowCerrarModal}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Cerrar Reclamo</DialogTitle>
            <DialogDescription>
              Ingrese el informe resolutivo para cerrar este reclamo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="informe">Informe Resolutivo <span className="text-red-500">*</span></Label>
              <Textarea
                id="informe"
                placeholder="Describa la solución aplicada y el resultado del reclamo..."
                value={informeResolutivo}
                onChange={(e) => setInformeResolutivo(e.target.value)}
                rows={6}
                className="mt-2"
                data-testid="textarea-informe-resolutivo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCerrarModal(false);
                setInformeResolutivo("");
                setSelectedReclamoId(null);
              }}
              data-testid="button-cancel-cerrar"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!informeResolutivo.trim()) {
                  toast({
                    title: "Error",
                    description: "Debe ingresar el informe resolutivo",
                    variant: "destructive",
                  });
                  return;
                }
                if (selectedReclamoId) {
                  cerrarReclamoMutation.mutate({
                    reclamoId: selectedReclamoId,
                    notas: informeResolutivo,
                  });
                }
              }}
              disabled={cerrarReclamoMutation.isPending}
              data-testid="button-confirm-cerrar"
            >
              {cerrarReclamoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cerrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Cerrar Reclamo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Resolución del Laboratorio */}
      <Dialog open={showResolucionLaboratorioModal} onOpenChange={setShowResolucionLaboratorioModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Resolución del Laboratorio</DialogTitle>
            <DialogDescription>
              Ingrese el informe de resolución y adjunte fotos de evidencia
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Informe */}
            <div>
              <Label htmlFor="informe-laboratorio">Informe de Resolución <span className="text-red-500">*</span></Label>
              <Textarea
                id="informe-laboratorio"
                placeholder="Describa el análisis realizado, hallazgos y conclusiones del laboratorio..."
                value={informeLaboratorio}
                onChange={(e) => setInformeLaboratorio(e.target.value)}
                rows={8}
                className="mt-2"
                data-testid="textarea-informe-laboratorio"
              />
            </div>

            {/* Evidencia fotográfica */}
            <div>
              <Label>Evidencia Fotográfica <span className="text-red-500">*</span></Label>
              <p className="text-sm text-muted-foreground mb-2">
                Adjunte al menos una foto de evidencia de la resolución
              </p>
              
              <input
                ref={resolucionFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleResolucionFileSelect}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="outline"
                onClick={() => resolucionFileInputRef.current?.click()}
                className="w-full mb-4"
                data-testid="button-add-evidencia"
              >
                <Camera className="h-4 w-4 mr-2" />
                Adjuntar Fotos de Evidencia
              </Button>
              
              {resolucionPreviewUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {resolucionPreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Evidencia ${index + 1}`}
                        className="w-full h-32 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeResolucionFile(index)}
                        data-testid={`button-remove-evidencia-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Indicador de progreso */}
            {resolucionUploadProgress.total > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                Subiendo foto {resolucionUploadProgress.current} de {resolucionUploadProgress.total}...
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResolucionLaboratorioModal(false);
                setInformeLaboratorio("");
                setResolucionPhotos([]);
                setResolucionPreviewUrls([]);
                setResolucionUploadProgress({ current: 0, total: 0 });
                setSelectedReclamoId(null);
              }}
              data-testid="button-cancel-resolucion"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitResolucion}
              disabled={resolucionLaboratorioMutation.isPending}
              data-testid="button-submit-resolucion"
            >
              {resolucionLaboratorioMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {resolucionUploadProgress.total > 0 ? (
                `Subiendo foto ${resolucionUploadProgress.current}/${resolucionUploadProgress.total}...`
              ) : resolucionLaboratorioMutation.isPending ? (
                'Enviando resolución...'
              ) : (
                'Enviar Resolución'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vista Ampliada de Imagen */}
      <Dialog open={showImageModal} onOpenChange={(open) => {
        setShowImageModal(open);
        if (!open) setSelectedImage(null);
      }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista de Imagen</DialogTitle>
            {selectedImage?.description && (
              <DialogDescription>{selectedImage.description}</DialogDescription>
            )}
          </DialogHeader>
          
          {selectedImage && (
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
              <img
                src={selectedImage.url}
                alt={selectedImage.description || 'Imagen ampliada'}
                className="max-w-full max-h-[70vh] object-contain rounded"
                data-testid="img-enlarged"
              />
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImageModal(false);
                setSelectedImage(null);
              }}
              data-testid="button-close-image"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualización de Resolución del Laboratorio */}
      <Dialog open={showResolucionViewModal} onOpenChange={setShowResolucionViewModal}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolución del Laboratorio</DialogTitle>
            {reclamoDetails?.fechaRespuestaLaboratorio && (
              <DialogDescription>
                Fecha: {format(new Date(reclamoDetails.fechaRespuestaLaboratorio), "dd MMMM yyyy HH:mm", { locale: es })}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {resolucionPhotosLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Informe del laboratorio */}
              {reclamoDetails?.informeLaboratorio && (
                <div>
                  <Label className="text-muted-foreground font-semibold">Informe</Label>
                  <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">{reclamoDetails.informeLaboratorio}</p>
                  </div>
                </div>
              )}

              {/* Evidencia fotográfica */}
              {resolucionPhotosData && resolucionPhotosData.length > 0 && (
                <div>
                  <Label className="text-muted-foreground font-semibold">
                    Evidencia Fotográfica ({resolucionPhotosData.length} foto{resolucionPhotosData.length !== 1 ? 's' : ''})
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {resolucionPhotosData.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.photoUrl}
                          alt={photo.description || 'Evidencia de resolución'}
                          className="w-full h-40 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setSelectedImage({ url: photo.photoUrl, description: photo.description || undefined });
                            setShowImageModal(true);
                          }}
                          data-testid={`img-resolucion-${photo.id}`}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-b">
                          <Eye className="h-3 w-3 inline mr-1" />
                          Ver imagen
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResolucionViewModal(false)}
              data-testid="button-close-resolucion-view"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
