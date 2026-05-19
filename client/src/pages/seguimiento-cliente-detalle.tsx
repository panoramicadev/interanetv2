import { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Phone, Building2, User, Mail,
  MessageSquare, PhoneCall, FileText,
  MapPin, AlertTriangle, CheckCircle2, Truck, ShoppingCart,
  UserCheck, Send, Link2, Sparkles, Trash2, Edit3, RefreshCw,
  ArrowLeft, Plus, Calendar, Clock, CreditCard, Save, X, Tags, ChevronDown,
  BookOpen, Target, ShieldCheck, Package, Swords
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ESTADOS,
  HITO_TIPOS,
  getEstadoConfig,
  getHitoConfig,
  timeAgo,
  formatDate,
  fixEncoding,
  SEGMENTOS_CRM,
  PedidosTab,
  NVVTab,
} from "./seguimiento-clientes";

// All 16 regions of Chile
const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes y la Antártica Chilena",
];

// Common payment conditions
const CONDICIONES_PAGO = [
  "CONTADO",
  "CREDITO 15 DIAS",
  "CREDITO 30 DIAS",
  "CREDITO 45 DIAS",
  "CREDITO 60 DIAS",
  "CREDITO 90 DIAS",
  "CREDITO 120 DIAS",
  "CONTRA ENTREGA",
  "TRANSFERENCIA",
];

// ─── Main Detail Page ─────────────────────────────────────────────────
export default function SeguimientoClienteDetalle() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/seguimiento-clientes/:id");
  const clientId = params?.id;

  const isAdminOrSupervisor = user?.role === "admin" || (user?.role === "supervisor" || user?.role === "encargado_area");

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [newBitNota, setNewBitNota] = useState("");
  const [newBitTipo, setNewBitTipo] = useState("nota");
  const [hitoForm, setHitoForm] = useState({ tipo: "contacto", descripcion: "" });
  const [rutInput, setRutInput] = useState("");
  const [detectedPurchases, setDetectedPurchases] = useState<any[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showComunaSuggestions, setShowComunaSuggestions] = useState(false);
  const comunaInputRef = useRef<HTMLInputElement>(null);
  const comunaDropdownRef = useRef<HTMLDivElement>(null);

  const BIT_TIPOS = [
    { value: "nota", label: "Nota", icon: MessageSquare, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    { value: "llamada", label: "Llamada", icon: PhoneCall, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { value: "visita", label: "Visita", icon: MapPin, color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    { value: "seguimiento", label: "Seguimiento", icon: UserCheck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { value: "problema", label: "Problema", icon: AlertTriangle, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  ];

  // ─── Client query ───────────────────────────────────────────────
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

  // ─── Comunas query (for autocomplete) ──────────────────────────
  const { data: comunasSugeridas = [] } = useQuery<string[]>({
    queryKey: ["/api/crm/comunas"],
    queryFn: async () => {
      const res = await fetch("/api/crm/comunas");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ─── Bitácora query ─────────────────────────────────────────────
  const { data: bitacoraEntries = [], isLoading: bitacoraLoading } = useQuery({
    queryKey: ["/api/bitacora", "cliente", clientId],
    queryFn: async () => {
      const params = new URLSearchParams({
        documentoTipo: "cliente",
        documentoId: client?.clienteId || clientId!,
      });
      const response = await fetch(`/api/bitacora?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!clientId && !!client,
  });

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
    // Optimistic update: update cache immediately before API responds
    onMutate: async (data: any) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/crm/seguimiento", clientId] });
      // Snapshot previous value for rollback
      const previousClient = queryClient.getQueryData(["/api/crm/seguimiento", clientId]);
      // Optimistically set new data in cache
      queryClient.setQueryData(["/api/crm/seguimiento", clientId], (old: any) => {
        if (!old) return old;
        return { ...old, ...data };
      });
      return { previousClient };
    },
    onSuccess: () => {
      toast({ title: "✅ Datos actualizados" });
      setIsEditing(false);
      // Background invalidation (non-blocking)
      queryClient.invalidateQueries({ queryKey: ["/api/crm/seguimiento"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/comunas"] });
    },
    onError: (err: Error, _data, context) => {
      // Rollback to previous data on failure
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
      setNewBitNota("");
      setNewBitTipo("nota");
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
      setHitoForm({ tipo: "contacto", descripcion: "" });
      refetch();
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
      refetch();
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────
  const handleAddBit = () => {
    if (!newBitNota.trim() || !client) return;
    const cv = client.clienteVinculado;
    createBitMutation.mutate({
      documentoTipo: "cliente",
      documentoId: client.clienteId || client.id,
      documentoNumero: cv?.koen || null,
      clienteNombre: client.nombre || cv?.nokoen,
      clienteRut: client.rut || cv?.rten || null,
      nota: newBitNota.trim(),
      tipo: newBitTipo,
    });
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
    // Always send all editable fields to ensure comuna and contactoEncargado are persisted
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

  // ─── Loading / Not Found ────────────────────────────────────────
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

  const estadoConfig = getEstadoConfig(client.estado);
  const cv = client.clienteVinculado;
  const isStaleContact = !client.ultimoContacto || (new Date().getTime() - new Date(client.ultimoContacto).getTime()) > 7 * 24 * 60 * 60 * 1000;
  const displayPhone = cv?.foen || client.linkedFoen || client.telefono || "—";
  const displayComuna = fixEncoding(client.comuna || cv?.comuna || client.linkedComuna || client.ciudad);
  const displayRegion = client.region || fixEncoding(client.linkedRegion || cv?.provincia || client.linkedProvincia);
  const displayContacto = fixEncoding(client.contactoEncargado || cv?.purchasingContactName || client.linkedPurchasingContact);
  const displayEmail = client.email || cv?.email || "—";
  const displayCondicionPago = client.condicionPago || (cv?.cpen || client.linkedCpen || "")?.trim() || "—";

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/30 dark:bg-background" data-testid="seguimiento-cliente-detalle-page">
      
      {/* ═══ Top Bar ═══ */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
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
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${estadoConfig.badge} border-0 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition-all`}>
                  <estadoConfig.icon className="w-3 h-3 mr-1" />
                  {estadoConfig.label}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {ESTADOS.map(e => (
                  <DropdownMenuItem
                    key={e.value}
                    onClick={() => updateMutation.mutate({ estado: e.value })}
                    disabled={e.value === client.estado}
                    className="text-xs"
                  >
                    <e.icon className="w-3.5 h-3.5 mr-2" />
                    {e.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => {
                if (confirm("¿Eliminar este cliente del seguimiento?")) deleteMutation.mutate();
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ Client Summary Header ═══ */}
      <div className="bg-background border-b">
        <div className="px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Name & Key Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{client.nombre}</h1>
              {client.empresa && client.empresa !== client.nombre && (
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {client.empresa}
                </p>
              )}
              
              {/* Key metrics row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3">
                {client.rut && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Link2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="font-mono text-foreground/80">{client.rut}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm">
                  <Phone className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-foreground/80">{displayPhone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-foreground/80">{displayEmail}</span>
                </div>
                <div className={`flex items-center gap-1.5 text-sm ${isStaleContact ? 'text-red-500' : 'text-muted-foreground'}`}>
                  <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isStaleContact ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className="font-medium">{timeAgo(client.ultimoContacto)}</span>
                  {client.ultimoContacto && (
                    <span className="text-muted-foreground text-xs">({formatDate(client.ultimoContacto)})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                  className="text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {updateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Summary Grid (Always visible) ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4 pt-4 border-t border-dashed">
            <SummaryItem icon={MapPin} label="Comuna" value={displayComuna} />
            <SummaryItem icon={MapPin} label="Región" value={displayRegion || "—"} />
            <SummaryItem icon={CreditCard} label="Método de Pago" value={displayCondicionPago} />
            <SummaryItem icon={User} label="Vendedor" value={client.vendedorNombre || "—"} />
            <SummaryItem icon={Calendar} label="Último Pedido" value={formatDate(client.ultimaCompraDate)} />
            <SummaryItem 
              icon={Phone} 
              label="Contacto Enc." 
              value={displayContacto || "—"} 
            />
            <SummaryItem icon={Tags} label="Segmento" value={client.segmento || client.linkedSegmento || "—"} />
          </div>

          {/* ─── Edit Form ─── */}
          {isEditing && (
            <div className="mt-4 pt-4 border-t border-dashed space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Editar datos del cliente</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    // Don't show if exact match already typed
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
                <div className="col-span-2 sm:col-span-3">
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
            </div>
          )}
        </div>
      </div>

      {/* ═══ Content: 2-Column Layout ═══ */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-220px)]">
        
        {/* ─── Left Column: Info Cards + Tabs ─── */}
        <div className="flex-1 lg:border-r overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-5">

            {/* Anotaciones del Cliente */}
            {((cv?.oben || client.linkedOben || "")?.trim() || client.notas) && (
              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Anotaciones del Cliente</p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {fixEncoding((cv?.oben || client.linkedOben || "")?.trim() || client.notas)}
                </p>
              </div>
            )}

            {/* Teléfonos de Contacto */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center gap-2 mb-2.5">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Teléfonos de Contacto</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cv?.foen || client.linkedFoen || client.telefono || "Sin teléfono"}</p>
                    <p className="text-xs text-muted-foreground">
                      {(cv?.purchasingContactName || client.linkedPurchasingContact)
                        ? `Encargado: ${fixEncoding(cv?.purchasingContactName || client.linkedPurchasingContact)}`
                        : "Contacto principal"}
                    </p>
                  </div>
                  {(cv?.foen || client.linkedFoen || client.telefono) && (
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">Principal</Badge>
                  )}
                </div>
                {(cv?.cnen || client.linkedCnen) && (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 dark:border-slate-700/30 pt-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{cv?.cnen || client.linkedCnen}</p>
                      <p className="text-xs text-muted-foreground">Contacto alternativo</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Secundario</Badge>
                  </div>
                )}
                {(cv?.cnen2 || client.linkedCnen2) && (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 dark:border-slate-700/30 pt-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{cv?.cnen2 || client.linkedCnen2}</p>
                      <p className="text-xs text-muted-foreground">Contacto adicional</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Adicional</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Tabs ─── */}
            <Tabs defaultValue="pedidos" className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-10">
                <TabsTrigger value="pedidos" className="text-xs">Pedidos</TabsTrigger>
                <TabsTrigger value="nvv" className="text-xs">NVV</TabsTrigger>
                <TabsTrigger value="ayuda-memoria" className="text-xs flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Ayuda Memoria
                </TabsTrigger>
                <TabsTrigger value="hitos" className="text-xs">Historial ({client.hitos?.length || 0})</TabsTrigger>
              </TabsList>

              {/* Pedidos Tab */}
              <TabsContent value="pedidos" className="mt-4">
                <PedidosTab client={client} />
              </TabsContent>

              {/* NVV Tab */}
              <TabsContent value="nvv" className="mt-4">
                <NVVTab client={client} />
              </TabsContent>

              {/* Ayuda Memoria Tab */}
              <TabsContent value="ayuda-memoria" className="mt-4">
                <AyudaMemoriaTab clientId={clientId!} clientNombre={client.nombre} clientRut={client.rut} />
              </TabsContent>

              {/* Historial Tab */}
              <TabsContent value="hitos" className="mt-4">
                <div className="space-y-0">
                  {(client.hitos || []).map((hito: any, i: number) => {
                    const config = getHitoConfig(hito.tipo);
                    return (
                      <div key={hito.id} className="flex gap-3 relative">
                        {i < (client.hitos?.length || 0) - 1 && (
                          <div className="absolute left-[15px] top-8 w-0.5 h-[calc(100%-8px)] bg-border" />
                        )}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background z-10 ${hito.autoDetectado ? 'border-cyan-300' : 'border-muted-foreground/20'}`}>
                          <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{config.label}</span>
                            {hito.autoDetectado && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 text-cyan-600 border-cyan-300">Auto</Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto">{formatDate(hito.createdAt)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{hito.descripcion}</p>
                          {hito.documentoNumero && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">Doc: {hito.documentoTipo} #{hito.documentoNumero}</p>
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
            </Tabs>
          </div>
        </div>

        {/* ─── Right Column: Bitácora ─── */}
        <div className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 bg-white dark:bg-slate-900/20 border-t lg:border-t-0 overflow-y-auto">
          <div className="p-4 sm:p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Bitácora</h3>
                <p className="text-[11px] text-muted-foreground leading-none">{(bitacoraEntries as any[]).length} {(bitacoraEntries as any[]).length === 1 ? "entrada" : "entradas"}</p>
              </div>
            </div>

            {/* New entry form */}
            <div className="space-y-2 border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/30 mb-4">
              <Select value={newBitTipo} onValueChange={setNewBitTipo}>
                <SelectTrigger className="h-8 w-40 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BIT_TIPOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-1.5">
                        <t.icon className="h-3 w-3" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Escribir nota sobre este cliente..."
                value={newBitNota}
                onChange={(e) => setNewBitNota(e.target.value)}
                className="min-h-[60px] text-sm rounded-lg resize-none"
              />
              <Button
                size="sm"
                onClick={handleAddBit}
                disabled={!newBitNota.trim() || createBitMutation.isPending}
                className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {createBitMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Agregar Entrada
              </Button>
            </div>

            {/* Entries list */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              {bitacoraLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
                </div>
              ) : (bitacoraEntries as any[]).length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium">Sin entradas en la bitácora</p>
                  <p className="text-[10px] mt-1">Agrega una nota para comenzar el seguimiento</p>
                </div>
              ) : (
                (bitacoraEntries as any[]).map((entry: any) => {
                  const typeConfig = BIT_TIPOS.find(t => t.value === entry.tipo) || BIT_TIPOS[0];
                  const TypeIcon = typeConfig.icon;
                  return (
                    <div key={entry.id} className="border rounded-xl p-3 space-y-1.5 bg-background hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`${typeConfig.color} text-[10px] gap-1 border-0`}>
                            <TypeIcon className="w-2.5 h-2.5" />
                            {typeConfig.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(entry.createdAt)} · {timeAgo(entry.createdAt)}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteBitMutation.mutate(entry.id)}
                          className="text-muted-foreground/30 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{entry.nota}</p>
                      <p className="text-[10px] text-muted-foreground">por {entry.autorNombre}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Item Component ──────────────────────────────────────────
function SummaryItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Ayuda Memoria Tab Component ─────────────────────────────────────
const TIPOS_CLIENTE = [
  { value: "ferreteria", label: "Ferretería" },
  { value: "construccion", label: "Construcción" },
  { value: "industrial", label: "Industrial" },
  { value: "hogar", label: "Hogar" },
  { value: "pintureria", label: "Pinturería" },
  { value: "distribuidor", label: "Distribuidor" },
  { value: "otro", label: "Otro" },
];

const FRECUENCIAS = [
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "esporadico", label: "Esporádico" },
];

function AyudaMemoriaTab({ clientId, clientNombre, clientRut }: { clientId: string; clientNombre: string; clientRut?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load existing ayuda memoria for this client
  const { data: fichas = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/crm/ayuda-memoria", "cliente", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/ayuda-memoria?busqueda=`);
      if (!res.ok) return [];
      const all = await res.json();
      // Filter to this client
      return all.filter((f: any) => f.clienteSeguimientoId === clientId);
    },
    enabled: !!clientId,
  });

  const ficha = fichas[0] || null;

  const [form, setForm] = useState({
    giro: "", direccion: "", ciudad: "", tipoCliente: "",
    contactoPrincipal: "", telefonoContacto: "", emailContacto: "",
    productosInteres: "", frecuenciaCompra: "", condicionesPago: "", competencia: "",
    fortalezas: "", debilidades: "", oportunidades: "", observaciones: "",
  });
  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when ficha loads
  useEffect(() => {
    if (ficha && !initialized) {
      setForm({
        giro: ficha.giro || "",
        direccion: ficha.direccion || "",
        ciudad: ficha.ciudad || "",
        tipoCliente: ficha.tipoCliente || "",
        contactoPrincipal: ficha.contactoPrincipal || "",
        telefonoContacto: ficha.telefonoContacto || "",
        emailContacto: ficha.emailContacto || "",
        productosInteres: ficha.productosInteres || "",
        frecuenciaCompra: ficha.frecuenciaCompra || "",
        condicionesPago: ficha.condicionesPago || "",
        competencia: ficha.competencia || "",
        fortalezas: ficha.fortalezas || "",
        debilidades: ficha.debilidades || "",
        oportunidades: ficha.oportunidades || "",
        observaciones: ficha.observaciones || "",
      });
      setInitialized(true);
    } else if (!ficha && !isLoading && !initialized) {
      setInitialized(true);
    }
  }, [ficha, isLoading, initialized]);

  const updateField = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setHasChanges(true);
  };

  // Save mutation (create or update)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (ficha) {
        // Update existing
        const res = await fetch(`/api/crm/ayuda-memoria/${ficha.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Error al guardar");
        return res.json();
      } else {
        // Create new
        const res = await fetch("/api/crm/ayuda-memoria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            clienteSeguimientoId: clientId,
            clienteNombre: clientNombre,
            rut: clientRut || null,
          }),
        });
        if (!res.ok) throw new Error("Error al crear");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/ayuda-memoria"] });
      toast({ title: "✅ Ayuda memoria guardada" });
      setHasChanges(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-500" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando ayuda memoria...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="ayuda-memoria-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Ayuda Memoria</h3>
            <p className="text-[10px] text-muted-foreground leading-none">
              {ficha ? `Última actualización: ${formatDate(ficha.updatedAt)}` : "Sin información registrada aún"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending || !hasChanges}
          className={`text-xs transition-all duration-300 ${
            hasChanges
              ? "bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md shadow-teal-500/25"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {saveMutation.isPending ? (
            <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Guardando...</>
          ) : (
            <><Save className="w-3.5 h-3.5 mr-1.5" /> Guardar</>
          )}
        </Button>
      </div>

      {/* Sección: Info del Negocio */}
      <div className="rounded-xl border bg-slate-50/50 dark:bg-slate-900/20 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> Datos del Negocio
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Giro</label>
            <Input value={form.giro} onChange={e => updateField("giro", e.target.value)} placeholder="Rubro del negocio" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Tipo de Cliente</label>
            <Select value={form.tipoCliente} onValueChange={v => updateField("tipoCliente", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_CLIENTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Dirección</label>
            <Input value={form.direccion} onChange={e => updateField("direccion", e.target.value)} placeholder="Dirección principal" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Ciudad</label>
            <Input value={form.ciudad} onChange={e => updateField("ciudad", e.target.value)} placeholder="Ciudad" className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección: Contacto */}
      <div className="rounded-xl border bg-blue-50/30 dark:bg-blue-900/10 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <Phone className="w-3 h-3" /> Contacto
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Contacto Principal</label>
            <Input value={form.contactoPrincipal} onChange={e => updateField("contactoPrincipal", e.target.value)} placeholder="Nombre" className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Teléfono</label>
            <Input value={form.telefonoContacto} onChange={e => updateField("telefonoContacto", e.target.value)} placeholder="+56 9..." className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Email</label>
            <Input value={form.emailContacto} onChange={e => updateField("emailContacto", e.target.value)} placeholder="correo@empresa.cl" className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección: Comercial */}
      <div className="rounded-xl border bg-amber-50/30 dark:bg-amber-900/10 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Package className="w-3 h-3" /> Información Comercial
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Productos de Interés</label>
            <Textarea value={form.productosInteres} onChange={e => updateField("productosInteres", e.target.value)} placeholder="¿Qué suele comprar o le interesa?" rows={2} className="text-sm resize-none" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Frecuencia de Compra</label>
            <Select value={form.frecuenciaCompra} onValueChange={v => updateField("frecuenciaCompra", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {FRECUENCIAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Condiciones de Pago</label>
            <Input value={form.condicionesPago} onChange={e => updateField("condicionesPago", e.target.value)} placeholder="Contado, Crédito 30 días..." className="h-8 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Competencia</label>
            <Textarea value={form.competencia} onChange={e => updateField("competencia", e.target.value)} placeholder="¿Qué marcas de la competencia usa?" rows={2} className="text-sm resize-none" />
          </div>
        </div>
      </div>

      {/* Sección: Análisis FODA */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Target className="w-3 h-3" /> Análisis del Cliente
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Fortalezas */}
          <div className="rounded-xl border overflow-hidden bg-emerald-50/40 dark:bg-emerald-900/10">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-600" />
            <div className="p-3">
              <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1.5">
                <ShieldCheck className="w-3 h-3" /> Fortalezas
              </label>
              <Textarea value={form.fortalezas} onChange={e => updateField("fortalezas", e.target.value)} placeholder="Puntos fuertes de la relación..." rows={3} className="text-sm resize-none border-emerald-200 dark:border-emerald-800 focus-visible:ring-emerald-400" />
            </div>
          </div>
          {/* Debilidades */}
          <div className="rounded-xl border overflow-hidden bg-red-50/40 dark:bg-red-900/10">
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-600" />
            <div className="p-3">
              <label className="text-[10px] font-bold text-red-700 dark:text-red-400 flex items-center gap-1 mb-1.5">
                <AlertTriangle className="w-3 h-3" /> Debilidades
              </label>
              <Textarea value={form.debilidades} onChange={e => updateField("debilidades", e.target.value)} placeholder="Puntos débiles o riesgos..." rows={3} className="text-sm resize-none border-red-200 dark:border-red-800 focus-visible:ring-red-400" />
            </div>
          </div>
          {/* Oportunidades */}
          <div className="rounded-xl border overflow-hidden bg-blue-50/40 dark:bg-blue-900/10">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <div className="p-3">
              <label className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3" /> Oportunidades
              </label>
              <Textarea value={form.oportunidades} onChange={e => updateField("oportunidades", e.target.value)} placeholder="Oportunidades de crecimiento..." rows={3} className="text-sm resize-none border-blue-200 dark:border-blue-800 focus-visible:ring-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className="rounded-xl border bg-purple-50/30 dark:bg-purple-900/10 p-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Observaciones Generales
        </p>
        <Textarea value={form.observaciones} onChange={e => updateField("observaciones", e.target.value)} placeholder="Notas adicionales sobre el cliente..." rows={3} className="text-sm resize-none" />
      </div>

      {/* Save reminder */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <p className="text-xs text-teal-700 dark:text-teal-300 flex-1">Tienes cambios sin guardar</p>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">
            {saveMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Guardar ahora
          </Button>
        </div>
      )}
    </div>
  );
}

