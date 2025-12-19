import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  Building2,
  List,
  XCircle,
  MoreVertical,
  Edit,
  CheckCheck,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { ReclamoGeneral, ReclamoGeneralPhoto } from "@shared/schema";
import { RECLAMOS_AREAS, AREA_LABELS, getAreaLabel, getRoleArea } from "@shared/reclamosAreas";
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

const MOTIVO_OPTIONS = [
  { value: 'etiquetado', label: 'Etiquetado', area: 'produccion' },
  { value: 'sellado', label: 'Sellado', area: 'produccion' },
  { value: 'llenado_envase', label: 'Llenado del envase', area: 'produccion' },
  { value: 'formato_envase', label: 'Formato de envase', area: 'produccion' },
  { value: 'calidad_producto', label: 'Calidad de producto', area: 'laboratorio' },
  { value: 'diferencia_color', label: 'Diferencia de color', area: 'laboratorio' },
  { value: 'pedido_incompleto', label: 'Pedido incompleto', area: 'logistica' },
  { value: 'producto_expirado', label: 'Producto expirado', area: 'logistica' },
  { value: 'estado_envase', label: 'Estado del envase no adecuado', area: 'logistica' },
  { value: 'producto_cambiado', label: 'Producto cambiado', area: 'logistica' },
  { value: 'mal_aplicacion', label: 'Mal aplicación', area: 'aplicacion' },
  { value: 'otro', label: 'Otro', area: null },
];

const AREA_ASIGNADA_OPTIONS = [
  { value: RECLAMOS_AREAS.PRODUCCION, label: AREA_LABELS[RECLAMOS_AREAS.PRODUCCION] },
  { value: RECLAMOS_AREAS.LABORATORIO, label: AREA_LABELS[RECLAMOS_AREAS.LABORATORIO] },
  { value: RECLAMOS_AREAS.LOGISTICA, label: AREA_LABELS[RECLAMOS_AREAS.LOGISTICA] },
  { value: RECLAMOS_AREAS.APLICACION, label: AREA_LABELS[RECLAMOS_AREAS.APLICACION] },
  { value: RECLAMOS_AREAS.MATERIA_PRIMA, label: AREA_LABELS[RECLAMOS_AREAS.MATERIA_PRIMA] },
];

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

const CATEGORIA_RESPONSABLE_OPTIONS = [
  { value: RECLAMOS_AREAS.PRODUCCION, label: AREA_LABELS[RECLAMOS_AREAS.PRODUCCION] },
  { value: RECLAMOS_AREAS.LABORATORIO, label: AREA_LABELS[RECLAMOS_AREAS.LABORATORIO] },
  { value: RECLAMOS_AREAS.LOGISTICA, label: AREA_LABELS[RECLAMOS_AREAS.LOGISTICA] },
  { value: RECLAMOS_AREAS.APLICACION, label: AREA_LABELS[RECLAMOS_AREAS.APLICACION] },
];

const VALIDACION_AREA_OPTIONS = [
  { value: RECLAMOS_AREAS.PRODUCCION, label: AREA_LABELS[RECLAMOS_AREAS.PRODUCCION] },
  { value: RECLAMOS_AREAS.LABORATORIO, label: AREA_LABELS[RECLAMOS_AREAS.LABORATORIO] },
  { value: RECLAMOS_AREAS.LOGISTICA, label: AREA_LABELS[RECLAMOS_AREAS.LOGISTICA] },
  { value: RECLAMOS_AREAS.APLICACION, label: AREA_LABELS[RECLAMOS_AREAS.APLICACION] },
  { value: RECLAMOS_AREAS.ENVASE, label: AREA_LABELS[RECLAMOS_AREAS.ENVASE] },
  { value: RECLAMOS_AREAS.ETIQUETA, label: AREA_LABELS[RECLAMOS_AREAS.ETIQUETA] },
  { value: RECLAMOS_AREAS.MATERIA_PRIMA, label: AREA_LABELS[RECLAMOS_AREAS.MATERIA_PRIMA] },
  { value: RECLAMOS_AREAS.COLORES, label: AREA_LABELS[RECLAMOS_AREAS.COLORES] },
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
  'en_area_responsable': { 
    label: 'En Área Responsable', 
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    icon: Building2
  },
  'resuelto': { 
    label: 'Resuelto', 
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    icon: CheckCircle2
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

// Organizational roles constant
const organizationalRoles = ['produccion', 'logistica_bodega', 'planificacion', 'bodega_materias_primas', 'prevencion_riesgos'];

// Portal-based file picker that lives outside modal DOM tree
interface PortaledFilePickerProps {
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
}

function PortaledFilePicker({ inputRef, onChange, accept = "image/*", multiple = true }: PortaledFilePickerProps) {
  return createPortal(
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={onChange}
      className="hidden"
      style={{ display: 'none', position: 'absolute', left: '-9999px' }}
    />,
    document.body
  );
}

export default function ReclamosGeneralesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("mis-reclamos");
  const [filterTab, setFilterTab] = useState(() => {
    // Initialize with "asignados-area" for area, laboratorio, jefe_planta, and organizational roles
    if (user?.role === 'laboratorio' || user?.role === 'jefe_planta' || user?.role?.startsWith('area_') || (user?.role && organizationalRoles.includes(user.role))) {
      return 'asignados-area';
    }
    return 'todos';
  });
  const [showNewReclamoModal, setShowNewReclamoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [showResolucionLaboratorioModal, setShowResolucionLaboratorioModalRaw] = useState(false);
  const resolucionModalRef = useRef(false);
  
  const setShowResolucionLaboratorioModal = (value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(resolucionModalRef.current) : value;
    console.log('[DEBUG] setShowResolucionLaboratorioModal called:', newValue, new Error().stack?.split('\n').slice(1, 4).join(' | '));
    resolucionModalRef.current = newValue;
    setShowResolucionLaboratorioModalRaw(newValue);
  };
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; description?: string } | null>(null);
  const [showResolucionViewModal, setShowResolucionViewModal] = useState(false);
  
  // Refs to prevent modal closure when interacting with file upload areas
  const resolucionUploadContainerRef = useRef<HTMLDivElement>(null);
  const cerrarUploadContainerRef = useRef<HTMLDivElement>(null);
  const isFilePickerOpenRef = useRef(false);
  const [showValidacionTecnicaModal, setShowValidacionTecnicaModal] = useState(false);
  const [selectedReclamoId, setSelectedReclamoId] = useState<string | null>(null);
  const [resumenExpanded, setResumenExpanded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [validacionProcede, setValidacionProcede] = useState<boolean | null>(null);
  const [validacionAreaResponsable, setValidacionAreaResponsable] = useState("");
  const [validacionNotas, setValidacionNotas] = useState("");
  const [informeResolutivo, setInformeResolutivo] = useState("");
  const [informeLaboratorio, setInformeLaboratorio] = useState("");
  const [categoriaResponsable, setCategoriaResponsable] = useState("");
  const [resolucionPhotos, setResolucionPhotos] = useState<File[]>([]);
  const [resolucionPreviewUrls, setResolucionPreviewUrls] = useState<string[]>([]);
  const [resolucionDocuments, setResolucionDocuments] = useState<File[]>([]);
  const [resolucionUploadProgress, setResolucionUploadProgress] = useState({ current: 0, total: 0 });
  const resolucionFileInputRef = useRef<HTMLInputElement>(null);
  const resolucionDocInputRef = useRef<HTMLInputElement>(null);
  const [cerrarPhotos, setCerrarPhotos] = useState<File[]>([]);
  const [cerrarPreviewUrls, setCerrarPreviewUrls] = useState<string[]>([]);
  const [cerrarUploadProgress, setCerrarUploadProgress] = useState({ current: 0, total: 0 });
  const cerrarFileInputRef = useRef<HTMLInputElement>(null);
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
    motivo: '',
    areaAsignadaInicial: '',
    description: '',
    gravedad: 'media',
  });
  
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [debouncedClientSearchTerm, setDebouncedClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [manualClientEntry, setManualClientEntry] = useState(false);
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

  // Reset resumen expanded state when modal closes or reclamo changes
  useEffect(() => {
    if (!showDetailModal || !selectedReclamoId) {
      setResumenExpanded(false);
    }
  }, [showDetailModal, selectedReclamoId]);

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
      // Técnico de obra, laboratorio, admin, supervisor, jefe_planta y roles organizacionales ven todos los reclamos
      // Roles de área también ven todos para poder filtrar por su área
      const rolesQueVenTodos = [
        'tecnico_obra', 
        'laboratorio', 
        'admin', 
        'supervisor',
        'jefe_planta',
        'produccion',
        'logistica_bodega',
        'planificacion',
        'bodega_materias_primas',
        'prevencion_riesgos'
      ];
      const esRolDeArea = user?.role?.startsWith('area_');
      
      if (user?.id && !rolesQueVenTodos.includes(user.role!) && !esRolDeArea) {
        params.append('vendedorId', user.id);
      }
      const url = `/api/reclamos-generales?${params.toString()}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al obtener reclamos');
      return response.json();
    },
    enabled: !!user && (
      user.role === 'salesperson' || 
      user.role === 'admin' || 
      user.role === 'supervisor' || 
      user.role === 'tecnico_obra' || 
      user.role === 'laboratorio' || 
      user.role === 'jefe_planta' ||
      user.role === 'produccion' ||
      user.role === 'logistica_bodega' ||
      user.role === 'planificacion' ||
      user.role === 'bodega_materias_primas' ||
      user.role === 'prevencion_riesgos' ||
      user.role?.startsWith('area_')
    ),
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

  // Update reclamo mutation
  const updateReclamoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }): Promise<ReclamoGeneral> => {
      const response = await apiRequest(`/api/reclamos-generales/${id}`, {
        method: 'PATCH',
        data: data,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Reclamo actualizado",
        description: "El reclamo ha sido actualizado exitosamente.",
      });
      resetForm();
      setShowNewReclamoModal(false);
      setIsEditMode(false);
      setSelectedReclamoId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el reclamo",
        variant: "destructive",
      });
    },
  });

  // Cerrar reclamo mutation
  const cerrarReclamoMutation = useMutation({
    mutationFn: async ({ reclamoId, notas, photos }: { reclamoId: string; notas: string; photos: Array<{ photoUrl: string; description?: string }> }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/cerrar`, {
        method: 'POST',
        data: { notas, photos },
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
      setCerrarPhotos([]);
      setCerrarPreviewUrls([]);
      setCerrarUploadProgress({ current: 0, total: 0 });
      setSelectedReclamoId(null);
    },
    onError: (error) => {
      setCerrarUploadProgress({ current: 0, total: 0 });
      toast({
        title: "Error",
        description: (error as any)?.message || "No se pudo cerrar el reclamo",
        variant: "destructive",
      });
    },
  });

  // Subir resolución del laboratorio con evidencia
  const resolucionLaboratorioMutation = useMutation({
    mutationFn: async ({ reclamoId, informe, categoriaResponsable, photos, documents }: { 
      reclamoId: string; 
      informe: string; 
      categoriaResponsable?: string; 
      photos: Array<{ photoUrl: string; description?: string }>;
      documents?: Array<{ fileName: string; fileData: string; mimeType: string }>;
    }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/resolucion-laboratorio`, {
        method: 'POST',
        data: { informe, categoriaResponsable, photos, documents },
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
      setCategoriaResponsable("");
      setResolucionPhotos([]);
      setResolucionPreviewUrls([]);
      setResolucionDocuments([]);
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

  // Subir resolución del área responsable con evidencia
  const resolucionAreaMutation = useMutation({
    mutationFn: async ({ reclamoId, resolucionDescripcion, photos, documents }: { 
      reclamoId: string; 
      resolucionDescripcion: string; 
      photos: Array<{ photoUrl: string; description?: string }>;
      documents?: Array<{ fileName: string; fileData: string; mimeType: string }>;
    }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/resolucion-area`, {
        method: 'POST',
        data: { resolucionDescripcion, photos, documents },
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Resolución enviada",
        description: "La resolución del área responsable ha sido registrada con éxito.",
      });
      setShowResolucionLaboratorioModal(false);
      setInformeLaboratorio("");
      setResolucionPhotos([]);
      setResolucionPreviewUrls([]);
      setResolucionDocuments([]);
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

  // Derivar a laboratorio mutation
  const derivarLaboratorioMutation = useMutation({
    mutationFn: async (reclamoId: string) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/derivar-laboratorio`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Reclamo derivado",
        description: "El reclamo ha sido derivado a laboratorio exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo derivar el reclamo a laboratorio",
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

  // Validar reclamo mutation (solo tecnico_obra)
  const validarReclamoMutation = useMutation({
    mutationFn: async ({ reclamoId, procede, areaResponsable, notas }: { 
      reclamoId: string; 
      procede: boolean; 
      areaResponsable?: string; 
      notas: string;
    }) => {
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/validacion-tecnica`, {
        method: 'POST',
        data: { procede, areaResponsable, notas },
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Validación registrada",
        description: "La validación técnica ha sido registrada exitosamente.",
      });
      setShowValidacionTecnicaModal(false);
      setValidacionProcede(null);
      setValidacionAreaResponsable("");
      setValidacionNotas("");
      setSelectedReclamoId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo registrar la validación",
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
      motivo: '',
      areaAsignadaInicial: '',
      description: '',
      gravedad: 'media',
    });
    setClientSearchTerm('');
    setManualClientEntry(false);
    setSelectedFiles([]);
    setPreviewUrls([]);
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
    console.log('[DEBUG] handleResolucionFileSelect called, files:', e.target.files?.length);
    e.stopPropagation();
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

  // Función para manejar selección de documentos
  const handleResolucionDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const files = Array.from(e.target.files || []);
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const docFiles = files.filter(file => validTypes.includes(file.type));
    
    if (docFiles.length !== files.length) {
      toast({
        title: "Advertencia",
        description: "Solo se aceptan archivos PDF, Word o Excel",
        variant: "destructive",
      });
    }
    
    if (docFiles.length === 0) return;
    
    // Verificar tamaño máximo (10MB por archivo)
    const validSizeFiles = docFiles.filter(file => file.size <= 10 * 1024 * 1024);
    if (validSizeFiles.length !== docFiles.length) {
      toast({
        title: "Advertencia", 
        description: "Algunos archivos exceden el límite de 10MB",
        variant: "destructive",
      });
    }
    
    if (validSizeFiles.length > 0) {
      setResolucionDocuments(prev => [...prev, ...validSizeFiles]);
      toast({
        title: "Documentos agregados",
        description: `Se agregaron ${validSizeFiles.length} documento(s)`,
      });
    }
    
    // Clear the file input
    if (resolucionDocInputRef.current) {
      resolucionDocInputRef.current.value = '';
    }
  };

  const removeResolucionDoc = (index: number) => {
    setResolucionDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Funciones para fotos de evidencia al cerrar
  const handleCerrarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent modal from closing
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
      setCerrarPhotos(prev => [...prev, ...newFiles]);
      setCerrarPreviewUrls(prev => [...prev, ...newPreviews]);
    }
    
    // Clear the file input
    if (cerrarFileInputRef.current) {
      cerrarFileInputRef.current.value = '';
    }
  };

  const removeCerrarFile = (index: number) => {
    setCerrarPhotos(prev => prev.filter((_, i) => i !== index));
    setCerrarPreviewUrls(prev => prev.filter((_, i) => i !== index));
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

    // Verificar si es un rol de área o rol organizacional
    // Jefe de planta puede dar resolución a reclamos de producción
    const isAreaRole = user?.role?.startsWith('area_') || 
                       (user?.role && organizationalRoles.includes(user.role)) ||
                       user?.role === 'jefe_planta';
    
    // Solo validar categoriaResponsable para laboratorio
    if (user?.role === 'laboratorio' && !categoriaResponsable) {
      toast({
        title: "Error",
        description: "Debe seleccionar el área responsable",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedReclamoId) return;

    // Prepare photos array (optional - can be empty)
    const photos = resolucionPreviewUrls.map(photoUrl => ({
      photoUrl,
      description: isAreaRole ? "Evidencia de resolución del área responsable" : "Evidencia de resolución del laboratorio"
    }));

    // Convert documents to base64
    const documents: Array<{ fileName: string; fileData: string; mimeType: string }> = [];
    for (const doc of resolucionDocuments) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(doc);
        });
        documents.push({
          fileName: doc.name,
          fileData: base64,
          mimeType: doc.type
        });
      } catch (error) {
        console.error('Error reading document:', error);
      }
    }

    if (isAreaRole) {
      // Usar el endpoint de área responsable
      resolucionAreaMutation.mutate({
        reclamoId: selectedReclamoId,
        resolucionDescripcion: informeLaboratorio,
        photos,
        documents
      });
    } else {
      // Usar el endpoint de laboratorio
      resolucionLaboratorioMutation.mutate({
        reclamoId: selectedReclamoId,
        informe: informeLaboratorio,
        categoriaResponsable,
        photos,
        documents
      });
    }
  };

  const handleSubmit = () => {
    if (!formData.clientName || !formData.productName || !formData.motivo || !formData.areaAsignadaInicial || !formData.description) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    
    if (!isEditMode && previewUrls.length === 0) {
      toast({
        title: "Error",
        description: "Debe adjuntar al menos una foto del reclamo",
        variant: "destructive",
      });
      return;
    }
    
    // Verify all files were compressed successfully (only for new uploads)
    if (!isEditMode && previewUrls.length !== selectedFiles.length) {
      toast({
        title: "Error",
        description: "Algunas fotos no se procesaron correctamente. Por favor, elimínelas y vuelva a intentar.",
        variant: "destructive",
      });
      return;
    }

    const reclamoData = {
      clientName: formData.clientName,
      clientRut: formData.clientRut || null,
      clientEmail: formData.clientEmail || null,
      clientPhone: formData.clientPhone || null,
      clientAddress: formData.clientAddress || null,
      productName: formData.productName,
      productSku: formData.productSku || null,
      lote: formData.lote || null,
      motivo: formData.motivo,
      areaAsignadaInicial: formData.areaAsignadaInicial,
      description: formData.description,
      gravedad: formData.gravedad,
    };

    if (isEditMode && selectedReclamoId) {
      updateReclamoMutation.mutate({
        id: selectedReclamoId,
        data: reclamoData,
      });
    } else {
      createReclamoMutation.mutate({
        ...reclamoData,
        estado: 'registrado',
      });
    }
  };

  // Get user's area from role using shared taxonomy
  const getUserArea = () => {
    return getRoleArea(user?.role);
  };

  // Get available tabs based on user role
  const getAvailableTabs = () => {
    const tabs = [];

    // Tabs for area, laboratorio, and organizational roles
    const isAreaRole = user?.role === 'laboratorio' || 
                       user?.role?.startsWith('area_') || 
                       organizationalRoles.includes(user?.role || '');
    
    // Jefe de planta ve todos los reclamos y los asignados a producción
    if (user?.role === 'jefe_planta') {
      tabs.push(
        { value: 'asignados-area', label: 'Asignados a Producción', icon: Building2 },
        { value: 'todos', label: 'Todos', icon: List }
      );
    } else if (isAreaRole) {
      tabs.push(
        { value: 'asignados-area', label: 'Asignados a Mi Área', icon: Building2 },
        { value: 'todos', label: 'Todos', icon: List }
      );
    } else {
      // For vendedores, admin, supervisor, tecnico_obra
      tabs.push(
        { value: 'todos', label: 'Todos', icon: List },
        { value: 'mis-reclamos', label: 'Mis Reclamos', icon: User }
      );
    }

    // Add "Pendientes Validación" only for tecnico_obra
    if (user?.role === 'tecnico_obra') {
      tabs.push({ value: 'pendientes-validacion', label: 'Pendientes Validación', icon: Clock });
    }

    tabs.push(
      { value: 'resueltos', label: 'Resueltos', icon: CheckCircle2 },
      { value: 'cerrados', label: 'Cerrados', icon: XCircle }
    );

    return tabs;
  };

  // Filter reclamos based on selected tab
  const filterByTab = (reclamos: ReclamoGeneral[]) => {
    switch (filterTab) {
      case 'todos':
        return reclamos;
      
      case 'mis-reclamos':
        return reclamos.filter(r => r.vendedorId === user?.id);
      
      case 'pendientes-validacion':
        // Only for tecnico_obra: reclamos in "registrado" state
        return reclamos.filter(r => r.estado === 'registrado');
      
      case 'asignados-area':
        if (user?.role === 'laboratorio') {
          // Laboratorio: reclamos in "en_laboratorio" state OR assigned to laboratorio area in "en_area_responsable" state
          const userArea = getUserArea();
          return reclamos.filter(r => 
            r.estado === 'en_laboratorio' || 
            (r.areaResponsableActual === userArea && r.estado === 'en_area_responsable')
          );
        } else if (user?.role?.startsWith('area_') || (user?.role && organizationalRoles.includes(user.role))) {
          // Area roles and organizational roles: reclamos where areaResponsableActual matches and estado === "en_area_responsable"
          const userArea = getUserArea();
          return reclamos.filter(r => 
            r.areaResponsableActual === userArea && r.estado === 'en_area_responsable'
          );
        }
        return [];
      
      case 'resueltos':
        return reclamos.filter(r => r.estado === 'resuelto');
      
      case 'cerrados':
        return reclamos.filter(r => r.estado === 'cerrado');
      
      default:
        return reclamos;
    }
  };

  // Get count for a specific tab
  const getTabCount = (tabValue: string) => {
    const filterBySpecificTab = (reclamos: ReclamoGeneral[], tab: string) => {
      switch (tab) {
        case 'todos':
          return reclamos;
        
        case 'mis-reclamos':
          return reclamos.filter(r => r.vendedorId === user?.id);
        
        case 'pendientes-validacion':
          return reclamos.filter(r => r.estado === 'registrado');
        
        case 'asignados-area':
          if (user?.role === 'laboratorio') {
            const userArea = getUserArea();
            return reclamos.filter(r => 
              r.estado === 'en_laboratorio' || 
              (r.areaResponsableActual === userArea && r.estado === 'en_area_responsable')
            );
          } else if (user?.role?.startsWith('area_') || (user?.role && organizationalRoles.includes(user.role))) {
            const userArea = getUserArea();
            return reclamos.filter(r => 
              r.areaResponsableActual === userArea && r.estado === 'en_area_responsable'
            );
          }
          return [];
        
        case 'resueltos':
          return reclamos.filter(r => r.estado === 'resuelto');
        
        case 'cerrados':
          return reclamos.filter(r => r.estado === 'cerrado');
        
        default:
          return reclamos;
      }
    };

    return filterBySpecificTab(reclamos.filter(reclamo => {
      const matchesSearch = reclamo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reclamo.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEstado = filterEstado === 'all' || reclamo.estado === filterEstado;
      const matchesGravedad = filterGravedad === 'all' || reclamo.gravedad === filterGravedad;
      return matchesSearch && matchesEstado && matchesGravedad;
    }), tabValue).length;
  };

  const filteredReclamos = reclamos.filter(reclamo => {
    // Apply tab-based filtering first
    const tabFiltered = filterByTab([reclamo]).length > 0;
    
    // Apply search and other filters
    const matchesSearch = reclamo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reclamo.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'all' || reclamo.estado === filterEstado;
    const matchesGravedad = filterGravedad === 'all' || reclamo.gravedad === filterGravedad;
    
    return tabFiltered && matchesSearch && matchesEstado && matchesGravedad;
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

  const hasAccess = user && (
    user.role === 'salesperson' || 
    user.role === 'admin' || 
    user.role === 'supervisor' || 
    user.role === 'tecnico_obra' || 
    user.role === 'laboratorio' ||
    user.role === 'jefe_planta' ||
    user.role?.startsWith('area_') ||
    (user.role && organizationalRoles.includes(user.role))
  );

  if (!hasAccess) {
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
        {(user?.role === 'salesperson' || user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'tecnico_obra') && (
          <Button 
            onClick={() => setShowNewReclamoModal(true)}
            data-testid="button-create-reclamo"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Reclamo
          </Button>
        )}
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

          {/* Filter Tabs - Modernized */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <Tabs value={filterTab} onValueChange={setFilterTab} className="w-full">
              <TabsList className="w-full justify-start h-auto gap-0 bg-transparent p-0 border-b border-gray-200 dark:border-gray-800 rounded-none">
                {getAvailableTabs().map((tab) => {
                  const Icon = tab.icon;
                  const count = getTabCount(tab.value);
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      data-testid={`tab-filter-${tab.value}`}
                      className="relative flex items-center gap-2 px-6 py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{tab.label}</span>
                      <span 
                        className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                      >
                        {count}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

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
                                  {reclamo.clientName} {reclamo.clientRut && <span className="text-muted-foreground font-normal">- {reclamo.clientRut}</span>}
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
                                {reclamo.vendedorName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Creado por: {reclamo.vendedorName}
                                  </span>
                                )}
                                {reclamo.tecnicoName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Técnico: {reclamo.tecnicoName}
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

                              {/* Menú desplegable de acciones */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-actions-${reclamo.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {/* Opciones para Técnico de Obra */}
                                  {user?.role === 'tecnico_obra' && reclamo.estado === 'registrado' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedReclamoId(reclamo.id);
                                          setIsEditMode(true);
                                          setFormData({
                                            clientName: reclamo.clientName,
                                            clientRut: reclamo.clientRut || '',
                                            clientEmail: reclamo.clientEmail || '',
                                            clientPhone: reclamo.clientPhone || '',
                                            clientAddress: reclamo.clientAddress || '',
                                            productName: reclamo.productName,
                                            productSku: reclamo.productSku || '',
                                            lote: reclamo.lote || '',
                                            motivo: reclamo.motivo || '',
                                            areaAsignadaInicial: reclamo.areaAsignadaInicial || '',
                                            description: reclamo.description,
                                            gravedad: reclamo.gravedad,
                                          });
                                          setShowNewReclamoModal(true);
                                        }}
                                        data-testid={`menu-edit-reclamo-${reclamo.id}`}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedReclamoId(reclamo.id);
                                          setShowValidacionTecnicaModal(true);
                                        }}
                                        data-testid={`menu-validar-reclamo-${reclamo.id}`}
                                      >
                                        <CheckCheck className="h-4 w-4 mr-2" />
                                        Validar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}

                                  {/* Opciones para Laboratorio y Áreas Responsables */}
                                  {((user?.role === 'laboratorio' && reclamo.estado === 'en_laboratorio') || 
                                    (user?.role?.startsWith('area_') && reclamo.estado === 'en_area_responsable') ||
                                    (organizationalRoles.includes(user?.role || '') && reclamo.estado === 'en_area_responsable')) && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedReclamoId(reclamo.id);
                                          if (reclamo.informeLaboratorio) {
                                            setShowDetailModal(true);
                                            setTimeout(() => setShowResolucionViewModal(true), 300);
                                          } else {
                                            // Navegar a página separada para evitar problema de cierre en móvil
                                            setLocation(`/reclamos/resolucion/${reclamo.id}`);
                                          }
                                        }}
                                        data-testid={`menu-resolucion-laboratorio-${reclamo.id}`}
                                      >
                                        {reclamo.informeLaboratorio ? (
                                          <>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Ver Resolución
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Subir Resolución
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  
                                  {/* Opción de Cerrar - disponible para técnicos de obra, laboratorio, áreas y roles organizacionales */}
                                  {reclamo.estado !== 'cerrado' && (
                                    user?.role === 'tecnico_obra' ||
                                    user?.role === 'laboratorio' ||
                                    user?.role?.startsWith('area_') ||
                                    organizationalRoles.includes(user?.role || '')
                                  ) && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedReclamoId(reclamo.id);
                                        setShowCerrarModal(true);
                                      }}
                                      data-testid={`menu-cerrar-reclamo-${reclamo.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Cerrar
                                    </DropdownMenuItem>
                                  )}

                                  {/* Opción de Eliminar para Admin y Técnico */}
                                  {(user?.role === 'admin' || user?.role === 'tecnico_obra') && (
                                    <>
                                      {(reclamo.estado !== 'cerrado' && user?.role === 'tecnico_obra') && <DropdownMenuSeparator />}
                                      <DropdownMenuItem
                                        onClick={() => {
                                          if (window.confirm('¿Está seguro que desea eliminar este reclamo? Esta acción no se puede deshacer.')) {
                                            deleteReclamoMutation.mutate(reclamo.id);
                                          }
                                        }}
                                        disabled={deleteReclamoMutation.isPending}
                                        data-testid={`menu-delete-reclamo-${reclamo.id}`}
                                        className="text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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

      {/* Create/Edit Reclamo Dialog */}
      <Dialog open={showNewReclamoModal} onOpenChange={(open) => {
        setShowNewReclamoModal(open);
        if (!open) {
          setIsEditMode(false);
          setSelectedReclamoId(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Editar Reclamo' : 'Nuevo Reclamo de Cliente'}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Modifique la información del reclamo' : 'Complete la información del reclamo y adjunte fotos'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <div className="space-y-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente <span className="text-red-500">*</span></Label>
              {!manualClientEntry ? (
                <div className="relative" ref={clientDropdownRef}>
                  <Input
                    id="cliente"
                    placeholder="Buscar cliente..."
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setShowClientDropdown(true);
                      setFormData(prev => ({ ...prev, clientName: '', clientRut: '' }));
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
                  {showClientDropdown && clients.length === 0 && debouncedClientSearchTerm.length > 0 && (
                    <Card className="absolute z-50 w-full mt-1 shadow-lg border-2">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-3">
                          No se encontraron clientes con ese nombre
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setManualClientEntry(true);
                            setFormData(prev => ({ ...prev, clientName: clientSearchTerm }));
                            setShowClientDropdown(false);
                          }}
                          data-testid="button-add-manual-client"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Cliente Manualmente
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Ingresando cliente manualmente
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setManualClientEntry(false);
                        setClientSearchTerm('');
                        setFormData(prev => ({ ...prev, clientName: '', clientRut: '' }));
                      }}
                      data-testid="button-cancel-manual-client"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Buscar en base de datos
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="manual-client-name">Nombre del Cliente <span className="text-red-500">*</span></Label>
                    <Input
                      id="manual-client-name"
                      placeholder="Ingrese nombre del cliente"
                      value={formData.clientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      data-testid="input-manual-client-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-client-rut">RUT del Cliente</Label>
                    <Input
                      id="manual-client-rut"
                      placeholder="Ingrese RUT (opcional)"
                      value={formData.clientRut}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientRut: e.target.value }))}
                      data-testid="input-manual-client-rut"
                    />
                  </div>
                </div>
              )}
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

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo del Reclamo <span className="text-red-500">*</span></Label>
              <Select 
                value={formData.motivo} 
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, motivo: value }));
                  const selectedMotivo = MOTIVO_OPTIONS.find(m => m.value === value);
                  if (selectedMotivo?.area) {
                    setFormData(prev => ({ ...prev, areaAsignadaInicial: selectedMotivo.area || '' }));
                  } else {
                    setFormData(prev => ({ ...prev, areaAsignadaInicial: '' }));
                  }
                }}
              >
                <SelectTrigger data-testid="select-motivo">
                  <SelectValue placeholder="Seleccione el motivo del reclamo" />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVO_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Área Asignada Inicial */}
            <div className="space-y-2">
              <Label htmlFor="areaAsignadaInicial">Área Responsable Inicial <span className="text-red-500">*</span></Label>
              <Select 
                value={formData.areaAsignadaInicial} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, areaAsignadaInicial: value }))}
              >
                <SelectTrigger data-testid="select-area-asignada-inicial">
                  <SelectValue placeholder="Seleccione el área responsable" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_ASIGNADA_OPTIONS.map(({ value, label }) => (
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

            {/* Photos Upload - Only show when creating new reclamo */}
            {!isEditMode && (
              <div className="space-y-2">
                <Label>Fotos <span className="text-red-500">*</span></Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
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
            )}
          </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowNewReclamoModal(false);
                setIsEditMode(false);
                setSelectedReclamoId(null);
              }}
              data-testid="button-cancel-reclamo"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createReclamoMutation.isPending || updateReclamoMutation.isPending}
              data-testid="button-submit-reclamo"
            >
              {(createReclamoMutation.isPending || updateReclamoMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {uploadProgress.total > 0 ? (
                `Subiendo foto ${uploadProgress.current}/${uploadProgress.total}...`
              ) : (createReclamoMutation.isPending || updateReclamoMutation.isPending) ? (
                isEditMode ? 'Actualizando reclamo...' : 'Creando reclamo...'
              ) : (
                isEditMode ? 'Actualizar Reclamo' : 'Crear Reclamo'
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
            {/* Botón para laboratorio y áreas responsables debajo del título */}
            {((user?.role === 'laboratorio' && reclamoDetails && reclamoDetails.estado === 'en_laboratorio') ||
              ((user?.role?.startsWith('area_') || (user?.role && organizationalRoles.includes(user.role))) && reclamoDetails && reclamoDetails.estado === 'en_area_responsable')) && (
              <Button
                onClick={() => {
                  if (reclamoDetails.informeLaboratorio) {
                    // Si ya tiene resolución, abrir el modal de visualización
                    setShowResolucionViewModal(true);
                  } else {
                    // Navegar a página separada para evitar problema de cierre en móvil
                    setShowDetailModal(false);
                    setLocation(`/reclamos/resolucion/${reclamoDetails.id}`);
                  }
                }}
                className={`mt-2 w-full ${reclamoDetails.informeLaboratorio ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                data-testid="button-resolucion-laboratorio-modal"
              >
                {reclamoDetails.informeLaboratorio ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Resolución {user?.role === 'laboratorio' ? 'del Laboratorio' : 'del Área Responsable'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Resolución {user?.role === 'laboratorio' ? 'del Laboratorio' : 'del Área Responsable'}
                  </>
                )}
              </Button>
            )}
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : reclamoDetails ? (
            <div className="space-y-6 pt-4">
              {/* Resumen de Resolución - Cuando está resuelto o cerrado */}
              {(reclamoDetails.estado === 'resuelto' || reclamoDetails.estado === 'cerrado') && 
               (reclamoDetails.informeLaboratorio || reclamoDetails.resolucionDescripcion) && (
                <Card className="border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <CardTitle className="text-base text-green-900 dark:text-green-100">
                          Resolución del Reclamo
                        </CardTitle>
                      </div>
                      <Badge className="bg-green-600 text-white">
                        {reclamoDetails.estado === 'cerrado' ? 'Cerrado' : 'Resuelto'}
                      </Badge>
                    </div>
                    {reclamoDetails.categoriaResponsable && (
                      <p className="text-sm mt-1 text-green-700 dark:text-green-300">
                        Área responsable: {CATEGORIA_RESPONSABLE_OPTIONS.find(c => c.value === reclamoDetails.categoriaResponsable)?.label || reclamoDetails.categoriaResponsable}
                      </p>
                    )}
                    {reclamoDetails.resolucionUsuarioName && (
                      <p className="text-sm mt-1 text-green-700 dark:text-green-300">
                        Resuelto por: {reclamoDetails.resolucionUsuarioName}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className={`text-sm whitespace-pre-wrap text-green-900 dark:text-green-100 ${!resumenExpanded && 'line-clamp-3'}`}>
                        {reclamoDetails.informeLaboratorio || reclamoDetails.resolucionDescripcion}
                      </p>
                      {(reclamoDetails.informeLaboratorio || reclamoDetails.resolucionDescripcion || '').length > 150 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setResumenExpanded(!resumenExpanded)}
                          className="p-0 h-auto mt-1 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                          data-testid="button-toggle-resumen"
                        >
                          {resumenExpanded ? (
                            <>
                              Ver menos <ChevronUp className="h-3 w-3 ml-1" />
                            </>
                          ) : (
                            <>
                              Ver más <ChevronDown className="h-3 w-3 ml-1" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResolucionViewModal(true)}
                      className="w-full border-green-400 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900 text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                      data-testid="button-ver-evidencia-resolucion"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Evidencia Fotográfica Completa
                    </Button>
                  </CardContent>
                </Card>
              )}

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
                {reclamoDetails.vendedorName && (
                  <div>
                    <Label className="text-muted-foreground">Creado por</Label>
                    <p className="font-medium">{reclamoDetails.vendedorName}</p>
                  </div>
                )}
                {reclamoDetails.tecnicoName && (
                  <div>
                    <Label className="text-muted-foreground">Técnico Asignado</Label>
                    <p className="font-medium">{reclamoDetails.tecnicoName}</p>
                  </div>
                )}
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
                {reclamoDetails.motivo && (
                  <div>
                    <Label className="text-muted-foreground">Motivo del Reclamo</Label>
                    <div className="mt-1">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {MOTIVO_OPTIONS.find(m => m.value === reclamoDetails.motivo)?.label || reclamoDetails.motivo}
                      </Badge>
                    </div>
                  </div>
                )}
                {reclamoDetails.areaAsignadaInicial && (
                  <div>
                    <Label className="text-muted-foreground">Área Asignada Inicial</Label>
                    <div className="mt-1">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {AREA_ASIGNADA_OPTIONS.find(a => a.value === reclamoDetails.areaAsignadaInicial)?.label || reclamoDetails.areaAsignadaInicial}
                      </Badge>
                    </div>
                  </div>
                )}
                {reclamoDetails.categoriaResponsable && (
                  <div>
                    <Label className="text-muted-foreground">Área Responsable Final</Label>
                    <div className="mt-1">
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        {CATEGORIA_RESPONSABLE_OPTIONS.find(c => c.value === reclamoDetails.categoriaResponsable)?.label || reclamoDetails.categoriaResponsable}
                      </Badge>
                    </div>
                  </div>
                )}
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
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Prevent closing when clicking anywhere inside the upload container
            const target = e.target as Node;
            if (cerrarUploadContainerRef.current?.contains(target)) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            // Also prevent pointer down events from closing the modal
            const target = e.target as Node;
            if (cerrarUploadContainerRef.current?.contains(target)) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Cerrar Reclamo</DialogTitle>
            <DialogDescription>
              Ingrese el informe resolutivo y adjunte evidencia fotográfica
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
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

            {/* Fotos de evidencia */}
            <div ref={cerrarUploadContainerRef}>
              <Label>Evidencia Fotográfica (Opcional)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Puede adjuntar fotos que documenten la solución aplicada si lo considera necesario
              </p>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cerrarFileInputRef.current?.click()}
                  data-testid="button-upload-cerrar-photos"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar Fotos
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Opcional: puede añadir fotos de evidencia
                </p>
              </div>
              
              {cerrarPreviewUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {cerrarPreviewUrls.map((url, index) => (
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
                        onClick={() => removeCerrarFile(index)}
                        data-testid={`button-remove-cerrar-photo-${index}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCerrarModal(false);
                setInformeResolutivo("");
                setCerrarPhotos([]);
                setCerrarPreviewUrls([]);
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
                  const photos = cerrarPreviewUrls.map(photoUrl => ({
                    photoUrl,
                    description: "Evidencia de cierre del reclamo"
                  }));
                  cerrarReclamoMutation.mutate({
                    reclamoId: selectedReclamoId,
                    notas: informeResolutivo,
                    photos
                  });
                }
              }}
              disabled={cerrarReclamoMutation.isPending}
              data-testid="button-confirm-cerrar"
            >
              {cerrarReclamoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {cerrarUploadProgress.total > 0 ? (
                    `Subiendo foto ${cerrarUploadProgress.current}/${cerrarUploadProgress.total}...`
                  ) : (
                    'Cerrando...'
                  )}
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

      {/* Modal de Resolución del Laboratorio - CSS-based visibility to prevent file picker issues */}
      <div 
        className={`fixed inset-0 z-50 bg-black/80 transition-opacity ${showResolucionLaboratorioModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        aria-hidden={!showResolucionLaboratorioModal} 
      />
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity ${showResolucionLaboratorioModal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ display: showResolucionLaboratorioModal ? 'flex' : 'none' }}
      >
        <div className="bg-background border rounded-lg shadow-lg max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {user?.role === 'laboratorio' ? 'Resolución del Laboratorio' : 'Resolución del Área Responsable'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ingrese el informe de resolución y adjunte fotos de evidencia
            </p>
          </div>
          
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

            {/* Área Responsable - Solo para laboratorio */}
            {user?.role === 'laboratorio' && (
              <div>
                <Label htmlFor="categoria-responsable">Área Responsable <span className="text-red-500">*</span></Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Seleccione el área responsable del reclamo según el análisis realizado
                </p>
                <Select 
                  value={categoriaResponsable} 
                  onValueChange={setCategoriaResponsable}
                >
                  <SelectTrigger data-testid="select-categoria-responsable" className="mt-2">
                    <SelectValue placeholder="Seleccione un área..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIA_RESPONSABLE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Evidencia fotográfica y documentos */}
            <div ref={resolucionUploadContainerRef} className="space-y-6">
              {/* Fotos */}
              <div>
                <Label>Evidencia Fotográfica (Opcional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Puede adjuntar fotos de evidencia de la resolución si lo considera necesario
                </p>
                
                <Button
                  type="button"
                  variant="outline"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[DEBUG] Adjuntar Fotos clicked - opening file picker');
                    isFilePickerOpenRef.current = true;
                    resolucionFileInputRef.current?.click();
                    setTimeout(() => {
                      console.log('[DEBUG] Resetting file picker flag');
                      isFilePickerOpenRef.current = false;
                    }, 1000);
                  }}
                  className="w-full mb-4"
                  data-testid="button-add-evidencia"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Adjuntar Fotos de Evidencia
                </Button>
                
                {resolucionPreviewUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
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

              {/* Documentos adjuntos */}
              <div>
              <Label>Documentos Adjuntos (Opcional)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Puede adjuntar documentos PDF, Word o Excel como respaldo
              </p>
              
              <Button
                type="button"
                variant="outline"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  isFilePickerOpenRef.current = true;
                  resolucionDocInputRef.current?.click();
                  setTimeout(() => {
                    isFilePickerOpenRef.current = false;
                  }, 1000);
                }}
                className="w-full mb-4"
                data-testid="button-add-documento"
              >
                <FileText className="h-4 w-4 mr-2" />
                Adjuntar Documento
              </Button>
              
              {resolucionDocuments.length > 0 && (
                <div className="space-y-2">
                  {resolucionDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        <span className="text-sm truncate">{doc.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({(doc.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => removeResolucionDoc(index)}
                        data-testid={`button-remove-doc-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>

            {/* Indicador de progreso */}
            {resolucionUploadProgress.total > 0 && (
              <div className="text-sm text-muted-foreground text-center">
                Subiendo foto {resolucionUploadProgress.current} de {resolucionUploadProgress.total}...
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowResolucionLaboratorioModal(false);
                setInformeLaboratorio("");
                setCategoriaResponsable("");
                setResolucionPhotos([]);
                setResolucionPreviewUrls([]);
                setResolucionDocuments([]);
                setResolucionUploadProgress({ current: 0, total: 0 });
                setSelectedReclamoId(null);
              }}
              data-testid="button-cancel-resolucion"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitResolucion}
              disabled={resolucionLaboratorioMutation.isPending || resolucionAreaMutation.isPending}
              data-testid="button-submit-resolucion"
            >
              {(resolucionLaboratorioMutation.isPending || resolucionAreaMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {resolucionUploadProgress.total > 0 ? (
                `Subiendo foto ${resolucionUploadProgress.current}/${resolucionUploadProgress.total}...`
              ) : (resolucionLaboratorioMutation.isPending || resolucionAreaMutation.isPending) ? (
                'Enviando resolución...'
              ) : (
                'Enviar Resolución'
              )}
            </Button>
          </div>
        </div>
      </div>

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
              {/* Área Responsable */}
              {reclamoDetails?.categoriaResponsable && (
                <div>
                  <Label className="text-muted-foreground font-semibold">Área Responsable</Label>
                  <div className="mt-2">
                    <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                      {CATEGORIA_RESPONSABLE_OPTIONS.find(c => c.value === reclamoDetails.categoriaResponsable)?.label || reclamoDetails.categoriaResponsable}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Informe del laboratorio */}
              {reclamoDetails?.informeLaboratorio && (
                <div>
                  <Label className="text-muted-foreground font-semibold">Informe</Label>
                  <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">{reclamoDetails.informeLaboratorio}</p>
                  </div>
                </div>
              )}

              {/* Evidencia fotográfica y documentos */}
              {resolucionPhotosData && resolucionPhotosData.length > 0 && (() => {
                const photos = resolucionPhotosData.filter((p: any) => !p.description?.startsWith('Documento:'));
                const documents = resolucionPhotosData.filter((p: any) => p.description?.startsWith('Documento:'));
                
                return (
                  <>
                    {photos.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground font-semibold">
                          Evidencia Fotográfica ({photos.length} foto{photos.length !== 1 ? 's' : ''})
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                          {photos.map((photo: any) => (
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
                    
                    {documents.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground font-semibold">
                          Documentos Adjuntos ({documents.length} documento{documents.length !== 1 ? 's' : ''})
                        </Label>
                        <div className="space-y-2 mt-2">
                          {documents.map((doc: any) => {
                            const fileName = doc.description?.replace('Documento: ', '') || 'Documento';
                            const isDownloadable = doc.photoUrl?.startsWith('data:');
                            return (
                              <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded border">
                                <FileText className="h-6 w-6 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fileName}</p>
                                </div>
                                {isDownloadable && (
                                  <a
                                    href={doc.photoUrl}
                                    download={fileName}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                    data-testid={`link-download-doc-${doc.id}`}
                                  >
                                    Descargar
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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

      {/* Modal de Validación Técnica */}
      <Dialog open={showValidacionTecnicaModal} onOpenChange={setShowValidacionTecnicaModal}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Validación Técnica</DialogTitle>
            <DialogDescription>
              Indique si el reclamo procede y proporcione detalles
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Radio buttons para ¿Procede? */}
            <div className="space-y-3">
              <Label>¿Procede? <span className="text-red-500">*</span></Label>
              <RadioGroup 
                value={validacionProcede === null ? undefined : validacionProcede ? "si" : "no"}
                onValueChange={(value) => {
                  setValidacionProcede(value === "si");
                  if (value === "no") {
                    setValidacionAreaResponsable("");
                  }
                }}
                data-testid="radio-group-procede"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="si" id="procede-si" data-testid="radio-procede-si" />
                  <Label htmlFor="procede-si" className="cursor-pointer">Sí</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="procede-no" data-testid="radio-procede-no" />
                  <Label htmlFor="procede-no" className="cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Select para área responsable (solo si procede=true) */}
            {validacionProcede === true && (
              <div className="space-y-2">
                <Label htmlFor="area-responsable">Área Responsable <span className="text-red-500">*</span></Label>
                <Select 
                  value={validacionAreaResponsable} 
                  onValueChange={setValidacionAreaResponsable}
                >
                  <SelectTrigger data-testid="select-area-responsable">
                    <SelectValue placeholder="Seleccione el área responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALIDACION_AREA_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value} data-testid={`option-area-${value}`}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Textarea para notas */}
            <div className="space-y-2">
              <Label htmlFor="validacion-notas">Notas <span className="text-red-500">*</span></Label>
              <Textarea
                id="validacion-notas"
                placeholder="Ingrese observaciones sobre la validación..."
                value={validacionNotas}
                onChange={(e) => setValidacionNotas(e.target.value)}
                rows={4}
                data-testid="textarea-validacion-notas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowValidacionTecnicaModal(false);
                setValidacionProcede(null);
                setValidacionAreaResponsable("");
                setValidacionNotas("");
                setSelectedReclamoId(null);
              }}
              data-testid="button-cancel-validacion"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (validacionProcede === null) {
                  toast({
                    title: "Error",
                    description: "Debe indicar si el reclamo procede o no",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (validacionProcede && !validacionAreaResponsable) {
                  toast({
                    title: "Error",
                    description: "Debe seleccionar el área responsable cuando el reclamo procede",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (!validacionNotas.trim()) {
                  toast({
                    title: "Error",
                    description: "Debe ingresar notas sobre la validación",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (selectedReclamoId) {
                  validarReclamoMutation.mutate({
                    reclamoId: selectedReclamoId,
                    procede: validacionProcede,
                    areaResponsable: validacionProcede ? validacionAreaResponsable : undefined,
                    notas: validacionNotas,
                  });
                }
              }}
              disabled={validarReclamoMutation.isPending}
              data-testid="button-submit-validacion"
            >
              {validarReclamoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Validar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portaled file inputs - rendered outside modal DOM to prevent Radix from detecting clicks */}
      <PortaledFilePicker
        inputRef={fileInputRef}
        onChange={handleFileSelect}
      />
      <PortaledFilePicker
        inputRef={resolucionFileInputRef}
        onChange={handleResolucionFileSelect}
      />
      <PortaledFilePicker
        inputRef={resolucionDocInputRef}
        onChange={handleResolucionDocSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />
      <PortaledFilePicker
        inputRef={cerrarFileInputRef}
        onChange={handleCerrarFileSelect}
      />
    </div>
  );
}
