import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Package,
  PackageCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Camera,
  Store,
  Inbox,
} from "lucide-react";

// Espejo del TMS: KPIs + tabla paginada de órdenes reales (orden.estado).
// Reusable: global (con buscador por RUT) o acotado a un cliente (clienteIdErp).

interface BoardOrder {
  idErp: string;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  estado: string | null;
  etapaIndex: number;
  esNoEntregado: boolean;
  esRetiroCliente: boolean;
  esDespachoParcial: boolean;
  esBackorder: boolean;
  clienteIdErp: string | null;
  clienteNombre: string | null;
  clienteComuna: string | null;
  fechaEmision: string | null;
  fechaCompromiso: string | null;
  fechaConfirmacionDespacho: string | null;
  fechaActualizacion: string | null;
}

interface BoardResponse {
  tmsEnabled: boolean;
  days: number;
  clienteIdErp: string | null;
  estados: string[];
  kpis: {
    total: number;
    completadas: number;
    fallidas: number;
    pendientes: number;
    porEstado: Record<string, number>;
  };
  page: { orders: BoardOrder[]; total: number; limit: number; offset: number };
}

interface Entrega {
  estadoEntrega: string | null;
  horaEntrega: string | null;
  operarioNombre: string | null;
  rutaPatente: string | null;
  rutaEstado: string | null;
  direccionEntrega: string | null;
  motivoRechazo: string | null;
  fotoEvidenciaUrl: string | null;
  fotoFirmaUrl: string | null;
  creadoEn: string | null;
}

interface OrderDetail extends BoardOrder {
  etapas: string[];
  resumen: { totalItems: number; totalPedido: number; totalDespachado: number; tieneFaltantes: boolean; backordersPendientes: number } | null;
  items: Array<{ productoCodigo: string | null; productoNombre: string | null; unidad: string | null; cantidadPedida: number | null; cantidadDespachada: number | null; estadoItem: string | null }>;
  entregas: Entrega[];
}

const DEFAULT_ETAPAS = ["Pendiente", "En Preparación", "Preparada", "Listo para Despacho", "Despachado", "Entregado"];
const LIMIT = 25;

const fmtDate = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateTime = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function estadoMeta(estado: string | null, esNoEntregado?: boolean) {
  if (esNoEntregado || estado === "No Entregado") return { label: "No entregado", color: "text-red-700 bg-red-50 ring-red-200", Icon: AlertTriangle };
  switch (estado) {
    case "Entregado": return { label: "Entregado", color: "text-green-700 bg-green-50 ring-green-200", Icon: CheckCircle2 };
    case "Despachado": return { label: "Despachado", color: "text-blue-700 bg-blue-50 ring-blue-200", Icon: Truck };
    case "Listo para Despacho": return { label: "Listo para despacho", color: "text-indigo-700 bg-indigo-50 ring-indigo-200", Icon: PackageCheck };
    case "Preparada": return { label: "Preparada", color: "text-amber-700 bg-amber-50 ring-amber-200", Icon: PackageCheck };
    case "En Preparación": return { label: "En preparación", color: "text-amber-700 bg-amber-50 ring-amber-200", Icon: Package };
    case "Pendiente": return { label: "Pendiente", color: "text-slate-600 bg-slate-100 ring-slate-200", Icon: Clock };
    default: return { label: estado || "—", color: "text-slate-600 bg-slate-100 ring-slate-200", Icon: Clock };
  }
}

function Badge({ estado, esNoEntregado }: { estado: string | null; esNoEntregado?: boolean }) {
  const { label, color, Icon } = estadoMeta(estado, esNoEntregado);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${color}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function Timeline({ etapas, etapaIndex, esNoEntregado }: { etapas: string[]; etapaIndex: number; esNoEntregado: boolean }) {
  const steps = etapas?.length ? etapas : DEFAULT_ETAPAS;
  const current = esNoEntregado ? steps.indexOf("Despachado") : etapaIndex;
  return (
    <ol className="relative">
      {steps.map((label, i) => {
        const done = current >= 0 && i < current;
        const isCurrent = current >= 0 && i === current && !esNoEntregado;
        const last = i === steps.length - 1 && !esNoEntregado;
        return (
          <li key={label} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ring-2 ${done ? "bg-green-500 ring-green-500 text-white" : isCurrent ? "bg-[#FF6E23] ring-[#FF6E23] text-white" : "bg-white ring-slate-300 text-slate-300"}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              {!last && <span className={`mt-0.5 w-0.5 flex-1 ${i < current ? "bg-green-500" : "bg-slate-200"}`} style={{ minHeight: 16 }} />}
            </div>
            <p className={`-mt-0.5 text-sm ${done || isCurrent ? "text-slate-900 font-medium" : "text-slate-400"}`}>{label}{isCurrent && <span className="ml-2 text-xs text-[#FF6E23]">actual</span>}</p>
          </li>
        );
      })}
      {esNoEntregado && (
        <li className="flex gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full ring-2 bg-red-500 ring-red-500 text-white"><AlertTriangle className="h-3.5 w-3.5" /></span>
          <p className="-mt-0.5 text-sm font-semibold text-red-700">No entregado</p>
        </li>
      )}
    </ol>
  );
}

function DetailModal({ idErp, onClose }: { idErp: string; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery<OrderDetail>({ queryKey: ["/api/logistica/tms", idErp] });
  const e = data?.entregas?.[0];
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Orden {data?.tipoDocumento || ""} · ID {idErp}</p>
            <h3 className="text-base font-bold text-slate-900">{data?.numeroDocumento || idErp}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          {isLoading && <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {isError && <div className="rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 p-3 text-sm text-red-700">{(error as Error)?.message || "No se pudo cargar el detalle."}</div>}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge estado={data.estado} esNoEntregado={data.esNoEntregado} />
                {data.clienteNombre && <span className="text-sm text-slate-600">{data.clienteNombre}</span>}
                {data.esRetiroCliente && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ring-1 ring-inset ring-slate-200 bg-slate-100 text-slate-600"><Store className="h-3 w-3" /> Retiro</span>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-500">Emisión</p><p className="text-slate-800">{fmtDate(data.fechaEmision)}</p></div>
                <div><p className="text-xs text-slate-500">Compromiso</p><p className="text-slate-800">{fmtDate(data.fechaCompromiso)}</p></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Recorrido</h4>
                <Timeline etapas={data.etapas} etapaIndex={data.etapaIndex} esNoEntregado={data.esNoEntregado} />
              </div>
              {e && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-slate-500" /> Entrega</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {e.operarioNombre && <div><p className="text-xs text-slate-500">Repartidor</p><p className="text-slate-800">{e.operarioNombre}</p></div>}
                    {e.rutaPatente && <div><p className="text-xs text-slate-500">Patente</p><p className="text-slate-800">{e.rutaPatente}</p></div>}
                    {e.horaEntrega && <div><p className="text-xs text-slate-500">Hora</p><p className="text-slate-800">{fmtDateTime(e.horaEntrega)}</p></div>}
                    {e.direccionEntrega && <div className="col-span-2"><p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Dirección</p><p className="text-slate-800">{e.direccionEntrega}</p></div>}
                  </div>
                  {data.esNoEntregado && e.motivoRechazo && <div className="mt-3 rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 p-2.5 text-red-700"><span className="font-semibold">Motivo: </span>{e.motivoRechazo}</div>}
                  {(e.fotoEvidenciaUrl || e.fotoFirmaUrl) && (
                    <div className="mt-3 flex gap-3">
                      {e.fotoEvidenciaUrl && <a href={e.fotoEvidenciaUrl} target="_blank" rel="noopener noreferrer"><img src={e.fotoEvidenciaUrl} alt="Evidencia" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" /></a>}
                      {e.fotoFirmaUrl && <a href={e.fotoFirmaUrl} target="_blank" rel="noopener noreferrer"><img src={e.fotoFirmaUrl} alt="Firma" className="h-20 w-20 rounded-lg object-contain bg-white ring-1 ring-slate-200" /></a>}
                    </div>
                  )}
                </div>
              )}
              {data.items?.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <h4 className="text-sm font-semibold text-slate-900 px-4 py-3 border-b border-slate-100">Productos ({data.items.length})</h4>
                  <ul className="divide-y divide-slate-100">
                    {data.items.map((it, idx) => (
                      <li key={idx} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-800 truncate">{it.productoNombre || it.productoCodigo}</span>
                        <span className="text-sm text-slate-600 shrink-0">{it.cantidadDespachada ?? 0}/{it.cantidadPedida ?? 0} {it.unidad || ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, Icon, color }: { label: string; value: number; hint: string; Icon: any; color: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div>
      </div>
      <div className="text-2xl font-black text-gray-900">{value.toLocaleString("es-CL")}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      <div className="text-[11px] text-gray-400">{hint}</div>
    </div>
  );
}

export default function TmsOrdersPanel({ clienteIdErp, defaultDays }: { clienteIdErp?: string | null; defaultDays?: number }) {
  const scoped = !!clienteIdErp;
  const [days, setDays] = useState<string>(String(defaultDays ?? (scoped ? 0 : 90)));
  const [estado, setEstado] = useState<string>("all");
  const [offset, setOffset] = useState<number>(0);
  const [rutInput, setRutInput] = useState<string>("");
  const [rutFilter, setRutFilter] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);

  const effectiveRut = scoped ? String(clienteIdErp) : rutFilter;

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => { setOffset(0); }, [days, estado, rutFilter, clienteIdErp]);

  const params = useMemo(() => {
    const p: Record<string, any> = { days, limit: LIMIT, offset };
    if (estado !== "all") p.estado = estado;
    if (effectiveRut) p.clienteIdErp = effectiveRut;
    return p;
  }, [days, estado, offset, effectiveRut]);

  const { data, isLoading, isError, error, isFetching } = useQuery<BoardResponse>({
    queryKey: ["/api/logistica/tms", params],
  });

  const kpis = data?.kpis ?? { total: 0, completadas: 0, fallidas: 0, pendientes: 0, porEstado: {} };
  const orders = data?.page?.orders ?? [];
  const total = data?.page?.total ?? 0;
  const estados = data?.estados ?? DEFAULT_ETAPAS.concat("No Entregado");

  return (
    <div className="space-y-4">
      {data && !data.tmsEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>El sistema de envíos (TMS) no está conectado en este entorno. Cargá <strong>TMS_API_BASE</strong> y <strong>TMS_API_KEY</strong> para ver los datos reales.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Pendientes" value={kpis.pendientes} hint="Sin entregar aún" Icon={Clock} color="bg-amber-50 text-amber-600" />
        <Kpi label="Completadas" value={kpis.completadas} hint="Entregadas" Icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <Kpi label="Fallidas" value={kpis.fallidas} hint="No entregadas" Icon={AlertTriangle} color="bg-red-50 text-red-600" />
        <Kpi label="Total" value={kpis.total} hint="Órdenes en el rango" Icon={Truck} color="bg-slate-100 text-slate-600" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {!scoped && (
          <form
            onSubmit={(ev) => { ev.preventDefault(); setRutFilter(rutInput.trim()); }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={rutInput}
                onChange={(ev) => setRutInput(ev.target.value)}
                placeholder="Buscar por RUT (ej: 76565296-0)"
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white w-64"
              />
            </div>
            <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">Buscar</button>
            {rutFilter && (
              <button type="button" onClick={() => { setRutInput(""); setRutFilter(""); }} className="px-2 py-2 text-sm rounded-lg text-slate-500 hover:bg-slate-100">Limpiar</button>
            )}
          </form>
        )}
        <select value={estado} onChange={(ev) => setEstado(ev.target.value)} className="py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white">
          <option value="all">Todos los estados</option>
          {estados.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={days} onChange={(ev) => setDays(ev.target.value)} className="py-2 px-3 text-sm rounded-lg border border-slate-200 bg-white">
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="180">Últimos 180 días</option>
          <option value="0">Todo el historial</option>
        </select>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : isError ? (
        <div className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 p-4 text-sm text-red-700">{(error as Error)?.message || "No se pudieron cargar las órdenes."}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Inbox className="h-9 w-9 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">No hay órdenes para los filtros elegidos.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Orden</th>
                  {!scoped && <th className="text-left font-medium px-4 py-2.5">Cliente</th>}
                  <th className="text-left font-medium px-4 py-2.5">Emisión</th>
                  <th className="text-left font-medium px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.idErp} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(o.idErp)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{o.numeroDocumento || o.idErp}</div>
                      <div className="text-xs text-slate-400">ID {o.idErp}{o.esBackorder ? " · backorder" : ""}</div>
                    </td>
                    {!scoped && (
                      <td className="px-4 py-3">
                        <div className="text-slate-800 truncate max-w-[220px]">{o.clienteNombre || "—"}</div>
                        <div className="text-xs text-slate-400">{o.clienteComuna || ""}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(o.fechaEmision)}</td>
                    <td className="px-4 py-3"><Badge estado={o.estado} esNoEntregado={o.esNoEntregado} /></td>
                    <td className="px-4 py-3 text-right"><ChevronRight className="h-4 w-4 text-slate-300 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Paginación */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>{total === 0 ? "0" : `${offset + 1}–${Math.min(offset + LIMIT, total)}`} de {total.toLocaleString("es-CL")}</span>
            <div className="flex items-center gap-1">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(offset - LIMIT, 0))} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {selected && <DetailModal idErp={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
