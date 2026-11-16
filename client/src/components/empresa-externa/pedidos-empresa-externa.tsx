import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatoMoneda } from "@/components/gastos/ui";
import { pedirEmpresaExterna, useEmpresaExterna } from "@/hooks/use-empresa-externa";
import { fechaCorta } from "./periodo";

interface NotaVenta {
  id: number;
  numero: string;
  fecha: string;
  cliente: string;
  vendedor: string;
  neto: number;
  netoPendiente: number;
  estado: "abierta" | "cerrada" | "nula";
  lineas: number;
  lineasPendientes: number;
}

interface Linea {
  codigo: string;
  producto: string;
  unidad: string;
  pedido: number;
  despachado: number;
  pendiente: number;
  precio: number;
  neto: number;
}

const NUM = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

const nombrePropio = (s: string) =>
  s.toLowerCase().replace(/(^|[\s.(-])([a-záéíóúñ])/g, (_m, sep, l) => sep + l.toUpperCase());

const haceDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const VENTANAS = [
  { valor: "30", etiqueta: "Últimos 30 días" },
  { valor: "90", etiqueta: "Últimos 90 días" },
  { valor: "365", etiqueta: "Último año" },
];

const ESTADO_CHIP: Record<NotaVenta["estado"], string> = {
  abierta: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  cerrada: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  nula: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function DetalleNota({ id, consulta }: { id: number; consulta: string }) {
  const { data, isLoading } = useQuery<Linea[]>({
    queryKey: ["empresa-externa", "nota-venta", id, consulta],
    queryFn: () => pedirEmpresaExterna(`notas-venta/${id}`, {}, consulta),
    staleTime: 2 * 60_000,
  });
  if (isLoading || !data) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#fd6301]" />
      </div>
    );
  }
  return (
    <div className="space-y-1.5 py-2">
      {data.map((l, i) => (
        <div key={`${l.codigo}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">{l.producto}</span>
          <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">
            {NUM.format(l.pedido)} {l.unidad}
            {l.pendiente > 0 && <span className="text-[#fd6301]"> · faltan {NUM.format(l.pendiente)}</span>}
            <span className="ml-3 text-gray-900 dark:text-white">{formatoMoneda(l.neto)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Notas de venta de una empresa externa (Pinturería del Sur), leídas en vivo
 * desde Random. "Pendientes" = abiertas y con algo por despachar.
 */
export default function PedidosEmpresaExterna() {
  const { empresa, consulta } = useEmpresaExterna();
  const [estado, setEstado] = useState<"pendientes" | "todas">("pendientes");
  const [ventana, setVentana] = useState("90");
  const [abierta, setAbierta] = useState<number | null>(null);
  const desde = haceDias(Number(ventana));

  const { data = [], isLoading, error } = useQuery<NotaVenta[]>({
    queryKey: ["empresa-externa", "notas-venta", estado, desde, "", consulta],
    queryFn: () => pedirEmpresaExterna("notas-venta", { estado, desde }, consulta),
    staleTime: 2 * 60_000,
  });

  const totalPendiente = data.reduce((s, n) => s + n.netoPendiente, 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
          <ClipboardList className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Pedidos</h1>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
            Notas de venta de {empresa?.nombre}, al día desde el sistema de facturación.
          </p>
        </div>
      </div>

      <div className="modern-card p-3 sm:p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="grid grid-cols-2 sm:flex gap-3 w-full sm:w-auto">
          <Select value={estado} onValueChange={(v) => setEstado(v as any)}>
            <SelectTrigger className="h-9 sm:w-[190px] rounded-xl" data-testid="select-estado-nvv">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendientes">Por despachar</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ventana} onValueChange={setVentana}>
            <SelectTrigger className="h-9 sm:w-[190px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENTANAS.map((v) => (
                <SelectItem key={v.valor} value={v.valor}>{v.etiqueta}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          {data.length} notas
          {estado === "pendientes" && data.length > 0 && <> · <span className="text-[#fd6301]">{formatoMoneda(totalPendiente)}</span> por despachar</>}
        </span>
      </div>

      {error ? (
        <div className="modern-card p-6 text-sm text-red-600">{(error as Error).message}</div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#fd6301]" />
        </div>
      ) : data.length === 0 ? (
        <div className="modern-card p-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No hay notas de venta en este período.
        </div>
      ) : (
        <div className="modern-card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {data.map((n) => {
            const expandida = abierta === n.id;
            return (
              <Fragment key={n.id}>
                <button
                  type="button"
                  onClick={() => setAbierta(expandida ? null : n.id)}
                  className="w-full text-left px-3 sm:px-4 py-3 hover:bg-orange-50/50 dark:hover:bg-slate-800/40 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1"
                  data-testid={`row-nvv-${n.numero}`}
                >
                  {expandida ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{n.cliente || "Sin cliente"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      N° {n.numero} · {fechaCorta(n.fecha)} · {nombrePropio(n.vendedor)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto pl-7 sm:pl-0">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-0.5 ${ESTADO_CHIP[n.estado]}`}>
                      {n.estado === "abierta" && n.lineasPendientes > 0 ? "Por despachar" : n.estado}
                    </span>
                    <div className="text-right ml-auto sm:ml-0 sm:w-36">
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{formatoMoneda(n.neto)}</p>
                      {n.netoPendiente > 0 && n.estado === "abierta" && (
                        <p className="text-xs tabular-nums text-[#fd6301]">{formatoMoneda(n.netoPendiente)} pendiente</p>
                      )}
                    </div>
                  </div>
                </button>
                {expandida && (
                  <div className="px-4 sm:px-11 pb-3 bg-slate-50/60 dark:bg-slate-800/30">
                    <DetalleNota id={n.id} consulta={consulta} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
