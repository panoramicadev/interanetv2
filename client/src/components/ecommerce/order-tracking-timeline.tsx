import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Truck,
  MapPin,
  User as UserIcon,
  Clock,
  PackageCheck,
  AlertTriangle,
  Navigation,
} from "lucide-react";

const ORANGE = "#FF6E23";

interface Etapa {
  key: string;
  label: string;
  fecha: string | null;
  done: boolean;
}

interface EnvioInfo {
  estadoEntrega?: string | null;
  horaEntrega?: string | null;
  motivoRechazo?: string | null;
  operario?: string | null;
  patente?: string | null;
  rutaEstado?: string | null;
}

interface SeguimientoResponse {
  found: boolean;
  codigo?: string;
  estado?: string;
  etapas?: Etapa[];
  fecha?: string;
  envioDisponible?: boolean;
  envio?: EnvioInfo | null;
  mensajeEnvio?: string | null;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Línea de tiempo de seguimiento para un pedido web. Reutiliza el endpoint público
 * GET /api/public/seguimiento/:code (que acepta el UUID del pedido), por lo que no
 * requiere endpoint nuevo. Si el pedido ya está en el TMS, muestra el envío real.
 */
export function OrderTrackingTimeline({ orderId }: { orderId: string }) {
  const { data, isLoading, isError } = useQuery<SeguimientoResponse>({
    queryKey: ["/api/public/seguimiento", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/public/seguimiento/${encodeURIComponent(orderId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return { found: false } as SeguimientoResponse;
        throw new Error("No se pudo cargar el seguimiento");
      }
      return res.json();
    },
    enabled: !!orderId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Cargando seguimiento…</span>
      </div>
    );
  }

  if (isError || !data?.found || !Array.isArray(data?.etapas) || data.etapas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
        <Navigation className="h-7 w-7 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">El seguimiento estará disponible cuando tu pedido avance.</p>
      </div>
    );
  }

  const envio = data.envio;
  const entregado = envio?.estadoEntrega === "Entregado";
  const fallida = envio?.estadoEntrega === "No Entregado";

  return (
    <div className="space-y-4">
      {/* Estado actual */}
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 p-4">
        <div className="h-10 w-10 rounded-xl bg-[#FF6E23] flex items-center justify-center flex-shrink-0">
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-700/70">Estado actual</p>
          <p className="text-base font-bold text-slate-800 truncate">{data.estado || "En proceso"}</p>
        </div>
        {data.codigo && (
          <span className="ml-auto font-mono text-[11px] bg-white/70 border border-orange-200 text-orange-700 px-2 py-1 rounded-lg flex-shrink-0">
            {data.codigo}
          </span>
        )}
      </div>

      {/* Timeline de etapas */}
      <ol className="relative ml-2">
        {data.etapas.map((etapa, idx) => {
          const isLast = idx === data.etapas!.length - 1;
          const rejected = etapa.key === "rechazado";
          return (
            <li key={etapa.key} className="relative flex gap-4 pb-5 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${etapa.done ? "bg-[#FF6E23]/30" : "bg-slate-200"}`}
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex-shrink-0 mt-0.5">
                {rejected ? (
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                ) : etapa.done ? (
                  <CheckCircle2 className="h-6 w-6" style={{ color: ORANGE }} />
                ) : (
                  <Circle className="h-6 w-6 text-slate-300" />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm font-semibold ${rejected ? "text-red-600" : etapa.done ? "text-slate-800" : "text-slate-400"}`}>
                  {etapa.label}
                </p>
                {etapa.fecha && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" /> {formatDateTime(etapa.fecha)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Envío real (TMS) */}
      {data.envioDisponible && envio && (
        <div className={`rounded-xl border p-4 ${entregado ? "border-emerald-200 bg-emerald-50/60" : fallida ? "border-red-200 bg-red-50/60" : "border-blue-200 bg-blue-50/50"}`}>
          <div className="flex items-center gap-2 mb-3">
            <PackageCheck className={`h-4 w-4 ${entregado ? "text-emerald-600" : fallida ? "text-red-600" : "text-blue-600"}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${entregado ? "text-emerald-700" : fallida ? "text-red-700" : "text-blue-700"}`}>
              Estado del envío: {envio.estadoEntrega || "En ruta"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {envio.horaEntrega && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{formatDateTime(envio.horaEntrega)}</span>
              </div>
            )}
            {envio.operario && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{envio.operario}</span>
              </div>
            )}
            {envio.patente && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Truck className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono uppercase">{envio.patente}</span>
              </div>
            )}
            {envio.rutaEstado && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span className="truncate">{envio.rutaEstado}</span>
              </div>
            )}
          </div>
          {fallida && envio.motivoRechazo && (
            <p className="text-xs text-red-700 mt-3 pt-3 border-t border-red-200">
              <strong>Motivo:</strong> {envio.motivoRechazo}
            </p>
          )}
        </div>
      )}

      {/* Mensaje cuando no hay envío en TMS aún */}
      {!data.envioDisponible && data.mensajeEnvio && (
        <p className="text-xs text-slate-500 flex items-start gap-1.5 px-1">
          <Truck className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
          {data.mensajeEnvio}
        </p>
      )}
    </div>
  );
}

export default OrderTrackingTimeline;
