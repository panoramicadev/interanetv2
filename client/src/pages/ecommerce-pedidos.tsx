import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ShoppingCart, Clock, CheckCircle, XCircle, Package, Eye, FileText,
  Phone, Mail, Search, Filter, ArrowLeft, User, MapPin, ChevronRight,
  Truck, DollarSign, Calendar, AlertCircle, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Types
interface OrderItem {
  productId?: string;
  productName: string;
  productCode?: string;
  sku?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  subtotal?: number;
  totalPrice?: number;
  imageUrl?: string;
  selectedColor?: string;
  selectedPackaging?: string;
}

interface EcommerceOrder {
  id: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCompany?: string;
  assignedSalespersonId?: string;
  assignedSalespersonName?: string;
  shippingAddress?: string;
  status: string;
  total: string;
  subtotal?: string;
  tax?: string;
  items: OrderItem[] | string;
  notes?: string;
  quoteId?: string;
  createdAt: string;
  approvedAt?: string;
  modifiedAt?: string;
}

// Helpers
const formatPrice = (price: string | number | undefined | null) => {
  if (price === undefined || price === null) return '$0';
  const numPrice = typeof price === 'string' ? parseFloat(price) || 0 : price;
  return `$${numPrice.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateString;
  }
};

const timeAgo = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

const getOrderItems = (order: EcommerceOrder): OrderItem[] => {
  if (!order.items) return [];
  return typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  pendiente: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "Aprobado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  modified: { label: "Modificado", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Package },
  rejected: { label: "Rechazado", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
  sent: { label: "Enviado", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Truck },
};

// ==================== ORDER DETAIL VIEW ====================
function OrderDetail({ order, onBack }: { order: EcommerceOrder; onBack: () => void }) {
  const items = getOrderItems(order);
  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const subtotal = parseFloat(order.subtotal || '0') || items.reduce((sum, i) => sum + (i.subtotal || (i.unitPrice || i.price || 0) * i.quantity), 0);
  const tax = parseFloat(order.tax || '0') || Math.round(subtotal * 0.19);
  const total = parseFloat(order.total || '0');

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              Pedido #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(order.createdAt)}
            <span className="text-gray-300">·</span>
            <span>{timeAgo(order.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button size="sm" className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white">
            <FileText className="w-4 h-4 mr-2" />
            Generar Cotización
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Products + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products Card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Productos</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {items.length}
                </span>
              </div>
              <span className={`text-xs font-bold ${status.color}`}>
                {status.label}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((item, index) => {
                const itemPrice = item.unitPrice || item.price || 0;
                const itemTotal = item.subtotal || item.totalPrice || itemPrice * item.quantity;
                return (
                  <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.productName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {item.selectedColor && (
                          <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedColor}
                          </span>
                        )}
                        {(item.selectedPackaging || item.sku) && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedPackaging || item.sku}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatPrice(itemPrice)} × {item.quantity}
                      </div>
                    </div>
                    {/* Price */}
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(itemTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#FF6E23]" />
                <h3 className="font-bold text-gray-900">Resumen de Pago</h3>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Subtotal ({items.length} producto{items.length !== 1 ? 's' : ''})</span>
                <span className="font-medium text-gray-700">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">IVA (19%)</span>
                <span className="font-medium text-gray-700">{formatPrice(tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total del pedido</span>
                <span className="text-xl font-black text-[#FF6E23]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Notas del Cliente</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Actividad</h3>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF6E23] mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Pedido recibido</p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                {order.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Pedido aprobado</p>
                      <p className="text-xs text-gray-500">{formatDate(order.approvedAt)}</p>
                    </div>
                  </div>
                )}
                {order.quoteId && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Cotización generada</p>
                      <p className="text-xs text-gray-500">Ref: {order.quoteId}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Customer Info */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Cliente</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6E23] to-amber-400 flex items-center justify-center text-white font-bold text-sm">
                  {order.clientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{order.clientName}</h4>
                  {order.clientCompany && (
                    <p className="text-xs text-gray-500">{order.clientCompany}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contacto</h5>
                {order.clientEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{order.clientEmail}</span>
                  </div>
                )}
                {order.clientPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{order.clientPhone}</span>
                  </div>
                )}
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dirección de envío</h5>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                    <span>{order.shippingAddress}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Salesperson */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Vendedor Asignado</h3>
            </div>
            <div className="px-5 py-4">
              {order.assignedSalespersonName ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{order.assignedSalespersonName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <AlertCircle className="w-4 h-4" />
                  Sin vendedor asignado
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} />
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
