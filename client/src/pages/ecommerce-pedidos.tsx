import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNumericOrderId } from "@/lib/utils";
import {
  ShoppingCart, Clock, CheckCircle, XCircle, Package, Eye, FileText,
  Phone, Mail, Search, Filter, ArrowLeft, User, MapPin, ChevronRight,
  Truck, DollarSign, Calendar, AlertCircle, MoreHorizontal,
  Pencil, Archive, Trash2, FileImage, Landmark
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
// ==================== MAIN PAGE ====================
export default function EcommercePedidos() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<EcommerceOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<EcommerceOrder[]>({
    queryKey: ['/api/ecommerce/orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set('status', statusFilter);
      const response = await fetch(`/api/ecommerce/orders?${params}`);
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
        <OrderDetailView order={selectedOrder} onBack={() => setSelectedOrder(null)} onOrderDeleted={() => setSelectedOrder(null)} />
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
    </div>
  );
}
