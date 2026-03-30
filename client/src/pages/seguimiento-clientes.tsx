import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, Mail, Building2, User, Plus, Search, X,
  Clock, CalendarDays, MessageSquare, PhoneCall, FileText,
  MapPin, AlertTriangle, CheckCircle2, Truck, ShoppingCart,
  UserCheck, Send, Link2, Sparkles, MoreVertical, Trash2, Edit3, RefreshCw, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// ─── Constants ────────────────────────────────────────────────────────
const ESTADOS = [
  { value: "cotizacion", label: "Cotización", icon: FileText, color: "from-amber-400 to-amber-600", bgCard: "bg-amber-50 dark:bg-amber-900/20", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  { value: "venta", label: "Venta", icon: ShoppingCart, color: "from-emerald-400 to-emerald-600", bgCard: "bg-emerald-50 dark:bg-emerald-900/20", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  { value: "despacho", label: "Despacho", icon: Truck, color: "from-purple-400 to-purple-600", bgCard: "bg-purple-50 dark:bg-purple-900/20", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
];

const PRIORIDADES = [
  { value: "baja", label: "Baja", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { value: "media", label: "Media", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  { value: "alta", label: "Alta", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
];

const HITO_TIPOS = [
  { value: "contacto", label: "Contacto", icon: UserCheck, color: "text-blue-500" },
  { value: "llamada", label: "Llamada", icon: PhoneCall, color: "text-indigo-500" },
  { value: "cotizacion", label: "Cotización", icon: FileText, color: "text-amber-500" },
  { value: "visita", label: "Visita", icon: MapPin, color: "text-green-500" },
  { value: "venta", label: "Venta", icon: ShoppingCart, color: "text-emerald-600" },
  { value: "despacho", label: "Despacho", icon: Truck, color: "text-purple-500" },
  { value: "nota", label: "Nota", icon: MessageSquare, color: "text-slate-500" },
  { value: "sistema", label: "Sistema", icon: RefreshCw, color: "text-cyan-500" },
];

function getEstadoConfig(estado: string) {
  return ESTADOS.find(e => e.value === estado) || ESTADOS[0];
}

function getPrioridadConfig(prioridad: string) {
  return PRIORIDADES.find(p => p.value === prioridad) || PRIORIDADES[1];
}

function getHitoConfig(tipo: string) {
  return HITO_TIPOS.find(h => h.value === tipo) || HITO_TIPOS[6];
}

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "Sin contacto";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  return `Hace ${Math.floor(diffDays / 30)} mes(es)`;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main Component ───────────────────────────────────────────────────
export default function SeguimientoClientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const isAdminOrSupervisor = user?.role === "admin" || user?.role === "supervisor";

  // ─── Queries ─────────────────────────────────────────────────────
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["/api/crm/seguimiento", filtroVendedor, filtroEstado, busqueda],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroVendedor !== "todos") params.set("vendedor", filtroVendedor);
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      if (busqueda) params.set("busqueda", busqueda);
      const res = await fetch(`/api/crm/seguimiento?${params}`);
      if (!res.ok) throw new Error("Error al cargar clientes");
      return res.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/crm/seguimiento/stats", filtroVendedor],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroVendedor !== "todos") params.set("vendedor", filtroVendedor);
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/seguimiento/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento/stats"] });
      setShowDetailModal(false);
      setSelectedClient(null);
      toast({ title: "Cliente eliminado" });
    },
  });



  const handleViewClient = async (client: any) => {
    try {
      const res = await fetch(`/api/crm/seguimiento/${client.id}`);
      if (!res.ok) throw new Error("Error al cargar detalle");
      const detail = await res.json();
      setSelectedClient(detail);
      setShowDetailModal(true);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el detalle del cliente", variant: "destructive" });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" data-testid="seguimiento-clientes-page">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Seguimiento de Clientes
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pipeline CRM — gestiona prospectos y oportunidades de venta
              </p>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/30"
              data-testid="btn-nuevo-cliente"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
              <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 dark:border-indigo-800/30 p-3">
                <p className="text-xs text-muted-foreground font-medium">Total Activos</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total || 0}</p>
              </div>
              {ESTADOS.slice(0, 4).map(e => (
                <div key={e.value} className={`rounded-xl ${e.bgCard} border ${e.border} p-3`}>
                  <p className="text-xs text-muted-foreground font-medium">{e.label}</p>
                  <p className="text-2xl font-bold">{stats.porEstado?.[e.value] || 0}</p>
                </div>
              ))}
              {stats.sinContacto7Dias > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-200/50 dark:border-red-800/30 p-3">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    Sin contacto 7d
                  </p>
                  <p className="text-2xl font-bold text-red-600">{stats.sinContacto7Dias}</p>
                </div>
              )}
            </div>
          )}

          {/* Estado tag filters */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4">
            <button
              onClick={() => setFiltroEstado("todos")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${filtroEstado === "todos" ? "bg-foreground text-background shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            >
              Todos
            </button>
            {ESTADOS.map(e => (
              <button
                key={e.value}
                onClick={() => setFiltroEstado(filtroEstado === e.value ? "todos" : e.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${filtroEstado === e.value ? `bg-gradient-to-r ${e.color} text-white shadow-sm` : `${e.badge} hover:opacity-80`}`}
              >
                <e.icon className="w-3 h-3" />
                {e.label}
                {stats?.porEstado?.[e.value] ? <span className="ml-0.5 opacity-70">({stats.porEstado[e.value]})</span> : null}
              </button>
            ))}
          </div>

          {/* Search and vendor filter */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, empresa, RUT..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 bg-background/50"
                data-testid="input-busqueda"
              />
            </div>

            {isAdminOrSupervisor && (
              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger className="w-[180px]" data-testid="select-vendedor-filter">
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los vendedores</SelectItem>
                  {vendedores.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.salespersonName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

          </div>
        </div>
      </div>

      {/* Content — Card Grid */}
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-lg">No hay clientes en seguimiento</p>
            <p className="text-sm mt-1">Crea un nuevo cliente para comenzar el pipeline</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clientes.map((client: any) => (
              <ClientCard key={client.id} client={client} onClick={() => handleViewClient(client)} onUpdateEstado={(id, estado) => updateMutation.mutate({ id, data: { estado } })} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateClientModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
        vendedores={vendedores}
        isAdminOrSupervisor={isAdminOrSupervisor}
      />

      {/* Detail Modal */}
      {selectedClient && (
        <ClientDetailModal
          open={showDetailModal}
          onOpenChange={(open) => {
            setShowDetailModal(open);
            if (!open) setSelectedClient(null);
          }}
          client={selectedClient}
          onDelete={() => deleteMutation.mutate(selectedClient.id)}
          onRefresh={() => handleViewClient(selectedClient)}
          vendedores={vendedores}
          isAdminOrSupervisor={isAdminOrSupervisor}
          onUpdateVendedor={(vendedorId: string) => updateMutation.mutate({ id: selectedClient.id, data: { vendedorId } })}
        />
      )}
    </div>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────
function ClientCard({ client, onClick, onUpdateEstado }: {
  client: any;
  onClick: () => void;
  onUpdateEstado: (id: string, estado: string) => void;
}) {
  const estadoConfig = getEstadoConfig(client.estado);
  const lastContact = timeAgo(client.ultimoContacto);
  const isStale = !client.ultimoContacto || (new Date().getTime() - new Date(client.ultimoContacto).getTime()) > 7 * 24 * 60 * 60 * 1000;

  return (
    <div
      className="group relative bg-background rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-indigo-300 dark:hover:border-indigo-700 overflow-hidden"
      onClick={onClick}
      data-testid={`card-client-${client.id}`}
    >
      {/* Estado color bar */}
      <div className={`h-1.5 bg-gradient-to-r ${estadoConfig.color}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base truncate">{client.nombre}</h4>
            {client.empresa && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.empresa}</p>
            )}
          </div>
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`inline-flex items-center text-[10px] px-2 py-0.5 h-5 rounded-full font-medium ${estadoConfig.badge} border-0 flex-shrink-0 ml-2 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition-all`}>
                  <estadoConfig.icon className="w-3 h-3 mr-1" />
                  {estadoConfig.label}
                  <ChevronDown className="w-2.5 h-2.5 ml-1 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {ESTADOS.map(e => (
                  <DropdownMenuItem
                    key={e.value}
                    onClick={() => onUpdateEstado(client.id, e.value)}
                    disabled={e.value === client.estado}
                    className="text-xs"
                  >
                    <e.icon className="w-3.5 h-3.5 mr-2" />
                    {e.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Info items with icons */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <span className="text-muted-foreground truncate">{client.vendedorNombre}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${isStale ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Clock className={`w-3.5 h-3.5 ${isStale ? 'text-red-500' : 'text-slate-500'}`} />
            </div>
            <span className={`${isStale ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{lastContact}</span>
          </div>

          {client.rut && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-3.5 h-3.5 text-green-500" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">{client.rut}</span>
            </div>
          )}

          {client.telefono && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-muted-foreground">{client.telefono}</span>
            </div>
          )}
        </div>

        {/* Last hito preview */}
        {client.ultimoHito && (
          <div className="mt-3 pt-3 border-t border-dashed">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                {(() => { const H = getHitoConfig(client.ultimoHito.tipo); return <H.icon className={`w-3 h-3 ${H.color}`} />; })()}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                <span className="font-medium text-foreground/80">{getHitoConfig(client.ultimoHito.tipo).label}:</span>{" "}
                {client.ultimoHito.descripcion}
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Create Client Modal ──────────────────────────────────────────────
function CreateClientModal({ open, onOpenChange, onSubmit, isLoading, vendedores, isAdminOrSupervisor }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  vendedores: any[];
  isAdminOrSupervisor: boolean;
}) {
  const [form, setForm] = useState({
    nombre: "", telefono: "", email: "", empresa: "", rut: "", notas: "",
    origen: "manual", vendedorId: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedExisting, setSelectedExisting] = useState<any>(null);
  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);

  // Search clients as user types
  const handleNameSearch = async (value: string) => {
    setSearchQuery(value);
    setForm(f => ({ ...f, nombre: value }));
    setSelectedExisting(null);

    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef[0] = setTimeout(async () => {
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
    setForm(f => ({
      ...f,
      nombre: client.nokoen || client.name || "",
      rut: client.rten || client.rut || "",
      email: client.email || "",
      empresa: client.nokoen || "",
      telefono: client.foen || client.phone || f.telefono,
    }));
    setSearchQuery(client.nokoen || client.name || "");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      vendedorId: form.vendedorId || undefined,
    });
    setForm({ nombre: "", telefono: "", email: "", empresa: "", rut: "", notas: "", origen: "manual", vendedorId: "" });
    setSearchQuery("");
    setSelectedExisting(null);
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
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
            {/* Nombre with autocomplete */}
            <div className="col-span-2 relative">
              <Label htmlFor="nombre">Nombre *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  value={searchQuery}
                  onChange={e => handleNameSearch(e.target.value)}
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
                  <button type="button" onClick={() => { setSelectedExisting(null); setSearchQuery(""); setForm(f => ({ ...f, nombre: "", rut: "", email: "", empresa: "" })); }} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Dropdown suggestions */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {searchResults.map((c: any, i: number) => (
                    <button
                      key={c.id || c.koen || i}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b last:border-0 flex items-center gap-3"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectClient(c); }}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center flex-shrink-0">
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
              <Input id="telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+56 9..." />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.cl" />
            </div>
            <div>
              <Label htmlFor="empresa">Empresa</Label>
              <Input id="empresa" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Nombre de empresa" />
            </div>
            <div>
              <Label htmlFor="rut">RUT (opcional)</Label>
              <Input id="rut" value={form.rut} onChange={e => setForm(f => ({ ...f, rut: e.target.value }))} placeholder="12.345.678-9" />
            </div>
            <div>
              <Label htmlFor="origen">Origen</Label>
              <Select value={form.origen} onValueChange={v => setForm(f => ({ ...f, origen: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="referido">Referido</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="llamada">Llamada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdminOrSupervisor && (
              <div>
                <Label htmlFor="vendedor">Asignar a Vendedor</Label>
                <Select value={form.vendedorId} onValueChange={v => setForm(f => ({ ...f, vendedorId: v }))}>
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
              <Textarea id="notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Contexto del cliente, interés, productos..." rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              disabled={isLoading || !form.nombre}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
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

// ─── Client Detail Modal ──────────────────────────────────────────────
function ClientDetailModal({ open, onOpenChange, client, onDelete, onRefresh, vendedores, isAdminOrSupervisor, onUpdateVendedor }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: any;
  onDelete: () => void;
  onRefresh: () => void;
  vendedores: any[];
  isAdminOrSupervisor: boolean;
  onUpdateVendedor: (vendedorId: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hitoForm, setHitoForm] = useState({ tipo: "contacto", descripcion: "" });
  const [rutInput, setRutInput] = useState(client.rut || "");
  const [detectedPurchases, setDetectedPurchases] = useState<any[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const estadoConfig = getEstadoConfig(client.estado);

  // Add milestone mutation
  const addHitoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/hito`, {
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
      setHitoForm({ tipo: "contacto", descripcion: "" });
      onRefresh();
    },
  });

  // Link RUT mutation
  const linkRutMutation = useMutation({
    mutationFn: async (rut: string) => {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/vincular-rut`, {
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
        description: data.clienteVinculado ? `Cliente encontrado: ${data.clienteVinculado.nokoen}` : "No se encontró cliente con ese RUT en la base de ventas.",
      });
      onRefresh();
    },
  });

  // Detect purchases
  const handleDetectPurchases = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/detectar-compras`);
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setDetectedPurchases(data.compras);
      if (data.nuevosHitosCreados > 0) {
        toast({ title: `${data.nuevosHitosCreados} documentos detectados`, description: "Se han creado hitos automáticos con las compras encontradas." });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
        onRefresh();
      } else if (data.compras.length === 0) {
        toast({ title: "Sin compras", description: "No se encontraron documentos de venta para este RUT." });
      } else {
        toast({ title: `${data.compras.length} documentos encontrados`, description: "Todos los documentos ya están registrados como hitos." });
      }
    } catch {
      toast({ title: "Error", description: "No se pudieron detectar compras", variant: "destructive" });
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${estadoConfig.color} p-6 text-white rounded-t-lg`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{client.nombre}</h2>
              {client.empresa && (
                <p className="flex items-center gap-1.5 text-white/80 mt-1">
                  <Building2 className="w-4 h-4" />
                  {client.empresa}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                  <estadoConfig.icon className="w-3.5 h-3.5 mr-1" />
                  {estadoConfig.label}
                </Badge>
                {client.rut && (
                  <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm font-mono">
                    <Link2 className="w-3 h-3 mr-1" />
                    {client.rut}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => {
                if (confirm("¿Eliminar este cliente del seguimiento?")) onDelete();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {client.telefono && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{client.telefono}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              {isAdminOrSupervisor ? (
                <select
                  className="text-sm bg-transparent border rounded px-2 py-0.5 cursor-pointer hover:border-indigo-400 transition-colors"
                  value={client.vendedorId || ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateVendedor(e.target.value);
                  }}
                >
                  <option value="" disabled>Seleccionar vendedor...</option>
                  {vendedores.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.salespersonName}</option>
                  ))}
                </select>
              ) : (
                <span>{client.vendedorNombre}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span>{formatDate(client.createdAt)}</span>
            </div>
          </div>

          {/* Notas */}
          {client.notas && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notas</p>
              <p className="text-sm">{client.notas}</p>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="hitos" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="hitos">Historial ({client.hitos?.length || 0})</TabsTrigger>
              <TabsTrigger value="nuevo-hito">Nuevo Hito</TabsTrigger>
              <TabsTrigger value="nvv">Seguimiento Pedido</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="rut">RUT / Compras</TabsTrigger>
            </TabsList>

            {/* Historial Tab */}
            <TabsContent value="hitos" className="mt-4">
              <div className="space-y-0">
                {(client.hitos || []).map((hito: any, i: number) => {
                  const config = getHitoConfig(hito.tipo);
                  return (
                    <div key={hito.id} className="flex gap-3 relative">
                      {/* Timeline line */}
                      {i < (client.hitos?.length || 0) - 1 && (
                        <div className="absolute left-[15px] top-8 w-0.5 h-[calc(100%-8px)] bg-border" />
                      )}
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background z-10 ${hito.autoDetectado ? 'border-cyan-300' : 'border-muted-foreground/20'}`}>
                        <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{config.label}</span>
                          {hito.autoDetectado && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 text-cyan-600 border-cyan-300">
                              Auto
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto">{formatDate(hito.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{hito.descripcion}</p>
                        {hito.documentoNumero && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            Doc: {hito.documentoTipo} #{hito.documentoNumero}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">por {hito.autorNombre}</p>
                      </div>
                    </div>
                  );
                })}
                {(!client.hitos || client.hitos.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin hitos registrados</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Nuevo Hito Tab */}
            <TabsContent value="nuevo-hito" className="mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Tipo de Hito</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {HITO_TIPOS.filter(h => h.value !== "sistema").map(h => (
                      <button
                        key={h.value}
                        type="button"
                        onClick={() => setHitoForm(f => ({ ...f, tipo: h.value }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                          hitoForm.tipo === h.value
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
                    value={hitoForm.descripcion}
                    onChange={e => setHitoForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Detalle de la interacción..."
                    rows={3}
                    data-testid="input-hito-descripcion"
                  />
                </div>
                <Button
                  onClick={() => addHitoMutation.mutate(hitoForm)}
                  disabled={addHitoMutation.isPending || !hitoForm.descripcion}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
                  data-testid="btn-agregar-hito"
                >
                  {addHitoMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Registrar Hito
                </Button>
              </div>
            </TabsContent>

            {/* RUT / Compras Tab */}
            <TabsContent value="rut" className="mt-4 space-y-4">
              {/* Link RUT */}
              <div className="space-y-2">
                <Label>Vincular RUT</Label>
                <div className="flex gap-2">
                  <Input
                    value={rutInput}
                    onChange={e => setRutInput(e.target.value)}
                    placeholder="12.345.678-9"
                    className="font-mono"
                    data-testid="input-vincular-rut"
                  />
                  <Button
                    onClick={() => linkRutMutation.mutate(rutInput)}
                    disabled={linkRutMutation.isPending || !rutInput}
                    variant="outline"
                    data-testid="btn-vincular-rut"
                  >
                    {linkRutMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Linked client info */}
              {client.clienteVinculado && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Cliente Vinculado
                  </p>
                  <p className="text-sm font-medium">{client.clienteVinculado.nokoen}</p>
                  {client.clienteVinculado.ruen && <p className="text-xs text-muted-foreground">Segmento: {client.clienteVinculado.ruen}</p>}
                  {client.clienteVinculado.cpen && <p className="text-xs text-muted-foreground">Condición: {client.clienteVinculado.cpen}</p>}
                </div>
              )}

              {/* Detect purchases */}
              {client.rut && (
                <Button
                  onClick={handleDetectPurchases}
                  disabled={isDetecting}
                  variant="outline"
                  className="w-full"
                  data-testid="btn-detectar-compras"
                >
                  {isDetecting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Detectar Compras Automáticamente
                </Button>
              )}

              {/* Detected purchases */}
              {detectedPurchases && detectedPurchases.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Documentos encontrados ({detectedPurchases.length})</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {detectedPurchases.map((p: any) => (
                      <div key={p.id} className="text-xs bg-muted/30 rounded-lg p-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium">{p.tido} #{p.nudo}</span>
                          <p className="text-muted-foreground mt-0.5 truncate max-w-[300px]">{p.nokoprct}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${parseFloat(p.vanedo || "0").toLocaleString("es-CL")}</p>
                          <p className="text-muted-foreground">{formatDate(p.feemdo)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Seguimiento Pedido (NVV) Tab */}
            <TabsContent value="nvv" className="mt-4">
              <NVVTab client={client} />
            </TabsContent>

            {/* Pedidos Tab */}
            <TabsContent value="pedidos" className="mt-4">
              <PedidosTab client={client} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pedidos Tab (inside detail modal) ────────────────────────────────
function PedidosTab({ client }: { client: any }) {
  const [pedidos, setPedidos] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPedidos = async () => {
    if (!client.rut && !client.clienteId) {
      setPedidos([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/detectar-compras`);
      if (res.ok) {
        const data = await res.json();
        setPedidos(data.compras || []);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  // Load on mount
  useState(() => { loadPedidos(); });

  if (!client.rut && !client.clienteId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin RUT vinculado</p>
        <p className="text-xs mt-1">Vincula un RUT en la pestaña "RUT / Compras" para ver pedidos.</p>
      </div>
    );
  }

  if (isLoading || pedidos === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin pedidos registrados</p>
        <p className="text-xs mt-1">No se encontraron documentos de venta para este cliente.</p>
      </div>
    );
  }

  // Group by document type
  const estadoColors: Record<string, string> = {
    "Facturado": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "Pendiente": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    "Anulado": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{pedidos.length} documentos encontrados</p>
        <Button variant="ghost" size="sm" onClick={loadPedidos} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" />
          Actualizar
        </Button>
      </div>
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {pedidos.map((p: any, i: number) => {
          const estadoLabel = p.eslido || "Pendiente";
          const estadoClass = estadoColors[estadoLabel] || "bg-muted text-muted-foreground";
          return (
            <div key={p.id || i} className="bg-muted/20 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{p.tido} #{p.nudo}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${estadoClass}`}>
                      {estadoLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{p.nokoprct || "Sin detalle de producto"}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${parseFloat(p.vanedo || "0").toLocaleString("es-CL")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(p.feemdo)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── NVV Tab (Seguimiento Pedido / Notas de Venta) ────────────────────
function NVVTab({ client }: { client: any }) {
  const [nvvs, setNvvs] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadNVVs = async () => {
    if (!client.rut && !client.clienteId) {
      setNvvs([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/crm/seguimiento/${client.id}/nvv`);
      if (res.ok) {
        const data = await res.json();
        setNvvs(data.nvvs || []);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  useState(() => { loadNVVs(); });

  if (!client.rut && !client.clienteId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin RUT vinculado</p>
        <p className="text-xs mt-1">Vincula un RUT en la pestaña "RUT / Compras" para ver las NVV.</p>
      </div>
    );
  }

  if (isLoading || nvvs === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (nvvs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Sin notas de venta (NVV)</p>
        <p className="text-xs mt-1">No se encontraron NVV para este cliente.</p>
      </div>
    );
  }

  const estadoColors: Record<string, string> = {
    "Facturado": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "Pendiente": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    "Anulado": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    "En Proceso": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "Despachado": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  // Group by nudo to show grouped NVVs
  const groupedByNudo: Record<string, any[]> = {};
  for (const nvv of nvvs) {
    const key = nvv.nudo || 'sin-numero';
    if (!groupedByNudo[key]) groupedByNudo[key] = [];
    groupedByNudo[key].push(nvv);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">
          {Object.keys(groupedByNudo).length} NVV encontradas ({nvvs.length} líneas)
        </p>
        <Button variant="ghost" size="sm" onClick={loadNVVs} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" />
          Actualizar
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
        {Object.entries(groupedByNudo).map(([nudo, items]) => {
          const firstItem = items[0];
          const estadoLabel = firstItem.eslido || firstItem.esdo || "Pendiente";
          const estadoClass = estadoColors[estadoLabel] || "bg-muted text-muted-foreground";
          const totalMonto = items.reduce((sum: number, item: any) => sum + parseFloat(item.vanedo || "0"), 0);

          return (
            <div key={nudo} className="border rounded-lg overflow-hidden">
              {/* NVV Header */}
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span className="font-mono text-sm font-semibold">NVV #{nudo}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${estadoClass}`}>
                    {estadoLabel}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${totalMonto.toLocaleString("es-CL")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDate(firstItem.feemdo)}</p>
                </div>
              </div>
              {/* Line items */}
              <div className="divide-y">
                {items.map((item: any, i: number) => (
                  <div key={item.id || i} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-muted/10">
                    <span className="text-muted-foreground flex-1 truncate pr-2">
                      {item.nokoprct || "Sin detalle"}
                    </span>
                    <span className="font-medium text-right flex-shrink-0">
                      ${parseFloat(item.vanedo || "0").toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
