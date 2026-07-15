import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart, Clock, CheckCircle, XCircle, FileText,
  Search, Filter, ChevronRight,
  DollarSign, Loader2, Database, Inbox, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

import {
  EcommerceOrder, OrderDetailView, formatPrice, statusConfig, timeAgo, getOrderItems
} from "@/components/ecommerce/order-detail-view";
import ErpOrdersTable from "@/components/ecommerce/erp-orders-table";
import { SolicitudesWebPanel } from "@/pages/cotizaciones-b2c";

// Cuenta de solicitudes web pendientes para el badge de la pestaña "Solicitudes".
function useSolicitudesPendientes() {
  const { data } = useQuery<{ requests: { status: string }[] }>({
    queryKey: ["/api/b2c/quote-requests"],
    queryFn: async () => {
      const res = await fetch("/api/b2c/quote-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar solicitudes");
      return res.json();
    },
    retry: false,
  });
  const requests = data?.requests ?? [];
  return {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
  };
}

// ==================== MAIN PAGE ====================
// La página tiene dos modos según el rol:
//   - reception  → 3 pestañas (ERP, Pedidos de Tienda para aprobar, Cotizaciones)
//   - resto      → vista simple con solo el listado ERP (admin/supervisor/encargado_area)
export default function EcommercePedidos() {
  const { user } = useAuth();
  const isReception = user?.role === 'reception';

  if (isReception) return <ReceptionPedidosView />;

  return <DefaultPedidosView />;
}

// ==================== VISTA PRINCIPAL (admin/supervisor/encargado) ====================
// Dos pestañas: el listado ERP y las Solicitudes que llegan desde el sitio web.
function DefaultPedidosView() {
  const { total: solicitudesTotal, pending: solicitudesPending } = useSolicitudesPendientes();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">Listado de pedidos del ERP. Los pedidos ingresados desde Panorámica Market quedan destacados.</p>
      </div>

      <Tabs defaultValue="pedidos" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 gap-3 sm:gap-4 bg-transparent p-0 h-auto w-full">
          <TabsTrigger
            value="pedidos"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <Package className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Pedidos</div>
              <div className="text-xs text-gray-500 font-normal truncate">Listado del ERP</div>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="solicitudes"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="relative w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <Inbox className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
              {solicitudesPending > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {solicitudesPending}
                </span>
              )}
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Solicitudes</div>
              <div className="text-xs text-gray-500 font-normal truncate">{solicitudesTotal} solicitud{solicitudesTotal !== 1 ? "es" : ""} desde la web</div>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-0 space-y-6">
          <ErpOrdersTable />
        </TabsContent>

        <TabsContent value="solicitudes" className="mt-0 space-y-6">
          <SolicitudesWebPanel embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== RECEPTION VIEW (3 pestañas) ====================
function ReceptionPedidosView() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<EcommerceOrder[]>({
    queryKey: ['/api/ecommerce/orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set('status', statusFilter);
      const response = await fetch(`/api/ecommerce/orders?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    retry: false,
  });

  const filtered = orders.filter(order => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.clientName.toLowerCase().includes(term) ||
      (order.clientEmail || '').toLowerCase().includes(term) ||
      order.id.toLowerCase().includes(term) ||
      (order.assignedSalespersonName || '').toLowerCase().includes(term)
    );
  });

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'pendiente');
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const pendingRevenue = pendingOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  const { data: allQuotes = [] } = useQuery<SentQuote[]>({
    queryKey: ["/api/quotes"],
  });
  const sentQuotesCount = allQuotes.filter(
    (q) => q.status === "sent" || q.sentToFinanceAt
  ).length;

  const { data: erpData } = useQuery<{ count: number }>({
    queryKey: ["/api/ecommerce/erp-orders"],
  });
  const erpCount = erpData?.count ?? 0;

  const { total: solicitudesTotal, pending: solicitudesPending } = useSolicitudesPendientes();

  if (selectedOrder) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <OrderDetailView
          order={selectedOrder}
          onBack={() => setSelectedOrder(null)}
          onOrderDeleted={() => setSelectedOrder(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos eCommerce</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona los pedidos recibidos desde la tienda</p>
        </div>
      </div>

      <Tabs defaultValue="tienda" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 bg-transparent p-0 h-auto w-full">
          <TabsTrigger
            value="erp"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <Database className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Pedidos ERP</div>
              <div className="text-xs text-gray-500 font-normal truncate">{erpCount} pedido{erpCount !== 1 ? "s" : ""} en ERP</div>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="tienda"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <ShoppingCart className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Pedidos de Tienda</div>
              <div className="text-xs text-gray-500 font-normal truncate">{orders.length} pedido{orders.length !== 1 ? "s" : ""} recibido{orders.length !== 1 ? "s" : ""}</div>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="cotizaciones"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <FileText className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Cotizaciones</div>
              <div className="text-xs text-gray-500 font-normal truncate">{sentQuotesCount} cotización{sentQuotesCount !== 1 ? "es" : ""} enviada{sentQuotesCount !== 1 ? "s" : ""}</div>
            </div>
          </TabsTrigger>
          <TabsTrigger
            value="solicitudes"
            className="group justify-start gap-3 px-4 sm:px-5 py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-gray-300 data-[state=active]:border-[#FF6E23] data-[state=active]:bg-orange-50/40 data-[state=active]:shadow-md transition-all"
          >
            <div className="relative w-11 h-11 rounded-xl bg-gray-100 group-data-[state=active]:bg-[#FF6E23] flex items-center justify-center flex-shrink-0 transition-colors">
              <Inbox className="h-5 w-5 text-gray-500 group-data-[state=active]:text-white" />
              {solicitudesPending > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {solicitudesPending}
                </span>
              )}
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Solicitudes</div>
              <div className="text-xs text-gray-500 font-normal truncate">{solicitudesTotal} desde la web</div>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="erp" className="mt-0 space-y-6">
          <ErpOrdersTable />
        </TabsContent>

        <TabsContent value="tienda" className="mt-0 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">PENDIENTES</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{pendingOrders.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">{formatPrice(pendingRevenue)}</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">APROBADOS</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{approvedOrders.length}</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">TOTAL</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{orders.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">pedidos</div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[#FF6E23]" />
                </div>
                <span className="text-[10px] font-bold text-[#FF6E23] bg-orange-50 px-2 py-0.5 rounded-full">REVENUE</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{formatPrice(totalRevenue)}</div>
              <div className="text-xs text-gray-500 mt-0.5">facturado</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por cliente, email o ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl border-gray-200"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] rounded-xl">
                  <Filter className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="modified">Modificados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                  <SelectItem value="ingresado">Ingresados al ERP</SelectItem>
                  <SelectItem value="preparacion">En preparación</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="transito">En curso</SelectItem>
                  <SelectItem value="entregado">Entregados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[#FF6E23] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-500">Cargando pedidos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Sin pedidos</h3>
                <p className="text-sm text-gray-500">No hay pedidos {statusFilter !== "all" ? "con este estado" : "aún"}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span>Cliente</span>
                  <span>Vendedor</span>
                  <span>Estado</span>
                  <span className="text-right">Total</span>
                  <span>Fecha</span>
                  <span />
                </div>

                <div className="divide-y divide-gray-50">
                  {filtered.map((order) => {
                    const status = statusConfig[order.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    const items = getOrderItems(order);

                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-4 hover:bg-orange-50/30 cursor-pointer transition-colors items-center group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200 text-sm font-bold text-gray-400">
                            {order.clientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName}</h4>
                            <p className="text-[10px] text-gray-400 truncate">{order.clientEmail || `${items.length} producto${items.length !== 1 ? 's' : ''}`}</p>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 truncate">
                          {order.assignedSalespersonName || <span className="text-gray-300">—</span>}
                        </div>

                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${status.bg} ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500">
                            {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy", { locale: es }) : "—"}
                          </span>
                        </div>

                        <div className="flex justify-end">
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF6E23] transition-colors" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                  Mostrando {filtered.length} de {orders.length} pedido{orders.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cotizaciones" className="mt-0 space-y-6">
          <SentQuotesTable />
        </TabsContent>

        <TabsContent value="solicitudes" className="mt-0 space-y-6">
          <SolicitudesWebPanel embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== SENT QUOTES (RECEPTION-MANAGEABLE) ====================

interface SentQuote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientRut?: string;
  status: string;
  total: string | number;
  subtotal?: string | number;
  createdAt: string;
  creatorName?: string;
  creatorFirstName?: string;
  creatorLastName?: string;
  sentToFinanceAt?: string | null;
  ocNumber?: string | null;
  segment?: string | null;
  paymentMethod?: string | null;
  scope?: string | null;
  erpEntered?: boolean;
  erpEnteredAt?: string | null;
}

function SentQuotesTable() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: allQuotes = [], isLoading } = useQuery<SentQuote[]>({
    queryKey: ["/api/quotes"],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "ingresado">("all");
  const [ingresarDialog, setIngresarDialog] = useState<SentQuote | null>(null);
  const [ingresarNotes, setIngresarNotes] = useState("");
  const [detailQuote, setDetailQuote] = useState<SentQuote | null>(null);

  const sentQuotes = allQuotes.filter(
    (q) => q.status === "sent" || q.sentToFinanceAt
  );

  const filtered = sentQuotes.filter((q) => {
    if (filter === "pending" && q.erpEntered) return false;
    if (filter === "ingresado" && !q.erpEntered) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return (
      q.clientName.toLowerCase().includes(t) ||
      q.quoteNumber.toLowerCase().includes(t) ||
      (q.creatorName || "").toLowerCase().includes(t) ||
      (q.ocNumber || "").toLowerCase().includes(t)
    );
  });

  const pendingCount = sentQuotes.filter((q) => !q.erpEntered).length;
  const ingresadosCount = sentQuotes.filter((q) => q.erpEntered).length;
  const totalRevenue = sentQuotes.reduce((s, q) => s + (Number(q.total) || 0), 0);
  const pendingRevenue = sentQuotes.filter((q) => !q.erpEntered).reduce((s, q) => s + (Number(q.total) || 0), 0);

  const erpMutation = useMutation({
    mutationFn: async ({ id, entered, notes }: { id: string; entered: boolean; notes?: string }) => {
      return apiRequest(`/api/quotes/${id}/erp-status`, {
        method: "PATCH",
        data: { entered, notes },
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: vars.entered ? "✅ Presupuesto ingresado al ERP" : "Marcado como pendiente" });
      setIngresarDialog(null);
      setIngresarNotes("");
      setDetailQuote(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const openIngresar = (q: SentQuote) => {
    setIngresarDialog(q);
    setIngresarNotes("");
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">PENDIENTES</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{pendingCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">{formatPrice(pendingRevenue)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">INGRESADOS</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{ingresadosCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">TOTAL</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{sentQuotes.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">cotizaciones</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#FF6E23]" />
            </div>
            <span className="text-[10px] font-bold text-[#FF6E23] bg-orange-50 px-2 py-0.5 rounded-full">REVENUE</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{formatPrice(totalRevenue)}</div>
          <div className="text-xs text-gray-500 mt-0.5">en cotizaciones</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente, número, vendedor u OC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-gray-200"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="ingresado">Ingresados al ERP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#FF6E23] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Cargando cotizaciones...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Sin cotizaciones</h3>
            <p className="text-sm text-gray-500">No hay cotizaciones {filter !== "all" ? "con este estado" : "enviadas aún"}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Cliente</span>
              <span>Vendedor</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
              <span>Fecha</span>
              <span />
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map((quote) => (
                <div
                  key={quote.id}
                  onClick={() => setDetailQuote(quote)}
                  className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-4 hover:bg-orange-50/30 cursor-pointer transition-colors items-center group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200 text-sm font-bold text-gray-400">
                      {quote.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{quote.clientName}</h4>
                      <p className="text-[10px] text-gray-400 truncate">
                        #{quote.quoteNumber}{quote.ocNumber ? ` · OC ${quote.ocNumber}` : ""}{quote.segment ? ` · ${quote.segment}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {quote.creatorName || <span className="text-gray-300">—</span>}
                  </div>
                  <div>
                    {quote.erpEntered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Ingresado ERP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                        <Clock className="w-3 h-3" /> Pendiente
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(quote.total)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500">
                      {quote.sentToFinanceAt
                        ? formatDistanceToNow(new Date(quote.sentToFinanceAt), { locale: es, addSuffix: true })
                        : formatDistanceToNow(new Date(quote.createdAt), { locale: es, addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF6E23] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Mostrando {filtered.length} de {sentQuotes.length} cotización{sentQuotes.length !== 1 ? "es" : ""}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!detailQuote} onOpenChange={(o) => { if (!o) setDetailQuote(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-amber-50 to-white border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              Cotización #{detailQuote?.quoteNumber}
            </DialogTitle>
            <DialogDescription>{detailQuote?.clientName}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Total</div>
                <div className="font-bold text-gray-900 text-lg">{detailQuote && formatPrice(detailQuote.total)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Estado</div>
                {detailQuote?.erpEntered ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
                    <CheckCircle className="h-3 w-3" /> Ingresado al ERP
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                    <Clock className="h-3 w-3" /> Pendiente
                  </Badge>
                )}
              </div>
              {detailQuote?.creatorName && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Vendedor</div>
                  <div className="font-medium text-gray-900">{detailQuote.creatorName}</div>
                </div>
              )}
              {detailQuote?.ocNumber && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">N° OC</div>
                  <div className="font-medium text-orange-600">{detailQuote.ocNumber}</div>
                </div>
              )}
              {detailQuote?.segment && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Segmento</div>
                  <div className="font-medium text-gray-900">{detailQuote.segment}</div>
                </div>
              )}
              {detailQuote?.paymentMethod && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Método de pago</div>
                  <div className="font-medium text-gray-900">{detailQuote.paymentMethod}</div>
                </div>
              )}
            </div>
            {detailQuote?.scope && (
              <div className="bg-slate-50 border-l-4 border-slate-400 rounded-r-lg p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Alcances</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{detailQuote.scope}</div>
              </div>
            )}
            {detailQuote?.erpEntered && detailQuote.erpEnteredAt && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                ✓ Ingresado al ERP el {format(new Date(detailQuote.erpEnteredAt), "dd/MM/yyyy HH:mm", { locale: es })}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
            <Button variant="outline" onClick={() => setDetailQuote(null)}>Cerrar</Button>
            {detailQuote && !detailQuote.erpEntered && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { openIngresar(detailQuote); setDetailQuote(null); }}
              >
                <Database className="h-4 w-4 mr-2" /> Ingresar al ERP
              </Button>
            )}
            {detailQuote?.erpEntered && (
              <Button
                variant="outline"
                onClick={() => erpMutation.mutate({ id: detailQuote.id, entered: false })}
                disabled={erpMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" /> Marcar como no ingresado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ingresarDialog} onOpenChange={(open) => { if (!open) setIngresarDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600" />
              Ingresar presupuesto al ERP
            </DialogTitle>
            <DialogDescription>
              {ingresarDialog && (
                <>
                  Confirma el ingreso al ERP de <strong>#{ingresarDialog.quoteNumber}</strong>
                  {ingresarDialog.ocNumber && <> · OC <strong>{ingresarDialog.ocNumber}</strong></>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-medium">Notas internas (opcional)</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={ingresarNotes}
                onChange={(e) => setIngresarNotes(e.target.value)}
                placeholder="N° NVV, observaciones del ingreso, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngresarDialog(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => ingresarDialog && erpMutation.mutate({ id: ingresarDialog.id, entered: true, notes: ingresarNotes.trim() || undefined })}
              disabled={erpMutation.isPending}
            >
              {erpMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar ingreso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
