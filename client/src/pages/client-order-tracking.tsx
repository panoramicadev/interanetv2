import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Package,
  PackageCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  AlertTriangle,
  X,
  Loader2,
  Store,
  Inbox,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface OrderSummary {
  idErp: string;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
  estado: string | null;
  etapaIndex: number;
  esNoEntregado: boolean;
  esRetiroCliente: boolean;
  esDespachoParcial: boolean;
  esBackorder: boolean;
  fechaEmision: string | null;
  fechaCompromiso: string | null;
  fechaConfirmacionDespacho: string | null;
  fechaActualizacion: string | null;
}

interface OrdersResponse {
  tmsEnabled: boolean;
  rut: string | null;
  etapas?: string[];
  orders: OrderSummary[];
  message?: string;
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

interface OrderItem {
  productoCodigo: string | null;
  productoNombre: string | null;
  unidad: string | null;
  cantidadPedida: number | null;
  cantidadDespachada: number | null;
  cantidadPendiente: number | null;
  estadoItem: string | null;
  motivoFaltante: string | null;
}

interface OrderDetail extends OrderSummary {
  etapas: string[];
  resumen: {
    totalItems: number;
    totalPedido: number;
    totalDespachado: number;
    tieneFaltantes: boolean;
    backordersPendientes: number;
  } | null;
  items: OrderItem[];
  entregas: Entrega[];
}

const DEFAULT_ETAPAS = [
  "Pendiente",
  "En Preparación",
  "Preparada",
  "Listo para Despacho",
  "Despachado",
  "Entregado",
];

const fmtDate = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDateTime = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function estadoMeta(estado: string | null, esNoEntregado: boolean) {
  if (esNoEntregado || estado === "No Entregado") {
    return { label: "No entregado", color: "text-red-700 bg-red-50 ring-red-200", Icon: AlertTriangle };
  }
  switch (estado) {
    case "Entregado":
      return { label: "Entregado", color: "text-green-700 bg-green-50 ring-green-200", Icon: CheckCircle2 };
    case "Despachado":
      return { label: "Despachado", color: "text-blue-700 bg-blue-50 ring-blue-200", Icon: Truck };
    case "Listo para Despacho":
      return { label: "Listo para despacho", color: "text-indigo-700 bg-indigo-50 ring-indigo-200", Icon: PackageCheck };
    case "Preparada":
      return { label: "Preparada", color: "text-amber-700 bg-amber-50 ring-amber-200", Icon: PackageCheck };
    case "En Preparación":
      return { label: "En preparación", color: "text-amber-700 bg-amber-50 ring-amber-200", Icon: Package };
    case "Pendiente":
      return { label: "Pendiente", color: "text-slate-600 bg-slate-100 ring-slate-200", Icon: Clock };
    default:
      return { label: estado || "—", color: "text-slate-600 bg-slate-100 ring-slate-200", Icon: Clock };
  }
}

function StatusBadge({ estado, esNoEntregado }: { estado: string | null; esNoEntregado: boolean }) {
  const { label, color, Icon } = estadoMeta(estado, esNoEntregado);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function Timeline({ etapas, etapaIndex, esNoEntregado }: { etapas: string[]; etapaIndex: number; esNoEntregado: boolean }) {
  const steps = etapas?.length ? etapas : DEFAULT_ETAPAS;
  // "No Entregado" es un desvío: se llegó hasta Despachado y falló la entrega.
  const despachadoIdx = steps.indexOf("Despachado");
  const current = esNoEntregado ? despachadoIdx : etapaIndex;

  return (
    <ol className="relative">
      {steps.map((label, i) => {
        const done = current >= 0 && i < current;
        const isCurrent = current >= 0 && i === current && !esNoEntregado;
        const last = i === steps.length - 1 && !esNoEntregado;
        const reached = done || isCurrent;
        return (
          <li key={label} className="flex gap-3 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ring-2 ${
                  done
                    ? "bg-green-500 ring-green-500 text-white"
                    : isCurrent
                    ? "bg-[#FF6E23] ring-[#FF6E23] text-white"
                    : "bg-white ring-slate-300 text-slate-300"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
              </span>
              {!last && (
                <span className={`mt-0.5 w-0.5 flex-1 ${i < current ? "bg-green-500" : "bg-slate-200"}`} style={{ minHeight: 20 }} />
              )}
            </div>
            <div className="-mt-0.5 pb-1">
              <p className={`text-sm font-medium ${reached ? "text-slate-900" : "text-slate-400"}`}>{label}</p>
              {isCurrent && <p className="text-xs text-[#FF6E23] font-semibold">Etapa actual</p>}
            </div>
          </li>
        );
      })}

      {esNoEntregado && (
        <li className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-full ring-2 bg-red-500 ring-red-500 text-white">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="-mt-0.5">
            <p className="text-sm font-semibold text-red-700">No entregado</p>
            <p className="text-xs text-red-600">La entrega no pudo completarse</p>
          </div>
        </li>
      )}
    </ol>
  );
}

function DeliveryDetail({ entregas, esNoEntregado }: { entregas: Entrega[]; esNoEntregado: boolean }) {
  if (!entregas || entregas.length === 0) return null;
  const e = entregas[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <Truck className="h-4 w-4 text-slate-500" />
        Detalle de la entrega
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {e.operarioNombre && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-slate-500">Repartidor</dt>
            <dd className="text-slate-800">{e.operarioNombre}</dd>
          </div>
        )}
        {e.rutaPatente && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-slate-500">Patente</dt>
            <dd className="text-slate-800">{e.rutaPatente}</dd>
          </div>
        )}
        {e.horaEntrega && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-slate-500">Hora de entrega</dt>
            <dd className="text-slate-800">{fmtDateTime(e.horaEntrega)}</dd>
          </div>
        )}
        {e.direccionEntrega && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Dirección</dt>
            <dd className="text-slate-800">{e.direccionEntrega}</dd>
          </div>
        )}
      </dl>

      {esNoEntregado && e.motivoRechazo && (
        <div className="mt-3 rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 p-3 text-sm text-red-700">
          <span className="font-semibold">Motivo: </span>{e.motivoRechazo}
        </div>
      )}

      {(e.fotoEvidenciaUrl || e.fotoFirmaUrl) && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Camera className="h-3 w-3" /> Evidencia</p>
          <div className="flex gap-3">
            {e.fotoEvidenciaUrl && (
              <a href={e.fotoEvidenciaUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img src={e.fotoEvidenciaUrl} alt="Evidencia de entrega" className="h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200" />
              </a>
            )}
            {e.fotoFirmaUrl && (
              <a href={e.fotoFirmaUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img src={e.fotoFirmaUrl} alt="Firma de recepción" className="h-24 w-24 rounded-lg object-contain bg-white ring-1 ring-slate-200" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderDetailModal({ idErp, onClose }: { idErp: string; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery<OrderDetail>({
    queryKey: ["/api/client/orders", idErp],
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Pedido</p>
            <h3 className="text-base font-bold text-slate-900">
              {data?.numeroDocumento || idErp}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {isError && (
            <div className="rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 p-3 text-sm text-red-700">
              {(error as Error)?.message || "No se pudo cargar el detalle del pedido."}
            </div>
          )}

          {data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge estado={data.estado} esNoEntregado={data.esNoEntregado} />
                {data.esRetiroCliente && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ring-slate-200 bg-slate-100 text-slate-600">
                    <Store className="h-3.5 w-3.5" /> Retiro en bodega
                  </span>
                )}
                {data.esDespachoParcial && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ring-amber-200 bg-amber-50 text-amber-700">
                    Despacho parcial
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Fecha de emisión</p>
                  <p className="text-slate-800">{fmtDate(data.fechaEmision)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha comprometida</p>
                  <p className="text-slate-800">{fmtDate(data.fechaCompromiso)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Estado del pedido</h4>
                <Timeline etapas={data.etapas} etapaIndex={data.etapaIndex} esNoEntregado={data.esNoEntregado} />
              </div>

              <DeliveryDetail entregas={data.entregas} esNoEntregado={data.esNoEntregado} />

              {data.items?.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <h4 className="text-sm font-semibold text-slate-900 px-4 py-3 border-b border-slate-100">
                    Productos ({data.items.length})
                  </h4>
                  <ul className="divide-y divide-slate-100">
                    {data.items.map((it, idx) => (
                      <li key={idx} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">{it.productoNombre || it.productoCodigo}</p>
                          {it.productoCodigo && <p className="text-xs text-slate-400">{it.productoCodigo}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-slate-800">
                            {it.cantidadDespachada ?? 0}/{it.cantidadPedida ?? 0} {it.unidad || ""}
                          </p>
                          {it.estadoItem && <p className="text-xs text-slate-400">{it.estadoItem}</p>}
                        </div>
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

export default function ClientOrderTracking() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<OrdersResponse>({
    queryKey: ["/api/client/orders"],
  });

  const orders = data?.orders ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-[#FF6E23]" />
            Seguimiento de pedidos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Mirá el estado y el recorrido de tus despachos.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 p-4 text-sm text-red-700">
          {(error as Error)?.message || "No se pudieron cargar tus pedidos."}
        </div>
      )}

      {!isLoading && !isError && data && !data.tmsEnabled && (
        <div className="rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-200 p-5 text-sm text-amber-800 flex items-start gap-3">
          <Clock className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">El seguimiento en línea todavía no está disponible.</p>
            <p className="mt-1 text-amber-700">Estamos conectando el sistema de despachos. Vuelve a intentarlo más tarde.</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && data?.tmsEnabled && orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <Inbox className="h-10 w-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Aún no tienes pedidos en seguimiento</p>
          <p className="text-sm text-slate-400">Cuando tengas un despacho en curso, aparecerá aquí.</p>
        </div>
      )}

      {orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((o) => {
            const { label, color, Icon } = estadoMeta(o.estado, o.esNoEntregado);
            return (
              <li key={o.idErp}>
                <button
                  onClick={() => setSelected(o.idErp)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all p-4 flex items-center gap-4"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{o.numeroDocumento || o.idErp}</p>
                      {o.esRetiroCliente && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Retiro</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Emitido {fmtDate(o.fechaEmision)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${color}`}>
                      {label}
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && <OrderDetailModal idErp={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
