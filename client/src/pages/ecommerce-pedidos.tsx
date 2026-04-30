import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNumericOrderId } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  ShoppingCart, Clock, CheckCircle, XCircle, Package, Eye, FileText,
  Phone, Mail, Search, Filter, ArrowLeft, User, MapPin, ChevronRight,
  Truck, DollarSign, Calendar, AlertCircle, MoreHorizontal,
  Pencil, Archive, Trash2, FileImage, Landmark, Loader2, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import {
  EcommerceOrder, OrderDetailView, formatPrice, statusConfig, timeAgo, getOrderItems
} from "@/components/ecommerce/order-detail-view";
import { useLocation } from "wouter";
// ==================== MAIN PAGE ====================
export default function EcommercePedidos() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(null);
  const [, navigate] = useLocation();

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

  // Filter by search
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

  // KPI calculations
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'pendiente');
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const pendingRevenue = pendingOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

  // Detail view
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos eCommerce</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona los pedidos recibidos desde la tienda</p>
        </div>
      </div>

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
              <SelectItem value="sent">Enviados</SelectItem>
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
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Cliente</span>
              <span>Vendedor</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
              <span>Fecha</span>
              <span />
            </div>

            {/* Table Rows */}
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
                    {/* Client */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200 text-sm font-bold text-gray-400">
                        {order.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName}</h4>
                        <p className="text-[10px] text-gray-400 truncate">{order.clientEmail || `${items.length} producto${items.length !== 1 ? 's' : ''}`}</p>
                      </div>
                    </div>

                    {/* Salesperson */}
                    <div className="text-sm text-gray-600 truncate">
                      {order.assignedSalespersonName || <span className="text-gray-300">—</span>}
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</span>
                    </div>

                    {/* Date */}
                    <div>
                      <span className="text-[10px] text-gray-500">{timeAgo(order.createdAt)}</span>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-end">
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF6E23] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Mostrando {filtered.length} de {orders.length} pedido{orders.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {/* Cotizaciones enviadas a recepción (presupuestos para ingresar al ERP) */}
      <SentQuotesSection />
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

function SentQuotesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: allQuotes = [], isLoading } = useQuery<SentQuote[]>({
    queryKey: ["/api/quotes"],
  });

  const sentQuotes = allQuotes.filter(
    (q) => q.status === "sent" || q.sentToFinanceAt
  );

  const erpMutation = useMutation({
    mutationFn: async ({ id, entered }: { id: string; entered: boolean }) => {
      return apiRequest(`/api/quotes/${id}/erp-status`, {
        method: "PATCH",
        data: { entered },
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: vars.entered ? "✅ Marcado ingresado al ERP" : "Marcado como pendiente" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return null;
  if (sentQuotes.length === 0) return null;

  const pending = sentQuotes.filter((q) => !q.erpEntered).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Presupuestos enviados a recepción</h2>
            <p className="text-xs text-gray-500">Cotizaciones para ingresar al ERP — gestionar igual que pedidos de tienda</p>
          </div>
        </div>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5" /> {pending} pendiente{pending !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {sentQuotes.map((quote) => (
          <div
            key={quote.id}
            className={`group border rounded-xl p-5 transition-all duration-200 ${
              quote.erpEntered ? "bg-emerald-50/30 border-emerald-200" : "bg-white hover:shadow-md hover:border-orange-300"
            }`}
          >
            <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900">Presupuesto #{quote.quoteNumber}</h3>
                {quote.erpEntered ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1">
                    <CheckCircle className="h-3 w-3" /> Ingresado al ERP
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                    <Clock className="h-3 w-3" /> Pendiente
                  </Badge>
                )}
                {quote.segment && <Badge variant="outline" className="text-[10px]">{quote.segment}</Badge>}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{formatPrice(quote.total)}</div>
                {quote.subtotal && <div className="text-xs text-gray-500">Subtotal: {formatPrice(quote.subtotal)}</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Cliente</div>
                <div className="font-medium text-gray-900 truncate">{quote.clientName}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Fecha</div>
                <div className="font-medium text-gray-900">
                  {quote.sentToFinanceAt ? format(new Date(quote.sentToFinanceAt), "dd/MM/yyyy", { locale: es }) : format(new Date(quote.createdAt), "dd/MM/yyyy", { locale: es })}
                </div>
              </div>
              {quote.creatorName && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Vendedor</div>
                  <div className="font-medium text-gray-900 truncate">{quote.creatorName}</div>
                </div>
              )}
              {quote.ocNumber && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">N° OC</div>
                  <div className="font-medium text-orange-600">{quote.ocNumber}</div>
                </div>
              )}
              {quote.paymentMethod && (
                <div className="col-span-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Método de pago</div>
                  <div className="font-medium text-gray-900">{quote.paymentMethod}</div>
                </div>
              )}
            </div>

            {quote.scope && (
              <div className="mb-4 bg-slate-50 border-l-4 border-slate-400 rounded-r-lg p-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Alcances</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{quote.scope}</div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <Button
                size="sm"
                className={quote.erpEntered ? "" : "bg-emerald-600 hover:bg-emerald-700"}
                variant={quote.erpEntered ? "outline" : "default"}
                onClick={() => erpMutation.mutate({ id: quote.id, entered: !quote.erpEntered })}
                disabled={erpMutation.isPending}
              >
                {erpMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                {quote.erpEntered ? "Marcar como no ingresado" : "Marcar ingresado al ERP"}
              </Button>
              {quote.erpEntered && quote.erpEnteredAt && (
                <span className="text-xs text-slate-500 ml-2">
                  Ingresado el {format(new Date(quote.erpEnteredAt), "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
