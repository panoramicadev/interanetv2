import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, CheckCircle, ShoppingCart, DollarSign, Search, Filter,
  ChevronRight, Database, Layers, FileText, Receipt, Calendar, User,
  Users, Building2, Check, ChevronsUpDown, X, Truck, Package, Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/components/ecommerce/order-detail-view";
import { useAuth } from "@/hooks/useAuth";

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
  docType: "FCV" | "NVV" | "GDV";
  status: "facturado" | "pendiente_facturacion" | "despachada";
  clientName: string;
  clientCode: string;
  salesperson: string | null;
  date: string | null;
  deliveryDate: string | null;
  total: number;
  totalPending: number;
  items: number;
  isGrouped: boolean;
  fromMarket?: boolean;
  orderNumbers: string[];
  documents: ErpOrderDoc[];
}

interface ErpOrdersResponse {
  orders: ErpOrder[];
  count: number;
  nvvCount: number;
  gdvCount: number;
  fcvCount: number;
}

interface ErpOrderLine {
  docId: string;
  orderNumber: string;
  code: string;
  name: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  pending: number | null;
}

interface TmsEstadoLogistica {
  estadoPedido: string | null;
  envio: {
    estadoEntrega: string | null;
    horaEntrega: string | null;
    motivoRechazo: string | null;
    operario: string | null;
    patente: string | null;
    rutaEstado: string | null;
  } | null;
  tieneFaltantes: boolean;
  backordersPendientes: number;
  retiroEnBodega: boolean;
}

interface ErpOrderDetailResponse {
  items: ErpOrderLine[];
  logistica: { docId: string; estado: TmsEstadoLogistica | null }[];
  tmsConfigured: boolean;
}

const PAGE_SIZE = 60;

// Colores por estado de logística del TMS.
function tmsEstadoStyle(estado?: string | null): string {
  switch ((estado || "").trim()) {
    case "Entregado":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Despachado":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Listo para Despacho":
    case "Preparada":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "En Preparación":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Pendiente":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "No Entregado":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  return `${day}-${m}-${y}`;
}

function fmtQty(n?: number | null) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Combobox buscable para listas largas (vendedores / clientes)
function FilterCombobox({
  value, onChange, options, placeholder, allLabel, searchPlaceholder, icon, width = "w-full sm:w-[220px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  allLabel: string;
  searchPlaceholder: string;
  icon: React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`${width} justify-between rounded-xl font-normal ${value === "all" ? "text-gray-500" : "text-gray-900"}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="truncate">{value === "all" ? placeholder : value}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => { onChange("all"); setOpen(false); }}>
                <Check className={`mr-2 h-4 w-4 ${value === "all" ? "opacity-100" : "opacity-0"}`} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${value === opt ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ docType }: { docType: ErpOrder["docType"] }) {
  if (docType === "FCV") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
        <CheckCircle className="w-3 h-3 shrink-0" /> Facturada
      </span>
    );
  }
  if (docType === "GDV") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
        <Truck className="w-3 h-3 shrink-0" /> GDV · Despachada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
      <Clock className="w-3 h-3 shrink-0" /> NVV · Pendiente
    </span>
  );
}

export default function ErpOrdersTable() {
  const { user } = useAuth();
  // Un vendedor solo ve sus propios pedidos: ocultamos el filtro de Vendedor
  // para que no pueda navegar los pedidos de sus compañeros. Admin/supervisión sí lo ven.
  const canFilterBySalesperson =
    user?.role === "admin" ||
    user?.role === "supervisor" ||
    user?.role === "encargado_area";

  const { data, isLoading } = useQuery<ErpOrdersResponse>({
    queryKey: ["/api/ecommerce/erp-orders"],
  });

  const orders = data?.orders ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [tipo, setTipo] = useState<"all" | "nvv" | "gdv" | "fcv">("all");
  const [vendedor, setVendedor] = useState("all");
  const [cliente, setCliente] = useState("all");
  // Por defecto el filtro arranca en el mes en curso
  const [anio, setAnio] = useState(() => String(new Date().getFullYear()));
  const [mes, setMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [dia, setDia] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<ErpOrder | null>(null);

  // Opciones de filtro derivadas de los pedidos cargados
  const salespeople = useMemo(
    () => Array.from(new Set(orders.map((o) => o.salesperson).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, "es")),
    [orders],
  );
  const clients = useMemo(
    () => Array.from(new Set(orders.map((o) => o.clientName).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es")),
    [orders],
  );
  const years = useMemo(
    () => Array.from(new Set(orders.map((o) => (o.date || "").slice(0, 4)).filter(Boolean)))
      .sort().reverse(),
    [orders],
  );
  // Meses presentes según el año elegido (cascada)
  const months = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const iso = (o.date || "").slice(0, 10);
      if (!iso) return;
      if (anio !== "all" && iso.slice(0, 4) !== anio) return;
      set.add(iso.slice(5, 7));
    });
    return Array.from(set).sort();
  }, [orders, anio]);
  // Días presentes según año + mes elegidos (cascada)
  const days = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const iso = (o.date || "").slice(0, 10);
      if (!iso) return;
      if (anio !== "all" && iso.slice(0, 4) !== anio) return;
      if (mes !== "all" && iso.slice(5, 7) !== mes) return;
      set.add(iso.slice(8, 10));
    });
    return Array.from(set).sort();
  }, [orders, anio, mes]);

  const hasActiveFilters =
    !!searchTerm || tipo !== "all" || vendedor !== "all" || cliente !== "all" ||
    anio !== "all" || mes !== "all" || dia !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setTipo("all");
    setVendedor("all");
    setCliente("all");
    setAnio("all");
    setMes("all");
    setDia("all");
  };

  // Detalle del pedido abierto: líneas de producto + estado de logística (TMS).
  const detailIds = detail ? detail.documents.map((d) => d.docId).join(",") : "";
  const { data: detailData, isLoading: detailLoading } = useQuery<ErpOrderDetailResponse>({
    queryKey: ["/api/ecommerce/erp-orders/detail", { docType: detail?.docType, ids: detailIds }],
    enabled: !!detail,
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (tipo === "nvv" && o.docType !== "NVV") return false;
      if (tipo === "gdv" && o.docType !== "GDV") return false;
      if (tipo === "fcv" && o.docType !== "FCV") return false;
      if (vendedor !== "all" && (o.salesperson || "") !== vendedor) return false;
      if (cliente !== "all" && o.clientName !== cliente) return false;
      const iso = (o.date || "").slice(0, 10);
      if (anio !== "all" && iso.slice(0, 4) !== anio) return false;
      if (mes !== "all" && iso.slice(5, 7) !== mes) return false;
      if (dia !== "all" && iso.slice(8, 10) !== dia) return false;
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return (
        o.clientName.toLowerCase().includes(t) ||
        (o.clientCode || "").toLowerCase().includes(t) ||
        (o.salesperson || "").toLowerCase().includes(t) ||
        o.orderNumbers.some((n) => String(n).toLowerCase().includes(t))
      );
    });
  }, [orders, tipo, searchTerm, vendedor, cliente, anio, mes, dia]);

  // KPIs — se calculan sobre el conjunto filtrado para que las tarjetas reflejen los filtros activos
  const nvvOrders = filtered.filter((o) => o.docType === "NVV");
  const gdvOrders = filtered.filter((o) => o.docType === "GDV");
  const fcvOrders = filtered.filter((o) => o.docType === "FCV");
  const nvvCount = nvvOrders.length;
  const gdvCount = gdvOrders.length;
  const fcvCount = fcvOrders.length;
  const nvvPendingTotal = nvvOrders.reduce((s, o) => s + (o.totalPending || o.total || 0), 0);
  const gdvTotal = gdvOrders.reduce((s, o) => s + (o.total || 0), 0);
  const fcvTotal = fcvOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Etiqueta del período activo para el subtítulo de "FACTURADO"
  const periodoLabel = (() => {
    if (anio === "all" && mes === "all" && dia === "all") return "últimos 90 días";
    const parts: string[] = [];
    if (dia !== "all") parts.push(String(parseInt(dia, 10)));
    if (mes !== "all") parts.push(MONTH_NAMES[parseInt(mes, 10)] || mes);
    if (anio !== "all") parts.push(anio);
    return parts.join(" ");
  })();

  // Reset pagination when the filtered set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, tipo, vendedor, cliente, anio, mes, dia]);

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
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">GDV ABIERTAS</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{gdvCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">{formatPrice(gdvTotal)}</div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#FF6E23]" />
            </div>
            <span className="text-[10px] font-bold text-[#FF6E23] bg-orange-50 px-2 py-0.5 rounded-full">FACTURADO</span>
          </div>
          <div className="text-2xl font-black text-gray-900">{formatPrice(fcvTotal)}</div>
          <div className="text-xs text-gray-500 mt-0.5">{periodoLabel}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
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
            <SelectTrigger className="w-full sm:w-[200px] rounded-xl">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nvv">NVV (pendientes)</SelectItem>
              <SelectItem value="gdv">GDV (despachadas)</SelectItem>
              <SelectItem value="fcv">FCV (facturadas)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtros por vendedor, cliente y fecha */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          {canFilterBySalesperson && (
            <FilterCombobox
              value={vendedor}
              onChange={setVendedor}
              options={salespeople}
              placeholder="Vendedor"
              allLabel="Todos los vendedores"
              searchPlaceholder="Buscar vendedor..."
              icon={<Users className="h-4 w-4 shrink-0 text-gray-400" />}
            />
          )}
          <FilterCombobox
            value={cliente}
            onChange={setCliente}
            options={clients}
            placeholder="Cliente"
            allLabel="Todos los clientes"
            searchPlaceholder="Buscar cliente..."
            icon={<Building2 className="h-4 w-4 shrink-0 text-gray-400" />}
            width="w-full sm:w-[260px]"
          />
          <Select value={anio} onValueChange={(v) => { setAnio(v); setMes("all"); setDia("all"); }}>
            <SelectTrigger className="w-full sm:w-[120px] rounded-xl">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Año</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mes} onValueChange={(v) => { setMes(v); setDia("all"); }}>
            <SelectTrigger className="w-full sm:w-[150px] rounded-xl">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mes</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{MONTH_NAMES[parseInt(m, 10)] || m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dia} onValueChange={setDia}>
            <SelectTrigger className="w-full sm:w-[110px] rounded-xl">
              <SelectValue placeholder="Día" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Día</SelectItem>
              {days.map((d) => (
                <SelectItem key={d} value={d}>{parseInt(d, 10)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="rounded-xl text-gray-500 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-1.5" />
              Limpiar
            </Button>
          )}
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
            <p className="text-sm text-gray-500">No hay documentos {hasActiveFilters ? "con los filtros aplicados" : "en los últimos 90 días"}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_150px_145px_100px_90px_40px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
                  className="grid grid-cols-[1fr_150px_145px_100px_90px_40px] gap-4 px-5 py-4 hover:bg-orange-50/30 cursor-pointer transition-colors items-center group"
                >
                  {/* Cliente */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200 text-sm font-bold text-gray-400">
                      {(order.clientName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{order.clientName}</h4>
                        {order.fromMarket && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#FF6E23] text-white shrink-0 uppercase tracking-wide">
                            <Store className="w-3 h-3" /> Market
                          </span>
                        )}
                      </div>
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
          <DialogHeader className={`px-6 pt-6 pb-4 border-b shrink-0 bg-gradient-to-r ${detail?.docType === "FCV" ? "from-emerald-50" : detail?.docType === "GDV" ? "from-blue-50" : "from-amber-50"} to-white`}>
            <DialogTitle className="flex items-center gap-2">
              {detail?.docType === "FCV"
                ? <Receipt className="h-5 w-5 text-emerald-600" />
                : detail?.docType === "GDV"
                  ? <Truck className="h-5 w-5 text-blue-600" />
                  : <FileText className="h-5 w-5 text-amber-600" />}
              Pedido ERP · {detail?.docType}
              {detail?.isGrouped && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#FF6E23]">
                  <Layers className="w-3 h-3" /> Agrupado
                </span>
              )}
              {detail?.fromMarket && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6E23] text-white uppercase tracking-wide">
                  <Store className="w-3 h-3" /> Market
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

            {/* Estado de logística (TMS) */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Estado de logística
              </div>
              {detailLoading ? (
                <div className="text-sm text-gray-400">Consultando estado de envío…</div>
              ) : !detailData?.tmsConfigured ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  El sistema de logística (TMS) no está conectado. No hay estado de envío disponible.
                </div>
              ) : detailData.logistica.every((l) => !l.estado) ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  Sin información de envío en el TMS para este pedido.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailData.logistica.filter((l) => l.estado).map((l) => {
                    const doc = detail?.documents.find((d) => d.docId === l.docId);
                    const est = l.estado!;
                    const envioEstado = est.envio?.estadoEntrega || est.estadoPedido;
                    return (
                      <div key={l.docId} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {detail?.isGrouped && doc && (
                              <span className="text-[10px] font-bold text-gray-400">N° {doc.orderNumber}</span>
                            )}
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${tmsEstadoStyle(envioEstado)}`}>
                              <Truck className="w-3 h-3" /> {envioEstado || "Sin estado"}
                            </span>
                          </div>
                          {est.retiroEnBodega && (
                            <span className="text-[10px] text-gray-500">Retiro en bodega</span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                          {est.envio?.horaEntrega && (<div><span className="text-gray-400">Entrega:</span> {fmtDate(est.envio.horaEntrega)}</div>)}
                          {est.envio?.patente && (<div><span className="text-gray-400">Patente:</span> {est.envio.patente}</div>)}
                          {est.envio?.operario && (<div><span className="text-gray-400">Operario:</span> {est.envio.operario}</div>)}
                          {est.envio?.rutaEstado && (<div><span className="text-gray-400">Ruta:</span> {est.envio.rutaEstado}</div>)}
                          {est.tieneFaltantes && (<div className="text-amber-600">Despacho con faltantes</div>)}
                          {est.backordersPendientes > 0 && (<div className="text-amber-600">{est.backordersPendientes} backorder(s) pendiente(s)</div>)}
                          {est.envio?.motivoRechazo && (<div className="col-span-2 text-rose-600">Motivo: {est.envio.motivoRechazo}</div>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Productos del pedido */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                <Package className="w-3 h-3" /> Productos {detailData?.items?.length ? `(${detailData.items.length})` : ""}
              </div>
              {detailLoading ? (
                <div className="text-sm text-gray-400">Cargando productos…</div>
              ) : !detailData?.items?.length ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  No se encontraron líneas de producto para este pedido.
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {detailData.items.map((it, i) => (
                    <div key={`${it.docId}-${it.code}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 break-words">{it.name}</div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
                          {it.code && <span className="font-mono">{it.code}</span>}
                          <span>{fmtQty(it.quantity)}{it.unit ? ` ${it.unit}` : ""}</span>
                          {detail?.docType === "NVV" && it.pending ? (
                            <span className="text-amber-600">· {fmtQty(it.pending)} pend.</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-gray-900">{formatPrice(it.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documentos que componen el pedido */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                Documento{(detail?.documents.length || 0) !== 1 ? "s" : ""} ({detail?.documents.length})
              </div>
              <div className="space-y-2">
                {detail?.documents.map((d) => (
                  <div key={d.docId} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${detail.docType === "FCV" ? "bg-emerald-100 text-emerald-700" : detail.docType === "GDV" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
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
