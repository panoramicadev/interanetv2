import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck, PackageCheck, Package, Search, MapPin, User as UserIcon,
  Loader2, Navigation, AlertTriangle, Eye, CheckCircle2, Hash, Inbox, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderTrackingTimeline } from "@/components/ecommerce/order-tracking-timeline";

const ORANGE = "#FF6E23";

// ==============================
// Types
// ==============================

interface EnvioDetalle {
  estadoEntrega: string | null;
  horaEntrega: string | null;
  operario: string | null;
  patente: string | null;
  rutaEstado: string | null;
  motivoRechazo: string | null;
}

interface Envio {
  id: string;
  trackingCode: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  salespersonName: string | null;
  status: string;
  estado: "ingresado" | "preparacion" | "curso" | "entregado";
  estadoLabel: string;
  subEstado: string | null;
  fecha: string;
  ingresadoAt: string | null;
  total: string;
  itemsCount: number;
  erpIdmaeedo: string | null;
  envio: EnvioDetalle | null;
}

interface EnviosResponse {
  tmsEnabled: boolean;
  days: number;
  resumen: { ingresados: number; preparacion: number; curso: number; entregados: number; total: number };
  envios: Envio[];
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
  }).format(Number.isFinite(num) ? num : 0);
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
};

const estadoStyle = (estado: Envio["estado"], subEstado: string | null) => {
  if (estado === "entregado") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (estado === "ingresado") return "bg-blue-50 text-blue-700 border-blue-200";
  if (estado === "preparacion") return "bg-amber-50 text-amber-700 border-amber-200";
  if (subEstado === "fallido") return "bg-red-50 text-red-700 border-red-200";
  return "bg-indigo-50 text-indigo-700 border-indigo-200"; // curso
};

const shortCode = (e: Envio) => e.trackingCode || `${e.id.slice(0, 8)}…`;

// ==============================
// Page
// ==============================

export default function Logistica() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState("90");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Envio | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data, isLoading, isError } = useQuery<EnviosResponse>({
    queryKey: ["/api/logistica/envios", days],
    queryFn: async () => {
      const res = await fetch(`/api/logistica/envios?days=${encodeURIComponent(days)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("No se pudieron cargar los envíos");
      return res.json();
    },
    staleTime: 30_000,
  });

  const handleSyncErp = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/logistica/sync-erp", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("sync");
      const r = await res.json();
      toast({
        title: "Sincronización con ERP",
        description: r.vinculados > 0
          ? `${r.vinculados} pedido(s) vinculados al ERP de ${r.evaluados} evaluados.`
          : `Sin nuevas coincidencias (${r.evaluados} pedido(s) evaluados).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logistica/envios"] });
    } catch {
      toast({ title: "No se pudo sincronizar con el ERP", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const envios = data?.envios ?? [];
  const resumen = data?.resumen ?? { ingresados: 0, preparacion: 0, curso: 0, entregados: 0, total: 0 };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return envios;
    return envios.filter((e) =>
      (e.clientName || "").toLowerCase().includes(term) ||
      (e.trackingCode || "").toLowerCase().includes(term) ||
      (e.salespersonName || "").toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term) ||
      (e.envio?.patente || "").toLowerCase().includes(term),
    );
  }, [envios, search]);

  const byEstado = useMemo(() => ({
    ingresado: filtered.filter((e) => e.estado === "ingresado"),
    preparacion: filtered.filter((e) => e.estado === "preparacion"),
    curso: filtered.filter((e) => e.estado === "curso"),
    entregado: filtered.filter((e) => e.estado === "entregado"),
  }), [filtered]);

  const renderTable = (list: Envio[]) => {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
          <Navigation className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No hay envíos en esta categoría.</p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>Cliente</TableHead>
              <TableHead>Seguimiento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Ítems</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Logística</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((e) => (
              <TableRow
                key={e.id}
                className="cursor-pointer hover:bg-orange-50/30"
                onClick={() => setSelected(e)}
              >
                <TableCell>
                  <div className="font-semibold text-slate-800 truncate max-w-[220px]">{e.clientName || "Cliente"}</div>
                  {e.salespersonName && (
                    <div className="text-xs text-slate-400 truncate max-w-[220px]">Vendedor: {e.salespersonName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-[11px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                    <Hash className="h-3 w-3" /> {shortCode(e)}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-slate-600">{formatDate(e.fecha)}</TableCell>
                <TableCell className="text-center text-sm text-slate-600">{e.itemsCount}</TableCell>
                <TableCell className="text-right font-semibold text-slate-800">{formatCurrency(e.total)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`${estadoStyle(e.estado, e.subEstado)} font-medium`}>
                    {e.estadoLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  {e.envio ? (
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {e.envio.operario && (
                        <div className="flex items-center gap-1"><UserIcon className="h-3 w-3 text-slate-400" />{e.envio.operario}</div>
                      )}
                      {e.envio.patente && (
                        <div className="flex items-center gap-1"><Truck className="h-3 w-3 text-slate-400" /><span className="font-mono uppercase">{e.envio.patente}</span></div>
                      )}
                      {e.envio.rutaEstado && (
                        <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" />{e.envio.rutaEstado}</div>
                      )}
                      {!e.envio.operario && !e.envio.patente && !e.envio.rutaEstado && <span className="text-slate-300">—</span>}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#FF6E23] hover:underline"
                    onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto w-full">
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#FF6E23] flex items-center justify-center">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Logística</h1>
              <p className="text-sm text-gray-500">
                {resumen.total} {resumen.total === 1 ? "pedido ingresado al ERP" : "pedidos ingresados al ERP"} · ingresado → en preparación → en curso → entregado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSyncErp}
              disabled={isSyncing}
              className="bg-white"
              title="Vincular pedidos ingresados con su documento del ERP (NVV) por RUT, fecha y monto"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sincronizar con ERP
            </Button>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[180px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="180">Últimos 180 días</SelectItem>
                <SelectItem value="0">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Aviso TMS no configurado */}
        {data && !data.tmsEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              El sistema de envíos (TMS) no está conectado en este entorno. El estado de cada envío se gestiona de forma manual
              (preparación, en curso, entregado). Al conectar el TMS se completan automáticamente transportista, patente, ruta y la confirmación de <strong>Entregado</strong>.
            </span>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Inbox className="w-5 h-5 text-blue-600" /></div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">INGRESADOS</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{resumen.ingresados}</div>
              <div className="text-xs text-gray-500 mt-0.5">Por preparar</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Package className="w-5 h-5 text-amber-600" /></div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">EN PREPARACIÓN</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{resumen.preparacion}</div>
              <div className="text-xs text-gray-500 mt-0.5">Armándose en bodega</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Truck className="w-5 h-5 text-indigo-600" /></div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">EN CURSO</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{resumen.curso}</div>
              <div className="text-xs text-gray-500 mt-0.5">En camino / reparto</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><PackageCheck className="w-5 h-5 text-emerald-600" /></div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">ENTREGADOS</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{resumen.entregados}</div>
              <div className="text-xs text-gray-500 mt-0.5">Confirmados</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, código, vendedor o patente…"
            className="pl-9 bg-white"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando envíos…
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-6 text-center text-sm text-red-600">
            No se pudieron cargar los envíos. Intenta nuevamente.
          </div>
        ) : (
          <Tabs defaultValue="ingresado" className="w-full space-y-4">
            <TabsList className="bg-white border border-gray-200 rounded-xl p-1">
              <TabsTrigger value="ingresado" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg gap-2">
                <Inbox className="h-4 w-4" /> Ingresados <span className="text-xs opacity-70">({byEstado.ingresado.length})</span>
              </TabsTrigger>
              <TabsTrigger value="preparacion" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 rounded-lg gap-2">
                <Package className="h-4 w-4" /> En preparación <span className="text-xs opacity-70">({byEstado.preparacion.length})</span>
              </TabsTrigger>
              <TabsTrigger value="curso" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg gap-2">
                <Truck className="h-4 w-4" /> En curso <span className="text-xs opacity-70">({byEstado.curso.length})</span>
              </TabsTrigger>
              <TabsTrigger value="entregado" className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-lg gap-2">
                <CheckCircle2 className="h-4 w-4" /> Entregados <span className="text-xs opacity-70">({byEstado.entregado.length})</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="ingresado" className="mt-0">{renderTable(byEstado.ingresado)}</TabsContent>
            <TabsContent value="preparacion" className="mt-0">{renderTable(byEstado.preparacion)}</TabsContent>
            <TabsContent value="curso" className="mt-0">{renderTable(byEstado.curso)}</TabsContent>
            <TabsContent value="entregado" className="mt-0">{renderTable(byEstado.entregado)}</TabsContent>
          </Tabs>
        )}
      </main>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" style={{ color: ORANGE }} />
              Seguimiento del envío
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Cliente</span>
                  <span className="font-semibold text-slate-800 text-right">{selected.clientName || "Cliente"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Seguimiento</span>
                  <span className="font-mono text-slate-700">{shortCode(selected)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Fecha</span>
                  <span className="text-slate-700">{formatDate(selected.fecha)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(selected.total)}</span>
                </div>
              </div>
              <OrderTrackingTimeline orderId={selected.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
