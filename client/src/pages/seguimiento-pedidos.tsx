import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText, ShoppingCart, Truck, FileCheck, Package,
  Search, PackageSearch, CheckCircle, XCircle, Send,
  ArrowRight, Loader2, BookOpen, Plus, Phone, MapPin,
  AlertCircle, MessageSquare, Trash2, Users, ShoppingBag,
  Eye, Clock, Store, MoreVertical, Copy, ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ==============================
// Types
// ==============================

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "converted";
  total: string;
  createdAt: string;
  creatorName?: string;
  notes?: string;
}

interface NVVRecord {
  id: string;
  NUDO: string;
  TIDO: string;
  FEEMDO: string;
  ENDO: string;
  NOKOEN: string;
  NOKOPR: string;
  KOPRCT: string;
  CAPREX2: number;
  CAPRCO2: number;
  PPPRNE: number;
  cantidadPendiente: number;
  totalPendiente: number;
}

interface GDVRecord {
  numeroGuia: string;
  fecha: string;
  cliente: string;
  codigoCliente: string;
  producto: string;
  cantidad: number;
  monto: number;
}

interface EcommerceOrder {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  assignedSalespersonName?: string;
  status: string;
  total: string;
  items: any[] | string;
  notes?: string;
  createdAt: string;
}

interface BitacoraEntry {
  id: string;
  documentoTipo: string;
  documentoId: string;
  documentoNumero?: string;
  clienteNombre?: string;
  clienteRut?: string;
  nota: string;
  tipo: string;
  autorId: string;
  autorNombre: string;
  createdAt: string;
  updatedAt: string;
}

// ==============================
// Helpers
// ==============================

const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTimeAgo = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diffInMs / (1000 * 60 * 60));
    const minutes = Math.floor(diffInMs / (1000 * 60));

    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return "ahora";
  } catch {
    return "";
  }
};

// ==============================
// Stage Config
// ==============================

const STAGES = [
  {
    key: "catalogo",
    label: "Pedidos Catálogo",
    icon: Store,
    color: "orange",
    bgGradient: "from-orange-500 to-red-500",
    bgLight: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-300 dark:border-orange-700",
    textColor: "text-orange-600 dark:text-orange-400",
    badgeColor: "bg-orange-100 text-orange-700",
    highlighted: true,
  },
  {
    key: "cotizacion",
    label: "Cotizaciones",
    icon: FileText,
    color: "blue",
    bgGradient: "from-blue-500 to-blue-600",
    bgLight: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    key: "ingresado",
    label: "Ingresados (NVV)",
    icon: ShoppingCart,
    color: "amber",
    bgGradient: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-600 dark:text-amber-400",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    key: "despacho",
    label: "En Despacho (GDV)",
    icon: Truck,
    color: "purple",
    bgGradient: "from-purple-500 to-violet-600",
    bgLight: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-600 dark:text-purple-400",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    key: "facturado",
    label: "Facturado",
    icon: FileCheck,
    color: "green",
    bgGradient: "from-green-500 to-emerald-600",
    bgLight: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-600 dark:text-green-400",
    badgeColor: "bg-green-100 text-green-700",
  },
] as const;

const quoteStatusMap: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: "Borrador", icon: FileText, color: "bg-gray-100 text-gray-700" },
  sent: { label: "Enviada", icon: Send, color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Aceptada", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rechazada", icon: XCircle, color: "bg-red-100 text-red-700" },
  converted: { label: "Convertida", icon: Package, color: "bg-purple-100 text-purple-700" },
};

const BITACORA_TYPES = [
  { value: "nota", label: "Nota", icon: MessageSquare, color: "bg-gray-100 text-gray-700" },
  { value: "llamada", label: "Llamada", icon: Phone, color: "bg-blue-100 text-blue-700" },
  { value: "visita", label: "Visita", icon: MapPin, color: "bg-green-100 text-green-700" },
  { value: "seguimiento", label: "Seguimiento", icon: BookOpen, color: "bg-purple-100 text-purple-700" },
  { value: "problema", label: "Problema", icon: AlertCircle, color: "bg-red-100 text-red-700" },
];

// ==============================
// Main Page
// ==============================

export default function SeguimientoPedidos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const salespersonName = (user as any)?.salespersonName || "";
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";
  const [activeStage, setActiveStage] = useState<string>("catalogo");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>("all");

  // Bitácora state
  const [bitacoraOpen, setBitacoraOpen] = useState(false);
  const [bitacoraDoc, setBitacoraDoc] = useState<{
    tipo: string;
    id: string;
    numero: string;
    clienteNombre: string;
    clienteRut?: string;
  } | null>(null);
  const [newNota, setNewNota] = useState("");
  const [newNotaTipo, setNewNotaTipo] = useState("nota");

  // Get salesperson to filter by
  const effectiveSalesperson = isAdmin
    ? (selectedSalesperson === "all" ? "" : selectedSalesperson)
    : salespersonName;

  // Salespeople list for admin filter (from salesperson mapping)
  const { data: salespeople = [] } = useQuery<string[]>({
    queryKey: ["/api/sales-transactions/salesperson-mapping"],
    queryFn: async () => {
      const res = await fetch('/api/sales-transactions/salesperson-mapping', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      // Extract unique salesperson names from kofulidoToName mapping
      const names = Object.values(data.kofulidoToName || {}) as string[];
      return Array.from(new Set(names)).filter(Boolean).sort();
    },
    enabled: isAdmin,
  });

  // Ecommerce / catalog orders
  const { data: catalogOrders = [], isLoading: catalogLoading } = useQuery<EcommerceOrder[]>({
    queryKey: ["/api/ecommerce/orders"],
    queryFn: async () => {
      const response = await fetch("/api/ecommerce/orders", { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Quotes data
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes?limit=500&offset=0"],
  });

  // Auto-match quotes with NVV on page load
  useEffect(() => {
    fetch('/api/quotes/auto-match-nvv', {
      method: 'POST',
      credentials: 'include',
    }).then(res => res.json()).then(result => {
      if (result.matched > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
        toast({ title: `✅ ${result.matched} cotización(es) aceptada(s) automáticamente (NVV)` });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NVV data
  const { data: nvvData = [], isLoading: nvvLoading } = useQuery<NVVRecord[]>({
    queryKey: ["/api/nvv/by-salesperson", effectiveSalesperson, "all", "all"],
    queryFn: async () => {
      if (!effectiveSalesperson && !isAdmin) return [];
      const params = new URLSearchParams();
      if (effectiveSalesperson) params.append("salesperson", effectiveSalesperson);
      const response = await fetch(`/api/nvv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!effectiveSalesperson || isAdmin,
  });

  // GDV data
  const { data: gdvData = [], isLoading: gdvLoading } = useQuery<GDVRecord[]>({
    queryKey: ["/api/gdv/by-salesperson", effectiveSalesperson],
    queryFn: async () => {
      if (!effectiveSalesperson && !isAdmin) return [];
      const params = new URLSearchParams();
      if (effectiveSalesperson) params.append("salesperson", effectiveSalesperson);
      const response = await fetch(`/api/gdv/by-salesperson?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!effectiveSalesperson || isAdmin,
  });

  // Facturas data (current month)
  const { data: facturas = [], isLoading: facturasLoading } = useQuery<any[]>({
    queryKey: ["/api/sales/transactions", effectiveSalesperson, "seguimiento"],
    queryFn: async () => {
      if (!effectiveSalesperson && !isAdmin) return [];
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const params = new URLSearchParams({
        startDate,
        endDate,
        limit: "200",
      });
      if (effectiveSalesperson) params.append("salesperson", effectiveSalesperson);
      const response = await fetch(`/api/sales/transactions?${params}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!effectiveSalesperson || isAdmin,
  });

  // Bitácora data for selected document
  const { data: bitacoraEntries = [], isLoading: bitacoraLoading } = useQuery<BitacoraEntry[]>({
    queryKey: ["/api/bitacora", bitacoraDoc?.tipo, bitacoraDoc?.id],
    queryFn: async () => {
      if (!bitacoraDoc) return [];
      const params = new URLSearchParams({
        documentoTipo: bitacoraDoc.tipo,
        documentoId: bitacoraDoc.id,
      });
      const response = await fetch(`/api/bitacora?${params}`, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!bitacoraDoc,
  });

  // Create bitácora entry
  const createBitacoraMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/bitacora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Error al crear entrada");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      setNewNota("");
      setNewNotaTipo("nota");
      toast({ title: "✅ Entrada agregada a la bitácora" });
    },
    onError: () => {
      toast({ title: "❌ Error al agregar entrada", variant: "destructive" });
    },
  });

  // Delete bitácora entry
  const deleteBitacoraMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/bitacora/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al eliminar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bitacora"] });
      toast({ title: "Entrada eliminada" });
    },
  });

  const handleOpenBitacora = (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => {
    setBitacoraDoc({ tipo, id, numero, clienteNombre, clienteRut });
    setBitacoraOpen(true);
  };

  const handleAddBitacora = () => {
    if (!bitacoraDoc || !newNota.trim()) return;
    createBitacoraMutation.mutate({
      documentoTipo: bitacoraDoc.tipo,
      documentoId: bitacoraDoc.id,
      documentoNumero: bitacoraDoc.numero,
      clienteNombre: bitacoraDoc.clienteNombre,
      clienteRut: bitacoraDoc.clienteRut,
      nota: newNota.trim(),
      tipo: newNotaTipo,
    });
  };

  // Filter quotes by salesperson (creator)
  // Filter catalog orders
  const filteredCatalogOrders = useMemo(() => {
    if (!searchTerm) return catalogOrders;
    return catalogOrders.filter(o =>
      o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientCompany?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [catalogOrders, searchTerm]);

  const filteredQuotes = useMemo(() => {
    // Exclude drafts - only show sent/accepted/rejected/converted
    let result = quotes.filter(q => q.status !== "draft");
    if (effectiveSalesperson) {
      result = result.filter(q => q.creatorName?.toLowerCase().includes(effectiveSalesperson.toLowerCase()));
    }
    if (searchTerm) {
      result = result.filter(q =>
        q.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return result;
  }, [quotes, effectiveSalesperson, searchTerm]);

  const filteredNVV = useMemo(() => {
    if (!searchTerm) return nvvData;
    return nvvData.filter(r =>
      r.NOKOEN?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.NOKOPR?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.NUDO?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nvvData, searchTerm]);

  const filteredGDV = useMemo(() => {
    if (!searchTerm) return gdvData;
    return gdvData.filter(r =>
      r.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.producto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.numeroGuia?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [gdvData, searchTerm]);

  const filteredFacturas = useMemo(() => {
    if (!searchTerm) return facturas;
    return facturas.filter(r =>
      (r.clientName || r.nokoen || "")?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.productName || r.nokopr || "")?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.documentNumber || r.nudo || "")?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [facturas, searchTerm]);

  // Compute totals for each stage
  const stageCounts: Record<string, number> = {
    catalogo: filteredCatalogOrders.length,
    cotizacion: filteredQuotes.length,
    ingresado: filteredNVV.length,
    despacho: filteredGDV.length,
    facturado: filteredFacturas.length,
  };

  const stageTotals: Record<string, number> = {
    catalogo: filteredCatalogOrders.reduce((s, o) => s + parseFloat(o.total || "0"), 0),
    cotizacion: filteredQuotes.reduce((s, q) => s + parseFloat(q.total || "0"), 0),
    ingresado: filteredNVV.reduce((s, r) => s + (r.totalPendiente || 0), 0),
    despacho: filteredGDV.reduce((s, r) => s + (r.monto || 0), 0),
    facturado: filteredFacturas.reduce((s, r) => s + (Number(r.amount) || 0), 0),
  };

  const isLoading = catalogLoading || quotesLoading || nvvLoading || gdvLoading || facturasLoading;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <PackageSearch className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Seguimiento de Pedidos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sigue el estado de tus pedidos desde la cotización hasta la entrega
            </p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Salesperson filter - only for admin/supervisor */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <Select value={selectedSalesperson} onValueChange={setSelectedSalesperson}>
              <SelectTrigger className="h-9 w-56 rounded-lg border-gray-200 text-sm">
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {salespeople.map((sp) => (
                  <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por cliente, producto o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 rounded-lg border-gray-200 focus:border-indigo-400 text-sm"
            data-testid="input-search-seguimiento"
          />
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const count = stageCounts[stage.key] || 0;
          const total = stageTotals[stage.key] || 0;
          const isHighlighted = (stage as any).highlighted;
          const isActive = activeStage === stage.key;

          return (
            <button
              key={stage.key}
              onClick={() => setActiveStage(stage.key)}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left group
                ${isActive
                  ? `${stage.borderColor} ${stage.bgLight} ring-2 ring-offset-1 ring-${stage.color}-400/30 scale-[1.02]`
                  : isHighlighted
                    ? "border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 hover:shadow-md shadow-sm"
                    : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 hover:shadow-md"
                }`}
              data-testid={`stage-${stage.key}`}
            >
              {isActive && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: `var(--${stage.color}-500, #6366f1)` }} />
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stage.bgGradient} shadow-sm`}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">
                  {stage.label}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-[10px] text-gray-400 font-medium">documentos</p>
                </div>
                <p className={`text-xs font-bold ${stage.textColor}`}>
                  {formatCurrency(total)}
                </p>
              </div>

              {idx < STAGES.length - 1 && (
                <ArrowRight className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 z-10" />
              )}
            </button>
          );
        })}
      </div>

      {/* Stage content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardContent className="p-0">
            {activeStage === "catalogo" && (
              <CatalogOrdersTable orders={filteredCatalogOrders} onBitacora={handleOpenBitacora} />
            )}
            {activeStage === "cotizacion" && (
              <CotizacionesTable quotes={filteredQuotes} isAdmin={isAdmin} onBitacora={handleOpenBitacora} />
            )}
            {activeStage === "ingresado" && (
              <NVVTable records={filteredNVV} onBitacora={handleOpenBitacora} />
            )}
            {activeStage === "despacho" && (
              <GDVTable records={filteredGDV} onBitacora={handleOpenBitacora} />
            )}
            {activeStage === "facturado" && (
              <FacturasTable records={filteredFacturas} onBitacora={handleOpenBitacora} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Bitácora Dialog */}
      <Dialog open={bitacoraOpen} onOpenChange={(open) => { if (!open) setBitacoraOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              Bitácora
            </DialogTitle>
            <DialogDescription>
              {bitacoraDoc && (
                <span className="text-sm">
                  {bitacoraDoc.numero && <span className="font-semibold text-gray-900">#{bitacoraDoc.numero}</span>}
                  {bitacoraDoc.clienteNombre && <span> — {bitacoraDoc.clienteNombre}</span>}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* New entry form */}
          <div className="space-y-3 border rounded-xl p-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Select value={newNotaTipo} onValueChange={setNewNotaTipo}>
                <SelectTrigger className="h-8 w-40 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BITACORA_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-1.5">
                        <t.icon className="h-3 w-3" />
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Escribir nota..."
              value={newNota}
              onChange={(e) => setNewNota(e.target.value)}
              className="min-h-[60px] text-sm rounded-lg resize-none"
            />
            <Button
              size="sm"
              onClick={handleAddBitacora}
              disabled={!newNota.trim() || createBitacoraMutation.isPending}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700"
            >
              {createBitacoraMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Agregar Entrada
            </Button>
          </div>

          {/* Entries list */}
          <div className="space-y-2 mt-2">
            {bitacoraLoading ? (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : bitacoraEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin entradas en la bitácora</p>
                <p className="text-xs">Agrega una nota para comenzar el seguimiento</p>
              </div>
            ) : (
              bitacoraEntries.map((entry) => {
                const typeConfig = BITACORA_TYPES.find(t => t.value === entry.tipo) || BITACORA_TYPES[0];
                const TypeIcon = typeConfig.icon;
                return (
                  <div key={entry.id} className="border rounded-xl p-3 space-y-1.5 bg-white hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`${typeConfig.color} text-[10px] gap-1`}>
                          <TypeIcon className="w-2.5 h-2.5" />
                          {typeConfig.label}
                        </Badge>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(entry.createdAt)} · {getTimeAgo(entry.createdAt)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteBitacoraMutation.mutate(entry.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.nota}</p>
                    <p className="text-[10px] text-gray-400">por {entry.autorNombre}</p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==============================
// Cotizaciones Table
// ==============================

function CotizacionesTable({ quotes, isAdmin, onBitacora }: {
  quotes: Quote[];
  isAdmin: boolean;
  onBitacora: (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter by status
  const filteredByStatus = statusFilter === "all"
    ? quotes
    : quotes.filter(q => q.status === statusFilter);
  const displayed = showAll ? filteredByStatus : filteredByStatus.slice(0, 15);

  // Status counts for filter badges
  const statusCounts = {
    all: quotes.length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    draft: quotes.filter(q => q.status === 'draft').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: '✅ Estado actualizado' });
    },
    onError: () => {
      toast({ title: '❌ Error al actualizar estado', variant: 'destructive' });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: '✅ Cotización duplicada' });
    },
    onError: () => {
      toast({ title: '❌ Error al duplicar', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: '✅ Cotización eliminada' });
    },
    onError: () => {
      toast({ title: '❌ Error al eliminar', variant: 'destructive' });
    },
  });

  if (quotes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay cotizaciones</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status filter pills */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 overflow-x-auto">
        {[
          { key: 'all', label: 'Todas', count: statusCounts.all },
          { key: 'sent', label: 'Enviadas', count: statusCounts.sent },
          { key: 'accepted', label: 'Aceptadas', count: statusCounts.accepted },
          { key: 'draft', label: 'Borradores', count: statusCounts.draft },
          { key: 'rejected', label: 'Rechazadas', count: statusCounts.rejected },
        ].filter(f => f.count > 0 || f.key === 'all').map((f) => (
          <Button
            key={f.key}
            variant={statusFilter === f.key ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full px-3 gap-1.5 whitespace-nowrap ${
              statusFilter === f.key 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => { setStatusFilter(f.key); setShowAll(false); }}
          >
            {f.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              statusFilter === f.key ? 'bg-white/20' : 'bg-gray-100'
            }`}>{f.count}</span>
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">N° Cotización</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              {isAdmin && <TableHead className="text-xs">Creado por</TableHead>}
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
              <TableHead className="text-xs w-20 text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((q) => {
              const status = quoteStatusMap[q.status] || quoteStatusMap.draft;
              const StatusIcon = status.icon;
              return (
                <TableRow key={q.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-xs font-medium text-gray-900">
                    #{q.quoteNumber}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium text-gray-900">{q.clientName}</div>
                    {q.clientRut && (
                      <div className="text-[10px] text-gray-400">RUT: {q.clientRut}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${status.color} text-[10px] gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                    {q.status === 'accepted' && q.notes?.includes('[NVV-AUTO]') && (
                      <div className="text-[9px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Auto NVV
                      </div>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-xs text-gray-600">
                      {q.creatorName || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-xs">
                    <div>{formatDate(q.createdAt)}</div>
                    <div className="text-[10px] text-gray-400">{getTimeAgo(q.createdAt)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-right font-bold text-blue-600">
                    {formatCurrency(q.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                        onClick={() => onBitacora("cotizacion", q.id, q.quoteNumber, q.clientName, q.clientRut)}
                        title="Bitácora"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => window.open(`/tomador-pedidos?edit=${q.id}`, '_blank')}
                            className="text-xs gap-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver / Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {q.status === 'draft' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: q.id, status: 'sent' })}
                              className="text-xs gap-2"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Marcar como enviada
                            </DropdownMenuItem>
                          )}
                          {(q.status === 'draft' || q.status === 'sent') && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: q.id, status: 'rejected' })}
                              className="text-xs gap-2"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Marcar como rechazada
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => duplicateMutation.mutate(q.id)}
                            className="text-xs gap-2"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Duplicar cotización
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm('¿Estás seguro de eliminar esta cotización?')) {
                                deleteMutation.mutate(q.id);
                              }
                            }}
                            className="text-xs gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {filteredByStatus.length > 15 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todas (${filteredByStatus.length - 15} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// NVV Table
// ==============================

function NVVTable({ records, onBitacora }: {
  records: NVVRecord[];
  onBitacora: (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay notas de venta pendientes</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant. Pend.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r) => (
              <TableRow key={r.id} className="hover:bg-gray-50/50">
                <TableCell className="text-xs">
                  <div className="font-medium">{r.NUDO}</div>
                  <div className="text-[10px] text-gray-400">{r.TIDO}</div>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.FEEMDO)}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.NOKOEN}>
                  {r.NOKOEN}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.NOKOPR}>
                  {r.NOKOPR}
                </TableCell>
                <TableCell className="text-xs text-right">
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {r.cantidadPendiente?.toLocaleString("es-CL")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-amber-600">
                  {formatCurrency(r.totalPendiente)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => onBitacora("nvv", r.id, r.NUDO, r.NOKOEN)}
                    title="Bitácora"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// GDV Table
// ==============================

function GDVTable({ records, onBitacora }: {
  records: GDVRecord[];
  onBitacora: (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay guías de despacho pendientes</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Guía</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Cant.</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r, idx) => (
              <TableRow key={`${r.numeroGuia}-${idx}`} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-medium">{r.numeroGuia}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha)}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.cliente}>
                  {r.cliente}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.producto}>
                  {r.producto}
                </TableCell>
                <TableCell className="text-xs text-right">
                  {r.cantidad?.toLocaleString("es-CL")}
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-purple-600">
                  {formatCurrency(r.monto)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => onBitacora("gdv", r.numeroGuia, r.numeroGuia, r.cliente, r.codigoCliente)}
                    title="Bitácora"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// Facturas Table
// ==============================

function FacturasTable({ records, onBitacora }: {
  records: any[];
  onBitacora: (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? records : records.slice(0, 20);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <FileCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay facturas en el mes actual</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Documento</TableHead>
              <TableHead className="text-xs">Tipo</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs text-right">Monto</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((r, idx) => (
              <TableRow key={`${r.documentNumber || r.nudo || idx}`} className="hover:bg-gray-50/50">
                <TableCell className="text-xs font-medium">
                  {r.documentNumber || r.nudo || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={r.docType === "FCV" ? "default" : "secondary"} className="text-[10px]">
                    {r.docType || "FCV"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.date || r.fecha || "")}</TableCell>
                <TableCell className="text-xs font-medium max-w-[150px] truncate" title={r.clientName || r.nokoen || ""}>
                  {r.clientName || r.nokoen || "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate" title={r.productName || r.nokopr || ""}>
                  {r.productName || r.nokopr || "—"}
                </TableCell>
                <TableCell className="text-xs text-right font-bold text-green-600">
                  {formatCurrency(Number(r.amount) || 0)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => onBitacora("factura", r.documentNumber || r.nudo || idx.toString(), r.documentNumber || r.nudo || "", r.clientName || r.nokoen || "")}
                    title="Bitácora"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {records.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${records.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ==============================
// Catalog Orders Table
// ==============================

const catalogStatusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  pendiente: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Aprobado", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  modified: { label: "Modificado", icon: Package, color: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rechazado", icon: XCircle, color: "bg-red-100 text-red-700" },
  sent: { label: "Enviado", icon: Send, color: "bg-purple-100 text-purple-700" },
};

function CatalogOrdersTable({ orders, onBitacora }: {
  orders: EcommerceOrder[];
  onBitacora: (tipo: string, id: string, numero: string, clienteNombre: string, clienteRut?: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? orders : orders.slice(0, 20);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Store className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">No hay pedidos del catálogo</p>
        <p className="text-xs text-gray-400 mt-1">Los pedidos realizados desde el catálogo público aparecerán aquí</p>
      </div>
    );
  }

  const getOrderItems = (order: EcommerceOrder) => {
    if (!order.items) return [];
    return typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs">Productos</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((order) => {
              const status = catalogStatusConfig[order.status] || catalogStatusConfig.pending;
              const StatusIcon = status.icon;
              const items = getOrderItems(order);

              return (
                <TableRow key={order.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-xs">
                    <div className="font-medium text-gray-900">{order.clientName}</div>
                    {order.clientCompany && (
                      <div className="text-[10px] text-gray-400">{order.clientCompany}</div>
                    )}
                    {order.clientEmail && (
                      <div className="text-[10px] text-gray-400">{order.clientEmail}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">
                    {order.assignedSalespersonName || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${status.color} text-[10px] gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium">{items.length}</span>
                    <span className="text-gray-400 ml-1">producto{items.length !== 1 ? "s" : ""}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{formatDate(order.createdAt)}</div>
                    <div className="text-[10px] text-gray-400">{getTimeAgo(order.createdAt)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-right font-bold text-orange-600">
                    {formatCurrency(parseFloat(order.total || "0"))}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                      onClick={() => onBitacora("catalogo", order.id, order.id.slice(-6), order.clientName)}
                      title="Bitácora"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {orders.length > 20 && (
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Ver menos" : `Ver todos (${orders.length - 20} más)`}
          </Button>
        </div>
      )}
    </div>
  );
}
