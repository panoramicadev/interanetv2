/**
 * Seguimiento de Clientes (CRM) — página de lista del pipeline de ventas.
 *
 * Dos vistas intercambiables (preferencia en localStorage):
 *  - Tabla: listado denso con todos los datos vinculados del ERP.
 *  - Pipeline: kanban de 5 etapas con drag & drop para mover de estado.
 *
 * Constantes y helpers del CRM viven en @/lib/crm-seguimiento (compartidos
 * con el detalle). Las pestañas de documentos ERP del detalle viven en
 * @/components/crm/pedidos-nvv-tabs.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, Search, X, Clock, AlertTriangle, CheckCircle2, User, Users, UserCheck,
  Star, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, RefreshCw,
  MapPin, Tags, List, LayoutGrid, Banknote, Send, Eye,
  MessageSquare, Check, Trash2, CalendarClock, ChevronRight, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ESTADOS, type EstadoValue, normalizeEstado, getEstadoConfig,
  PRIORIDADES, getPrioridadConfig, HITO_TIPOS, SEGMENTOS_CRM,
  timeAgo, formatDate, formatCLP, isOverdue, proximoContactoLabel,
  fixEncoding, getInitials,
} from "@/lib/crm-seguimiento";
import ImportExportClientes from "@/components/crm/import-export-clientes";

type ViewMode = "tabla" | "pipeline";

const VIEW_STORAGE_KEY = "crm-seguimiento-view";
// La búsqueda y los demás filtros se persisten en sessionStorage para no
// perderlos al entrar a un cliente y volver (la lista se desmonta al cambiar
// de ruta). Es transitorio: se limpia al cerrar la pestaña, no queda
// guardado para siempre.
const SEARCH_STORAGE_KEY = "crm-seguimiento-busqueda";
const FILTERS_STORAGE_KEY = "crm-seguimiento-filtros";

type FiltrosPersistidos = {
  estado: string;
  prioridad: string;
  vendedor: string;
  region: string;
  segmento: string;
  soloDestacados: boolean;
  pinProblemas: boolean;
  sortContacto: "none" | "asc" | "desc";
};

function loadViewPreference(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "pipeline" ? "pipeline" : "tabla";
  } catch {
    return "tabla";
  }
}

function loadSearchPreference(): string {
  try {
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function loadFiltrosPreference(): Partial<FiltrosPersistidos> {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Sin contacto hace más de 7 días (o nunca). */
function isStaleContact(client: any) {
  return !client.ultimoContacto ||
    (new Date().getTime() - new Date(client.ultimoContacto).getTime()) > 7 * 24 * 60 * 60 * 1000;
}

// Mapea el "Área" de la pestaña superior del Panel de Trabajo (valores de
// SEGMENTOS en tareas.tsx) al segmento del CRM (SEGMENTOS_CRM en crm-seguimiento.ts).
// Las áreas sin segmento CRM equivalente (marketing, "all") caen a "todos".
const AREA_TO_SEGMENTO_CRM: Record<string, string> = {
  ferreterias: "Ferretería",
  construccion: "Construcción",
  digital: "Industrial",
};

// ─── Página ───────────────────────────────────────────────────────────
// `segmentoArea` llega cuando el CRM va embebido como pestaña del Panel de
// Trabajo: sincroniza el filtro de Segmento con la pestaña superior de Área
// (y oculta el dropdown propio para evitar el doble filtro). Sin la prop, el
// CRM funciona standalone con su dropdown de Segmento habitual.
// Handle imperativo para que el (+) del header del Panel de Trabajo abra el
// alta de cliente cuando la pestaña activa es CRM.
export interface SeguimientoClientesHandle {
  nuevoCliente: () => void;
}

function SeguimientoClientesInner(
  { segmentoArea }: { segmentoArea?: string },
  ref: React.Ref<SeguimientoClientesHandle>,
) {
  const embedded = segmentoArea !== undefined;
  const segmentoDesdeArea = embedded ? (AREA_TO_SEGMENTO_CRM[segmentoArea!] ?? "todos") : undefined;

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [busqueda, setBusqueda] = useState(loadSearchPreference);
  const [busquedaDebounced, setBusquedaDebounced] = useState(loadSearchPreference);
  const [filtroEstado, setFiltroEstado] = useState<string>(() => loadFiltrosPreference().estado ?? "todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>(() => loadFiltrosPreference().prioridad ?? "todos");
  const [filtroVendedor, setFiltroVendedor] = useState<string>(() => loadFiltrosPreference().vendedor ?? "todos");
  const [filtroRegion, setFiltroRegion] = useState<string>(() => loadFiltrosPreference().region ?? "todos");
  const [filtroSegmento, setFiltroSegmento] = useState<string>(
    () => segmentoDesdeArea ?? loadFiltrosPreference().segmento ?? "todos"
  );
  const [soloDestacados, setSoloDestacados] = useState<boolean>(() => loadFiltrosPreference().soloDestacados ?? false);
  const [pinProblemas, setPinProblemas] = useState<boolean>(() => loadFiltrosPreference().pinProblemas ?? true);
  const [sortContacto, setSortContacto] = useState<"none" | "asc" | "desc">(() => loadFiltrosPreference().sortContacto ?? "desc");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [view, setView] = useState<ViewMode>(loadViewPreference);
  // Cliente objetivo del dialog "Registrar hito" (null = cerrado)
  const [hitoCliente, setHitoCliente] = useState<any>(null);

  useImperativeHandle(ref, () => ({ nuevoCliente: () => setShowCreateModal(true) }), []);

  const isAdminOrSupervisor = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");

  // Embebido en el Panel de Trabajo: al cambiar la pestaña de Área, seguir el segmento.
  useEffect(() => {
    if (segmentoDesdeArea !== undefined) setFiltroSegmento(segmentoDesdeArea);
  }, [segmentoDesdeArea]);

  // Debounce de la búsqueda: la query usa el valor estabilizado.
  // Se persiste de inmediato (no debounced) para no perderla si el usuario
  // entra a un cliente antes de que dispare el timeout.
  useEffect(() => {
    try { sessionStorage.setItem(SEARCH_STORAGE_KEY, busqueda); } catch { /* ignore */ }
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Persiste los demás filtros (estado, prioridad, vendedor, etc.) por la
  // misma razón que la búsqueda: no perderlos al entrar a un cliente y volver.
  useEffect(() => {
    try {
      const filtros: FiltrosPersistidos = {
        estado: filtroEstado,
        prioridad: filtroPrioridad,
        vendedor: filtroVendedor,
        region: filtroRegion,
        segmento: filtroSegmento,
        soloDestacados,
        pinProblemas,
        sortContacto,
      };
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filtros));
    } catch { /* ignore */ }
  }, [filtroEstado, filtroPrioridad, filtroVendedor, filtroRegion, filtroSegmento, soloDestacados, pinProblemas, sortContacto]);

  const changeView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* ignore */ }
  };

  // ─── Queries ─────────────────────────────────────────────────────
  // La key completa se reutiliza en el update optimista del kanban.
  // El estado NO se filtra en el servidor: hay registros con estados
  // legacy ("nuevo"/"contactado") que un eq exacto excluiría de la etapa
  // a la que pertenecen; se filtra en cliente vía normalizeEstado.
  const listKey = ["/api/crm/seguimiento", filtroVendedor, filtroPrioridad, busquedaDebounced];

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "500");
      if (filtroVendedor !== "todos") params.set("vendedor", filtroVendedor);
      if (filtroPrioridad !== "todos") params.set("prioridad", filtroPrioridad);
      if (busquedaDebounced) params.set("busqueda", busquedaDebounced);
      const res = await fetch(`/api/crm/seguimiento?${params}`);
      if (!res.ok) throw new Error("Error al cargar clientes");
      return res.json();
    },
  });

  // Las tarjetas KPI se acotan al segmento/Área activa igual que el listado: sin
  // esto quedaban en total general mientras los leads sí se filtraban.
  const { data: stats } = useQuery({
    queryKey: ["/api/crm/seguimiento/stats", filtroVendedor, filtroSegmento],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroVendedor !== "todos") params.set("vendedor", filtroVendedor);
      if (filtroSegmento !== "todos") params.set("segmento", filtroSegmento);
      const res = await fetch(`/api/crm/seguimiento/stats?${params}`);
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json();
    },
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

  // ─── Mutations ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/crm/seguimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error al crear cliente");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
      toast({ title: "Cliente creado", description: "El cliente se ha agregado al seguimiento." });
      setShowCreateModal(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/crm/seguimiento/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
    },
  });

  // Mover de etapa (kanban): update optimista sobre la key actual + rollback
  const moveEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoValue }) => {
      const res = await fetch(`/api/crm/seguimiento/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error("Error al actualizar el estado");
      return res.json();
    },
    onMutate: async ({ id, estado }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<any[]>(listKey);
      queryClient.setQueryData<any[]>(listKey, (old = []) =>
        old.map((c: any) => (c.id === id ? { ...c, estado } : c))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(listKey, ctx.prev);
      toast({ title: "Error", description: "No se pudo mover el cliente de etapa.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
    },
  });

  const hitoMutation = useMutation({
    mutationFn: async ({ id, tipo, descripcion }: { id: string; tipo: string; descripcion: string }) => {
      const res = await fetch(`/api/crm/seguimiento/${id}/hito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, descripcion }),
      });
      if (!res.ok) throw new Error("Error al registrar hito");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
      toast({ title: "Hito registrado", description: "La interacción quedó en el historial del cliente." });
      setHitoCliente(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ─── Selección masiva (vista Tabla) ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/crm/seguimiento/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al eliminar los leads");
      }
      return res.json();
    },
    onSuccess: (data: { deleted: number; requested: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
      setSelectedIds(new Set());
      toast({
        title: `${data.deleted} ${data.deleted === 1 ? "lead eliminado" : "leads eliminados"}`,
        description: data.deleted < data.requested
          ? `${data.requested - data.deleted} no se eliminaron (sin acceso o ya eliminados).`
          : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} ${ids.length === 1 ? "lead" : "leads"} del seguimiento? Esta acción los quita del pipeline.`)) return;
    bulkDeleteMutation.mutate(ids);
  };

  // ─── Handlers ────────────────────────────────────────────────────
  const handleViewClient = (client: any) => {
    // Embebido en el Panel de Trabajo: el detalle necesita saber el origen
    // para que "Volver" regrese a la pestaña CRM y no a la página antigua.
    navigate(`/seguimiento-clientes/${client.id}${embedded ? "?from=panel" : ""}`);
  };

  const toggleDestacado = (client: any) => {
    updateMutation.mutate(
      { id: client.id, data: { destacado: !client.destacado } },
      {
        onSuccess: () => {
          toast({
            title: client.destacado ? "Cliente quitado de destacados" : "Cliente destacado",
          });
        },
      }
    );
  };

  const toggleSortContacto = () => {
    setSortContacto((prev) => (prev === "desc" ? "asc" : prev === "asc" ? "none" : "desc"));
  };

  const handleMoveEstado = (client: any, estado: EstadoValue) => {
    if (normalizeEstado(client.estado) === estado) return;
    moveEstadoMutation.mutate({ id: client.id, estado });
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setBusquedaDebounced("");
    setFiltroEstado("todos");
    setFiltroPrioridad("todos");
    setFiltroVendedor("todos");
    setFiltroRegion("todos");
    // Embebido: el segmento sigue atado al Área, no se limpia a "todos".
    setFiltroSegmento(segmentoDesdeArea ?? "todos");
    setSoloDestacados(false);
  };

  // ─── Derived data ────────────────────────────────────────────────
  // Regiones disponibles según los datos vinculados de la lista cargada
  const uniqueRegiones = useMemo(() => (
    Array.from(
      new Set(
        clientes
          .map((c: any) => (c.linkedRegion || c.linkedProvincia || c.region || "").trim())
          .filter((r: string) => r && r !== "—")
      )
    ).sort() as string[]
  ), [clientes]);

  // Estado/región/segmento/destacados se filtran en cliente (estado, para
  // que normalizeEstado absorba los valores legacy; el resto no lo soporta
  // el endpoint)
  const filteredClientes = useMemo(() => clientes.filter((c: any) => {
    if (filtroEstado !== "todos" && normalizeEstado(c.estado) !== filtroEstado) return false;
    if (filtroRegion !== "todos") {
      const region = (c.linkedRegion || c.linkedProvincia || c.region || "").trim();
      if (region !== filtroRegion) return false;
    }
    if (filtroSegmento !== "todos") {
      const seg = (c.segmento || c.linkedSegmento || "").trim();
      if (seg !== filtroSegmento) return false;
    }
    if (soloDestacados && !c.destacado) return false;
    return true;
  }), [clientes, filtroEstado, filtroRegion, filtroSegmento, soloDestacados]);

  // Orden: destacados primero, luego problemas (opcional), luego último contacto
  const sortedClientes = useMemo(() => [...filteredClientes].sort((a: any, b: any) => {
    const aDest = a.destacado ? 1 : 0;
    const bDest = b.destacado ? 1 : 0;
    if (aDest !== bDest) return bDest - aDest;
    if (pinProblemas) {
      const aProb = a.hasProblema ? 1 : 0;
      const bProb = b.hasProblema ? 1 : 0;
      if (aProb !== bProb) return bProb - aProb;
    }
    if (sortContacto !== "none") {
      const aT = a.ultimoContacto ? new Date(a.ultimoContacto).getTime() : 0;
      const bT = b.ultimoContacto ? new Date(b.ultimoContacto).getTime() : 0;
      if (aT !== bT) return sortContacto === "asc" ? aT - bT : bT - aT;
    }
    return 0;
  }), [filteredClientes, pinProblemas, sortContacto]);

  // Agrupación para el kanban — normalizeEstado absorbe estados legacy
  const grupos = useMemo(() => {
    const map: Record<EstadoValue, any[]> = {
      prospecto: [], seguimiento: [], cotizacion: [], venta: [], perdido: [], despacho: [],
    };
    for (const c of sortedClientes) map[normalizeEstado(c.estado)].push(c);
    return map;
  }, [sortedClientes]);

  // Select-all opera sobre las filas visibles (filtradas + ordenadas)
  const allVisibleSelected = sortedClientes.length > 0 && sortedClientes.every((c: any) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(sortedClientes.map((c: any) => c.id)));
  };

  const activeFilterCount = [
    busqueda !== "",
    filtroEstado !== "todos",
    filtroPrioridad !== "todos",
    filtroVendedor !== "todos",
    filtroRegion !== "todos",
    filtroSegmento !== "todos",
    soloDestacados,
  ].filter(Boolean).length;

  // Filtros que el export replica en el server (mismo scope que el listado).
  const exportQuery = (() => {
    const p = new URLSearchParams();
    if (filtroVendedor !== "todos") p.set("vendedor", filtroVendedor);
    if (filtroPrioridad !== "todos") p.set("prioridad", filtroPrioridad);
    if (filtroEstado !== "todos") p.set("estado", filtroEstado);
    if (busquedaDebounced) p.set("busqueda", busquedaDebounced);
    return p.toString();
  })();

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" data-testid="seguimiento-clientes-page">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Seguimiento de Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pipeline CRM — gestiona prospectos y oportunidades de venta
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle de vista */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => changeView("tabla")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "tabla"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="btn-view-tabla"
              >
                <List className="w-3.5 h-3.5" />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => changeView("pipeline")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "pipeline"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="btn-view-pipeline"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Pipeline
              </button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowImportExport(true)}
              data-testid="btn-import-export"
              title="Importar o exportar leads (CSV)"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Importar / Exportar</span>
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="btn-nuevo-cliente"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          <KpiCard
            icon={Users}
            label="Total activos"
            shortLabel="Activos"
            value={String(stats?.total ?? filteredClientes.length)}
            iconBox="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
          />
          <KpiCard
            icon={UserCheck}
            label="Prospectos en seguimiento"
            shortLabel="Prospectos"
            value={String(stats?.prospectosEnSeguimiento ?? "—")}
            iconBox="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          />
          <KpiCard
            icon={Clock}
            label="Sin interacción (7+ días)"
            shortLabel="Sin interac."
            value={String(stats?.sinContacto7Dias ?? "—")}
            iconBox="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
            valueClass="text-amber-600 dark:text-amber-400"
          />
          <KpiCard
            icon={Banknote}
            label="Tiempo promedio de cierre"
            shortLabel="Cierre prom."
            value={stats?.tiempoCierrePromedioDias != null ? `${stats.tiempoCierrePromedioDias} días` : "—"}
            iconBox="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
          />
        </div>

        {/* Toolbar de filtros — administrador, supervisor y encargado de área.
            El supervisor/encargado ve los mismos filtros que el admin; sus datos ya vienen
            scopeados a su equipo desde el backend (getVendedorScope), así que los filtros
            operan solo sobre su cartera. Los vendedores no ven la toolbar (cartera propia). */}
        {isAdminOrSupervisor && (
        <div className="rounded-xl border bg-card shadow-sm p-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, empresa, RUT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
                data-testid="input-busqueda"
              />
            </div>

            {/* Filtros: en móvil una tira horizontal deslizable (estilo app);
                en desktop participan del flex-wrap normal (sm:contents) */}
            <div className="flex items-center gap-2 overflow-x-auto sm:overflow-visible sm:contents -mx-1 px-1 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[160px] shrink-0" data-testid="select-estado-filter">
                {filtroEstado === "todos" ? <span className="text-muted-foreground">Estado</span> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${e.dot}`} />
                      {e.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroPrioridad} onValueChange={setFiltroPrioridad}>
              <SelectTrigger className="w-[150px] shrink-0" data-testid="select-prioridad-filter">
                {filtroPrioridad === "todos" ? <span className="text-muted-foreground">Prioridad</span> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda prioridad</SelectItem>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAdminOrSupervisor && (
              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger className="w-[180px] shrink-0" data-testid="select-vendedor-filter">
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  {filtroVendedor === "todos" ? <span className="text-muted-foreground">Vendedor</span> : <SelectValue />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los vendedores</SelectItem>
                  {vendedores.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.salespersonName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filtroRegion} onValueChange={setFiltroRegion}>
              <SelectTrigger className="w-[180px] shrink-0" data-testid="select-region-filter">
                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                {filtroRegion === "todos" ? <span className="text-muted-foreground">Región</span> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las regiones</SelectItem>
                {uniqueRegiones.map((region: string) => (
                  <SelectItem key={region} value={region}>{fixEncoding(region)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Embebido en el Panel: el segmento lo gobierna la pestaña de Área → sin dropdown propio (evita el doble filtro). */}
            {!embedded && (
              <Select value={filtroSegmento} onValueChange={setFiltroSegmento}>
                <SelectTrigger className="w-[160px] shrink-0" data-testid="select-segmento-filter">
                  <Tags className="w-3.5 h-3.5 mr-1.5" />
                  {filtroSegmento === "todos" ? <span className="text-muted-foreground">Segmento</span> : <SelectValue />}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los segmentos</SelectItem>
                  {SEGMENTOS_CRM.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant={soloDestacados ? "default" : "outline"}
              size="sm"
              onClick={() => setSoloDestacados((v) => !v)}
              className={`shrink-0 ${soloDestacados ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
              data-testid="btn-filtro-destacados"
            >
              <Star className={`w-3.5 h-3.5 mr-1.5 ${soloDestacados ? "fill-current" : ""}`} />
              Destacados
            </Button>

            <Button
              variant={pinProblemas ? "default" : "outline"}
              size="sm"
              onClick={() => setPinProblemas((v) => !v)}
              className={`shrink-0 ${pinProblemas ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
              data-testid="btn-pin-problemas"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              Problemas primero
            </Button>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Badge variant="secondary" className="text-[10px]">
                  {activeFilterCount} {activeFilterCount === 1 ? "filtro activo" : "filtros activos"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={limpiarFiltros}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="btn-limpiar-filtros"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Barra de acciones de selección masiva */}
        {view === "tabla" && selectedIds.size > 0 && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-4 py-2.5 flex flex-wrap items-center gap-3" data-testid="bulk-actions-bar">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {selectedIds.size} {selectedIds.size === 1 ? "lead seleccionado" : "leads seleccionados"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 text-xs text-muted-foreground"
                data-testid="btn-cancelar-seleccion"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="h-7 text-xs"
                data-testid="btn-eliminar-seleccionados"
              >
                {bulkDeleteMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                )}
                Eliminar seleccionados
              </Button>
            </div>
          </div>
        )}

        {/* Contenido según vista */}
        {isLoading ? (
          <div className="rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Cargando clientes...</p>
          </div>
        ) : view === "tabla" ? (
          <TablaView
            clientes={sortedClientes}
            sortContacto={sortContacto}
            onToggleSort={toggleSortContacto}
            onToggleDestacado={toggleDestacado}
            onView={handleViewClient}
            onRegistrarHito={setHitoCliente}
            onNuevo={() => setShowCreateModal(true)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            allSelected={allVisibleSelected}
          />
        ) : (
          <PipelineView
            grupos={grupos}
            onCardClick={handleViewClient}
            onMove={handleMoveEstado}
            onRegistrarHito={setHitoCliente}
            onToggleDestacado={toggleDestacado}
            onNuevo={() => setShowCreateModal(true)}
          />
        )}
      </div>

      {/* Dialog: registrar hito rápido */}
      <RegistrarHitoDialog
        client={hitoCliente}
        onOpenChange={(open) => { if (!open) setHitoCliente(null); }}
        onSubmit={(tipo, descripcion) => {
          if (hitoCliente) hitoMutation.mutate({ id: hitoCliente.id, tipo, descripcion });
        }}
        isLoading={hitoMutation.isPending}
      />

      {/* Modal: nuevo cliente */}
      <CreateClientModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        vendedores={vendedores}
        isAdminOrSupervisor={isAdminOrSupervisor}
      />

      {/* Modal: importación / exportación masiva */}
      <ImportExportClientes
        open={showImportExport}
        onOpenChange={setShowImportExport}
        isAdminOrSupervisor={isAdminOrSupervisor}
        vendedores={vendedores}
        exportQuery={exportQuery}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
          queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
        }}
      />
    </div>
  );
}

const SeguimientoClientes = forwardRef<SeguimientoClientesHandle, { segmentoArea?: string }>(SeguimientoClientesInner);
export default SeguimientoClientes;

// ─── KPI card ─────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, shortLabel, value, iconBox, valueClass = "" }: {
  icon: any;
  label: string;
  shortLabel?: string;
  value: string;
  iconBox: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBox}`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-lg sm:text-2xl font-bold tracking-tight leading-none truncate ${valueClass}`}>{value}</p>
        {/* En móvil una etiqueta corta; en desktop la descripción completa */}
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5 sm:hidden">{shortLabel ?? label}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5 hidden sm:block">{label}</p>
      </div>
    </div>
  );
}

// ─── Badges compartidos entre vistas ──────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const config = getEstadoConfig(estado);
  return (
    <Badge className={`${config.badge} border-0 text-[10px] font-medium px-1.5 py-0 whitespace-nowrap`}>
      <config.icon className="w-2.5 h-2.5 mr-1" />
      {config.label}
    </Badge>
  );
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const config = getPrioridadConfig(prioridad);
  return (
    <Badge className={`${config.color} border-0 text-[10px] font-medium px-1.5 py-0 whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${config.dot}`} />
      {config.label}
    </Badge>
  );
}

/** Badge rojo cuando el próximo contacto agendado ya venció. */
function VencidoBadge({ proximoContacto }: { proximoContacto: string }) {
  return (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-[9px] font-medium px-1.5 py-0 whitespace-nowrap">
      {proximoContactoLabel(proximoContacto)}
    </Badge>
  );
}

// ─── Vista Tabla ──────────────────────────────────────────────────────
// Tabla nativa (no shadcn Table) para que el header sticky funcione dentro
// del mismo contenedor que scrollea en X e Y.
const TH_CLASS = "sticky top-0 z-10 bg-muted text-left h-9 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))]";

// Checkbox de selección: mismo affordance que el resto de la app
// (borde vacío vs indigo con check).
function SelectBox({ checked, onToggle, testId }: { checked: boolean; onToggle: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
        checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-input bg-background hover:border-indigo-400"
      }`}
      data-testid={testId}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  );
}

function TablaView({ clientes, sortContacto, onToggleSort, onToggleDestacado, onView, onRegistrarHito, onNuevo, selectedIds, onToggleSelect, onToggleSelectAll, allSelected }: {
  clientes: any[];
  sortContacto: "none" | "asc" | "desc";
  onToggleSort: () => void;
  onToggleDestacado: (client: any) => void;
  onView: (client: any) => void;
  onRegistrarHito: (client: any) => void;
  onNuevo: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground">
          {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} en seguimiento
        </p>
      </div>
      {/* ─── Vista móvil: tarjetas compactas (prioridad al cliente) ─── */}
      <div className="sm:hidden divide-y divide-border/60">
        {clientes.map((client: any) => {
          const isStale = isStaleContact(client);
          return (
            <div
              key={client.id}
              onClick={() => onView(client)}
              className={`flex items-start gap-3 px-3 py-3 cursor-pointer active:bg-indigo-50/60 dark:active:bg-indigo-950/30 transition-colors ${
                client.destacado ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
              }`}
              data-testid={`card-cliente-${client.id}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggleDestacado(client); }}
                className="pt-0.5 shrink-0"
                data-testid={`btn-destacar-m-${client.id}`}
              >
                <Star className={`w-4 h-4 ${client.destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"}`} />
              </button>
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                {getInitials(client.nombre)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-sm text-foreground truncate">{fixEncoding(client.nombre)}</p>
                  {client.hasProblema && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>
                {client.empresa && client.empresa !== client.nombre && (
                  <p className="text-xs text-muted-foreground truncate">{fixEncoding(client.empresa)}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <EstadoBadge estado={client.estado} />
                  <PrioridadBadge prioridad={client.prioridad} />
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                  <span className={`inline-flex items-center gap-1 font-medium ${isStale ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    <Clock className="w-3 h-3" />
                    {timeAgo(client.ultimoContacto)}
                  </span>
                  {client.proximoContacto && (
                    <span className={`inline-flex items-center gap-1 ${isOverdue(client.proximoContacto) ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      <CalendarClock className="w-3 h-3" />
                      {formatDate(client.proximoContacto)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-2" />
            </div>
          );
        })}
        {clientes.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No se encontraron clientes</p>
            <p className="text-xs mt-1 mb-4">Ajusta los filtros o crea un nuevo cliente</p>
            <Button variant="outline" size="sm" onClick={onNuevo}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuevo Cliente
            </Button>
          </div>
        )}
      </div>

      {/* ─── Vista desktop: tabla completa ─── */}
      <div className="hidden sm:block overflow-auto max-h-[calc(100vh-240px)]">
        <table className="w-full min-w-[1300px] text-sm">
          <thead>
            <tr>
              <th className={`${TH_CLASS} pl-4 w-[36px]`}>
                <SelectBox checked={allSelected} onToggle={onToggleSelectAll} testId="checkbox-select-all" />
              </th>
              <th className={`${TH_CLASS} w-[36px]`}></th>
              <th className={`${TH_CLASS} min-w-[190px]`}>Cliente</th>
              <th className={`${TH_CLASS} w-[90px]`}>Estado</th>
              <th className={`${TH_CLASS} w-[80px]`}>Prioridad</th>
              <th
                className={`${TH_CLASS} w-[95px] cursor-pointer select-none hover:text-foreground`}
                onClick={onToggleSort}
                data-testid="th-contacto-sort"
              >
                <span className="inline-flex items-center gap-1">
                  Contacto
                  {sortContacto === "asc" ? <ArrowUp className="w-3 h-3" /> : sortContacto === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-50" />}
                </span>
              </th>
              <th className={`${TH_CLASS} w-[110px]`}>Próx. contacto</th>
              <th className={`${TH_CLASS} w-[100px]`}>Región</th>
              <th className={`${TH_CLASS} w-[90px]`}>Segmento</th>
              <th className={`${TH_CLASS} w-[110px]`}>Teléfono</th>
              <th className={`${TH_CLASS} w-[100px]`}>Cond. Pago</th>
              <th className={`${TH_CLASS} w-[120px]`}>Vendedor</th>
              <th className={`${TH_CLASS} w-[85px]`}>Últ. Pedido</th>
              <th className={`${TH_CLASS} pr-4 w-[44px] text-right`}></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((client: any) => {
              const isStale = isStaleContact(client);
              const isSelected = selectedIds.has(client.id);
              return (
                <tr
                  key={client.id}
                  className={`group cursor-pointer border-b border-border/60 last:border-0 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors ${
                    isSelected ? "bg-indigo-50/70 dark:bg-indigo-950/30" : client.destacado ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
                  }`}
                  onClick={() => onView(client)}
                >
                  {/* Selección */}
                  <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                    <SelectBox
                      checked={isSelected}
                      onToggle={() => onToggleSelect(client.id)}
                      testId={`checkbox-lead-${client.id}`}
                    />
                  </td>
                  {/* Destacado */}
                  <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onToggleDestacado(client)}
                          className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          data-testid={`btn-destacar-${client.id}`}
                        >
                          <Star className={`w-4 h-4 transition-colors ${client.destacado ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40 hover:text-amber-500"}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {client.destacado ? "Quitar de destacados" : "Marcar como destacado"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {/* Cliente */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {getInitials(client.nombre)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="font-semibold text-xs text-foreground truncate">{fixEncoding(client.nombre)}</p>
                          {client.hasProblema && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" data-testid={`icon-problema-${client.id}`} />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Tiene un problema registrado en la bitácora
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {client.empresa && client.empresa !== client.nombre && (
                          <p className="text-[10px] text-muted-foreground truncate">{fixEncoding(client.empresa)}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Estado */}
                  <td className="py-2.5 px-2">
                    <EstadoBadge estado={client.estado} />
                  </td>
                  {/* Prioridad */}
                  <td className="py-2.5 px-2">
                    <PrioridadBadge prioridad={client.prioridad} />
                  </td>
                  {/* Contacto */}
                  <td className="py-2.5 px-2">
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-semibold ${isStale ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {timeAgo(client.ultimoContacto)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDate(client.ultimoContacto)}
                      </span>
                    </div>
                  </td>
                  {/* Próximo contacto */}
                  <td className="py-2.5 px-2">
                    {client.proximoContacto ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-[11px] whitespace-nowrap">{formatDate(client.proximoContacto)}</span>
                        {isOverdue(client.proximoContacto) && (
                          <VencidoBadge proximoContacto={client.proximoContacto} />
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                  {/* Región */}
                  <td className="py-2.5 px-2">
                    <span className="text-[11px] text-foreground/80 truncate block max-w-[110px]">
                      {fixEncoding(client.linkedRegion || client.linkedProvincia || client.region) || "—"}
                    </span>
                  </td>
                  {/* Segmento */}
                  <td className="py-2.5 px-2">
                    {(client.segmento || client.linkedSegmento) ? (
                      <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700">
                        {client.segmento || client.linkedSegmento}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                  {/* Teléfono */}
                  <td className="py-2.5 px-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] tabular-nums truncate max-w-[120px]">{client.linkedFoen || client.telefono || "—"}</span>
                      {(client.contactoEncargado || client.linkedPurchasingContact) && (
                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[120px]">
                          {fixEncoding(client.contactoEncargado || client.linkedPurchasingContact)}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Condición Pago */}
                  <td className="py-2.5 px-2">
                    {(client.condicionPago || client.linkedCpen?.trim()) ? (
                      <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 border-slate-200 dark:border-slate-700 whitespace-nowrap">
                        {client.condicionPago || client.linkedCpen.trim()}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                  {/* Vendedor */}
                  <td className="py-2.5 px-2">
                    <span className="text-[11px] font-medium text-foreground/70 truncate block max-w-[130px]">{client.vendedorNombre || "—"}</span>
                  </td>
                  {/* Último Pedido */}
                  <td className="py-2.5 px-2">
                    <span className="text-[11px] text-foreground/70 whitespace-nowrap">
                      {client.ultimaCompraDate ? formatDate(client.ultimaCompraDate) : "—"}
                    </span>
                  </td>
                  {/* Acciones */}
                  <td className="py-2.5 px-2 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                          data-testid={`btn-menu-${client.id}`}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onView(client)} className="text-xs">
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRegistrarHito(client)} className="text-xs">
                          <MessageSquare className="w-3.5 h-3.5 mr-2" />
                          Registrar hito
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={14} className="text-center py-14 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No se encontraron clientes</p>
                  <p className="text-xs mt-1 mb-4">Intenta ajustar los filtros o crear un nuevo cliente</p>
                  <Button variant="outline" size="sm" onClick={onNuevo}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nuevo Cliente
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Vista Pipeline (kanban) ──────────────────────────────────────────
function PipelineView({ grupos, onCardClick, onMove, onRegistrarHito, onToggleDestacado, onNuevo }: {
  grupos: Record<EstadoValue, any[]>;
  onCardClick: (client: any) => void;
  onMove: (client: any, estado: EstadoValue) => void;
  onRegistrarHito: (client: any) => void;
  onToggleDestacado: (client: any) => void;
  onNuevo: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  // Marca temporal del último dragEnd: evita que el drop dispare el click de la card
  const dragEndAtRef = useRef(0);

  const allClients = useMemo(() => Object.values(grupos).flat(), [grupos]);

  const handleDrop = (e: React.DragEvent, estado: EstadoValue) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (!id) return;
    const client = allClients.find((c: any) => c.id === id);
    if (client) onMove(client, estado);
  };

  const handleCardClick = (client: any) => {
    // Ignorar el click residual que algunos navegadores emiten tras soltar el drag
    if (Date.now() - dragEndAtRef.current < 250) return;
    onCardClick(client);
  };

  const handleDragEnd = () => {
    dragEndAtRef.current = Date.now();
    setDragId(null);
  };

  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {ESTADOS.map((estado) => (
        <KanbanColumn
          key={estado.value}
          estado={estado}
          items={grupos[estado.value] || []}
          dragId={dragId}
          onDrop={handleDrop}
          onCardClick={handleCardClick}
          onDragStartCard={setDragId}
          onDragEndCard={handleDragEnd}
          onRegistrarHito={onRegistrarHito}
          onMove={onMove}
          onToggleDestacado={onToggleDestacado}
          onNuevo={onNuevo}
        />
      ))}
    </div>
  );
}

// Columna del kanban con su PROPIO estado de drag-target: cruzar el cursor
// entre columnas durante un drag solo re-renderiza la columna hovereada,
// no las 5 columnas con todas sus cards.
function KanbanColumn({ estado, items, dragId, onDrop, onCardClick, onDragStartCard, onDragEndCard, onRegistrarHito, onMove, onToggleDestacado, onNuevo }: {
  estado: (typeof ESTADOS)[number];
  items: any[];
  dragId: string | null;
  onDrop: (e: React.DragEvent, estado: EstadoValue) => void;
  onCardClick: (client: any) => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onRegistrarHito: (client: any) => void;
  onMove: (client: any, estado: EstadoValue) => void;
  onToggleDestacado: (client: any) => void;
  onNuevo: () => void;
}) {
  const [isDragTarget, setIsDragTarget] = useState(false);

  return (
    <div
      className={`flex-shrink-0 w-[290px] rounded-xl border flex flex-col ${estado.column} ${
        isDragTarget ? "ring-2 ring-indigo-400 dark:ring-indigo-600 border-transparent" : estado.border
      } transition-shadow`}
      onDragOver={(e) => { e.preventDefault(); setIsDragTarget(true); }}
      onDragLeave={(e) => {
        // Solo limpiar si realmente se salió de la columna (no de un hijo)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragTarget(false);
      }}
      onDrop={(e) => { setIsDragTarget(false); onDrop(e, estado.value); }}
      data-testid={`kanban-col-${estado.value}`}
    >
      {/* Header de columna */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-inherit">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${estado.dot}`} />
        <span className="text-xs font-semibold text-foreground">{estado.label}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[240px] max-h-[calc(100vh-380px)]">
        {items.map((client: any) => (
          <KanbanCard
            key={client.id}
            client={client}
            isDragging={dragId === client.id}
            onClick={() => onCardClick(client)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", client.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStartCard(client.id);
            }}
            onDragEnd={() => { setIsDragTarget(false); onDragEndCard(); }}
            onRegistrarHito={() => onRegistrarHito(client)}
            onMove={(nuevoEstado) => onMove(client, nuevoEstado)}
            onToggleDestacado={() => onToggleDestacado(client)}
          />
        ))}
        {items.length === 0 && (
          <div className="border border-dashed rounded-lg py-8 px-3 text-center text-muted-foreground">
            <estado.icon className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-medium">Sin clientes en esta etapa</p>
            <Button variant="ghost" size="sm" onClick={onNuevo} className="h-7 text-xs mt-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
              <Plus className="w-3 h-3 mr-1" />
              Nuevo cliente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({ client, isDragging, onClick, onDragStart, onDragEnd, onRegistrarHito, onMove, onToggleDestacado }: {
  client: any;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRegistrarHito: () => void;
  onMove: (estado: EstadoValue) => void;
  onToggleDestacado: () => void;
}) {
  const estadoActual = normalizeEstado(client.estado);
  const monto = parseFloat(client.montoEstimado) || 0;
  const vencido = isOverdue(client.proximoContacto);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group rounded-lg border bg-card shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
      data-testid={`card-kanban-${client.id}`}
    >
      {/* Nombre + indicadores + menú */}
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {client.destacado && <Star className="w-3 h-3 fill-amber-400 text-amber-500 flex-shrink-0" />}
            {client.hasProblema && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" data-testid={`icon-problema-${client.id}`} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Tiene un problema registrado en la bitácora
                </TooltipContent>
              </Tooltip>
            )}
            <p className="font-semibold text-xs text-foreground truncate">{fixEncoding(client.nombre)}</p>
          </div>
          {client.empresa && client.empresa !== client.nombre && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{fixEncoding(client.empresa)}</p>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 -mt-1 -mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                data-testid={`btn-menu-kanban-${client.id}`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onClick} className="text-xs">
                <Eye className="w-3.5 h-3.5 mr-2" />
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRegistrarHito} className="text-xs">
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                Registrar hito
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleDestacado} className="text-xs">
                <Star className={`w-3.5 h-3.5 mr-2 ${client.destacado ? "fill-amber-400 text-amber-500" : ""}`} />
                {client.destacado ? "Quitar destacado" : "Destacar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Alternativa táctil al drag & drop */}
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Mover a…</DropdownMenuLabel>
              {ESTADOS.map((e) => (
                <DropdownMenuItem
                  key={e.value}
                  onClick={() => onMove(e.value)}
                  disabled={e.value === estadoActual}
                  className="text-xs"
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${e.dot}`} />
                  {e.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        <PrioridadBadge prioridad={client.prioridad} />
        {(client.segmento || client.linkedSegmento) && (
          <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700">
            {client.segmento || client.linkedSegmento}
          </Badge>
        )}
        {vencido && <VencidoBadge proximoContacto={client.proximoContacto} />}
      </div>

      {/* Monto estimado */}
      {monto > 0 && (
        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
          {formatCLP(monto)}
        </p>
      )}

      {/* Footer: último contacto + avatar del vendedor */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
        <span className={`inline-flex items-center gap-1 text-[10px] ${isStaleContact(client) ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          <Clock className="w-3 h-3" />
          {timeAgo(client.ultimoContacto)}
        </span>
        {client.vendedorNombre && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                {getInitials(client.vendedorNombre)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {fixEncoding(client.vendedorNombre)}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ─── Dialog: registrar hito rápido ────────────────────────────────────
function RegistrarHitoDialog({ client, onOpenChange, onSubmit, isLoading }: {
  client: any;
  onOpenChange: (open: boolean) => void;
  onSubmit: (tipo: string, descripcion: string) => void;
  isLoading: boolean;
}) {
  const [tipo, setTipo] = useState("contacto");
  const [descripcion, setDescripcion] = useState("");
  const open = !!client;

  // Resetear el formulario cada vez que se abre para un cliente
  useEffect(() => {
    if (open) {
      setTipo("contacto");
      setDescripcion("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar hito</DialogTitle>
          <DialogDescription>
            {client ? `Nueva interacción con ${fixEncoding(client.nombre)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Tipo de Hito</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {HITO_TIPOS.filter((h) => h.value !== "sistema").map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => setTipo(h.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                    tipo === h.value
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <h.icon className={`w-4 h-4 ${h.color}`} />
                  {h.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Descripción *</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle de la interacción..."
              rows={3}
              data-testid="input-hito-descripcion"
            />
          </div>
          <Button
            onClick={() => onSubmit(tipo, descripcion.trim())}
            disabled={isLoading || !descripcion.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="btn-agregar-hito"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Registrar Hito
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: nuevo cliente ─────────────────────────────────────────────
const EMPTY_FORM = {
  nombre: "", telefono: "", email: "", empresa: "", rut: "", comuna: "", notas: "",
  origen: "manual", vendedorId: "", segmento: "",
  estado: "prospecto", prioridad: "media",
  region: "", contactoEncargado: "", condicionPago: "", clienteId: "",
};

function CreateClientModal({ open, onOpenChange, onSubmit, isLoading, vendedores, isAdminOrSupervisor }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  vendedores: any[];
  isAdminOrSupervisor: boolean;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<any>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Comunas existentes (autocomplete, mismo endpoint que el detalle)
  const { data: comunasSugeridas = [] } = useQuery<string[]>({
    queryKey: ["/api/crm/comunas"],
    queryFn: async () => {
      const res = await fetch("/api/crm/comunas");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  // El formulario se limpia al ABRIR el modal, no al enviar: si el POST
  // falla, el modal queda abierto y el usuario conserva lo que escribió.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM });
      setSearchQuery("");
      setSelectedExisting(null);
      setSearchResults([]);
      setShowSuggestions(false);
    }
  }, [open]);

  // Autocomplete contra la base de clientes del ERP mientras se escribe
  const handleNameSearch = async (value: string) => {
    setSearchQuery(value);
    setForm((f) => ({ ...f, nombre: value }));
    setSelectedExisting(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/clients/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.slice(0, 8));
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
      setIsSearching(false);
    }, 300);
  };

  const handleSelectClient = (client: any) => {
    setSelectedExisting(client);
    setForm((f) => ({
      ...f,
      nombre: client.nokoen || client.name || "",
      rut: client.rten || client.rut || "",
      email: client.email || "",
      empresa: client.nokoen || "",
      telefono: client.foen || client.phone || f.telefono,
      comuna: client.comuna ? fixEncoding(client.comuna) : f.comuna,
      // Campos extra auto-rellenados desde la base de clientes
      region: client.region ? fixEncoding(client.region) : f.region,
      contactoEncargado: (client.purchasingContactName || client.cnen)
        ? fixEncoding(client.purchasingContactName || client.cnen)
        : f.contactoEncargado,
      condicionPago: (client.cpen || "").trim() || f.condicionPago,
      // Garantiza el vínculo con el cliente maestro (independiente del RUT)
      clienteId: client.id || "",
    }));
    setSearchQuery(client.nokoen || client.name || "");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      vendedorId: form.vendedorId || undefined,
      segmento: form.segmento || undefined,
      comuna: form.comuna.trim() || undefined,
      region: form.region.trim() || undefined,
      contactoEncargado: form.contactoEncargado.trim() || undefined,
      condicionPago: form.condicionPago.trim() || undefined,
      clienteId: form.clienteId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            Nuevo Cliente en Seguimiento
          </DialogTitle>
          <DialogDescription>
            Busca un cliente existente o ingresa los datos manualmente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            {/* Nombre con autocomplete */}
            <div className="col-span-2 relative">
              <Label htmlFor="nombre">Nombre *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  value={searchQuery}
                  onChange={(e) => handleNameSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  required
                  placeholder="Buscar cliente existente o escribir nombre nuevo..."
                  className="pl-9"
                  autoComplete="off"
                  data-testid="input-nombre"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
              </div>
              {selectedExisting && (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Cliente existente vinculado — RUT: {selectedExisting.rten || "Sin RUT"}
                  </span>
                  <button type="button" onClick={() => { setSelectedExisting(null); setSearchQuery(""); setForm((f) => ({ ...f, nombre: "", rut: "", email: "", empresa: "", comuna: "", region: "", contactoEncargado: "", condicionPago: "", clienteId: "" })); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Sugerencias */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.map((c: any, i: number) => (
                    <button
                      key={c.id || c.koen || i}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-0 flex items-center gap-3"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectClient(c); }}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.nokoen || c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.rten && <span className="font-mono mr-2">RUT: {c.rten}</span>}
                          {c.email && <span>{c.email}</span>}
                        </p>
                      </div>
                    </button>
                  ))}
                  <div className="px-3 py-2 bg-muted/20 text-xs text-muted-foreground border-t">
                    <span className="font-medium">¿No encuentras al cliente?</span> Escribe el nombre completo para crear uno nuevo.
                  </div>
                </div>
              )}
              {showSuggestions && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg p-3 text-center">
                  <p className="text-sm text-muted-foreground">No se encontraron clientes con "<span className="font-medium text-foreground">{searchQuery}</span>"</p>
                  <p className="text-xs text-muted-foreground mt-1">Se creará como cliente nuevo</p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="+56 9..." />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.cl" />
            </div>
            <div>
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Nombre de empresa" />
            </div>
            <div>
              <Label htmlFor="rut">RUT (opcional)</Label>
              <Input id="rut" value={form.rut} onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
            </div>
            <div>
              <Label htmlFor="comuna">Comuna</Label>
              <Input
                id="comuna"
                list="comunas-sugeridas"
                value={form.comuna}
                onChange={(e) => setForm((f) => ({ ...f, comuna: e.target.value }))}
                placeholder="Escribir o seleccionar comuna..."
                autoComplete="off"
                data-testid="input-comuna"
              />
              <datalist id="comunas-sugeridas">
                {comunasSugeridas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="region">Región</Label>
              <Input id="region" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Región" data-testid="input-region" />
            </div>
            <div>
              <Label htmlFor="contactoEncargado">Contacto encargado</Label>
              <Input id="contactoEncargado" value={form.contactoEncargado} onChange={(e) => setForm((f) => ({ ...f, contactoEncargado: e.target.value }))} placeholder="Nombre del contacto" data-testid="input-contacto" />
            </div>
            <div>
              <Label htmlFor="condicionPago">Condición de pago</Label>
              <Input id="condicionPago" value={form.condicionPago} onChange={(e) => setForm((f) => ({ ...f, condicionPago: e.target.value }))} placeholder="CONTADO, CRÉDITO 30 DÍAS..." data-testid="input-condicion-pago" />
            </div>
            <div>
              <Label htmlFor="segmento">Segmento</Label>
              <Select value={form.segmento} onValueChange={(v) => setForm((f) => ({ ...f, segmento: v }))}>
                <SelectTrigger id="segmento"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS_CRM.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estado-inicial">Estado inicial</Label>
              <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}>
                <SelectTrigger id="estado-inicial" data-testid="select-estado-inicial"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${e.dot}`} />
                        {e.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="prioridad">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => setForm((f) => ({ ...f, prioridad: v }))}>
                <SelectTrigger id="prioridad" data-testid="select-prioridad-inicial"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="origen">Origen</Label>
              <Select value={form.origen} onValueChange={(v) => setForm((f) => ({ ...f, origen: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="digital_organico">Digital Orgánico</SelectItem>
                  <SelectItem value="digital_pagado">Digital Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdminOrSupervisor && (
              <div>
                <Label htmlFor="vendedor">Asignar a Vendedor</Label>
                <Select value={form.vendedorId} onValueChange={(v) => setForm((f) => ({ ...f, vendedorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.salespersonName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label htmlFor="notas">Notas Iniciales</Label>
              <Textarea id="notas" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Contexto del cliente, interés, productos..." rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={isLoading || !form.nombre}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="btn-submit-crear"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear Cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
