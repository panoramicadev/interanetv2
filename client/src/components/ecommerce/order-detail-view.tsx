import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getNumericOrderId } from "@/lib/utils";
import {
  Clock, CheckCircle, XCircle, Package, FileText,
  Phone, Mail, ArrowLeft, User, MapPin,
  Truck, DollarSign, Calendar, AlertCircle, MoreHorizontal,
  Pencil, Archive, Trash2, FileImage, Landmark
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// Export the types so order lists can use them
export interface OrderItem {
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

export interface EcommerceOrder {
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
  paymentCondition?: string;
  paymentReceiptUrl?: string;
  createdAt: string;
  approvedAt?: string;
  modifiedAt?: string;
}

// Helpers
export const formatPrice = (price: string | number | undefined | null) => {
  if (price === undefined || price === null) return '$0';
  const numPrice = typeof price === 'string' ? parseFloat(price) || 0 : price;
  return `$${numPrice.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return dateString;
  }
};

export const timeAgo = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

export const getOrderItems = (order: EcommerceOrder): OrderItem[] => {
  if (!order.items) return [];
  return typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
};

export const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  pendiente: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "Aprobado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  modified: { label: "Modificado", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Package },
  rejected: { label: "Rechazado", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
  sent: { label: "Enviado", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Truck },
  // ERP Specific statuses mapping 
  ingresado: { label: "Ingresado ERP", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: Package },
  despacho: { label: "En Despacho", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", icon: Truck },
  facturado: { label: "Facturado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
};

// Component props
interface OrderDetailViewProps {
  order: EcommerceOrder;
  onBack: () => void;
  onOrderDeleted?: () => void;
  isClientView?: boolean; // Determines if admin actions are hidden
}

export function OrderDetailView({ order, onBack, onOrderDeleted, isClientView = false }: OrderDetailViewProps) {
  const items = getOrderItems(order);
  const statusKey = order.status?.toLowerCase() || 'pending';
  const status = statusConfig[statusKey] || statusConfig.pending;
  const StatusIcon = status.icon;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const subtotal = parseFloat(order.subtotal || '0') || items.reduce((sum, i) => sum + (i.subtotal || (i.unitPrice || i.price || 0) * i.quantity), 0);
  const tax = parseFloat(order.tax || '0') || Math.round(subtotal * 0.19);
  const total = parseFloat(order.total || '0') || Math.round(subtotal * 1.19); // Fallback to computed total

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              Pedido #{order.id?.includes('-') ? getNumericOrderId(order.id) : order.id}
            </h1>
            <span className={`inline-flex items-center flex-shrink-0 gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${status.bg} ${status.color}`}>
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
        
        {/* Admin Actions */}
        {!isClientView && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl shadow-sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={async () => {
                    const newStatus = order.status === 'pending' ? 'approved' : 'pending';
                    try {
                      await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: newStatus }),
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                      toast({ title: `Estado cambiado a ${statusConfig[newStatus]?.label || newStatus}` });
                      onBack();
                    } catch {
                      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  {order.status === 'pending' ? 'Aprobar Pedido' : 'Marcar Pendiente'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await fetch(`/api/ecommerce/orders/${order.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: 'archived' }),
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                      toast({ title: 'Pedido archivado' });
                      onBack();
                    } catch {
                      toast({ title: 'Error al archivar', variant: 'destructive' });
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="rounded-xl bg-[#FF6E23] hover:bg-[#E55E13] text-white shadow-sm">
              <FileText className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Generar Cotización</span>
            </Button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {!isClientView && (
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente el pedido #{getNumericOrderId(order.id)}. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await fetch(`/api/ecommerce/orders/${order.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/ecommerce/orders'] });
                      toast({ title: 'Pedido eliminado' });
                      onOrderDeleted?.();
                      onBack();
                    } catch {
                      toast({ title: 'Error al eliminar', variant: 'destructive' });
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Products + Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products Card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
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
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {items.map((item, index) => {
                const itemPrice = item.unitPrice || item.price || 0;
                const itemTotal = item.subtotal || item.totalPrice || itemPrice * item.quantity;
                return (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex-shrink-0 overflow-hidden border border-gray-100 hidden sm:flex">
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
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-2">{item.productName}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.selectedColor && (
                          <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedColor}
                          </span>
                        )}
                        {(item.selectedPackaging || item.sku || item.productCode) && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                            {item.selectedPackaging || item.sku || item.productCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatPrice(itemPrice)} × {item.quantity} unidades
                      </div>
                    </div>
                    {/* Price */}
                    <div className="text-left sm:text-right flex-shrink-0 mt-2 sm:mt-0">
                      <span className="text-sm font-bold text-gray-900">{formatPrice(itemTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
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
              {tax > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">IVA (19%)</span>
                  <span className="font-medium text-gray-700">{formatPrice(tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-xl font-black text-[#FF6E23]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Notas</h3>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Actividad</h3>
            </div>
            <div className="px-5 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF6E23] mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Emisión documentada</p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                {order.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Aprobación confirmada</p>
                      <p className="text-xs text-gray-500">{formatDate(order.approvedAt)}</p>
                    </div>
                  </div>
                )}
                {statusKey === 'despacho' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Guía de despacho emitida</p>
                      <p className="text-xs text-gray-500">Registrado en sistema ERP</p>
                    </div>
                  </div>
                )}
                {statusKey === 'facturado' && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Factura emitida</p>
                      <p className="text-xs text-gray-500">Transacción finalizada</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Customer Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Cliente</h3>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6E23] to-amber-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {order.clientName?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName || 'Cliente Genérico'}</h4>
                  {order.clientCompany && (
                    <p className="text-xs text-gray-500 truncate">{order.clientCompany}</p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              {(order.clientEmail || order.clientPhone) && (
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contacto</h5>
                  {order.clientEmail && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={order.clientEmail}>{order.clientEmail}</span>
                    </div>
                  )}
                  {order.clientPhone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{order.clientPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dirección de envío</h5>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="break-words">{order.shippingAddress}</span>
                  </div>
                </div>
              )}

              {/* Payment Condition & Receipt */}
              {order.paymentCondition && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Condición de pago</h5>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Landmark className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium truncate">{order.paymentCondition}</span>
                  </div>
                </div>
              )}

              {order.paymentReceiptUrl && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Comprobante de pago</h5>
                  <a
                    href={order.paymentReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#FF6E23] hover:text-[#FF6E23]/80 transition-colors font-medium break-all"
                  >
                    <FileImage className="w-4 h-4 flex-shrink-0" />
                    Ver comprobante enviado
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Salesperson */}
          {!isClientView && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Vendedor Asignado</h3>
              </div>
              <div className="px-5 py-4">
                {order.assignedSalespersonName ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">{order.assignedSalespersonName}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Sin vendedor asignado
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
