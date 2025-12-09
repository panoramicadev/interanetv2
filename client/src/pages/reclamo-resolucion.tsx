import { useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Camera, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import imageCompression from "browser-image-compression";

const CATEGORIA_RESPONSABLE_OPTIONS = [
  { value: 'produccion', label: 'Producción' },
  { value: 'logistica', label: 'Logística / Bodega' },
  { value: 'comercial', label: 'Comercial / Vendedor' },
  { value: 'calidad', label: 'Calidad / Laboratorio' },
  { value: 'despacho', label: 'Despacho' },
  { value: 'cliente', label: 'Responsabilidad del Cliente' },
  { value: 'proveedor', label: 'Responsabilidad del Proveedor' },
  { value: 'otro', label: 'Otro' },
];

const organizationalRoles = ['produccion', 'logistica_bodega', 'planificacion', 'bodega_materias_primas', 'prevencion_riesgos'];

async function compressImage(file: File): Promise<string> {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  };
  const compressedFile = await imageCompression(file, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressedFile);
  });
}

export default function ReclamoResolucionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reclamos/resolucion/:id");
  const reclamoId = params?.id;

  const [informeLaboratorio, setInformeLaboratorio] = useState("");
  const [categoriaResponsable, setCategoriaResponsable] = useState("");
  const [resolucionPhotos, setResolucionPhotos] = useState<File[]>([]);
  const [resolucionPreviewUrls, setResolucionPreviewUrls] = useState<string[]>([]);
  const [resolucionDocuments, setResolucionDocuments] = useState<File[]>([]);
  const [resolucionUploadProgress, setResolucionUploadProgress] = useState({ current: 0, total: 0 });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const { data: reclamoDetails, isLoading: reclamoLoading } = useQuery<any>({
    queryKey: ['/api/reclamos-generales', reclamoId, 'details'],
    queryFn: async () => {
      const response = await fetch(`/api/reclamos-generales/${reclamoId}/details`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error al obtener detalles del reclamo');
      return response.json();
    },
    enabled: !!reclamoId,
  });

  const isAreaRole = user?.role?.startsWith('area_') || 
                     (user?.role && organizationalRoles.includes(user.role)) ||
                     user?.role === 'jefe_planta';

  const resolucionLaboratorioMutation = useMutation({
    mutationFn: async ({ reclamoId, informe, categoriaResponsable, photos, documents }: { 
      reclamoId: string; 
      informe: string; 
      categoriaResponsable: string; 
      photos: Array<{ photoUrl: string; description: string }>;
      documents: Array<{ fileName: string; fileData: string; mimeType: string }>;
    }) => {
      setResolucionUploadProgress({ current: 0, total: photos.length });
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/resolucion-laboratorio`, {
        method: 'POST',
        data: { informe, categoriaResponsable, photos, documents },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Resolución enviada",
        description: "La resolución del laboratorio ha sido registrada con éxito.",
      });
      setLocation('/reclamos-generales');
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

  const resolucionAreaMutation = useMutation({
    mutationFn: async ({ reclamoId, resolucionDescripcion, photos, documents }: { 
      reclamoId: string; 
      resolucionDescripcion: string; 
      photos: Array<{ photoUrl: string; description: string }>;
      documents: Array<{ fileName: string; fileData: string; mimeType: string }>;
    }) => {
      setResolucionUploadProgress({ current: 0, total: photos.length });
      const response = await apiRequest(`/api/reclamos-generales/${reclamoId}/resolucion-area`, {
        method: 'POST',
        data: { resolucionDescripcion, photos, documents },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reclamos-generales'] });
      toast({
        title: "Resolución enviada",
        description: "La resolución del área responsable ha sido registrada con éxito.",
      });
      setLocation('/reclamos-generales');
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    if (newFiles.length > 0) {
      setResolucionPhotos(prev => [...prev, ...newFiles]);
      setResolucionPreviewUrls(prev => [...prev, ...newPreviews]);
    }
    
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setResolucionPhotos(prev => prev.filter((_, i) => i !== index));
    setResolucionPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const validFiles = files.filter(file => validTypes.includes(file.type));
    
    if (validFiles.length !== files.length) {
      toast({
        title: "Advertencia",
        description: "Solo se aceptan archivos PDF, Word o Excel",
        variant: "destructive",
      });
    }

    const maxSize = 10 * 1024 * 1024;
    const sizedFiles = validFiles.filter(file => file.size <= maxSize);
    
    if (sizedFiles.length !== validFiles.length) {
      toast({
        title: "Advertencia",
        description: "Algunos archivos exceden el tamaño máximo de 10MB",
        variant: "destructive",
      });
    }
    
    if (sizedFiles.length > 0) {
      setResolucionDocuments(prev => [...prev, ...sizedFiles]);
    }
    
    if (docInputRef.current) {
      docInputRef.current.value = '';
    }
  };

  const removeDoc = (index: number) => {
    setResolucionDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!informeLaboratorio.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar el informe de resolución",
        variant: "destructive",
      });
      return;
    }

    if (user?.role === 'laboratorio' && !categoriaResponsable) {
      toast({
        title: "Error",
        description: "Debe seleccionar el área responsable",
        variant: "destructive",
      });
      return;
    }
    
    if (!reclamoId) return;

    const photos = resolucionPreviewUrls.map(photoUrl => ({
      photoUrl,
      description: isAreaRole ? "Evidencia de resolución del área responsable" : "Evidencia de resolución del laboratorio"
    }));

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
      resolucionAreaMutation.mutate({
        reclamoId,
        resolucionDescripcion: informeLaboratorio,
        photos,
        documents
      });
    } else {
      resolucionLaboratorioMutation.mutate({
        reclamoId,
        informe: informeLaboratorio,
        categoriaResponsable,
        photos,
        documents
      });
    }
  };

  const isPending = resolucionLaboratorioMutation.isPending || resolucionAreaMutation.isPending;

  if (reclamoLoading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!reclamoDetails) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Reclamo no encontrado</p>
            <Button 
              variant="outline" 
              className="mt-4 mx-auto block"
              onClick={() => setLocation('/reclamos-generales')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Reclamos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => setLocation('/reclamos-generales')}
        className="mb-4"
        data-testid="button-back"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver a Reclamos
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'laboratorio' ? 'Resolución del Laboratorio' : 'Resolución del Área Responsable'}
          </CardTitle>
          <CardDescription>
            Reclamo: {reclamoDetails.clientName} - {reclamoDetails.descripcionProblema?.substring(0, 50)}...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p><strong>Cliente:</strong> {reclamoDetails.clientName}</p>
            <p><strong>Producto:</strong> {reclamoDetails.productoCausante}</p>
            <p><strong>Fecha:</strong> {reclamoDetails.createdAt && format(new Date(reclamoDetails.createdAt), "dd MMMM yyyy", { locale: es })}</p>
          </div>

          <div>
            <Label htmlFor="informe">Informe de Resolución <span className="text-red-500">*</span></Label>
            <Textarea
              id="informe"
              placeholder="Describa el análisis realizado, hallazgos y conclusiones..."
              value={informeLaboratorio}
              onChange={(e) => setInformeLaboratorio(e.target.value)}
              rows={8}
              className="mt-2"
              data-testid="textarea-informe"
            />
          </div>

          {user?.role === 'laboratorio' && (
            <div>
              <Label htmlFor="categoria">Área Responsable <span className="text-red-500">*</span></Label>
              <p className="text-sm text-muted-foreground mb-2">
                Seleccione el área responsable del reclamo según el análisis realizado
              </p>
              <Select 
                value={categoriaResponsable} 
                onValueChange={setCategoriaResponsable}
              >
                <SelectTrigger data-testid="select-categoria" className="mt-2">
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

          <div>
            <Label>Evidencia Fotográfica (Opcional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Puede adjuntar fotos de evidencia de la resolución
            </p>
            
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
              data-testid="input-photos"
            />
            
            <Button
              type="button"
              variant="outline"
              onClick={() => photoInputRef.current?.click()}
              className="w-full mb-4"
              data-testid="button-add-photos"
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
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={() => removePhoto(index)}
                      data-testid={`button-remove-photo-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Documentos Adjuntos (Opcional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Puede adjuntar documentos PDF, Word o Excel como respaldo
            </p>
            
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              onChange={handleDocSelect}
              className="hidden"
              data-testid="input-docs"
            />
            
            <Button
              type="button"
              variant="outline"
              onClick={() => docInputRef.current?.click()}
              className="w-full mb-4"
              data-testid="button-add-docs"
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
                      onClick={() => removeDoc(index)}
                      data-testid={`button-remove-doc-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {resolucionUploadProgress.total > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Subiendo foto {resolucionUploadProgress.current} de {resolucionUploadProgress.total}...
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setLocation('/reclamos-generales')}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {resolucionUploadProgress.total > 0 ? (
                `Subiendo foto ${resolucionUploadProgress.current}/${resolucionUploadProgress.total}...`
              ) : isPending ? (
                'Enviando resolución...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Enviar Resolución
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
