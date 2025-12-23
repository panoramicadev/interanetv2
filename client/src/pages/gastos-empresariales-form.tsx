import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, FileText, Loader2 } from "lucide-react";

const formSchema = z.object({
  userId: z.string().min(1, "Debe seleccionar un vendedor"),
  archivoUrl: z.string().optional(),
  monto: z.string().min(1, "El monto es requerido"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  centroCostos: z.string().optional(),
  categoria: z.string().min(1, "La categoría es requerida"),
  tipoGasto: z.string().min(1, "El tipo de gasto es requerido"),
  tipoDocumento: z.string().optional(),
  proveedor: z.string().optional(),
  rutProveedor: z.string().optional(),
  numeroDocumento: z.string().optional(),
  fechaEmision: z.string().optional(),
  fundingMode: z.enum(['con_fondo', 'reembolso']).default('reembolso'),
  fundAllocationId: z.string().optional(),
});

interface FundAllocation {
  id: string;
  nombre: string;
  saldoDisponible: number;
  montoInicial: number;
}

type FormValues = z.infer<typeof formSchema>;

// Función para formatear nombres: Inicial mayúscula, resto minúscula
const formatName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function GastosEmpresarialesForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);

  // Determinar si el usuario puede seleccionar otros colaboradores
  const canSelectOthers = user?.role === 'admin' || user?.role === 'supervisor' || user?.role === 'recursos_humanos';

  // Fetch salespeople
  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<any[]>({
    queryKey: ['/api/users/salespeople'],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
      archivoUrl: "",
      monto: "",
      descripcion: "",
      centroCostos: "",
      categoria: "",
      tipoGasto: "",
      tipoDocumento: "",
      proveedor: "",
      rutProveedor: "",
      numeroDocumento: "",
      fechaEmision: "",
      fundingMode: "reembolso",
      fundAllocationId: "",
    },
  });

  const selectedUserId = form.watch('userId');
  const fundingMode = form.watch('fundingMode');

  // Fetch user's active fund allocations
  const { data: userFunds = [] } = useQuery<FundAllocation[]>({
    queryKey: ['/api/fund-allocations/user', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const response = await fetch(`/api/fund-allocations/user/${selectedUserId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  // Establecer automáticamente el userId del usuario actual si no puede seleccionar otros
  useEffect(() => {
    if (user?.id && !canSelectOthers) {
      form.setValue('userId', user.id);
    }
  }, [user?.id, canSelectOthers, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest('/api/gastos-empresariales', {
        method: 'POST',
        data: {
          ...data,
          monto: parseFloat(data.monto),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      toast({
        title: "Gasto creado",
        description: "El gasto ha sido registrado correctamente",
      });
      setLocation('/gastos-empresariales');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el gasto",
        variant: "destructive",
      });
    }
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/gastos-empresariales/upload-evidencia', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al subir archivo');
      }

      const data = await response.json();
      form.setValue('archivoUrl', data.url);
      setUploadedFile(file);
      toast({
        title: "Archivo subido",
        description: "El archivo de evidencia ha sido cargado correctamente",
      });
      
      // Trigger OCR extraction for images
      if (file.type.startsWith('image/')) {
        extractDataFromImage(file);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo subir el archivo de evidencia",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const extractDataFromImage = async (file: File) => {
    setIsExtractingOCR(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/gastos-empresariales/ocr-extract', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error en extracción OCR');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        
        // Auto-fill form fields with extracted data
        if (data.monto) {
          form.setValue('monto', String(data.monto));
        }
        if (data.descripcion) {
          form.setValue('descripcion', data.descripcion);
        }
        if (data.numeroDocumento) {
          form.setValue('numeroDocumento', data.numeroDocumento);
        }
        if (data.rutProveedor) {
          form.setValue('rutProveedor', data.rutProveedor);
        }
        if (data.proveedor) {
          form.setValue('proveedor', data.proveedor);
        }
        if (data.fechaEmision) {
          form.setValue('fechaEmision', data.fechaEmision);
        }
        if (data.tipoDocumento) {
          form.setValue('tipoDocumento', data.tipoDocumento);
        }
        
        toast({
          title: "Datos extraídos",
          description: "Los datos del documento han sido detectados automáticamente. Por favor revíselos.",
        });
      } else {
        toast({
          title: "OCR no disponible",
          description: result.message || "No se pudieron extraer datos. Por favor ingrese los datos manualmente.",
        });
      }
    } catch (error) {
      console.error('OCR extraction error:', error);
      toast({
        title: "OCR no disponible",
        description: "No se pudo procesar la imagen. Por favor ingrese los datos manualmente.",
      });
    } finally {
      setIsExtractingOCR(false);
    }
  };

  const handleFileRemove = () => {
    setUploadedFile(null);
    form.setValue('archivoUrl', '');
  };

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/gastos-empresariales')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Nueva Rendición de Gastos</h1>
          <p className="text-sm text-gray-500 mt-1">Registra un nuevo gasto empresarial</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* File Upload - First Field */}
              <div className="space-y-4 pb-4 border-b">
                <h3 className="font-semibold text-lg">Evidencia del Gasto</h3>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Sube una foto o documento que respalde este gasto (boleta, factura, recibo, etc.)
                  </p>
                  
                  {!uploadedFile ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
                      <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center cursor-pointer"
                      >
                        <Upload className="h-12 w-12 text-gray-400 mb-3" />
                        <span className="text-sm font-medium text-gray-700">
                          Haz clic para subir archivo
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          PDF, JPG, PNG hasta 10MB
                        </span>
                        <input
                          id="file-upload"
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file);
                            }
                          }}
                          disabled={isUploading}
                          data-testid="input-file-evidencia"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <FileText className="h-8 w-8 text-green-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleFileRemove}
                        className="p-1 hover:bg-green-100 rounded-full transition-colors"
                        data-testid="button-remove-file"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>
                  )}
                  
                  {isUploading && (
                    <p className="text-sm text-gray-600 text-center">Subiendo archivo...</p>
                  )}
                  
                  {isExtractingOCR && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <p className="text-sm text-blue-700">Extrayendo datos del documento...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Información Básica</h3>
                
                {/* Colaborador Selector */}
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colaborador *</FormLabel>
                      {!canSelectOthers ? (
                        // Usuario regular: mostrar su nombre directamente
                        <div className="flex flex-col gap-1">
                          <div className="flex h-10 w-full items-center rounded-md border border-input bg-gray-100 px-3 py-2 text-sm">
                            {formatName(user?.salespersonName || user?.email || user?.username || 'Usuario')}
                          </div>
                          <p className="text-xs text-gray-500">Solo puedes registrar gastos a tu nombre</p>
                        </div>
                      ) : (
                        // Admin/Supervisor/Recursos Humanos: selector completo
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-vendedor-gasto">
                              <SelectValue placeholder="Seleccionar colaborador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingSalespeople ? (
                              <SelectItem value="loading" disabled>Cargando...</SelectItem>
                            ) : (
                              salespeople.map((salesperson: any) => (
                                <SelectItem key={salesperson.id} value={salesperson.id}>
                                  {formatName(salesperson.salespersonName || salesperson.email || salesperson.username)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ej: 50000"
                            {...field}
                            data-testid="input-monto"
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
                        <FormLabel>Categoría *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-categoria-form">
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Combustibles">Combustibles</SelectItem>
                            <SelectItem value="Colación">Colación</SelectItem>
                            <SelectItem value="Gestión Ventas">Gestión Ventas</SelectItem>
                            <SelectItem value="Otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el gasto..."
                          {...field}
                          rows={3}
                          data-testid="textarea-descripcion"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipoGasto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Gasto *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-gasto">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Fijo">Fijo</SelectItem>
                            <SelectItem value="Variable">Variable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="centroCostos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Centro de Costos</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-centro-costos">
                              <SelectValue placeholder="Seleccionar centro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Maipú">Maipú</SelectItem>
                            <SelectItem value="Concepción">Concepción</SelectItem>
                            <SelectItem value="Lautaro">Lautaro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Origen del Fondo */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Origen del Fondo</h3>
                <p className="text-sm text-gray-500 -mt-2">
                  Indica si este gasto se carga a un fondo asignado o es para reembolso
                </p>
                
                <FormField
                  control={form.control}
                  name="fundingMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Financiamiento *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-funding-mode">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="reembolso">
                            💳 Solicitar Reembolso (sin fondo asignado)
                          </SelectItem>
                          <SelectItem value="con_fondo" disabled={userFunds.length === 0}>
                            💰 Usar Fondo Asignado {userFunds.length === 0 ? '(No hay fondos disponibles)' : ''}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {fundingMode === 'con_fondo' && userFunds.length > 0 && (
                  <FormField
                    control={form.control}
                    name="fundAllocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seleccionar Fondo *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-fund-allocation">
                              <SelectValue placeholder="Seleccionar fondo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {userFunds.map((fund) => (
                              <SelectItem key={fund.id} value={fund.id}>
                                {fund.nombre} - Disponible: ${fund.saldoDisponible.toLocaleString('es-CL')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {field.value && (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              {(() => {
                                const selectedFund = userFunds.find(f => f.id === field.value);
                                if (!selectedFund) return null;
                                const montoGasto = parseFloat(form.getValues('monto') || '0');
                                const nuevoSaldo = selectedFund.saldoDisponible - montoGasto;
                                return (
                                  <>
                                    <strong>Saldo disponible:</strong> ${selectedFund.saldoDisponible.toLocaleString('es-CL')}<br/>
                                    {montoGasto > 0 && (
                                      <>
                                        <strong>Saldo después del gasto:</strong> ${Math.max(0, nuevoSaldo).toLocaleString('es-CL')}
                                        {nuevoSaldo < 0 && (
                                          <span className="text-red-600 ml-2">(Excede el saldo disponible)</span>
                                        )}
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </p>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                )}

                {fundingMode === 'reembolso' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      Este gasto será procesado como solicitud de reembolso. Deberá ser aprobado por un supervisor.
                    </p>
                  </div>
                )}
              </div>

              {/* Document Info */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Información del Documento</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipoDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Documento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-documento">
                              <SelectValue placeholder="Seleccionar tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Boleta">Boleta</SelectItem>
                            <SelectItem value="Factura">Factura</SelectItem>
                            <SelectItem value="Recibo">Recibo</SelectItem>
                            <SelectItem value="Otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numeroDocumento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Documento</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: 123456"
                            {...field}
                            data-testid="input-numero-documento"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="proveedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nombre del proveedor"
                            {...field}
                            data-testid="input-proveedor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rutProveedor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUT Proveedor</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: 12.345.678-9"
                            {...field}
                            data-testid="input-rut-proveedor"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fechaEmision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Emisión</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-fecha-emision"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/gastos-empresariales')}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-form"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-submit-form"
                >
                  {createMutation.isPending ? 'Guardando...' : 'Guardar Gasto'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
  );
}
