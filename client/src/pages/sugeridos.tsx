import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getNumericOrderId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Sparkles, Plus, Search, Loader2, Trash2, ArrowLeft, Package,
  Clock, RefreshCw, CheckCircle, XCircle, Send, User, ShoppingCart,
} from "lucide-react";
import {
  SuggestedOrder, SuggestedItem, getSuggestedItems, suggestedStatusConfig,
} from "@/components/ecommerce/suggested-order-view";

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

interface ClientRow {
  id: string;
  nokoen: string;
  rten?: string;
  koen?: string;
  userId?: string | null;
  email?: string | null;
}

interface ProductResult {
  sku: string;
  productName: string;
  unit?: string | null;
  listPrice?: string | number | null;
  imageUrl?: string | null;
}

interface BuilderItem {
  sku: string;
  productName: string;
  quantity: number;
  unit?: string | null;
  imageUrl?: string | null;
  listPrice?: number;
}

// ==========================================
// Create / edit dialog
// ==========================================

function SuggestedOrderForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: SuggestedOrder | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");

  const [items, setItems] = useState<BuilderItem[]>([]);
  const [title, setTitle] = useState("");
  const [sellerNotes, setSellerNotes] = useState("");

  // Reset / preload on open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const its = getSuggestedItems(editing);
      setItems(its.map((it) => ({
        sku: it.sku,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        imageUrl: it.imageUrl,
        listPrice: Number(it.unitPrice) || 0,
      })));
      setTitle(editing.title || "");
      setSellerNotes(editing.sellerNotes || "");
      setSelectedClient({
        id: editing.clientId || "",
        nokoen: editing.clientName,
        userId: editing.clientUserId,
        email: editing.clientEmail,
      });
    } else {
      setItems([]);
      setTitle("");
      setSellerNotes("");
      setSelectedClient(null);
      setClientSearch("");
    }
    setProductSearch("");
  }, [open, editing]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [productSearch]);

  const { data: clientsResp, isFetching: clientsLoading } = useQuery<{ clients: ClientRow[] }>({
    queryKey: ["/api/clients", { search: debouncedClientSearch, ctx: "sugeridos" }],
    queryFn: async () => {
      const params = new URLSearchParams({ search: debouncedClientSearch, limit: "20" });
      const res = await fetch(`/api/clients?${params}`, { credentials: "include" });
      if (!res.ok) return { clients: [] };
      return res.json();
    },
    enabled: open && !editing && debouncedClientSearch.length >= 2,
  });

  const { data: products = [], isFetching: productsLoading } = useQuery<ProductResult[]>({
    queryKey: ["/api/suggested-orders/product-search", debouncedProductSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/suggested-orders/product-search?q=${encodeURIComponent(debouncedProductSearch)}`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && debouncedProductSearch.length >= 2,
  });

  const addProduct = (p: ProductResult) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.sku === p.sku);
      if (existing) {
        return prev.map((it) => (it.sku === p.sku ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [
        ...prev,
        {
          sku: p.sku,
          productName: p.productName,
          quantity: 1,
          unit: p.unit,
          imageUrl: p.imageUrl,
          listPrice: Number(p.listPrice) || 0,
        },
      ];
    });
    setProductSearch("");
  };

  const updateQty = (sku: string, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((it) => (it.sku === sku ? { ...it, quantity: qty } : it)));
  };
  const removeItem = (sku: string) => setItems((prev) => prev.filter((it) => it.sku !== sku));

  const estimatedTotal = useMemo(
    () => items.reduce((s, it) => s + (it.listPrice || 0) * it.quantity, 0),
    [items],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId: selectedClient?.id,
        title: title.trim() || null,
        sellerNotes: sellerNotes.trim() || null,
        items: items.map((it) => ({
          sku: it.sku,
          productName: it.productName,
          quantity: it.quantity,
          imageUrl: it.imageUrl,
          unit: it.unit,
        })),
      };
      const res = editing
        ? await apiRequest("PATCH", `/api/suggested-orders/${editing.id}`, payload)
        : await apiRequest("POST", "/api/suggested-orders", payload);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Error al guardar");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: editing ? "Sugerido reenviado" : "Sugerido enviado",
        description: editing
          ? "El cliente recibirá la versión actualizada."
          : "El cliente lo verá en su panel para aceptarlo o modificarlo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/suggested-orders"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const canSave =
    !!selectedClient &&
    !!selectedClient.userId &&
    items.length > 0 &&
    !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            {editing ? "Editar y reenviar sugerido" : "Nuevo pedido sugerido"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Ajusta los productos y reenvía el sugerido al cliente."
              : "Arma un carro y envíalo a un cliente de la tienda para que lo acepte o lo modifique."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client selector */}
          <div>
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            {selectedClient ? (
              <div className="mt-1 flex items-center justify-between border border-gray-200 rounded-xl p-3 bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedClient.nokoen}</p>
                  <p className="text-[11px] text-gray-500">
                    {selectedClient.rten || selectedClient.koen || ""}
                    {!selectedClient.userId && (
                      <span className="text-red-500 ml-1">· Sin usuario de tienda asociado</span>
                    )}
                  </p>
                </div>
                {!editing && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                    Cambiar
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre o RUT..."
                  className="pl-9 rounded-xl"
                />
                {debouncedClientSearch.length >= 2 && (
                  <div className="mt-1 border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-sm">
                    {clientsLoading ? (
                      <div className="p-3 text-center text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin inline" /> Buscando...
                      </div>
                    ) : (clientsResp?.clients || []).length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-400">Sin resultados</div>
                    ) : (
                      (clientsResp?.clients || []).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                          className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">{c.nokoen}</p>
                          <p className="text-[11px] text-gray-500">
                            {c.rten || c.koen || ""}
                            {!c.userId && <span className="text-red-500 ml-1">· Sin acceso a tienda</span>}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {selectedClient && !selectedClient.userId && (
              <p className="text-[11px] text-red-500 mt-1">
                Este cliente no tiene un usuario de tienda. Asígnale acceso en Clientes antes de enviarle un sugerido.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700">Título (opcional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Sugerido de reposición mayo"
              className="mt-1 rounded-xl"
              maxLength={160}
            />
          </div>

          {/* Product search */}
          <div>
            <label className="text-sm font-medium text-gray-700">Agregar productos</label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto por nombre o SKU..."
                className="pl-9 rounded-xl"
              />
              {debouncedProductSearch.length >= 2 && (
                <div className="mt-1 border border-gray-200 rounded-xl max-h-56 overflow-y-auto bg-white shadow-sm">
                  {productsLoading ? (
                    <div className="p-3 text-center text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin inline" /> Buscando...
                    </div>
                  ) : products.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-400">Sin resultados</div>
                  ) : (
                    products.map((p) => (
                      <button
                        key={p.sku}
                        onClick={() => addProduct(p)}
                        className="w-full text-left px-3 py-2 hover:bg-orange-50 border-b border-gray-50 last:border-0 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.productName}</p>
                          <p className="text-[11px] text-gray-500">{p.sku}</p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatCurrency(Number(p.listPrice) || 0)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                Aún no agregaste productos
              </div>
            ) : (
              items.map((it) => (
                <div key={it.sku} className="flex items-center gap-3 border border-gray-100 rounded-xl p-2.5">
                  <div className="h-10 w-10 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{it.productName}</p>
                    <p className="text-[11px] text-gray-400">{it.sku}</p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateQty(it.sku, parseInt(e.target.value) || 1)}
                    className="h-8 w-16 text-center text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => removeItem(it.sku)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="flex justify-between items-center text-sm bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-amber-700 font-medium">Total estimado (lista LP01)</span>
              <span className="text-amber-700 font-bold">{formatCurrency(estimatedTotal)}</span>
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            El precio final se calcula con la lista de precios del cliente al enviar el sugerido.
          </p>

          {/* Seller notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">Mensaje para el cliente (opcional)</label>
            <Textarea
              value={sellerNotes}
              onChange={(e) => setSellerNotes(e.target.value)}
              placeholder="Ej: Te dejo un sugerido según tu última compra."
              className="mt-1 rounded-xl text-sm"
              rows={2}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!canSave}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {editing ? "Reenviar al cliente" : "Enviar al cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Detail view (staff)
// ==========================================

function StaffSuggestedDetail({
  order,
  onBack,
  onEdit,
}: {
  order: SuggestedOrder;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const items = getSuggestedItems(order);
  const statusObj = suggestedStatusConfig[order.status] || suggestedStatusConfig.sent;
  const StatusIcon = statusObj.icon;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/suggested-orders/${order.id}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sugerido eliminado" });
      queryClient.invalidateQueries({ queryKey: ["/api/suggested-orders"] });
      onBack();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusObj.bg} ${statusObj.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusObj.label}
        </span>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              {order.title || "Pedido sugerido"}
            </h2>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <User className="h-3 w-3" /> {order.clientName} · creado {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(Number(order.total))}</p>
            {order.priceListUsed && (
              <p className="text-[10px] text-gray-400">Lista {order.priceListUsed}</p>
            )}
          </div>
        </div>

        {order.sellerNotes && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
            <p className="font-semibold text-xs text-blue-600 mb-1">Tu mensaje</p>
            {order.sellerNotes}
          </div>
        )}
        {order.clientNotes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
            <p className="font-semibold text-xs text-amber-600 mb-1">Comentario del cliente</p>
            {order.clientNotes}
          </div>
        )}

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={`${it.sku}-${idx}`} className="flex items-center gap-3 border border-gray-100 rounded-xl p-2.5">
              <div className="h-10 w-10 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                {it.imageUrl ? (
                  <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-4 w-4 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 line-clamp-1">{it.productName}</p>
                <p className="text-[11px] text-gray-400">
                  {it.sku} · {formatCurrency(Number(it.unitPrice) || 0)} c/u
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-700">x{it.quantity}</p>
                <p className="text-[11px] text-gray-400">
                  {formatCurrency((Number(it.unitPrice) || 0) * it.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {order.status === "accepted" && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            El cliente aceptó este sugerido
            {order.convertedOrderId
              ? ` — se generó el pedido #${getNumericOrderId(order.convertedOrderId)} (revísalo en Pedidos eCommerce).`
              : "."}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {order.status !== "accepted" && (
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={onEdit}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {order.status === "modified" ? "Revisar y reenviar" : "Editar y reenviar"}
            </Button>
          )}
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pedido sugerido</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El sugerido dejará de verse para el cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==========================================
// Main page
// ==========================================

export default function SugeridosPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<SuggestedOrder | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SuggestedOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<SuggestedOrder[]>({
    queryKey: ["/api/suggested-orders", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/suggested-orders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error al cargar sugeridos");
      return res.json();
    },
  });

  // Keep the selected order fresh after invalidation
  const freshSelected = selected ? orders.find((o) => o.id === selected.id) || selected : null;

  const counts = useMemo(() => {
    const c = { sent: 0, modified: 0, accepted: 0, rejected: 0 };
    orders.forEach((o) => {
      if (o.status in c) (c as any)[o.status]++;
    });
    return c;
  }, [orders]);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (order: SuggestedOrder) => { setEditing(order); setFormOpen(true); };

  if (freshSelected) {
    return (
      <StaffSuggestedDetail
        order={freshSelected}
        onBack={() => setSelected(null)}
        onEdit={() => openEdit(freshSelected)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedidos Sugeridos</h1>
            <p className="text-sm text-gray-500">
              Envía carros sugeridos a tus clientes de la tienda para que los acepten o modifiquen.
            </p>
          </div>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo sugerido
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: "sent", label: "Esperando cliente", value: counts.sent, icon: Clock, iconWrap: "bg-amber-50", iconColor: "text-amber-600" },
          { key: "modified", label: "Modificados (revisar)", value: counts.modified, icon: RefreshCw, iconWrap: "bg-blue-50", iconColor: "text-blue-600" },
          { key: "accepted", label: "Aceptados", value: counts.accepted, icon: CheckCircle, iconWrap: "bg-emerald-50", iconColor: "text-emerald-600" },
          { key: "rejected", label: "Rechazados", value: counts.rejected, icon: XCircle, iconWrap: "bg-red-50", iconColor: "text-red-600" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.iconWrap}`}>
                  <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900">{kpi.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="sent">Esperando cliente</SelectItem>
            <SelectItem value="modified">Modificados</SelectItem>
            <SelectItem value="accepted">Aceptados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <Sparkles className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay pedidos sugeridos todavía.</p>
          <Button variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = getSuggestedItems(order);
            const statusObj = suggestedStatusConfig[order.status] || suggestedStatusConfig.sent;
            const StatusIcon = statusObj.icon;
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
                        <User className="h-3 w-3" /> {order.clientName} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(Number(order.total))}</p>
                    <p className="text-[11px] text-gray-400">
                      {items.length} ítems · {items.reduce((s, it) => s + it.quantity, 0)} uds
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusObj.bg} ${statusObj.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusObj.label}
                  </span>
                  {order.status === "modified" && (
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">Requiere tu revisión</Badge>
                  )}
                  {order.status === "accepted" && order.convertedOrderId && (
                    <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> Pedido generado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SuggestedOrderForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}
