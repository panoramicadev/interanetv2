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
import { ArrowLeft, Upload, X, XCircle, FileText, Loader2, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formSchema = z.object({
  userId: z.string().min(1, "Debe seleccionar un vendedor"),
  archivoUrl: z.string().optional(),
  comprobantePreviewUrl: z.string().optional().nullable(),
  monto: z.string().min(1, "El monto es requerido"),
  descripcion: z.string().min(1, "La descripción es requerida"),
  categoria: z.string().min(1, "La categoría es requerida"),
  tipoDocumento: z.string().optional(),
  proveedor: z.string().optional(),
  rutProveedor: z.string().optional(),
  numeroDocumento: z.string().optional(),
  fechaEmision: z.string().optional(),
  fundingMode: z.enum(['con_fondo', 'reembolso']).default('reembolso'),
  fundAllocationId: z.string().optional(),
  ruta: z.string().optional(),
  clientes: z.string().optional(),
  ciudad: z.string().optional(),
});

interface FundAllocation {
  id: string;
  nombre: string;
  montoInicial: string | number;
  montoUsado?: string | number;
  saldoDisponible?: number;
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      comprobantePreviewUrl: "",
      monto: "",
      descripcion: "",
      categoria: "",
      tipoDocumento: "",
      proveedor: "",
      rutProveedor: "",
      numeroDocumento: "",
      fechaEmision: "",
      fundingMode: "reembolso",
      fundAllocationId: "",
      ruta: "",
      clientes: "",
      ciudad: "",

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

  // Fetch user's expenses to calculate fund usage
  const { data: userExpenses = [] } = useQuery<any[]>({
    queryKey: ['/api/gastos-empresariales', 'user', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const response = await fetch(`/api/gastos-empresariales?userId=${selectedUserId}`, {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  const getFundUsage = (fundId: string) => {
    const fundGastos = userExpenses.filter((g: any) => g.fundAllocationId === fundId && g.estado !== 'rechazado');
    const totalUsado = fundGastos.reduce((sum: number, g: any) => sum + parseFloat(g.monto || '0'), 0);
    return totalUsado;
  };

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
          tipoGasto: "Reembolso",
        },
      });
    },
    onSuccess: () => {
      setShowConfirmDialog(false);
      setPendingFormData(null);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-usuario'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gastos-empresariales/analytics/por-categoria'] });
      toast({
        title: "Gasto creado",
        description: "El gasto ha sido registrado correctamente",
      });
      setLocation('/gastos-empresariales');
    },
    onError: (error: any) => {
      setSubmitError(error.message || "No se pudo crear el gasto");
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
      if (data.previewUrl) {
        form.setValue('comprobantePreviewUrl', data.previewUrl);
      }
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
    form.setValue('comprobantePreviewUrl', '');
  };

  const onSubmit = (data: FormValues) => {
    if (data.fundingMode === 'reembolso' && !data.archivoUrl) {
      toast({
        title: "Foto requerida",
        description: "Debe adjuntar una foto del comprobante para solicitar un reembolso",
        variant: "destructive",
      });
      return;
    }
    setPendingFormData(data);
    setSubmitError(null);
    setShowConfirmDialog(true);
  };

  const onFormError = (errors: any) => {
    const fieldNames: Record<string, string> = {
      monto: 'Monto',
      descripcion: 'Descripción',
      categoria: 'Categoría',
      userId: 'Vendedor',
      fundAllocationId: 'Fondo',
    };
    const missing = Object.keys(errors).map(k => fieldNames[k] || k).join(', ');
    toast({
      title: "Campos incompletos",
      description: `Por favor complete: ${missing}`,
      variant: "destructive",
    });
  };

  const confirmarGasto = () => {
    if (!pendingFormData) return;
    setSubmitError(null);
    createMutation.mutate(pendingFormData);
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Obtener información del fondo seleccionado
  const getSelectedFundInfo = () => {
    if (!pendingFormData) return null;
    if (pendingFormData.fundingMode === 'reembolso') return null;
    const fund = userFunds.find(f => f.id === pendingFormData.fundAllocationId);
    if (!fund) return null;
    const montoInicial = typeof fund.montoInicial === 'string' ? parseFloat(fund.montoInicial) : fund.montoInicial;
    const montoUsado = getFundUsage(fund.id);
    const saldoActual = montoInicial - montoUsado;
    const nuevoSaldo = saldoActual - parseFloat(pendingFormData.monto || '0');
    return { fund, saldoActual, nuevoSaldo };
  };

  return (
    <>
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
            <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-6">
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

              {/* Origen del Fondo - FIRST after evidence */}
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
                            {userFunds.map((fund) => {
                              const montoInicial = parseFloat(String(fund.montoInicial || 0));
                              const montoUsado = fund.montoUsado ? parseFloat(String(fund.montoUsado)) : getFundUsage(fund.id);
                              const saldoReal = montoInicial - montoUsado;
                              return (
                                <SelectItem key={fund.id} value={fund.id} disabled={saldoReal <= 0}>
                                  {fund.nombre} - Disponible: ${saldoReal.toLocaleString('es-CL')}
                                </SelectItem>
                              );
                            })}
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
                                const saldoActual = selectedFund.saldoDisponible != null
                                  ? parseFloat(String(selectedFund.saldoDisponible))
                                  : parseFloat(String(selectedFund.montoInicial || 0)) - (selectedFund.montoUsado ? parseFloat(String(selectedFund.montoUsado)) : getFundUsage(selectedFund.id));
                                const nuevoSaldo = saldoActual - montoGasto;
                                return (
                                  <>
                                    <strong>Saldo disponible:</strong> ${saldoActual.toLocaleString('es-CL')}<br/>
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

              {/* Información Básica */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg">Información Básica</h3>
                
                {/* Colaborador Selector */}
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colaborador *</FormLabel>
                      {!canSelectOthers ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex h-10 w-full items-center rounded-md border border-input bg-gray-100 px-3 py-2 text-sm">
                            {formatName(user?.salespersonName || user?.email || user?.username || 'Usuario')}
                          </div>
                          <p className="text-xs text-gray-500">Solo puedes registrar gastos a tu nombre</p>
                        </div>
                      ) : (
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

      {/* Diálogo de confirmación de gasto */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Receipt className="h-5 w-5" />
              Confirmar Gasto
            </DialogTitle>
            <DialogDescription className="pt-4 text-base">
              Estás a punto de añadir el siguiente gasto:
            </DialogDescription>
          </DialogHeader>
          
          {pendingFormData && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Monto:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(parseFloat(pendingFormData.monto || '0'))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Categoría:</span>
                  <span className="font-medium">{pendingFormData.categoria}</span>
                </div>
                {pendingFormData.descripcion && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Descripción:</span>
                    <span className="font-medium text-right max-w-[200px] truncate">
                      {pendingFormData.descripcion}
                    </span>
                  </div>
                )}
              </div>

              {pendingFormData.fundingMode === 'con_fondo' && getSelectedFundInfo() ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    Con cargo a tus fondos asignados:
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Fondo:</span>
                      <span className="font-medium">{getSelectedFundInfo()?.fund.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Saldo actual:</span>
                      <span className="font-medium">{formatCurrency(getSelectedFundInfo()?.saldoActual || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                      <span className="text-blue-700 font-medium">Saldo después del gasto:</span>
                      <span className={`font-bold ${(getSelectedFundInfo()?.nuevoSaldo || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(getSelectedFundInfo()?.nuevoSaldo || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    Solicitud de Reembolso
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Este gasto será procesado como solicitud de reembolso y deberá ser aprobado por un supervisor.
                  </p>
                </div>
              )}
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingFormData(null);
                setSubmitError(null);
              }}
            >
              {submitError ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!submitError && (
              <Button 
                onClick={confirmarGasto}
                disabled={createMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-confirmar-gasto"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Sí, Confirmar Gasto'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
