import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, CheckCircle, ShoppingCart, DollarSign, Search, Filter,
  ChevronRight, Database, Layers, FileText, Receipt, Calendar, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/components/ecommerce/order-detail-view";

interface ErpOrderDoc {
  docId: string;
  orderNumber: string;
  items: number;
  total: number;
  totalPending: number;
  date: string | null;
  deliveryDate: string | null;
}

export interface ErpOrder {
  id: string;
  source: string;
  docType: "FCV" | "NVV";
  status: "facturado" | "pendiente_facturacion";
  clientName: string;
  clientCode: string;
  salesperson: string | null;
  date: string | null;
  deliveryDate: string | null;
  total: number;
  totalPending: number;
  items: number;
  isGrouped: boolean;
  orderNumbers: string[];
  documents: ErpOrderDoc[];
}

interface ErpOrdersResponse {
  orders: ErpOrder[];
  count: number;
  nvvCount: number;
  fcvCount: number;
}

const PAGE_SIZE = 60;

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  return `${day}-${m}-${y}`;
}

function StatusBadge({ docType }: { docType: ErpOrder["docType"] }) {
  if (docType === "FCV") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle className="w-3 h-3" /> Facturado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
      <Clock className="w-3 h-3" /> Pend. facturación
    </span>
  );
}

export default function ErpOrdersTable() {
  const { data, isLoading } = useQuery<ErpOrdersResponse>({
    queryKey: ["/api/ecommerce/erp-orders"],
  });

  const orders = data?.orders ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [tipo, setTipo] = useState<"all" | "nvv" | "fcv">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<ErpOrder | null>(null);

  // KPIs
  const nvvCount = data?.nvvCount ?? 0;
  const fcvCount = data?.fcvCount ?? 0;
  const nvvPendingTotal = orders
    .filter((o) => o.docType === "NVV")
    .reduce((s, o) => s + (o.totalPending || o.total || 0), 0);
  const fcvTotal = orders
    .filter((o) => o.docType === "FCV")
    .reduce((s, o) => s + (o.total || 0), 0);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (tipo === "nvv" && o.docType !== "NVV") return false;
      if (tipo === "fcv" && o.docType !== "FCV") return false;
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return (
        o.clientName.toLowerCase().includes(t) ||
        (o.clientCode || "").toLowerCase().includes(t) ||
        (o.salesperson || "").toLowerCase().includes(t) ||
        o.orderNumbers.some((n) => String(n).toLowerCase().includes(t))
      );
    });
  }, [orders, tipo, searchTerm]);

  // Reset pagination when the filtered set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, tipo]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <>
      {/* KPI Cards (mismo formato que Pedidos de Tienda) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">NVV PENDIENTES</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{nvvCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">{formatPrice(nvvPendingTotal)}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">FACTURADAS</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{fcvCount}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">TOTAL</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{orders.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">pedidos ERP</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#FF6E23]" />
            </div>
            <span className="text-[10px] font-bold text-[#FF6E23] bg-orange-50 px-2 py-0.5 rounded-full">FACTURADO</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{formatPrice(fcvTotal)}</div>
          <div className="text-xs text-gray-500 mt-0.5">últimos 90 días</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por cliente, vendedor o N° de documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-gray-200"
            />
          </div>
          <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
            <SelectTrigger className="w-[200px] rounded-xl">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nvv">NVV (pendientes)</SelectItem>
              <SelectItem value="fcv">FCV (facturadas)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table — mismo grid que pedidos de tienda */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#FF6E23] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Cargando pedidos ERP...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Database className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Sin pedidos ERP</h3>
            <p className="text-sm text-gray-500">No hay documentos {tipo !== "all" ? "de este tipo" : "en los últimos 90 días"}</p>
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
              {visible.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setDetail(order)}
                  className="grid grid-cols-[1fr_150px_120px_100px_90px_40px] gap-4 px-5 py-4 hover:bg-orange-50/30 cursor-pointer transition-colors items-center group"
                >
                  {/* Cliente */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200 text-sm font-bold text-gray-400">
                      {(order.clientName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName}</h4>
                      <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                        {order.isGrouped ? (
                          <span className="inline-flex items-center gap-1 text-[#FF6E23] font-semibold">
                            <Layers className="w-3 h-3" />
                            {order.docType} {order.orderNumbers.join(" + ")}
                          </span>
                        ) : (
                          <span>{order.docType} N° {order.orderNumbers[0]}</span>
                        )}
                        <span>· {order.items} ítem{order.items !== 1 ? "s" : ""}</span>
                      </p>
                    </div>
                  </div>

                  {/* Vendedor */}
                  <div className="text-sm text-gray-600 truncate">
                    {order.salesperson || <span className="text-gray-300">—</span>}
                  </div>

                  {/* Estado */}
                  <div>
                    <StatusBadge docType={order.docType} />
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</span>
                  </div>

                  {/* Fecha */}
                  <div>
                    <span className="text-[10px] text-gray-500">{fmtDate(order.date)}</span>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-end">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FF6E23] transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                Mostrando {visible.length} de {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
              </span>
              {visibleCount < filtered.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  Mostrar más
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detalle — abre al click en fila, muestra documentos del pedido */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className={`px-6 pt-6 pb-4 border-b shrink-0 bg-gradient-to-r ${detail?.docType === "FCV" ? "from-emerald-50" : "from-amber-50"} to-white`}>
            <DialogTitle className="flex items-center gap-2">
              {detail?.docType === "FCV"
                ? <Receipt className="h-5 w-5 text-emerald-600" />
                : <FileText className="h-5 w-5 text-amber-600" />}
              Pedido ERP · {detail?.docType}
              {detail?.isGrouped && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#FF6E23]">
                  <Layers className="w-3 h-3" /> Agrupado
                </span>
              )}
            </DialogTitle>
            <DialogDescription>{detail?.clientName}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Total</div>
                <div className="font-bold text-gray-900 text-lg">{detail && formatPrice(detail.total)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Estado</div>
                {detail && <StatusBadge docType={detail.docType} />}
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 flex items-center gap-1"><User className="w-3 h-3" /> Vendedor</div>
                <div className="font-medium text-gray-900">{detail?.salesperson || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha</div>
                <div className="font-medium text-gray-900">{fmtDate(detail?.date)}</div>
              </div>
              {detail?.docType === "NVV" && detail.deliveryDate && (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Fecha entrega</div>
                  <div className="font-medium text-gray-900">{fmtDate(detail.deliveryDate)}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Ítems</div>
                <div className="font-medium text-gray-900">{detail?.items}</div>
              </div>
            </div>

            {detail?.isGrouped && (
              <div className="bg-orange-50 border-l-4 border-[#FF6E23] rounded-r-lg p-3 text-sm text-orange-900">
                Pedido detectado como dividido en <strong>{detail.documents.length} documentos</strong> porque superó el tope de 30 ítems por documento en el ERP. Se unen por mismo cliente, fecha y vendedor.
              </div>
            )}

            {/* Documentos que componen el pedido */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                Documento{(detail?.documents.length || 0) !== 1 ? "s" : ""} ({detail?.documents.length})
              </div>
              <div className="space-y-2">
                {detail?.documents.map((d) => (
                  <div key={d.docId} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${detail.docType === "FCV" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {detail.docType}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">N° {d.orderNumber}</span>
                      <span className="text-xs text-gray-400">· {d.items} ítem{d.items !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 shrink-0">{formatPrice(d.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50 shrink-0">
            <Button variant="outline" onClick={() => setDetail(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
