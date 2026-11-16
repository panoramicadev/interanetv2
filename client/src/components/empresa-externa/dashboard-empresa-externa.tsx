import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CalendarIcon, ClipboardList, DollarSign, Loader2, Percent, Store, User, Users, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YearMonthSelector } from "@/components/dashboard/year-month-selector";
import TarjetaKpi from "@/components/dashboard/kpi-simple-card";
import { useFilter } from "@/contexts/FilterContext";
import { ICONO_CHIP_SM, ICONO_CHIP_ICONO_SM } from "@/lib/icono-chip";
import { formatoMoneda } from "@/components/gastos/ui";
import { pedirEmpresaExterna, useEmpresaExterna } from "@/hooks/use-empresa-externa";
import { diaMes, rangoDeSeleccion } from "./periodo";

interface Resumen {
  empresa: { codigo: string; nombre: string };
  periodo: { desde: string; hasta: string; desdeAnterior: string; hastaAnterior: string };
  totales: {
    venta: number;
    ventaAnterior: number;
    ventaMercaderia: number;
    costo: number;
    beneficio: number;
    margenPct: number;
    unidades: number;
    documentos: number;
    clientes: number;
    clientesNuevos: number;
  };
  porVendedor: { codigo: string; nombre: string; venta: number; margenPct: number; documentos: number }[];
  topClientes: { codigo: string; nombre: string; venta: number; documentos: number }[];
  topProductos: { codigo: string; nombre: string; venta: number; unidades: number; unidad: string }[];
  porMes: { anio: number; mes: number; venta: number }[];
}

interface NotaVenta {
  id: number;
  netoPendiente: number;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const NUM = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Nombre propio a partir del texto en mayúsculas del ERP: "PABLO ROSSI BOVE" → "Pablo Rossi Bove". */
const nombrePropio = (s: string) =>
  s.toLowerCase().replace(/(^|[\s.(-])([a-záéíóúñ])/g, (_m, sep, l) => sep + l.toUpperCase());

/** Hace 90 días, en YYYY-MM-DD: ventana de las notas de venta pendientes. */
const hace90Dias = () => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Panel({ titulo, icono: Icono, children, accion }: { titulo: string; icono: any; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="modern-card p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={ICONO_CHIP_SM}>
            <Icono className={ICONO_CHIP_ICONO_SM} />
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">{titulo}</h2>
        </div>
        {accion}
      </div>
      {children}
    </div>
  );
}

/** Ranking con barra: nombre + monto + % del total, como en el resto de los dashboards. */
function Ranking({
  filas,
  total,
  vacio,
  onElegir,
}: {
  filas: { clave: string; nombre: string; venta: number; detalle?: string }[];
  total: number;
  vacio: string;
  onElegir?: (clave: string, nombre: string) => void;
}) {
  if (filas.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{vacio}</p>;
  const max = Math.max(...filas.map((f) => Math.abs(f.venta)), 1);
  return (
    <div className="space-y-3">
      {filas.map((f) => (
        <button
          key={f.clave || f.nombre}
          type="button"
          disabled={!onElegir || !f.clave}
          onClick={() => onElegir?.(f.clave, f.nombre)}
          className="w-full text-left group disabled:cursor-default"
          title={onElegir && f.clave ? "Filtrar el dashboard por este ítem" : undefined}
        >
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-gray-800 dark:text-gray-200 group-enabled:group-hover:text-[#fd6301]">{f.nombre}</span>
            <span className="shrink-0 tabular-nums font-medium text-gray-900 dark:text-white">{formatoMoneda(f.venta)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-2 rounded-full bg-[#fd6301]" style={{ width: `${Math.max(2, (Math.abs(f.venta) / max) * 100)}%` }} />
            </div>
            <span className="shrink-0 whitespace-nowrap text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {total > 0 ? `${PCT.format((f.venta / total) * 100)}%` : ""}
              {f.detalle ? ` · ${f.detalle}` : ""}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Venta mes a mes: el año del período en naranjo y el anterior en pizarra. */
function EvolucionMensual({ porMes, anio }: { porMes: Resumen["porMes"]; anio: number }) {
  const valor = (a: number, m: number) => porMes.find((p) => p.anio === a && p.mes === m)?.venta || 0;
  const max = Math.max(...porMes.map((p) => p.venta), 1);
  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#fd6301]" /> {anio}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> {anio - 1}</span>
      </div>
      <div className="grid grid-cols-12 gap-1 sm:gap-2 h-40 items-end">
        {MESES.map((nombre, i) => {
          const actual = valor(anio, i + 1);
          const anterior = valor(anio - 1, i + 1);
          return (
            <div key={nombre} className="flex flex-col items-center h-full justify-end">
              <div className="flex items-end gap-0.5 h-full w-full justify-center">
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-slate-300 dark:bg-slate-600"
                  style={{ height: `${(Math.max(anterior, 0) / max) * 100}%` }}
                  title={`${nombre} ${anio - 1}: ${formatoMoneda(anterior)}`}
                />
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-[#fd6301]"
                  style={{ height: `${(Math.max(actual, 0) / max) * 100}%` }}
                  title={`${nombre} ${anio}: ${formatoMoneda(actual)}`}
                />
              </div>
              <span className="mt-1.5 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{nombre}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dashboard de una empresa externa (Pinturería del Sur, empresa 02 de Random).
 * Mismo diseño que el Dashboard de Panorámica, con los datos de la empresa del
 * usuario leídos en vivo desde Random (server/routes-empresa-externa.ts).
 */
export default function DashboardEmpresaExterna() {
  const [, setLocation] = useLocation();
  const { empresa, consulta } = useEmpresaExterna();
  const { selection, setSelection } = useFilter();
  const { desde, hasta } = useMemo(() => rangoDeSeleccion(selection), [selection]);
  const [vendedor, setVendedor] = useState("");
  const [cliente, setCliente] = useState<{ codigo: string; nombre: string } | null>(null);
  const [producto, setProducto] = useState<{ codigo: string; nombre: string } | null>(null);

  const { data: vendedores = [] } = useQuery<{ codigo: string; nombre: string }[]>({
    queryKey: ["empresa-externa", "vendedores", consulta],
    queryFn: () => pedirEmpresaExterna("vendedores", {}, consulta),
    staleTime: 10 * 60_000,
  });

  const { data, isLoading, error } = useQuery<Resumen>({
    queryKey: ["empresa-externa", "resumen", desde, hasta, vendedor, cliente?.codigo, producto?.codigo, consulta],
    queryFn: () =>
      pedirEmpresaExterna("resumen", { desde, hasta, vendedor, cliente: cliente?.codigo, producto: producto?.codigo }, consulta),
    staleTime: 2 * 60_000,
  });

  const desdeNvv = hace90Dias();
  const { data: pendientes } = useQuery<NotaVenta[]>({
    queryKey: ["empresa-externa", "notas-venta", "pendientes", desdeNvv, vendedor, consulta],
    queryFn: () => pedirEmpresaExterna("notas-venta", { estado: "pendientes", desde: desdeNvv, vendedor }, consulta),
    staleTime: 2 * 60_000,
  });

  const t = data?.totales;
  const variacion = t && t.ventaAnterior > 0 ? ((t.venta - t.ventaAnterior) / t.ventaAnterior) * 100 : null;
  const anio = Number(desde.slice(0, 4));
  const montoPendiente = (pendientes || []).reduce((s, n) => s + n.netoPendiente, 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-white dark:bg-slate-900 min-h-screen">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
          <Store className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">{empresa?.nombre}</h1>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
            Tus ventas, al día, desde el sistema de facturación.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="modern-card p-3 sm:p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
          <YearMonthSelector value={selection} onChange={(v) => v && setSelection(v)} />
        </div>
        {vendedores.length > 1 && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500 shrink-0" />
            <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">Vendedor:</span>
            <Select value={vendedor || "todos"} onValueChange={(v) => setVendedor(v === "todos" ? "" : v)}>
              <SelectTrigger className="h-9 w-[220px] rounded-xl" data-testid="select-vendedor-empresa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.codigo} value={v.codigo}>{nombrePropio(v.nombre)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {[
          cliente && { etiqueta: "Cliente", nombre: cliente.nombre, quitar: () => setCliente(null) },
          producto && { etiqueta: "Producto", nombre: producto.nombre, quitar: () => setProducto(null) },
        ]
          .filter(Boolean)
          .map((f: any) => (
            <span key={f.etiqueta} className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-sm px-3 py-1 text-gray-800 dark:text-gray-200 max-w-full">
              <span className="text-gray-500 dark:text-gray-400">{f.etiqueta}:</span>
              <span className="truncate max-w-[220px]">{f.nombre}</span>
              <button type="button" onClick={f.quitar} className="text-gray-500 hover:text-[#fd6301]" aria-label={`Quitar filtro de ${f.etiqueta}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
      </div>

      {error ? (
        <div className="modern-card p-6 text-sm text-red-600">{(error as Error).message}</div>
      ) : isLoading || !data || !t ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#fd6301]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <TarjetaKpi
              titulo="Ventas Totales"
              icono={DollarSign}
              valor={formatoMoneda(t.venta)}
              variacion={variacion === null ? "Sin datos previos" : `${variacion >= 0 ? "+" : ""}${PCT.format(variacion)}%`}
              variacionEtiqueta={`vs ${data.periodo.desdeAnterior.slice(0, 4)} al ${diaMes(data.periodo.hastaAnterior)}`}
              detalles={[{ etiqueta: "Año anterior", valor: formatoMoneda(t.ventaAnterior) }]}
              testId="text-ventas-empresa"
            />
            <TarjetaKpi
              titulo="Clientes"
              icono={Users}
              valor={NUM.format(t.clientes)}
              variacion={NUM.format(t.clientesNuevos)}
              variacionEtiqueta={t.clientesNuevos === 1 ? "cliente nuevo de la empresa" : "clientes nuevos de la empresa"}
              detalles={[
                { etiqueta: "Documentos", valor: NUM.format(t.documentos) },
                { etiqueta: "Unidades vendidas", valor: NUM.format(t.unidades) },
              ]}
            />
            <TarjetaKpi
              titulo="Margen"
              icono={Percent}
              valor={`${PCT.format(t.margenPct)}%`}
              detalles={[
                { etiqueta: "Beneficio", valor: formatoMoneda(t.beneficio) },
                { etiqueta: "Ventas sin flete", valor: formatoMoneda(t.ventaMercaderia) },
                { etiqueta: "Costo", valor: formatoMoneda(t.costo) },
              ]}
            />
            <TarjetaKpi
              titulo="Notas de venta pendientes"
              icono={ClipboardList}
              valor={pendientes ? NUM.format(pendientes.length) : "…"}
              variacion={pendientes ? formatoMoneda(montoPendiente) : undefined}
              variacionEtiqueta="por despachar · últimos 90 días"
              onClick={() => setLocation(`/seguimiento-pedidos${consulta ? `?${consulta}` : ""}`)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="Ventas por vendedor" icono={User}>
              <Ranking
                filas={data.porVendedor.map((v) => ({
                  clave: v.codigo,
                  nombre: nombrePropio(v.nombre),
                  venta: v.venta,
                  detalle: `${PCT.format(v.margenPct)}% margen`,
                }))}
                total={t.venta}
                vacio="Sin ventas en el período."
                onElegir={vendedores.length > 1 ? (codigo) => setVendedor(codigo) : undefined}
              />
            </Panel>
            <Panel titulo={`Venta mensual ${anio} vs ${anio - 1}`} icono={CalendarIcon}>
              <EvolucionMensual porMes={data.porMes} anio={anio} />
            </Panel>
            <Panel titulo="Mejores clientes" icono={Users}>
              <Ranking
                filas={data.topClientes.map((c) => ({ clave: c.codigo, nombre: c.nombre, venta: c.venta }))}
                total={t.venta}
                vacio="Sin ventas en el período."
                onElegir={(codigo, nombre) => setCliente({ codigo, nombre })}
              />
            </Panel>
            <Panel titulo="Productos más vendidos" icono={Store}>
              <Ranking
                filas={data.topProductos.map((p) => ({
                  clave: p.codigo,
                  nombre: p.nombre,
                  venta: p.venta,
                  detalle: `${NUM.format(p.unidades)} ${p.unidad}`.trim(),
                }))}
                total={t.venta}
                vacio="Sin ventas en el período."
                onElegir={(codigo, nombre) => setProducto({ codigo, nombre })}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
