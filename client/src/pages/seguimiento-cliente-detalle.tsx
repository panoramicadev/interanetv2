/**
 * Detalle de un cliente del CRM "Seguimiento de Clientes".
 * Diseño modern SaaS: hero con avatar + stepper del pipeline, fila de datos
 * clave editables inline, layout de 2 columnas (información / timeline de
 * actividad) y pestañas para bitácora, documentos ERP y vinculación de RUT.
 *
 * Constantes y helpers vienen de @/lib/crm-seguimiento (fuente única del
 * pipeline). Las pestañas de documentos ERP vienen de
 * @/components/crm/pedidos-nvv-tabs. Este archivo NO debe importar nada
 * desde ./seguimiento-clientes.
 */
import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, Building2, User, Mail,
  MessageSquare, PhoneCall, FileText,
  MapPin, AlertTriangle, CheckCircle2, ShoppingCart,
  UserCheck, Send, Link2, Sparkles, Trash2, Edit3, RefreshCw,
  ArrowLeft, Calendar, Clock, CreditCard, Save, X, Tags,
  Star, Search, Plus, CalendarClock, CalendarDays, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  ESTADOS,
  normalizeEstado,
  getEstadoConfig,
  PRIORIDADES,
  HITO_TIPOS,
  getHitoConfig,
  SEGMENTOS_CRM,
  REGIONES_CHILE,
  CONDICIONES_PAGO,
  timeAgo,
  formatDate,
  isOverdue,
  formatCLP,
  fixEncoding,
  getInitials,
} from "@/lib/crm-seguimiento";
import { PedidosTab, NVVTab } from "@/components/crm/pedidos-nvv-tabs";

// Constructor de presupuesto del Tomador 2, en modo modal embebido (se
// abre al pinchar la etapa "Cotización"). Lazy: no cargar el tomador
// completo al entrar al detalle.
const TomadorPedidos = lazy(() => import("./tomador-pedidos"));

// Tipos de entrada de la bitácora (propios de esta página). Las entradas
// viven en pedido_bitacora — NO migrar a hitos: el flag hasProblema del
// listado de leads (pin + ícono de alerta) se calcula desde esa tabla.
const BIT_TIPOS = [
  { value: "nota", label: "Nota", icon: MessageSquare, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "llamada", label: "Llamada", icon: PhoneCall, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "visita", label: "Visita", icon: MapPin, color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { value: "seguimiento", label: "Seguimiento", icon: UserCheck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { value: "problema", label: "Problema", icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
];

// Tipos del composer que se guardan como BITÁCORA (no como hito): el
// resto de los pills usa HITO_TIPOS. "Problema" debe ir a bitácora sí o
// sí para que el dashboard de leads lo detecte.
const COMPOSER_BIT_TIPOS = [
  { value: "seguimiento", label: "Seguimiento", icon: UserCheck, color: "text-purple-500", ring: "bg-purple-100 dark:bg-purple-900/40" },
  { value: "problema", label: "Problema", icon: AlertTriangle, color: "text-red-500", ring: "bg-red-100 dark:bg-red-900/40" },
];
const BIT_COMPOSER_VALUES = new Set(COMPOSER_BIT_TIPOS.map((t) => t.value));

// ─── Etiquetas del cliente (chips libres en la card Notas) ────────────
// Se persisten como JSON array de strings en crm_seguimiento_clientes.etiquetas.
const ETIQUETA_COLORS = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
];

// Hash estable para que cada etiqueta conserve su color entre renders
function etiquetaColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return ETIQUETA_COLORS[h % ETIQUETA_COLORS.length];
}

// Clave de día local (para agrupar actividad en el calendario)
function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function parseEtiquetas(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// ─── Página de detalle ────────────────────────────────────────────────
export default function SeguimientoClienteDetalle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/seguimiento-clientes/:id");
  const clientId = params?.id;

  const isAdminOrSupervisor = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");

  // ─── Estado local ───────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [hitoForm, setHitoForm] = useState<{ tipo: string; descripcion: string; fecha: Date | null }>({ tipo: "contacto", descripcion: "", fecha: null });
  const [fechaPickerOpen, setFechaPickerOpen] = useState(false);
  // Vista de la card Actividad: timeline cronológico o calendario mensual
  const [vistaActividad, setVistaActividad] = useState<"lista" | "calendario">("lista");
  const [calDia, setCalDia] = useState<Date | null>(new Date());
  const [rutInput, setRutInput] = useState("");
  const [detectedPurchases, setDetectedPurchases] = useState<any[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showComunaSuggestions, setShowComunaSuggestions] = useState(false);
  const comunaInputRef = useRef<HTMLInputElement>(null);
  const comunaDropdownRef = useRef<HTMLDivElement>(null);
  // Borrador de la card "Notas" (null = sin cambios locales)
  const [notasDraft, setNotasDraft] = useState<string | null>(null);
  const [etiquetaInput, setEtiquetaInput] = useState("");
  // Constructor de presupuesto embebido (etapa "Cotización")
  const [showCotizador, setShowCotizador] = useState(false);

  // ─── Query detalle del cliente ──────────────────────────────────
  const { data: client, isLoading, refetch } = useQuery({
    queryKey: ["/api/crm/seguimiento", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/seguimiento/${clientId}`);
      if (!res.ok) throw new Error("Error al cargar cliente");
      return res.json();
    },
    enabled: !!clientId,
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["/api/crm/vendedores"],
    queryFn: async () => {
      const res = await fetch("/api/crm/vendedores");
      if (!res.ok) throw new Error("Error al cargar vendedores");
      return res.json();
    },
    enabled: isAdminOrSupervisor,
  });

  // Comunas existentes (autocomplete del formulario)
  const { data: comunasSugeridas = [] } = useQuery<string[]>({
    queryKey: ["/api/crm/comunas"],
    queryFn: async () => {
      const res = await fetch("/api/crm/comunas");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ─── Bitácora ───────────────────────────────────────────────────
  // El documentoId efectivo cambia cuando se vincula un RUT (clienteId se
  // puebla); debe estar en la queryKey para que la caché no quede pegada
  // a las entradas del id anterior.
  const bitacoraDocId = client?.clienteId || clientId;
  const { data: bitacoraEntries = [], isLoading: bitacoraLoading } = useQuery({
    queryKey: ["/api/bitacora", "cliente", bitacoraDocId],
    queryFn: async () => {
      const params = new URLSearchParams({
        documentoTipo: "cliente",
        documentoId: bitacoraDocId!,
      });
      const response = await fetch(`/api/bitacora?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId && !!client,
  });

  // Timeline unificado de Actividad: hitos del CRM + entradas de bitácora
  // del cliente, mezclados por fecha (más reciente primero). La bitácora
  // conserva su tabla y sus tipos (Problema alimenta el dashboard de leads).
  const timeline = useMemo(() => {
    const hitoItems = ((client?.hitos as any[]) || []).map((h: any) => (
      { kind: "hito" as const, key: `h-${h.id}`, createdAt: h.createdAt, raw: h }
    ));
    const bitItems = ((bitacoraEntries as any[]) || []).map((b: any) => (
      { kind: "bitacora" as const, key: `b-${b.id}`, createdAt: b.createdAt, raw: b }
    ));
    return [...hitoItems, ...bitItems].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  }, [client?.hitos, bitacoraEntries]);

  // Vista calendario de Actividad: cada entrada cae en el día de su fecha
  // agendada (si tiene) o en el día en que se registró.
  const calendario = useMemo(() => {
    const porDia = new Map<string, typeof timeline>();
    const agendados: Date[] = [];
    const registrados: Date[] = [];
    for (const item of timeline) {
      const fechaStr = item.raw.fechaProgramada || item.createdAt;
      if (!fechaStr) continue;
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) continue;
      const key = dayKeyOf(d);
      if (!porDia.has(key)) porDia.set(key, []);
      porDia.get(key)!.push(item);
      (item.raw.fechaProgramada ? agendados : registrados).push(d);
    }
    return { porDia, agendados, registrados };
  }, [timeline]);

  // ─── Mutations ──────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/crm/seguimiento/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al actualizar");
      }
      return res.json();
    },
    // Update optimista: la UI refleja el cambio antes de que responda la API
    onMutate: async (data: any) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/seguimiento", clientId] });
      const previousClient = queryClient.getQueryData(["/api/crm/seguimiento", clientId]);
      queryClient.setQueryData(["/api/crm/seguimiento", clientId], (old: any) => {
        if (!old) return old;
        return { ...old, ...data };
      });
      return { previousClient };
    },
    onSuccess: (_data, variables) => {
      toast({ title: "✅ Datos actualizados" });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      // El autocomplete de comunas solo cambia si se editó la comuna;
      // invalidarlo en cada PATCH (estado, prioridad…) es trabajo inútil.
      if (variables?.comuna !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/comunas"] });
      }
    },
    onError: (err: Error, _data, context) => {
      // Rollback al snapshot anterior si falla
      if (context?.previousClient) {
        queryClient.setQueryData(["/api/crm/seguimiento", clientId], context.previousClient);
      }
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/crm/seguimiento/${clientId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      toast({ title: "Cliente eliminado" });
      navigate("/seguimiento-clientes");
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar el cliente", description: err.message, variant: "destructive" });
    },
  });

  const createBitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Error");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      setHitoForm({ tipo: "contacto", descripcion: "", fecha: null });
      toast({ title: "✅ Entrada agregada a la bitácora" });
    },
    onError: () => {
      toast({ title: "❌ Error al agregar entrada", variant: "destructive" });
    },
  });

  const deleteBitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/bitacora/${id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error("Error");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      toast({ title: "Entrada eliminada" });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar la entrada", description: err.message, variant: "destructive" });
    },
  });

  const addHitoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/crm/seguimiento/${clientId}/hito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al agregar hito");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      toast({ title: "Hito agregado" });
      setHitoForm({ tipo: "contacto", descripcion: "", fecha: null });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error al registrar el hito", description: err.message, variant: "destructive" });
    },
  });

  const linkRutMutation = useMutation({
    mutationFn: async (rut: string) => {
      const res = await fetch(`/api/crm/seguimiento/${clientId}/vincular-rut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut }),
      });
      if (!res.ok) throw new Error("Error al vincular RUT");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      toast({
        title: data.clienteVinculado ? "RUT vinculado exitosamente" : "RUT asociado",
        description: data.clienteVinculado
          ? `Cliente encontrado: ${data.clienteVinculado.nokoen}`
          : "No se encontró cliente con ese RUT en la base de ventas.",
      });
      setRutInput("");
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Error al vincular el RUT", description: err.message, variant: "destructive" });
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────
  // Composer unificado de Actividad: los tipos de bitácora se guardan en
  // pedido_bitacora; el resto se registra como hito del seguimiento.
  const handleRegistrarActividad = () => {
    const descripcion = hitoForm.descripcion.trim();
    if (!descripcion || !client) return;
    // Fecha agendada al mediodía local: evita que el día se corra al
    // convertir a UTC (Chile es UTC-3/-4)
    const fechaProgramada = hitoForm.fecha
      ? new Date(hitoForm.fecha.getFullYear(), hitoForm.fecha.getMonth(), hitoForm.fecha.getDate(), 12).toISOString()
      : null;
    if (BIT_COMPOSER_VALUES.has(hitoForm.tipo)) {
      const cv = client.clienteVinculado;
      createBitMutation.mutate({
        documentoTipo: "cliente",
        documentoId: client.clienteId || client.id,
        documentoNumero: cv?.koen || null,
        clienteNombre: client.nombre || cv?.nokoen,
        clienteRut: client.rut || cv?.rten || null,
        nota: descripcion,
        tipo: hitoForm.tipo,
        fechaProgramada,
      });
    } else {
      addHitoMutation.mutate({ tipo: hitoForm.tipo, descripcion, fechaProgramada });
    }
  };

  const startEditing = () => {
    if (!client) return;
    setEditForm({
      nombre: client.nombre || "",
      empresa: client.empresa || "",
      telefono: client.telefono || "",
      email: client.email || "",
      notas: client.notas || "",
      region: client.region || "",
      segmento: client.segmento || "",
      contactoEncargado: client.contactoEncargado || "",
      comuna: client.comuna || "",
      condicionPago: client.condicionPago || "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    // Se envían siempre todos los campos editables para persistir comuna y contactoEncargado
    const changes: any = {
      nombre: editForm.nombre,
      empresa: editForm.empresa,
      telefono: editForm.telefono,
      email: editForm.email,
      notas: editForm.notas,
      region: editForm.region,
      segmento: editForm.segmento,
      contactoEncargado: editForm.contactoEncargado,
      comuna: editForm.comuna,
      condicionPago: editForm.condicionPago,
    };
    updateMutation.mutate(changes);
  };

  const handleDetectPurchases = async () => {
    if (!client) return;
    setIsDetecting(true);
    try {
      const res = await fetch(`/api/crm/seguimiento/${clientId}/detectar-compras`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setDetectedPurchases(data.compras);
      if (data.nuevosHitosCreados > 0) {
        toast({ title: `${data.nuevosHitosCreados} documentos detectados` });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
        refetch();
      } else if (data.compras.length === 0) {
        toast({ title: "Sin compras", description: "No se encontraron documentos de venta para este RUT." });
      } else {
        toast({ title: `${data.compras.length} documentos encontrados` });
      }
    } catch {
      toast({ title: "Error", description: "No se pudieron detectar compras", variant: "destructive" });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleChangeEstado = (value: string) => {
    if (!client) return;
    // Cotización abre el constructor de presupuesto del Tomador 2 como
    // modal sobre esta página, con el cliente precargado si hay RUT.
    if (value === "cotizacion") {
      setShowCotizador(true);
    }
    // Comparar contra el valor CRUDO: si el registro tiene un estado legacy
    // ("contactado" se muestra como "Seguimiento"), clickear la etapa
    // mostrada debe reescribirlo al valor canónico, no ser un no-op.
    if (value === client.estado) return;
    updateMutation.mutate({ estado: value });
  };

  // ─── Carga / no encontrado ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No se encontró el cliente</p>
          <Button variant="outline" onClick={() => navigate("/seguimiento-clientes")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Seguimiento
          </Button>
        </div>
      </div>
    );
  }

  // ─── Valores derivados de la ficha ──────────────────────────────
  const estadoActual = normalizeEstado(client.estado);
  const estadoConfig = getEstadoConfig(client.estado);
  const currentEstadoIdx = ESTADOS.findIndex((e) => e.value === estadoActual);
  const cv = client.clienteVinculado;
  const isStaleContact = !client.ultimoContacto || (new Date().getTime() - new Date(client.ultimoContacto).getTime()) > 7 * 24 * 60 * 60 * 1000;
  const displayPhone = cv?.foen || client.linkedFoen || client.telefono || "—";
  const displayComuna = fixEncoding(client.comuna || cv?.comuna || client.linkedComuna || client.ciudad);
  const displayRegion = client.region || fixEncoding(client.linkedRegion || cv?.provincia || client.linkedProvincia);
  const displayContacto = fixEncoding(client.contactoEncargado || cv?.purchasingContactName || client.linkedPurchasingContact);
  const displayEmail = client.email || cv?.email || "—";
  const displayCondicionPago = client.condicionPago || (cv?.cpen || client.linkedCpen || "")?.trim() || "—";
  const anotacionErp = (cv?.oben || client.linkedOben || "")?.trim();
  const notasValue = notasDraft ?? (client.notas || "");
  const notasDirty = notasDraft !== null && notasDraft !== (client.notas || "");
  const etiquetas = parseEtiquetas(client.etiquetas);

  const addEtiqueta = () => {
    const tag = etiquetaInput.trim();
    if (!tag) return;
    if (etiquetas.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setEtiquetaInput("");
      return;
    }
    updateMutation.mutate({ etiquetas: JSON.stringify([...etiquetas, tag]) });
    setEtiquetaInput("");
  };

  const removeEtiqueta = (tag: string) => {
    updateMutation.mutate({ etiquetas: JSON.stringify(etiquetas.filter((t) => t !== tag)) });
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background" data-testid="seguimiento-cliente-detalle-page">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">

        {/* ═══ Volver ═══ */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/seguimiento-clientes")}
          className="text-muted-foreground hover:text-foreground -ml-2"
          data-testid="btn-volver"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Volver al Seguimiento
        </Button>

        {/* ═══ Header hero ═══ */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Avatar con anillo del color del estado */}
              <div className={`flex-shrink-0 p-1 rounded-2xl border ${estadoConfig.border} ${estadoConfig.bgCard}`}>
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${estadoConfig.color} flex items-center justify-center text-white text-xl font-bold select-none`}>
                  {getInitials(client.empresa || client.nombre)}
                </div>
              </div>

              {/* Nombre + chips de contacto */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="cliente-nombre">
                      {fixEncoding(client.empresa || client.nombre)}
                    </h1>
                    {client.empresa && client.empresa !== client.nombre && (
                      <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        {fixEncoding(client.nombre)}
                      </p>
                    )}
                  </div>

                  {/* Acciones: destacado / editar / eliminar */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ destacado: !client.destacado })}
                      className={`p-2 rounded-lg transition-colors ${
                        client.destacado
                          ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          : "text-muted-foreground/40 hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      }`}
                      title={client.destacado ? "Quitar destacado" : "Marcar como destacado"}
                      data-testid="btn-destacado"
                    >
                      <Star className={`w-5 h-5 ${client.destacado ? "fill-amber-400" : ""}`} />
                    </button>
                    {!isEditing ? (
                      <Button variant="outline" size="sm" onClick={startEditing} className="text-xs" data-testid="btn-editar">
                        <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                        Editar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-xs" data-testid="btn-cancelar-edicion">
                        <X className="w-3.5 h-3.5 mr-1" />
                        Cancelar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        if (confirm("¿Eliminar este cliente del seguimiento?")) deleteMutation.mutate();
                      }}
                      data-testid="btn-eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Chips de contacto */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {client.rut && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                      <Link2 className="w-3 h-3 text-indigo-500" />
                      <span className="font-mono">{client.rut}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                    <Phone className="w-3 h-3 text-blue-500" />
                    {displayPhone}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {displayEmail}
                  </span>
                  {(displayComuna !== "—" || displayRegion) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                      <MapPin className="w-3 h-3 text-emerald-500" />
                      {[displayComuna !== "—" ? displayComuna : null, displayRegion || null].filter(Boolean).join(", ")}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    isStaleContact
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-muted/40 text-muted-foreground"
                  }`}>
                    <Clock className="w-3 h-3" />
                    Últ. contacto: {timeAgo(client.ultimoContacto)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Stepper del pipeline ═══ */}
          <div className="border-t px-4 sm:px-6 py-4">
            {/* Desktop: pasos conectados */}
            <div className="hidden sm:flex items-center" data-testid="stepper-pipeline">
              {ESTADOS.map((etapa, i) => {
                const reached = i <= currentEstadoIdx;
                const isCurrent = i === currentEstadoIdx;
                return (
                  <div key={etapa.value} className={`flex items-center ${i > 0 ? "flex-1" : ""}`}>
                    {/* Conector previo, tintado si la etapa anterior fue alcanzada */}
                    {i > 0 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded ${i <= currentEstadoIdx ? ESTADOS[i - 1].dot : "bg-border"}`} />
                    )}
                    <button
                      onClick={() => handleChangeEstado(etapa.value)}
                      disabled={updateMutation.isPending}
                      className="group flex flex-col items-center gap-1.5 focus:outline-none"
                      title={`Mover a ${etapa.label}`}
                      data-testid={`stepper-etapa-${etapa.value}`}
                    >
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        reached
                          ? `${etapa.dot} text-white shadow-sm`
                          : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
                      } ${isCurrent ? "ring-2 ring-offset-2 ring-offset-card ring-indigo-300 dark:ring-indigo-700" : ""}`}>
                        <etapa.icon className="w-4 h-4" />
                      </span>
                      <span className={`text-[11px] font-medium leading-none ${reached ? etapa.text : "text-muted-foreground"}`}>
                        {etapa.label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Móvil: select compacto */}
            <div className="sm:hidden">
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Etapa del pipeline</label>
              <select
                className="w-full text-sm bg-background border rounded-lg px-3 py-2 cursor-pointer"
                value={estadoActual}
                onChange={(e) => handleChangeEstado(e.target.value)}
                data-testid="select-estado-mobile"
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ═══ Fila de datos clave ═══ */}
        <div className="grid grid-cols-2 gap-3">
          {/* Prioridad */}
          <div className="rounded-xl border bg-card shadow-sm p-3.5" data-testid="card-prioridad">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2">Prioridad</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORIDADES.map((p) => {
                const active = (client.prioridad || "media") === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => updateMutation.mutate({ prioridad: p.value })}
                    disabled={updateMutation.isPending}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      active ? `${p.color} ring-1 ring-inset ring-black/10 dark:ring-white/10` : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                    data-testid={`prioridad-${p.value}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Último pedido real (solo lectura) */}
          <div className="rounded-xl border bg-card shadow-sm p-3.5" data-testid="card-ultimo-pedido">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2 flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" /> Último pedido real
            </p>
            <p className="text-sm font-semibold text-foreground">{formatDate(client.ultimaCompraDate)}</p>
            {client.ultimaCompraDate && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(client.ultimaCompraDate)}</p>
            )}
          </div>
        </div>

        {/* ═══ Layout 2 columnas ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5 items-start">

          {/* ─── Columna izquierda: Información + Notas ─── */}
          <div className="space-y-5">

            {/* Card Información */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="px-4 sm:px-5 py-3.5 border-b flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  Información
                </h2>
                {isEditing && (
                  <Badge className="text-[10px] border-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">Editando</Badge>
                )}
              </div>

              {!isEditing ? (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <InfoItem icon={MapPin} label="Comuna" value={displayComuna} />
                    <InfoItem icon={MapPin} label="Región" value={displayRegion || "—"} />
                    <InfoItem icon={CreditCard} label="Condición de pago" value={displayCondicionPago} />
                    <InfoItem icon={User} label="Vendedor" value={client.vendedorNombre || "—"} />
                    <InfoItem icon={Phone} label="Contacto encargado" value={displayContacto || "—"} />
                    <InfoItem icon={Tags} label="Segmento" value={client.segmento || client.linkedSegmento || "—"} />
                    <InfoItem icon={Calendar} label="Último pedido" value={formatDate(client.ultimaCompraDate)} />
                  </div>

                  {/* Teléfonos secundarios de la ficha ERP */}
                  {(cv?.cnen || client.linkedCnen || cv?.cnen2 || client.linkedCnen2) && (
                    <div className="pt-3 border-t border-dashed space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Otros contactos</p>
                      {(cv?.cnen || client.linkedCnen) && (
                        <p className="text-sm text-foreground flex items-center gap-2">
                          <PhoneCall className="w-3.5 h-3.5 text-muted-foreground/50" />
                          {cv?.cnen || client.linkedCnen}
                          <Badge variant="outline" className="text-[10px]">Secundario</Badge>
                        </p>
                      )}
                      {(cv?.cnen2 || client.linkedCnen2) && (
                        <p className="text-sm text-foreground flex items-center gap-2">
                          <PhoneCall className="w-3.5 h-3.5 text-muted-foreground/50" />
                          {cv?.cnen2 || client.linkedCnen2}
                          <Badge variant="outline" className="text-[10px]">Adicional</Badge>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ─── Formulario de edición ─── */
                <div className="p-4 sm:p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Nombre</label>
                      <Input
                        value={editForm.nombre}
                        onChange={e => setEditForm((f: any) => ({ ...f, nombre: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Empresa</label>
                      <Input
                        value={editForm.empresa}
                        onChange={e => setEditForm((f: any) => ({ ...f, empresa: e.target.value }))}
                        placeholder="Nombre empresa"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Teléfono</label>
                      <Input
                        value={editForm.telefono}
                        onChange={e => setEditForm((f: any) => ({ ...f, telefono: e.target.value }))}
                        placeholder="+56 9..."
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Email</label>
                      <Input
                        value={editForm.email}
                        onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                        placeholder="correo@ejemplo.cl"
                        className="h-9"
                      />
                    </div>
                    {isAdminOrSupervisor && (
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Vendedor</label>
                        <select
                          className="w-full text-sm bg-background border rounded-md px-3 py-1.5 h-9 cursor-pointer hover:border-indigo-400 transition-colors"
                          value={vendedores.some((v: any) => v.id === client.vendedorId) ? client.vendedorId : ""}
                          onChange={(e) => updateMutation.mutate({ vendedorId: e.target.value })}
                        >
                          {!vendedores.some((v: any) => v.id === client.vendedorId) && (
                            <option value="" disabled>{client.vendedorNombre} (actual)</option>
                          )}
                          {vendedores.map((v: any) => (
                            <option key={v.id} value={v.id}>{v.salespersonName}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Contacto Encargado</label>
                      <Input
                        value={editForm.contactoEncargado}
                        onChange={e => setEditForm((f: any) => ({ ...f, contactoEncargado: e.target.value }))}
                        placeholder={fixEncoding(cv?.purchasingContactName || client.linkedPurchasingContact) || "Nombre del encargado..."}
                        className="h-9"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Comuna</label>
                      <Input
                        ref={comunaInputRef}
                        value={editForm.comuna}
                        onChange={e => {
                          setEditForm((f: any) => ({ ...f, comuna: e.target.value }));
                          setShowComunaSuggestions(true);
                        }}
                        onFocus={() => setShowComunaSuggestions(true)}
                        onBlur={() => { setTimeout(() => setShowComunaSuggestions(false), 200); }}
                        placeholder={fixEncoding(cv?.comuna || client.linkedComuna) || "Escribir o seleccionar comuna..."}
                        className="h-9"
                        autoComplete="off"
                      />
                      {showComunaSuggestions && (() => {
                        const filtered = comunasSugeridas.filter((c: string) =>
                          c.toLowerCase().includes((editForm.comuna || "").toLowerCase())
                        );
                        if (filtered.length === 0) return null;
                        // No mostrar si ya se escribió el match exacto
                        if (filtered.length === 1 && filtered[0].toLowerCase() === (editForm.comuna || "").toLowerCase()) return null;
                        return (
                          <div
                            ref={comunaDropdownRef}
                            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"
                          >
                            {filtered.slice(0, 15).map((c: string) => (
                              <button
                                key={c}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setEditForm((f: any) => ({ ...f, comuna: c }));
                                  setShowComunaSuggestions(false);
                                }}
                              >
                                <MapPin className="w-3 h-3 inline mr-2 text-muted-foreground" />
                                {fixEncoding(c)}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Región</label>
                      <select
                        className="w-full text-sm bg-background border rounded-md px-3 py-1.5 h-9 cursor-pointer hover:border-indigo-400 transition-colors"
                        value={editForm.region || ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, region: e.target.value }))}
                      >
                        <option value="">Seleccionar región...</option>
                        {REGIONES_CHILE.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Segmento</label>
                      <select
                        className="w-full text-sm bg-background border rounded-md px-3 py-1.5 h-9 cursor-pointer hover:border-indigo-400 transition-colors"
                        value={editForm.segmento || ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, segmento: e.target.value }))}
                      >
                        <option value="">Seleccionar segmento...</option>
                        {SEGMENTOS_CRM.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Condición de Pago</label>
                      <select
                        className="w-full text-sm bg-background border rounded-md px-3 py-1.5 h-9 cursor-pointer hover:border-indigo-400 transition-colors"
                        value={editForm.condicionPago || ""}
                        onChange={(e) => setEditForm((f: any) => ({ ...f, condicionPago: e.target.value }))}
                      >
                        <option value="">Seleccionar condición...</option>
                        {CONDICIONES_PAGO.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Notas</label>
                      <Textarea
                        value={editForm.notas}
                        onChange={e => setEditForm((f: any) => ({ ...f, notas: e.target.value }))}
                        placeholder="Notas del cliente..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-xs">
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                      data-testid="btn-guardar-edicion"
                    >
                      {updateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Guardar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Anotaciones de la ficha ERP (solo lectura) */}
            {anotacionErp && (
              <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Anotaciones del Cliente (ERP)</p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{fixEncoding(anotacionErp)}</p>
              </div>
            )}

            {/* Card Notas + Etiquetas */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="px-4 sm:px-5 py-3.5 border-b flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Notas
                </h2>
                {notasDirty && (
                  <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Sin guardar</Badge>
                )}
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                {/* Etiquetas */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Tags className="w-3 h-3" /> Etiquetas
                  </p>
                  <div className="flex flex-wrap gap-1.5" data-testid="etiquetas-list">
                    {etiquetas.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${etiquetaColor(tag)}`}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeEtiqueta(tag)}
                          disabled={updateMutation.isPending}
                          className="hover:opacity-60 transition-opacity"
                          title="Quitar etiqueta"
                          data-testid={`btn-quitar-etiqueta-${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {etiquetas.length === 0 && (
                      <span className="text-xs text-muted-foreground">Sin etiquetas aún</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={etiquetaInput}
                      onChange={(e) => setEtiquetaInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEtiqueta(); } }}
                      placeholder="Nueva etiqueta..."
                      className="h-8 text-sm"
                      data-testid="input-etiqueta"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addEtiqueta}
                      disabled={!etiquetaInput.trim() || updateMutation.isPending}
                      className="h-8 px-2.5"
                      title="Agregar etiqueta"
                      data-testid="btn-agregar-etiqueta"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Notas internas */}
                <div className="space-y-2">
                  <Textarea
                    value={notasValue}
                    onChange={(e) => setNotasDraft(e.target.value)}
                    placeholder="Notas internas sobre este cliente..."
                    rows={4}
                    className="text-sm resize-none"
                    data-testid="textarea-notas"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ notas: notasValue }, { onSuccess: () => setNotasDraft(null) })}
                      disabled={!notasDirty || updateMutation.isPending}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                      data-testid="btn-guardar-notas"
                    >
                      {updateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Guardar notas
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Columna derecha: Timeline de actividad ─── */}
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="px-4 sm:px-5 py-3.5 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Actividad
              </h2>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-muted-foreground">{timeline.length} {timeline.length === 1 ? "registro" : "registros"}</span>
                <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
                  <button
                    onClick={() => setVistaActividad("lista")}
                    className={`p-1 rounded-md transition-colors ${vistaActividad === "lista" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title="Vista timeline"
                    data-testid="btn-vista-lista"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setVistaActividad("calendario")}
                    className={`p-1 rounded-md transition-colors ${vistaActividad === "calendario" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title="Vista calendario"
                    data-testid="btn-vista-calendario"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* Composer: registrar interacción (hitos + tipos de bitácora) */}
              <div className="rounded-xl border bg-slate-50/60 dark:bg-slate-900/30 p-3.5 space-y-2.5" data-testid="hito-composer">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Registrar interacción</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...HITO_TIPOS.filter((t) => t.value !== "sistema"), ...COMPOSER_BIT_TIPOS].map((t) => {
                    const active = hitoForm.tipo === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setHitoForm((f) => ({ ...f, tipo: t.value }))}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          active
                            ? `${t.ring} ${t.color} ring-1 ring-inset ring-black/10 dark:ring-white/10`
                            : "bg-background border text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`hito-tipo-${t.value}`}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <Textarea
                  value={hitoForm.descripcion}
                  onChange={(e) => setHitoForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="¿Qué pasó con este cliente? (llamada, visita, acuerdo, problema...)"
                  rows={2}
                  className="text-sm resize-none bg-background"
                  data-testid="hito-descripcion"
                />
                <div className="flex items-center justify-between gap-2">
                  {/* Hito en calendario: fecha opcional (agenda una visita, un
                      seguimiento…). Sin fecha se registra como hasta ahora. */}
                  <div className="flex items-center gap-1">
                    <Popover open={fechaPickerOpen} onOpenChange={setFechaPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`text-xs ${hitoForm.fecha ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" : "text-muted-foreground"}`}
                          data-testid="btn-hito-fecha"
                        >
                          <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                          {hitoForm.fecha
                            ? hitoForm.fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
                            : "Agendar en calendario"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarUI
                          mode="single"
                          locale={es}
                          selected={hitoForm.fecha ?? undefined}
                          onSelect={(d) => {
                            setHitoForm((f) => ({ ...f, fecha: d ?? null }));
                            setFechaPickerOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    {hitoForm.fecha && (
                      <button
                        onClick={() => setHitoForm((f) => ({ ...f, fecha: null }))}
                        className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
                        title="Quitar fecha"
                        data-testid="btn-hito-fecha-clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRegistrarActividad}
                    disabled={!hitoForm.descripcion.trim() || addHitoMutation.isPending || createBitMutation.isPending}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    data-testid="btn-agregar-hito"
                  >
                    {(addHitoMutation.isPending || createBitMutation.isPending) ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    Registrar
                  </Button>
                </div>
              </div>

              {/* Vista calendario: hitos agendados + actividad registrada por día */}
              {vistaActividad === "calendario" ? (
                <div className="space-y-3" data-testid="actividad-calendario">
                  <CalendarUI
                    mode="single"
                    locale={es}
                    selected={calDia ?? undefined}
                    onSelect={(d) => setCalDia(d ?? null)}
                    className="mx-auto"
                    modifiers={{ agendado: calendario.agendados, registrado: calendario.registrados }}
                    modifiersClassNames={{
                      registrado: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-slate-400",
                      agendado: "relative font-bold text-indigo-600 dark:text-indigo-400 after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-indigo-500",
                    }}
                  />
                  <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      Hito agendado
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Actividad registrada
                    </span>
                  </div>
                  <div className="rounded-xl border bg-slate-50/60 dark:bg-slate-900/30 p-3.5" data-testid="calendario-dia-detalle">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {calDia
                        ? calDia.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
                        : "Selecciona un día"}
                    </p>
                    {(() => {
                      const items = calDia ? (calendario.porDia.get(dayKeyOf(calDia)) ?? []) : [];
                      if (items.length === 0) {
                        return <p className="text-xs text-muted-foreground py-1.5">Sin actividad este día.</p>;
                      }
                      return (
                        <div className="space-y-2.5">
                          {items.map((item) => {
                            const raw = item.raw;
                            const isBit = item.kind === "bitacora";
                            const bitCfg = BIT_TIPOS.find((t) => t.value === raw.tipo) || BIT_TIPOS[0];
                            const hitoCfg = getHitoConfig(raw.tipo);
                            const Icon = isBit ? bitCfg.icon : hitoCfg.icon;
                            return (
                              <div key={item.key} className="flex items-start gap-2.5">
                                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isBit ? bitCfg.color : hitoCfg.ring}`}>
                                  <Icon className={`w-3.5 h-3.5 ${isBit ? "" : hitoCfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-foreground">{isBit ? bitCfg.label : hitoCfg.label}</span>
                                    {raw.fechaProgramada && (
                                      <Badge className={`text-[10px] h-4 px-1.5 gap-1 border-0 ${
                                        isOverdue(raw.fechaProgramada)
                                          ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                      }`}>
                                        <CalendarClock className="w-2.5 h-2.5" />
                                        Agendado
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground/80 mt-0.5 whitespace-pre-wrap">{isBit ? raw.nota : raw.descripcion}</p>
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">por {raw.autorNombre}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : timeline.length === 0 ? (
                bitacoraLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Sin actividad registrada</p>
                    <p className="text-xs mt-1">Registra la primera interacción con este cliente.</p>
                  </div>
                )
              ) : (
                <div data-testid="timeline-hitos">
                  {timeline.map((item, i) => {
                    const isLast = i === timeline.length - 1;
                    if (item.kind === "bitacora") {
                      const entry = item.raw;
                      const typeConfig = BIT_TIPOS.find((t) => t.value === entry.tipo) || BIT_TIPOS[0];
                      return (
                        <div key={item.key} className="flex gap-3 relative">
                          {!isLast && (
                            <div className="absolute left-[17px] top-9 w-px h-[calc(100%-16px)] bg-border" />
                          )}
                          <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10 ${typeConfig.color}`}>
                            <typeConfig.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0 pb-5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={`${typeConfig.color} text-[10px] gap-1 border-0`} data-testid={`bitacora-tipo-${entry.tipo}`}>
                                <typeConfig.icon className="w-2.5 h-2.5" />
                                {typeConfig.label}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">Bitácora</Badge>
                              {entry.fechaProgramada && (
                                <Badge className={`text-[10px] h-4 px-1.5 gap-1 border-0 ${
                                  isOverdue(entry.fechaProgramada)
                                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                                }`}>
                                  <CalendarClock className="w-2.5 h-2.5" />
                                  {formatDate(entry.fechaProgramada)}
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap" title={formatDate(entry.createdAt)}>
                                {timeAgo(entry.createdAt)}
                              </span>
                              <button
                                onClick={() => deleteBitMutation.mutate(entry.id)}
                                className="text-muted-foreground/30 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar entrada"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{entry.nota}</p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1">
                              por {entry.autorNombre} · {formatDate(entry.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    const hito = item.raw;
                    const config = getHitoConfig(hito.tipo);
                    return (
                      <div key={item.key} className="flex gap-3 relative">
                        {/* Línea vertical conectora */}
                        {!isLast && (
                          <div className="absolute left-[17px] top-9 w-px h-[calc(100%-16px)] bg-border" />
                        )}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center z-10 ${config.ring}`}>
                          <config.icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 pb-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{config.label}</span>
                            {hito.autoDetectado && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-cyan-600 border-cyan-300 dark:text-cyan-400 dark:border-cyan-700">Auto</Badge>
                            )}
                            {hito.documentoNumero && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
                                {hito.documentoTipo} #{hito.documentoNumero}
                              </Badge>
                            )}
                            {hito.fechaProgramada && (
                              <Badge className={`text-[10px] h-4 px-1.5 gap-1 border-0 ${
                                isOverdue(hito.fechaProgramada)
                                  ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                              }`}>
                                <CalendarClock className="w-2.5 h-2.5" />
                                {formatDate(hito.fechaProgramada)}
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap" title={formatDate(hito.createdAt)}>
                              {timeAgo(hito.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{hito.descripcion}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            por {hito.autorNombre} · {formatDate(hito.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Pestañas: Pedidos / NVV / RUT-Compras ═══ */}
        {/* La bitácora del cliente vive integrada en el timeline de Actividad */}
        <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
          <Tabs defaultValue="pedidos" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
              <TabsTrigger value="nvv" className="text-xs">NVV</TabsTrigger>
              <TabsTrigger value="rut" className="text-xs">RUT / Compras</TabsTrigger>
            </TabsList>

            {/* ─── Pedidos ─── */}
            <TabsContent value="pedidos" className="mt-4">
              <PedidosTab client={client} />
            </TabsContent>

            {/* ─── NVV ─── */}
            <TabsContent value="nvv" className="mt-4">
              <NVVTab client={client} />
            </TabsContent>

            {/* ─── RUT / Compras ─── */}
            <TabsContent value="rut" className="mt-4 space-y-4" data-testid="tab-rut-compras">
              {/* Estado de vinculación */}
              <div className="rounded-xl border bg-slate-50/60 dark:bg-slate-900/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-foreground">Vinculación con base de ventas</h3>
                </div>

                {client.rut ? (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-mono text-sm font-semibold text-foreground">{client.rut}</span>
                    {cv ? (
                      <>
                        <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                          Vinculado
                        </Badge>
                        <span className="text-xs text-muted-foreground">{fixEncoding(cv.nokoen)}</span>
                      </>
                    ) : (
                      <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Sin match en ventas
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    Este cliente no tiene RUT vinculado. Ingresa uno para cruzarlo con la base de ventas.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={rutInput}
                    onChange={(e) => setRutInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && rutInput.trim()) linkRutMutation.mutate(rutInput.trim()); }}
                    placeholder={client.rut ? "Cambiar RUT (ej: 76.123.456-7)" : "Ingresar RUT (ej: 76.123.456-7)"}
                    className="h-9 sm:max-w-xs font-mono text-sm"
                    data-testid="input-rut"
                  />
                  <Button
                    size="sm"
                    onClick={() => linkRutMutation.mutate(rutInput.trim())}
                    disabled={!rutInput.trim() || linkRutMutation.isPending}
                    className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    data-testid="btn-vincular-rut"
                  >
                    {linkRutMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
                    {client.rut ? "Re-vincular" : "Vincular RUT"}
                  </Button>
                </div>
              </div>

              {/* Detección de compras */}
              <div className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-bold text-foreground">Detección de compras</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDetectPurchases}
                    disabled={isDetecting || (!client.rut && !client.clienteId)}
                    className="text-xs"
                    data-testid="btn-detectar-compras"
                  >
                    {isDetecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
                    Detectar compras
                  </Button>
                </div>

                {!client.rut && !client.clienteId ? (
                  <p className="text-xs text-muted-foreground">Vincula un RUT primero para poder detectar compras.</p>
                ) : detectedPurchases === null ? (
                  <p className="text-xs text-muted-foreground">
                    Busca documentos de venta (GDV/NVV/FCV) asociados al RUT y crea hitos automáticos si hay novedades.
                  </p>
                ) : detectedPurchases.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No se encontraron documentos de venta para este RUT.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {detectedPurchases.map((p: any, i: number) => (
                      <div key={p.id || i} className="bg-muted/20 border rounded-lg p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">{p.tido} #{p.nudo}</span>
                            {p.eslido && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{p.eslido}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{p.nokoprct || "Sin detalle de producto"}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCLP(p.vanedo)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{formatDate(p.feemdo)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Constructor de presupuesto (Tomador 2) como modal sobre el detalle */}
      {showCotizador && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] bg-slate-900/45 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
            </div>
          }
        >
          <TomadorPedidos
            variant="v2"
            builderOnly
            initialClientRut={client.rut || undefined}
            initialClientData={{
              nombre: client.empresa || client.nombre || undefined,
              rut: client.rut || undefined,
              email: client.email || undefined,
              telefono: client.telefono || undefined,
              direccion: [client.comuna, client.region].filter(Boolean).join(", ") || undefined,
            }}
            onClose={() => setShowCotizador(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Item de la card Información ──────────────────────────────────────
function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate" title={value}>{value}</p>
      </div>
    </div>
  );
}
