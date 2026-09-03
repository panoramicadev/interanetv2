/**
 * Formulario de alta de un gasto.
 *
 * Vive acá y no dentro de una página porque se monta en dos lugares: la pestaña
 * "Añadir Gasto" del módulo (modo `panel`, sin salir de la vista y lista para
 * cargar un gasto atrás de otro) y la ruta /gastos-empresariales/nuevo (modo
 * `pagina`), que se mantiene para los enlaces directos que ya andan dando vuelta.
 *
 * El criterio de la pestaña es que el formulario esté **listo al abrirlo**: el
 * colaborador y la fecha vienen puestos, el financiamiento arranca en reembolso
 * y la categoría se elige de un toque, así el camino corto —foto, monto,
 * categoría, descripción— se completa sin tocar un solo selector.
 */
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  HandCoins,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOTON_MARCA,
  SUPERFICIE,
  formatoMoneda,
  iconoCategoria,
} from "@/components/gastos/ui";

const formSchema = z.object({
  userId: z.string().min(1, "Debe seleccionar un colaborador"),
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
  fundingMode: z.enum(["con_fondo", "reembolso"]).default("reembolso"),
  fundAllocationId: z.string().optional(),
  ruta: z.string().optional(),
  clientes: z.string().optional(),
  ciudad: z.string().optional(),
  centroCostos: z.string().optional(),
  proyecto: z.string().optional(),
});

/** Ítem de `gasto_catalogos` — alimenta los selectores del formulario. */
interface ItemCatalogo {
  id: string;
  tipo: "categoria" | "centro_costo" | "proyecto" | "tipo_documento";
  nombre: string;
  requiereRutProveedor: boolean;
}

interface FundAllocation {
  id: string;
  nombre: string;
  montoInicial: string | number;
  montoUsado?: string | number;
  saldoDisponible?: number;
}

type FormValues = z.infer<typeof formSchema>;

/** Nombres del tipo "JUAN PEREZ" a "Juan Perez". */
const formatName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const hoyISO = () => new Date().toISOString().split("T")[0];

/** Encabezado de bloque: número de paso + título. */
function Paso({
  n,
  titulo,
  bajada,
}: {
  n: number;
  titulo: string;
  bajada?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-bold text-[#fd6301] dark:bg-orange-950/40">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</h3>
        {bajada && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{bajada}</p>
        )}
      </div>
    </div>
  );
}

export interface FormularioGastoProps {
  /** `panel`: embebido en la pestaña. `pagina`: ruta propia con su header. */
  modo?: "panel" | "pagina";
  /** Se llama al guardar. En `pagina` navega de vuelta; en `panel` el padre decide. */
  onGuardado?: () => void;
  /** Acción del botón Cancelar. Si no viene, el botón no se muestra. */
  onCancelar?: () => void;
  /** Enlace a la lista de gastos, para el aviso posterior al guardado. */
  onVerGastos?: () => void;
}

export default function FormularioGasto({
  modo = "panel",
  onGuardado,
  onCancelar,
  onVerGastos,
}: FormularioGastoProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Aviso de "quedó guardado" que se muestra sobre el formulario ya reseteado. */
  const [ultimoGuardado, setUltimoGuardado] = useState<{ monto: string; categoria: string } | null>(null);

  // Determinar si el usuario puede registrar gastos a nombre de otros
  const canSelectOthers =
    user?.role === "admin" ||
    user?.role === "supervisor" ||
    user?.role === "encargado_area" ||
    user?.role === "recursos_humanos";

  const { data: salespeople = [], isLoading: isLoadingSalespeople } = useQuery<any[]>({
    queryKey: ["/api/users/salespeople"],
  });

  // Catálogos administrables (categorías, centros de costo, proyectos, tipos de documento).
  const { data: catalogos = [] } = useQuery<ItemCatalogo[]>({
    queryKey: ["/api/gasto-catalogos"],
  });
  const porTipo = (tipo: ItemCatalogo["tipo"]) => catalogos.filter((c) => c.tipo === tipo);
  const categorias = porTipo("categoria");
  const centrosCosto = porTipo("centro_costo");
  const proyectos = porTipo("proyecto");
  const tiposDocumento = porTipo("tipo_documento");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // El colaborador arranca en uno mismo incluso pudiendo elegir a otro: es
      // el caso frecuente y deja el formulario listo para escribir el monto.
      userId: user?.id ?? "",
      archivoUrl: "",
      comprobantePreviewUrl: "",
      monto: "",
      descripcion: "",
      categoria: "",
      tipoDocumento: "",
      proveedor: "",
      rutProveedor: "",
      numeroDocumento: "",
      fechaEmision: hoyISO(),
      fundingMode: "reembolso",
      fundAllocationId: "",
      ruta: "",
      clientes: "",
      ciudad: "",
      centroCostos: "",
      proyecto: "",
    },
  });

  const selectedUserId = form.watch("userId");
  const fundingMode = form.watch("fundingMode");
  const montoActual = form.watch("monto");
  const categoriaActual = form.watch("categoria");

  const { data: userFunds = [] } = useQuery<FundAllocation[]>({
    queryKey: ["/api/fund-allocations/user", selectedUserId, user?.role],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const isAdmin = user?.role === "admin";
      const response = await fetch(
        `/api/fund-allocations/user/${selectedUserId}${isAdmin ? "?all=true" : ""}`,
        { credentials: "include" },
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  const { data: userExpenses = [] } = useQuery<any[]>({
    queryKey: ["/api/gastos-empresariales", "user", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const response = await fetch(`/api/gastos-empresariales?userId=${selectedUserId}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedUserId,
  });

  const getFundUsage = (fundId: string) => {
    const fundGastos = userExpenses.filter(
      (g: any) => g.fundAllocationId === fundId && g.estado !== "rechazado",
    );
    return fundGastos.reduce((sum: number, g: any) => sum + parseFloat(g.monto || "0"), 0);
  };

  // Si no puede elegir a otros, el userId queda fijado al propio (y se re-fija
  // cuando el usuario termina de cargar).
  useEffect(() => {
    if (user?.id && !form.getValues("userId")) {
      form.setValue("userId", user.id);
    }
  }, [user?.id, form]);

  // El preview local es un object URL: hay que soltarlo para no filtrar memoria.
  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal);
    };
  }, [previewLocal]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("/api/gastos-empresariales", {
        method: "POST",
        data: {
          ...data,
          monto: parseFloat(data.monto),
          tipoGasto: "Reembolso",
        },
      });
    },
    onSuccess: (_res, variables) => {
      setShowConfirmDialog(false);
      setPendingFormData(null);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales/analytics/usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales/analytics/por-usuario"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales/analytics/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales/analytics/por-categoria"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gastos-empresariales/analytics/por-dia"] });
      toast({
        title: "Gasto registrado",
        description: "Quedó cargado y listo para sumarlo a un informe.",
      });
      if (modo === "panel") {
        // En la pestaña no se navega: se limpia y queda lista para el siguiente.
        setUltimoGuardado({ monto: variables.monto, categoria: variables.categoria });
        limpiarFormulario();
      }
      onGuardado?.();
    },
    onError: (error: any) => {
      setSubmitError(error.message || "No se pudo crear el gasto");
    },
  });

  const limpiarFormulario = () => {
    form.reset({
      ...form.getValues(),
      archivoUrl: "",
      comprobantePreviewUrl: "",
      monto: "",
      descripcion: "",
      categoria: "",
      tipoDocumento: "",
      proveedor: "",
      rutProveedor: "",
      numeroDocumento: "",
      fechaEmision: hoyISO(),
      fundAllocationId: form.getValues("fundingMode") === "con_fondo" ? form.getValues("fundAllocationId") : "",
    });
    if (previewLocal) URL.revokeObjectURL(previewLocal);
    setPreviewLocal(null);
    setUploadedFile(null);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/gastos-empresariales/upload-evidencia", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        // El servidor explica el motivo (perfil sin permiso, archivo muy pesado, etc.):
        // se muestra tal cual en vez de un "no se pudo" que no dice nada.
        const detalle = await response.json().catch(() => null);
        throw new Error(detalle?.message || "No se pudo subir el archivo de evidencia");
      }

      const data = await response.json();
      form.setValue("archivoUrl", data.url);
      if (data.previewUrl) {
        form.setValue("comprobantePreviewUrl", data.previewUrl);
      }
      setUploadedFile(file);
      if (file.type.startsWith("image/")) {
        if (previewLocal) URL.revokeObjectURL(previewLocal);
        setPreviewLocal(URL.createObjectURL(file));
      }
      setUltimoGuardado(null);

      // El OCR corre solo sobre imágenes; los PDF se cargan a mano.
      if (file.type.startsWith("image/")) {
        extractDataFromImage(file);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo subir el archivo de evidencia",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const extractDataFromImage = async (file: File) => {
    setIsExtractingOCR(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/gastos-empresariales/ocr-extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error en extracción OCR");
      }

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;

        if (data.monto) form.setValue("monto", String(data.monto));
        if (data.descripcion) form.setValue("descripcion", data.descripcion);
        if (data.numeroDocumento) form.setValue("numeroDocumento", data.numeroDocumento);
        if (data.rutProveedor) form.setValue("rutProveedor", data.rutProveedor);
        if (data.proveedor) form.setValue("proveedor", data.proveedor);
        if (data.fechaEmision) form.setValue("fechaEmision", data.fechaEmision);
        if (data.tipoDocumento) form.setValue("tipoDocumento", data.tipoDocumento);

        // El OCR autoevalúa su lectura; bajo 0.6 conviene avisar explícitamente
        // que hay que revisar campo por campo.
        const confianzaBaja = typeof data.confianza === "number" && data.confianza < 0.6;
        toast({
          title: confianzaBaja ? "Datos extraídos con baja confianza" : "Datos extraídos",
          description: confianzaBaja
            ? "El documento se leyó con dificultad. Revise monto, fecha y folio antes de guardar."
            : "Los datos del documento han sido detectados automáticamente. Por favor revíselos.",
        });
      } else {
        toast({
          title: "OCR no disponible",
          description:
            result.message || "No se pudieron extraer datos. Por favor ingrese los datos manualmente.",
        });
      }
    } catch (error) {
      console.error("OCR extraction error:", error);
      toast({
        title: "OCR no disponible",
        description: "No se pudo procesar la imagen. Por favor ingrese los datos manualmente.",
      });
    } finally {
      setIsExtractingOCR(false);
    }
  };

  const handleFileRemove = () => {
    if (previewLocal) URL.revokeObjectURL(previewLocal);
    setPreviewLocal(null);
    setUploadedFile(null);
    form.setValue("archivoUrl", "");
    form.setValue("comprobantePreviewUrl", "");
  };

  const onSubmit = (data: FormValues) => {
    if (data.fundingMode === "reembolso" && !data.archivoUrl) {
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
      monto: "Monto",
      descripcion: "Descripción",
      categoria: "Categoría",
      userId: "Colaborador",
      fundAllocationId: "Fondo",
    };
    const missing = Object.keys(errors)
      .map((k) => fieldNames[k] || k)
      .join(", ");
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

  /** Saldo del fondo elegido, antes y después de este gasto. */
  const getSelectedFundInfo = () => {
    if (!pendingFormData) return null;
    if (pendingFormData.fundingMode === "reembolso") return null;
    const fund = userFunds.find((f) => f.id === pendingFormData.fundAllocationId);
    if (!fund) return null;
    const montoInicial =
      typeof fund.montoInicial === "string" ? parseFloat(fund.montoInicial) : fund.montoInicial;
    const montoUsado = getFundUsage(fund.id);
    const saldoActual = montoInicial - montoUsado;
    const nuevoSaldo = saldoActual - parseFloat(pendingFormData.monto || "0");
    return { fund, saldoActual, nuevoSaldo };
  };

  const IconoCategoriaActual = iconoCategoria(categoriaActual);
  const montoNumerico = parseFloat(montoActual || "0");
  const inputFileRef = useRef<HTMLInputElement>(null);

  const claseCampo =
    "h-11 rounded-xl border-slate-200 bg-slate-50/60 transition-all focus-visible:border-[#fd6301] focus-visible:ring-2 focus-visible:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800/50";

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onFormError)}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start"
        >
          {/* ── Columna principal ─────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">
            {ultimoGuardado && (
              <div
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                data-testid="banner-gasto-guardado"
              >
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="min-w-0 flex-1 text-sm text-emerald-900 dark:text-emerald-200">
                  Guardaste{" "}
                  <strong className="tabular-nums">{formatoMoneda(ultimoGuardado.monto)}</strong> en{" "}
                  {ultimoGuardado.categoria}. El formulario quedó limpio para el siguiente.
                </p>
                {onVerGastos && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200"
                    onClick={onVerGastos}
                    data-testid="button-ver-gastos"
                  >
                    Ver mis gastos
                  </Button>
                )}
              </div>
            )}

            {/* Comprobante */}
            <section className={cn(SUPERFICIE, "space-y-3 p-4 md:p-5")}>
              <Paso
                n={1}
                titulo="Comprobante"
                bajada="Sube la boleta o factura: si es una foto, leemos monto, fecha y folio por ti."
              />

              {!uploadedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrando(true);
                  }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setArrastrando(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className={cn(
                    "rounded-2xl border-2 border-dashed transition-all",
                    arrastrando
                      ? "border-[#fd6301] bg-orange-50/70 dark:bg-orange-950/20"
                      : "border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 dark:border-slate-700 dark:hover:bg-slate-800/40",
                  )}
                >
                  <label
                    htmlFor="file-upload"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8"
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-950/40">
                      {isUploading ? (
                        <Loader2 className="size-5 animate-spin text-[#fd6301]" />
                      ) : (
                        <Camera className="size-5 text-[#fd6301]" strokeWidth={1.8} />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {isUploading ? "Subiendo archivo..." : "Toca para subir o arrastra el archivo"}
                    </span>
                    <span className="text-xs text-slate-400">JPG, PNG o PDF hasta 10 MB</span>
                    <input
                      id="file-upload"
                      ref={inputFileRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      disabled={isUploading}
                      data-testid="input-file-evidencia"
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  {previewLocal ? (
                    <img
                      src={previewLocal}
                      alt="Comprobante"
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-900">
                      <FileText className="size-6 text-emerald-600" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(uploadedFile.size / 1024).toFixed(1)} KB · adjuntado
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFileRemove}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-800 dark:hover:bg-slate-800"
                    data-testid="button-remove-file"
                    aria-label="Quitar comprobante"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {isExtractingOCR && (
                <div className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 dark:border-sky-900/50 dark:bg-sky-950/20">
                  <Sparkles className="size-4 shrink-0 animate-pulse text-sky-600 dark:text-sky-400" />
                  <p className="text-xs text-sky-800 dark:text-sky-200">
                    Leyendo el documento para completar los campos...
                  </p>
                </div>
              )}
            </section>

            {/* Datos del gasto */}
            <section className={cn(SUPERFICIE, "space-y-4 p-4 md:p-5")}>
              <Paso n={2} titulo="Datos del gasto" bajada="Lo mínimo para dejarlo rendido." />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="monto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Monto *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                            $
                          </span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            autoFocus
                            {...field}
                            className={cn(claseCampo, "pl-8 text-lg font-bold tabular-nums")}
                            data-testid="input-monto"
                          />
                        </div>
                      </FormControl>
                      {montoNumerico > 0 && (
                        <p className="text-xs font-medium tabular-nums text-slate-500">
                          {formatoMoneda(montoNumerico)}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fechaEmision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Fecha del gasto
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className={claseCampo}
                          data-testid="input-fecha-emision"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Categoría en chips: un toque en vez de abrir un selector. */}
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Categoría *
                    </FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2" data-testid="select-categoria-form">
                        {(categorias.length === 0
                          ? [{ id: "otros", nombre: "Otros" }]
                          : categorias
                        ).map((c) => {
                          const Icono = iconoCategoria(c.nombre);
                          const activa = field.value === c.nombre;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => field.onChange(c.nombre)}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                                activa
                                  ? "border-[#fd6301] bg-[#fd6301] text-white shadow-sm shadow-orange-500/25"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                              )}
                              data-testid={`chip-categoria-${c.nombre}`}
                            >
                              <Icono className="size-4" strokeWidth={1.8} />
                              {c.nombre}
                            </button>
                          );
                        })}
                      </div>
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
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Descripción *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: Carga de combustible camino a obra Los Andes"
                        {...field}
                        rows={2}
                        className="rounded-xl border-slate-200 bg-slate-50/60 transition-all focus-visible:border-[#fd6301] focus-visible:ring-2 focus-visible:ring-orange-500/20 dark:border-slate-700 dark:bg-slate-800/50"
                        data-testid="textarea-descripcion"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Imputación contable — sale de los catálogos administrables.
                  Ambos campos son opcionales: si el catálogo está vacío el
                  selector no se muestra. */}
              {(centrosCosto.length > 0 || proyectos.length > 0) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {centrosCosto.length > 0 && (
                    <FormField
                      control={form.control}
                      name="centroCostos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Centro de costos
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={claseCampo} data-testid="select-centro-costos">
                                <SelectValue placeholder="Opcional" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {centrosCosto.map((c) => (
                                <SelectItem key={c.id} value={c.nombre}>
                                  {c.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {proyectos.length > 0 && (
                    <FormField
                      control={form.control}
                      name="proyecto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Proyecto
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={claseCampo} data-testid="select-proyecto">
                                <SelectValue placeholder="Opcional" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {proyectos.map((p) => (
                                <SelectItem key={p.id} value={p.nombre}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
            </section>

            {/* Documento tributario */}
            <section className={cn(SUPERFICIE, "space-y-4 p-4 md:p-5")}>
              <Paso
                n={3}
                titulo="Documento tributario"
                bajada="Opcional, pero si el OCR lo leyó ya viene completo."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tipoDocumento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tipo de documento
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={claseCampo} data-testid="select-tipo-documento">
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tiposDocumento.length === 0 ? (
                            <SelectItem value="Otro">Otro</SelectItem>
                          ) : (
                            tiposDocumento.map((t) => (
                              <SelectItem key={t.id} value={t.nombre}>
                                {t.nombre}
                              </SelectItem>
                            ))
                          )}
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
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        N° de documento
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: 123456"
                          {...field}
                          className={claseCampo}
                          data-testid="input-numero-documento"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="proveedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Proveedor
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre del proveedor"
                          {...field}
                          className={claseCampo}
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
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        RUT proveedor
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: 12.345.678-9"
                          {...field}
                          className={claseCampo}
                          data-testid="input-rut-proveedor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
          </div>

          {/* ── Columna de resumen (pegajosa en escritorio) ────────────────── */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className={cn(SUPERFICIE, "space-y-4 p-4 md:p-5")}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-950/40">
                  <IconoCategoriaActual className="size-5 text-[#fd6301]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total a rendir
                  </p>
                  <p
                    className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100"
                    data-testid="text-resumen-monto"
                  >
                    {formatoMoneda(montoNumerico)}
                  </p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Colaborador *
                    </FormLabel>
                    {!canSelectOthers ? (
                      <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                        {formatName(user?.salespersonName || user?.email || user?.username || "Usuario")}
                      </div>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={claseCampo} data-testid="select-vendedor-gasto">
                            <SelectValue placeholder="Seleccionar colaborador" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSalespeople ? (
                            <SelectItem value="loading" disabled>
                              Cargando...
                            </SelectItem>
                          ) : (
                            salespeople.map((salesperson: any) => (
                              <SelectItem key={salesperson.id} value={salesperson.id}>
                                {formatName(
                                  salesperson.salespersonName ||
                                    salesperson.email ||
                                    salesperson.username,
                                )}
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

              {/* Financiamiento como control segmentado: son dos opciones y una
                  de ellas suele estar deshabilitada por falta de fondos. */}
              <FormField
                control={form.control}
                name="fundingMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Financiamiento *
                    </FormLabel>
                    <FormControl>
                      <div
                        className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200/60 bg-slate-100/70 p-1 dark:border-slate-700/60 dark:bg-slate-800/60"
                        data-testid="select-funding-mode"
                      >
                        <button
                          type="button"
                          onClick={() => field.onChange("reembolso")}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all",
                            field.value === "reembolso"
                              ? "bg-white text-[#fd6301] shadow-sm dark:bg-slate-700 dark:text-orange-400"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
                          )}
                          data-testid="button-modo-reembolso"
                        >
                          <CreditCard className="size-4" />
                          Reembolso
                        </button>
                        <button
                          type="button"
                          disabled={userFunds.length === 0}
                          onClick={() => field.onChange("con_fondo")}
                          className={cn(
                            "inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
                            field.value === "con_fondo"
                              ? "bg-white text-[#fd6301] shadow-sm dark:bg-slate-700 dark:text-orange-400"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
                          )}
                          title={userFunds.length === 0 ? "No tienes fondos asignados" : undefined}
                          data-testid="button-modo-fondo"
                        >
                          <HandCoins className="size-4" />
                          Con fondo
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {fundingMode === "con_fondo" && userFunds.length > 0 && (
                <FormField
                  control={form.control}
                  name="fundAllocationId"
                  render={({ field }) => {
                    const fondo = userFunds.find((f) => f.id === field.value);
                    const saldoActual = fondo
                      ? fondo.saldoDisponible != null
                        ? parseFloat(String(fondo.saldoDisponible))
                        : parseFloat(String(fondo.montoInicial || 0)) -
                          (fondo.montoUsado ? parseFloat(String(fondo.montoUsado)) : getFundUsage(fondo.id))
                      : 0;
                    const nuevoSaldo = saldoActual - montoNumerico;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Fondo *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={claseCampo} data-testid="select-fund-allocation">
                              <SelectValue placeholder="Seleccionar fondo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {userFunds.map((fund) => {
                              const montoInicial = parseFloat(String(fund.montoInicial || 0));
                              const montoUsado = fund.montoUsado
                                ? parseFloat(String(fund.montoUsado))
                                : getFundUsage(fund.id);
                              const saldoReal = montoInicial - montoUsado;
                              return (
                                <SelectItem
                                  key={fund.id}
                                  value={fund.id}
                                  disabled={saldoReal <= 0 && user?.role !== "admin"}
                                >
                                  {fund.nombre} — {formatoMoneda(saldoReal)}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {fondo && (
                          <div className="mt-2 space-y-1 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs dark:border-sky-900/50 dark:bg-sky-950/20">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sky-800 dark:text-sky-300">Saldo disponible</span>
                              <span className="font-semibold tabular-nums text-sky-900 dark:text-sky-200">
                                {formatoMoneda(saldoActual)}
                              </span>
                            </div>
                            {montoNumerico > 0 && (
                              <div className="flex items-center justify-between gap-2 border-t border-sky-200/70 pt-1 dark:border-sky-900/50">
                                <span className="text-sky-800 dark:text-sky-300">Después del gasto</span>
                                <span
                                  className={cn(
                                    "font-bold tabular-nums",
                                    nuevoSaldo < 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-emerald-700 dark:text-emerald-400",
                                  )}
                                >
                                  {formatoMoneda(nuevoSaldo)}
                                </span>
                              </div>
                            )}
                            {nuevoSaldo < 0 && (
                              <p className="text-red-600 dark:text-red-400">
                                Excede el saldo disponible
                                {user?.role === "admin" ? " (permitido para admin)" : ""}.
                              </p>
                            )}
                          </div>
                        )}
                      </FormItem>
                    );
                  }}
                />
              )}

              {fundingMode === "reembolso" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Se procesa como <strong>solicitud de reembolso</strong> y requiere el comprobante
                  adjunto más la aprobación de tu supervisor.
                </p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || isUploading}
                  className={cn(BOTON_MARCA, "h-11 w-full text-sm font-semibold")}
                  data-testid="button-submit-form"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      Guardar gasto
                    </>
                  )}
                </Button>
                {onCancelar && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancelar}
                    className="h-10 w-full rounded-2xl text-slate-500"
                    data-testid="button-cancel-form"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </section>
          </aside>
        </form>
      </Form>

      {/* Confirmación previa al guardado. */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <span className="grid size-9 place-items-center rounded-xl bg-orange-50 dark:bg-orange-950/40">
                <Receipt className="size-4 text-[#fd6301]" />
              </span>
              Confirmar gasto
            </DialogTitle>
            <DialogDescription className="pt-2">
              Revisa los datos antes de dejarlo cargado.
            </DialogDescription>
          </DialogHeader>

          {pendingFormData && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Monto</span>
                  <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatoMoneda(pendingFormData.monto)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Categoría</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {pendingFormData.categoria}
                  </span>
                </div>
                {pendingFormData.descripcion && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                      Descripción
                    </span>
                    <span className="text-right text-sm font-medium text-slate-700 dark:text-slate-200">
                      {pendingFormData.descripcion}
                    </span>
                  </div>
                )}
              </div>

              {pendingFormData.fundingMode === "con_fondo" && getSelectedFundInfo() ? (
                <div className="space-y-1 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
                  <p className="font-semibold text-sky-900 dark:text-sky-200">
                    Con cargo a {getSelectedFundInfo()?.fund.nombre}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-sky-800 dark:text-sky-300">
                    <span>Saldo actual</span>
                    <span className="font-medium tabular-nums">
                      {formatoMoneda(getSelectedFundInfo()?.saldoActual || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-sky-200/70 pt-1 dark:border-sky-900/50">
                    <span className="font-medium text-sky-800 dark:text-sky-300">
                      Saldo después del gasto
                    </span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        (getSelectedFundInfo()?.nuevoSaldo || 0) < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {formatoMoneda(getSelectedFundInfo()?.nuevoSaldo || 0)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  <strong>Solicitud de reembolso.</strong> Deberá ser aprobada por un supervisor antes
                  de pagarse.
                </p>
              )}
            </div>
          )}

          {submitError && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingFormData(null);
                setSubmitError(null);
              }}
            >
              {submitError ? "Cerrar" : "Volver a revisar"}
            </Button>
            {!submitError && (
              <Button
                onClick={confirmarGasto}
                disabled={createMutation.isPending}
                className={BOTON_MARCA}
                data-testid="button-confirmar-gasto"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 size-4" />
                    Sí, guardar gasto
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
