import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getNumericOrderId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Sparkles, Clock, CheckCircle, XCircle, RefreshCw, ArrowLeft,
  Trash2, Plus, Minus, Package, ShoppingCart, Loader2, User,
} from "lucide-react";

// ==========================================
// Types
// ==========================================

export interface SuggestedItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  imageUrl?: string | null;
  unit?: string | null;
}

export interface SuggestedOrder {
  id: string;
  clientId?: string;
  clientUserId: string;
  clientName: string;
  clientEmail?: string;
  createdById: string;
  createdByName?: string;
  createdByRole?: string;
  title?: string;
  items: SuggestedItem[] | string;
  subtotal: string;
  tax: string;
  total: string;
  priceListUsed?: string;
  branchDiscountPercent?: string | number;
  status: string;
  sellerNotes?: string;
  clientNotes?: string;
  acceptedAt?: string;
  modifiedAt?: string;
  rejectedAt?: string;
  resentAt?: string;
  convertedOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Helpers
// ==========================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    year: "numeric", month: "short", day: "numeric",
  });
};

export const getSuggestedItems = (order: SuggestedOrder): SuggestedItem[] => {
  if (!order.items) return [];
  return typeof order.items === "string" ? JSON.parse(order.items) : order.items;
};

export const suggestedStatusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  sent: { label: "Esperando tu respuesta", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  modified: { label: "Enviado a tu vendedor", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: RefreshCw },
  accepted: { label: "Aceptado", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  rejected: { label: "Rechazado", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

// ==========================================
// Detail / edit view
// ==========================================

function SuggestedOrderDetail({ order, onBack }: { order: SuggestedOrder; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialItems = useMemo(() => getSuggestedItems(order), [order]);
  const [items, setItems] = useState<SuggestedItem[]>(initialItems.map((it) => ({ ...it })));
  const [clientNotes, setClientNotes] = useState("");
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const isActionable = order.status === "sent" || order.status === "modified";
  const statusObj = suggestedStatusConfig[order.status] || suggestedStatusConfig.sent;
  const StatusIcon = statusObj.icon;

  const isDirty = useMemo(() => {
    if (items.length !== initialItems.length) return true;
    return items.some((it, idx) => {
      const orig = initialItems[idx];
      return !orig || orig.sku !== it.sku || orig.quantity !== it.quantity;
    });
  }, [items, initialItems]);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * it.quantity, 0),
    [items],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/suggested-orders/client"] });
  };

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/suggested-orders/${order.id}/accept`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Error al aceptar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sugerido aceptado", description: "Tu pedido fue generado y está en revisión." });
      invalidate();
      onBack();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const modifyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientNotes: clientNotes.trim() || null,
        items: items.map((it) => ({
          sku: it.sku,
          productName: it.productName,
          quantity: it.quantity,
          imageUrl: it.imageUrl,
          unit: it.unit,
        })),
      };
      const res = await apiRequest("PATCH", `/api/suggested-orders/${order.id}/modify`, payload);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Error al enviar cambios");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cambios enviados", description: "Tu vendedor revisará el sugerido modificado." });
      invalidate();
      onBack();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/suggested-orders/${order.id}/reject`, {
        clientNotes: clientNotes.trim() || null,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Error al rechazar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sugerido rechazado" });
      invalidate();
      onBack();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const busy = acceptMutation.isPending || modifyMutation.isPending || rejectMutation.isPending;

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: qty } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusObj.bg} ${statusObj.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusObj.label}
        </span>
      </div>

      <Card className="rounded-2xl border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                {order.title || "Pedido sugerido"}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Enviado por {order.createdByName || "tu vendedor"} · {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total estimado</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(estimatedTotal)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.sellerNotes && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
              <p className="font-semibold text-xs text-blue-600 mb-1">Mensaje de tu vendedor</p>
              {order.sellerNotes}
            </div>
          )}
          {order.clientNotes && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-700">
              <p className="font-semibold text-xs text-gray-500 mb-1">Tu último comentario</p>
              {order.clientNotes}
            </div>
          )}

          <div className="space-y-2">
            {items.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No quedan productos en el sugerido.</p>
            )}
            {items.map((it, idx) => (
              <div key={`${it.sku}-${idx}`} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                <div className="h-12 w-12 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt={it.productName} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{it.productName}</p>
                  <p className="text-[11px] text-gray-400">
                    {it.sku} · {formatCurrency(Number(it.unitPrice) || 0)} c/u
                  </p>
                </div>
                {isActionable ? (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, it.quantity - 1)} disabled={busy}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                      className="h-7 w-14 text-center text-sm"
                      disabled={busy}
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(idx, it.quantity + 1)} disabled={busy}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(idx)} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">x{it.quantity}</p>
                    <p className="text-[11px] text-gray-400">{formatCurrency((Number(it.unitPrice) || 0) * it.quantity)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isActionable && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="text-xs font-medium text-gray-600">Comentario para tu vendedor (opcional)</label>
                <Textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Ej: necesito cambiar cantidades, agregar otro producto, etc."
                  className="mt-1 rounded-xl text-sm"
                  rows={2}
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  onClick={() => setShowAccept(true)}
                  disabled={busy || items.length === 0 || isDirty}
                  title={isDirty ? "Tienes cambios sin enviar. Acepta el sugerido tal cual, o envía tus cambios." : ""}
                >
                  {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aceptar y generar pedido
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl"
                  onClick={() => modifyMutation.mutate()}
                  disabled={busy || items.length === 0 || !isDirty}
                  title={!isDirty ? "Cambia cantidades o quita productos para enviar modificaciones." : ""}
                >
                  {modifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Enviar cambios al vendedor
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                  onClick={() => setShowReject(true)}
                  disabled={busy}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
              </div>
              {isDirty && (
                <p className="text-[11px] text-amber-600">
                  Tienes cambios sin guardar. Para aceptar el sugerido tal cual, deshaz los cambios; o envíalos a tu vendedor.
                </p>
              )}
            </div>
          )}

          {order.status === "accepted" && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aceptaste este sugerido{order.convertedOrderId ? ` — pedido #${getNumericOrderId(order.convertedOrderId)}` : ""}. Tu vendedor lo está procesando.
            </div>
          )}
          {order.status === "rejected" && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-800 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rechazaste este pedido sugerido.
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showAccept} onOpenChange={setShowAccept}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aceptar pedido sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará un pedido con estos productos y quedará en revisión con tu vendedor. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => acceptMutation.mutate()}
            >
              Aceptar y generar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReject} onOpenChange={setShowReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar pedido sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              El sugerido se marcará como rechazado y se notificará a tu vendedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => rejectMutation.mutate()}
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// List (client portal tab)
// ==========================================

export function ClientSuggestedOrders() {
  const [selected, setSelected] = useState<SuggestedOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<SuggestedOrder[]>({
    queryKey: ["/api/suggested-orders/client"],
    queryFn: async () => {
      const res = await fetch("/api/suggested-orders/client", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (selected) {
    // Re-read the fresh copy from the list if it changed
    const fresh = orders.find((o) => o.id === selected.id) || selected;
    return <SuggestedOrderDetail order={fresh} onBack={() => setSelected(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="rounded-2xl border border-gray-100 shadow-sm">
        <CardContent className="py-16 text-center">
          <Sparkles className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aún no tienes pedidos sugeridos.</p>
          <p className="text-xs text-gray-400 mt-1">
            Cuando tu vendedor te envíe uno, aparecerá aquí para que lo revises.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const items = getSuggestedItems(order);
        const statusObj = suggestedStatusConfig[order.status] || suggestedStatusConfig.sent;
        const StatusIcon = statusObj.icon;
        const units = items.reduce((s, it) => s + it.quantity, 0);
        return (
          <button
            key={order.id}
            onClick={() => setSelected(order)}
            className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-200 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {order.title || "Pedido sugerido"}
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {order.createdByName || "Tu vendedor"} · {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-amber-600">{formatCurrency(Number(order.total))}</p>
                <p className="text-[11px] text-gray-400">{items.length} ítems · {units} uds</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusObj.bg} ${statusObj.color}`}>
                <StatusIcon className="h-3 w-3" />
                {statusObj.label}
              </span>
              <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                {order.status === "sent" || order.status === "modified" ? (
                  <>Revisar <ShoppingCart className="h-3 w-3" /></>
                ) : (
                  "Ver detalle"
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
