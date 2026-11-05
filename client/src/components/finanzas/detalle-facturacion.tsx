import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ClipboardList, FileDown, FileSpreadsheet, FileText, Layers, Loader2, MapPin, Receipt, RefreshCw, RotateCcw, Search, Store, Truck, User, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import TarjetaKpi from "@/components/dashboard/kpi-simple-card";
import { useToast } from "@/hooks/use-toast";
import { ICONO_CHIP, ICONO_CHIP_ICONO } from "@/lib/icono-chip";

type TipoPeriodo = "diario" | "semanal" | "mensual" | "rango";

interface CategoriaResumen {
  clave: "nvv" | "gdv" | "facturas" | "ncv";
  titulo: string;
  monto: number | null;
  documentos: number | null;
}

interface Resumen {
  actualizadoEn: string;
  desde: string;
  hasta: string;
  categorias: CategoriaResumen[];
  consolidado: number;
  incompleto: boolean;
  opciones: {
    sucursales: { codigo: string; nombre: string }[];
    vendedores: string[];
    clientes: { codigo: string; nombre: string }[];
    segmentos: string[];
  };
}

const TODOS = "todos";

/** Lo facturado menos lo devuelto con notas de crédito. */
const ventasNetas = (r: Resumen) => {
  const monto = (clave: string) => r.categorias.find((c) => c.clave === clave)?.monto ?? 0;
  return monto("facturas") - monto("ncv");
};
const INTERVALO_ACTUALIZACION = 10 * 60 * 1000;

interface FiltrosPanel {
  sucursal: string;
  segmento: string;
  vendedor: string;
  cliente: string;
}

/** Arma la consulta del período con los filtros, sin mandar los que están en "todos". */
function armarParametros(desde: string, hasta: string, filtros: FiltrosPanel, extra: Record<string, string> = {}) {
  const parametros = new URLSearchParams({ desde, hasta, ...extra });
  if (filtros.sucursal !== TODOS) parametros.set("sucursal", filtros.sucursal);
  if (filtros.segmento !== TODOS) parametros.set("segmento", filtros.segmento);
  if (filtros.vendedor !== TODOS) parametros.set("vendedor", filtros.vendedor);
  if (filtros.cliente !== TODOS) parametros.set("cliente", filtros.cliente);
  return parametros.toString();
}

// Buscar sin tildes ni mayúsculas: "construccion" tiene que encontrar "Construcción".
const normalizar = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function PillFiltro({
  etiqueta,
  icono: Icono,
  valor,
  onChange,
  testId,
  textoTodos,
  opciones,
}: {
  etiqueta: string;
  icono: LucideIcon;
  valor: string;
  onChange: (valor: string) => void;
  testId: string;
  textoTodos: string;
  opciones: { valor: string; etiqueta: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const elegir = (nuevo: string) => {
    onChange(nuevo);
    setAbierto(false);
  };
  const actual = opciones.find((o) => o.valor === valor)?.etiqueta ?? textoTodos;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={abierto}
          aria-label={etiqueta}
          data-testid={testId}
          className="flex items-center gap-3 min-w-0 w-full text-left bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all"
        >
          <span className="flex items-center justify-center w-9 h-9 rounded-xl text-[#fd6301] flex-shrink-0">
            <Icono className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-none min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">{etiqueta}</span>
            <span className="truncate font-semibold text-sm leading-5 text-slate-700 dark:text-slate-200">{actual}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command filter={(item, busqueda) => (normalizar(item).includes(normalizar(busqueda)) ? 1 : 0)}>
          <CommandInput placeholder={`Buscar ${etiqueta.toLowerCase()}...`} data-testid={`${testId}-buscar`} />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {/* Siempre a la vista, aunque se esté buscando: es la salida del filtro. */}
              <CommandItem value={textoTodos} forceMount onSelect={() => elegir(TODOS)}>
                <Check className={`mr-2 h-4 w-4 ${valor === TODOS ? "opacity-100" : "opacity-0"}`} />
                {textoTodos}
              </CommandItem>
              {opciones.map((o) => (
                <CommandItem key={o.valor} value={`${o.etiqueta} ${o.valor}`} onSelect={() => elegir(o.valor)}>
                  <Check className={`mr-2 h-4 w-4 shrink-0 ${valor === o.valor ? "opacity-100" : "opacity-0"}`} />
                  {o.etiqueta}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface DocumentoDetalle {
  id: string;
  tipo: string;
  numero: string;
  fecha: string;
  codigoCliente: string;
  cliente: string;
  vendedor: string;
  /** Código de la sucursal: "004". */
  sucursal: string;
  neto: number;
  bruto: number;
}

/** Cómo se lee la sucursal en la tabla; las que no tienen nombre, por su código. */
const NOMBRE_SUCURSAL: Record<string, string> = { "004": "Lautaro", "007": "Concepción" };
const nombreSucursal = (codigo: string) => NOMBRE_SUCURSAL[codigo] ?? (codigo || "—");

type FormatoDescarga = "pdf" | "excel";

type ClaveCategoria = CategoriaResumen["clave"];

const POR_PAGINA = 50;

const CATEGORIAS_BASE: { clave: ClaveCategoria; titulo: string }[] = [
  { clave: "nvv", titulo: "Notas de venta" },
  { clave: "gdv", titulo: "Guías de despacho" },
  { clave: "facturas", titulo: "Total facturado" },
  { clave: "ncv", titulo: "Notas de crédito" },
];

const TITULO_DETALLE: Record<ClaveCategoria, string> = {
  nvv: "Notas de venta",
  gdv: "Guías",
  facturas: "Facturas",
  ncv: "Notas de crédito",
};

const claseOpcion = (activa: boolean) =>
  `h-8 shrink-0 px-4 rounded-xl text-sm font-medium transition-colors ${
    activa
      ? "bg-white dark:bg-slate-700 text-[#fd6301] shadow-sm"
      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
  }`;

const OPCIONES_PERIODO: { valor: TipoPeriodo; etiqueta: string }[] = [
  { valor: "diario", etiqueta: "Diario" },
  { valor: "semanal", etiqueta: "Semanal" },
  { valor: "mensual", etiqueta: "Mensual" },
  { valor: "rango", etiqueta: "Rango" },
];

const ICONOS: Record<CategoriaResumen["clave"], LucideIcon> = {
  nvv: ClipboardList,
  gdv: Truck,
  facturas: Receipt,
  ncv: RotateCcw,
};

const ISO = "yyyy-MM-dd";
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const fechaCorta = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const fechaHoraChile = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function periodoDe(tipo: TipoPeriodo, referencia: Date, rangoDesde: string, rangoHasta: string) {
  if (tipo === "diario") return { desde: format(referencia, ISO), hasta: format(referencia, ISO) };
  if (tipo === "semanal") {
    return {
      desde: format(startOfWeek(referencia, { weekStartsOn: 1 }), ISO),
      hasta: format(endOfWeek(referencia, { weekStartsOn: 1 }), ISO),
    };
  }
  if (tipo === "mensual") {
    return { desde: format(startOfMonth(referencia), ISO), hasta: format(endOfMonth(referencia), ISO) };
  }
  return { desde: rangoDesde, hasta: rangoHasta };
}

function etiquetaDe(tipo: TipoPeriodo, desde: string, hasta: string) {
  if (!desde || !hasta) return "";
  if (tipo === "mensual") {
    const mes = format(parseISO(desde), "MMMM yyyy", { locale: es });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  }
  return desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

interface LineaDocumento {
  codigo: string;
  producto: string;
  unidad: string;
  cantidad: number;
  pendiente: number | null;
  precio: number;
  neto: number;
  bruto: number;
}

const cantidad = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

/** Los productos de un documento, al desplegarlo. Se leen recién al abrirlo. */
function LineasDelDocumento({ categoria, id }: { categoria: ClaveCategoria; id: string }) {
  const { data, isLoading, isError, error } = useQuery<{ lineas: LineaDocumento[] }, Error>({
    queryKey: ["/api/detalle-facturacion/lineas", categoria, id],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/detalle-facturacion/lineas?${new URLSearchParams({ categoria, id })}`, { credentials: "include" });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.message || "No se pudo leer el detalle del documento");
      return cuerpo;
    },
  });
  const conPendiente = categoria === "nvv" || categoria === "gdv";

  if (isLoading) {
    return (
      <p className="py-3 text-xs text-slate-500 dark:text-slate-400">
        <Loader2 className="inline h-3.5 w-3.5 mr-2 animate-spin" />
        Cargando productos…
      </p>
    );
  }
  if (isError) return <p className="py-3 text-xs text-red-600 dark:text-red-400">{error?.message}</p>;
  const lineas = data?.lineas ?? [];
  if (lineas.length === 0) return <p className="py-3 text-xs text-slate-500 dark:text-slate-400">Este documento no tiene líneas en el sistema de gestión.</p>;

  return (
    <div className="py-2" data-testid={`detalle-lineas-${id}`}>
      {conPendiente && (
        <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">Solo las líneas que faltan pasar al documento siguiente; neto y bruto de lo pendiente.</p>
      )}
      {/* Escritorio */}
      <table className="hidden md:table w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
            <th className="py-1 pr-3 font-semibold">Código</th>
            <th className="py-1 pr-3 font-semibold">Producto</th>
            <th className="py-1 pr-3 font-semibold text-right">Cantidad</th>
            {conPendiente && <th className="py-1 pr-3 font-semibold text-right">Pendiente</th>}
            <th className="py-1 pr-3 font-semibold text-right">Precio neto</th>
            <th className="py-1 pr-3 font-semibold text-right">Neto</th>
            <th className="py-1 font-semibold text-right">Bruto</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} className="border-t border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
              <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{l.codigo}</td>
              <td className="py-1 pr-3">{l.producto}</td>
              <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums">{cantidad(l.cantidad)} {l.unidad}</td>
              {conPendiente && <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums">{cantidad(l.pendiente ?? 0)}</td>}
              <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums">{clp(l.precio)}</td>
              <td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums font-medium">{clp(l.neto)}</td>
              <td className="py-1 text-right whitespace-nowrap tabular-nums">{clp(l.bruto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Celular */}
      <div className="md:hidden space-y-1.5">
        {lineas.map((l, i) => (
          <div key={i} className="border-t border-slate-200/70 dark:border-slate-700/60 pt-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <p className="min-w-0 text-slate-700 dark:text-slate-200">{l.producto}</p>
              <p className="shrink-0 tabular-nums font-medium text-slate-700 dark:text-slate-200">{clp(l.neto)}</p>
            </div>
            <p className="text-slate-500 dark:text-slate-400 tabular-nums">
              {l.codigo} · {cantidad(l.cantidad)} {l.unidad}
              {conPendiente && ` · pendiente ${cantidad(l.pendiente ?? 0)}`} · {clp(l.precio)} c/u
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Los documentos de una categoría en el período: tabla en escritorio, tarjetas en celular. */
function DocumentosDelPeriodo({
  desde,
  hasta,
  filtros,
  categoria,
  onCategoria,
  descargando,
  onDescargar,
}: {
  desde: string;
  hasta: string;
  filtros: FiltrosPanel;
  categoria: ClaveCategoria;
  onCategoria: (clave: ClaveCategoria) => void;
  /** La descarga en curso, de esta tabla o del informe completo: no se disparan dos a la vez. */
  descargando: string | null;
  /** Baja solo la pestaña que se está mirando, con la búsqueda escrita. */
  onDescargar: (formato: FormatoDescarga, busqueda: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  const { data, isLoading, isError, error } = useQuery<{ documentos: DocumentoDetalle[] | null }, Error>({
    queryKey: ["/api/detalle-facturacion/documentos", desde, hasta, filtros, categoria],
    retry: false,
    refetchInterval: INTERVALO_ACTUALIZACION,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const parametros = armarParametros(desde, hasta, filtros, { categoria });
      const res = await fetch(`/api/detalle-facturacion/documentos?${parametros}`, { credentials: "include" });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.message || "No se pudo cargar el detalle");
      return cuerpo;
    },
  });

  // Por defecto los más recientes primero: es lo que se viene a revisar.
  const [ordenFecha, setOrdenFecha] = useState<"desc" | "asc">("desc");
  // Documentos desplegados, por id: se pueden abrir varios a la vez.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const alternarAbierto = (id: string) =>
    setAbiertos((prev) => {
      const sig = new Set(prev);
      if (sig.has(id)) sig.delete(id);
      else sig.add(id);
      return sig;
    });
  useEffect(() => setAbiertos(new Set()), [desde, hasta, filtros, categoria]);
  const alternarOrden = () => setOrdenFecha((o) => (o === "desc" ? "asc" : "desc"));

  useEffect(() => setPagina(0), [desde, hasta, filtros, categoria, busqueda, ordenFecha]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    // Orden estable por fecha: dentro del mismo día se respeta el orden en que llegan del ERP.
    const ascendente = (data?.documentos ?? [])
      .map((d, i) => ({ d, i }))
      .sort((a, b) => a.d.fecha.localeCompare(b.d.fecha) || a.i - b.i)
      .map(({ d }) => d);
    const lista = ordenFecha === "asc" ? ascendente : ascendente.reverse();
    if (!termino) return lista;
    return lista.filter((d) =>
      [d.numero, d.cliente, d.codigoCliente, d.vendedor].some((v) => v.toLowerCase().includes(termino)),
    );
  }, [data, busqueda, ordenFecha]);

  const IconoOrden = ordenFecha === "desc" ? ArrowDown : ArrowUp;
  const etiquetaOrden = ordenFecha === "desc" ? "Más recientes primero" : "Más antiguas primero";

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4" data-testid="documentos-periodo">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
        <div className="inline-flex self-start max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800 p-1">
          {CATEGORIAS_BASE.map((c) => (
            <button
              key={c.clave}
              type="button"
              aria-pressed={categoria === c.clave}
              onClick={() => onCategoria(c.clave)}
              data-testid={`detalle-${c.clave}`}
              className={claseOpcion(categoria === c.clave)}
            >
              {TITULO_DETALLE[c.clave]}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 lg:items-center">
          <div className="relative lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar N°, cliente o vendedor"
              aria-label="Buscar documento"
              className="h-10 pl-9 rounded-2xl"
              data-testid="detalle-busqueda"
            />
          </div>
          {/* Solo esta pestaña (pedido del usuario, nov-2026): cada documento con sus
              productos, con los filtros de arriba y lo escrito en el buscador. */}
          <div className="grid grid-cols-2 sm:flex gap-2">
            {(["pdf", "excel"] as const).map((formato) => (
              <Button
                key={formato}
                variant="outline"
                className="h-10 px-3 text-sm font-semibold rounded-2xl text-slate-700 dark:text-slate-200 hover:border-orange-200 hover:text-[#fd6301]"
                disabled={descargando !== null || isLoading || !data?.documentos?.length || filtrados.length === 0}
                onClick={() => onDescargar(formato, busqueda.trim())}
                title={`Descargar ${TITULO_DETALLE[categoria].toLowerCase()} en ${formato === "pdf" ? "PDF" : "Excel"}, con el detalle de cada documento`}
                data-testid={`detalle-tabla-${formato}`}
              >
                {descargando === `tabla-${formato}` ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : formato === "pdf" ? (
                  <FileDown className="h-4 w-4 mr-2" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                {formato === "pdf" ? "PDF" : "Excel"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
          Cargando documentos…
        </p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error?.message}</p>
      ) : data?.documentos === null ? (
        <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">
          No se pudo consultar el sistema de gestión: este detalle no está disponible.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {busqueda.trim()
            ? "Ningún documento coincide con la búsqueda."
            : categoria === "nvv" || categoria === "gdv"
              ? "No hay documentos pendientes en este período."
              : "No hay documentos en este período."}
        </p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm" data-testid="detalle-tabla">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 font-semibold">N°</th>
                  <th className="py-2 pr-3 font-semibold" aria-sort={ordenFecha === "desc" ? "descending" : "ascending"}>
                    <button
                      type="button"
                      onClick={alternarOrden}
                      title={`${etiquetaOrden} (clic para invertir)`}
                      className="inline-flex items-center gap-1 uppercase tracking-wider text-orange-500 hover:text-orange-600"
                      data-testid="detalle-orden-fecha"
                    >
                      Fecha
                      <IconoOrden className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="py-2 pr-3 font-semibold">Sucursal</th>
                  <th className="py-2 pr-3 font-semibold">Cliente</th>
                  <th className="py-2 pr-3 font-semibold">Vendedor</th>
                  <th className="py-2 pr-3 font-semibold text-right">Neto</th>
                  <th className="py-2 font-semibold text-right">Bruto</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => {
                  const abierto = abiertos.has(d.id);
                  return (
                  <Fragment key={d.id}>
                  <tr
                    onClick={() => alternarAbierto(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        alternarAbierto(d.id);
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={abierto}
                    title={abierto ? "Ocultar detalle" : "Ver detalle"}
                    data-testid={`detalle-fila-${d.id}`}
                    className={`border-b border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-orange-50/60 dark:hover:bg-slate-800/50 focus-visible:outline-none focus-visible:bg-orange-50/60 ${abierto ? "bg-orange-50/60 dark:bg-slate-800/50" : ""}`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <ChevronDown className={`inline h-3.5 w-3.5 mr-1 text-slate-400 transition-transform ${abierto ? "" : "-rotate-90"}`} />
                      {d.tipo}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{d.numero}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{fechaCorta(d.fecha)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap" title={`Sucursal ${d.sucursal}`}>{nombreSucursal(d.sucursal)}</td>
                    <td className="py-2 pr-3">{d.cliente || d.codigoCliente}</td>
                    <td className="py-2 pr-3">{d.vendedor || "—"}</td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums font-medium">{clp(d.neto)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">{clp(d.bruto)}</td>
                  </tr>
                  {abierto && (
                    <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-slate-800/30">
                      <td colSpan={8} className="px-6">
                        <LineasDelDocumento categoria={categoria} id={d.id} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2" data-testid="detalle-lista">
            <button
              type="button"
              onClick={alternarOrden}
              className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500"
              data-testid="detalle-orden-fecha-movil"
            >
              <IconoOrden className="h-3.5 w-3.5" />
              {etiquetaOrden}
            </button>
            {visibles.map((d) => (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                aria-expanded={abiertos.has(d.id)}
                onClick={() => alternarAbierto(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    alternarAbierto(d.id);
                  }
                }}
                className={`rounded-2xl border p-3 cursor-pointer ${abiertos.has(d.id) ? "border-orange-300 dark:border-orange-500/50" : "border-slate-200/70 dark:border-slate-800"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{d.cliente || d.codigoCliente}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">{clp(d.neto)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {d.tipo} {d.numero} · {fechaCorta(d.fecha)} · {nombreSucursal(d.sucursal)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{d.vendedor || "—"} · Bruto {clp(d.bruto)}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-500">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abiertos.has(d.id) ? "rotate-180" : ""}`} />
                  {abiertos.has(d.id) ? "Ocultar detalle" : "Ver detalle"}
                </p>
                {abiertos.has(d.id) && (
                  <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                    <LineasDelDocumento categoria={categoria} id={d.id} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span className="tabular-nums" data-testid="detalle-conteo">
              {filtrados.length.toLocaleString("es-CL")} documentos · {clp(filtrados.reduce((s, d) => s + d.neto, 0))} neto
            </span>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Página anterior" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums">{pagina + 1} / {totalPaginas}</span>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Página siguiente" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Totales de notas de venta, guías, facturas y notas de crédito del período, con
 * su descarga en PDF y Excel. Lo usan el panel de Recepción y Finanzas (admin).
 */
export default function DetalleFacturacion() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoPeriodo>("mensual");
  const [referencia, setReferencia] = useState(() => new Date());
  const hoy = format(new Date(), ISO);
  const [rangoDesde, setRangoDesde] = useState(() => format(startOfMonth(new Date()), ISO));
  const [rangoHasta, setRangoHasta] = useState(hoy);
  // "pdf"/"excel" = el informe completo; "tabla-pdf"/"tabla-excel" = solo la pestaña de la tabla.
  const [descargando, setDescargando] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<ClaveCategoria>("nvv");
  const [sucursal, setSucursal] = useState(TODOS);
  const [segmento, setSegmento] = useState(TODOS);
  const [vendedor, setVendedor] = useState(TODOS);
  const [cliente, setCliente] = useState(TODOS);
  const filtros = useMemo(() => ({ sucursal, segmento, vendedor, cliente }), [sucursal, segmento, vendedor, cliente]);

  const { desde, hasta } = periodoDe(tipo, referencia, rangoDesde, rangoHasta);
  const fechasListas = Boolean(desde && hasta);
  const parametros = armarParametros(desde, hasta, filtros);

  const { data, isLoading, isFetching, isError, error, isPlaceholderData } = useQuery<Resumen, Error>({
    queryKey: ["/api/detalle-facturacion/resumen", desde, hasta, filtros],
    // Mientras carga el filtro recién elegido, sus opciones siguen a la vista.
    placeholderData: (anterior) => anterior,
    enabled: fechasListas,
    retry: false,
    refetchInterval: INTERVALO_ACTUALIZACION,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const res = await fetch(`/api/detalle-facturacion/resumen?${parametros}`, { credentials: "include" });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.message || "No se pudo cargar el detalle");
      return cuerpo;
    },
  });

  // Al cambiar de período, un vendedor o cliente sin movimiento ya no está en la
  // lista: se vuelve a "todos" para no dejar un filtro invisible aplicado.
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    if (segmento !== TODOS && !data.opciones.segmentos.includes(segmento)) setSegmento(TODOS);
    if (vendedor !== TODOS && !data.opciones.vendedores.includes(vendedor)) setVendedor(TODOS);
    if (cliente !== TODOS && !data.opciones.clientes.some((c) => c.codigo === cliente)) setCliente(TODOS);
  }, [data, isPlaceholderData, segmento, vendedor, cliente]);

  const mover = (delta: number) => {
    setReferencia((actual) => {
      if (tipo === "diario") return addDays(actual, delta);
      if (tipo === "semanal") return addWeeks(actual, delta);
      return addMonths(actual, delta);
    });
  };

  const actualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/detalle-facturacion/resumen"] });
    queryClient.invalidateQueries({ queryKey: ["/api/detalle-facturacion/documentos"] });
  };

  /** Sin `soloTabla`, el informe completo; con él, solo la pestaña de la tabla y su búsqueda. */
  const descargar = async (formato: FormatoDescarga, soloTabla?: { busqueda: string }) => {
    setDescargando(soloTabla ? `tabla-${formato}` : formato);
    try {
      const extra: Record<string, string> = soloTabla ? { categoria } : {};
      if (soloTabla?.busqueda) extra.busqueda = soloTabla.busqueda;
      const res = await fetch(`/api/detalle-facturacion/${formato}?${armarParametros(desde, hasta, filtros, extra)}`, { credentials: "include" });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        throw new Error(cuerpo?.message || "No se pudo generar el archivo");
      }
      const url = URL.createObjectURL(await res.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      // El nombre lleva los filtros: dos descargas del mismo período no se confunden.
      const nombreCliente = data?.opciones.clientes.find((c) => c.codigo === cliente)?.nombre ?? cliente;
      const sufijo = [
        soloTabla ? TITULO_DETALLE[categoria] : TODOS,
        sucursal === TODOS ? TODOS : nombreSucursal(sucursal),
        segmento,
        vendedor,
        cliente === TODOS ? TODOS : nombreCliente,
      ]
        .filter((v) => v !== TODOS)
        .map((v) => `_${normalizar(v).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`)
        .join("");
      enlace.download = `detalle-facturacion_${desde}_${hasta}${sufijo}.${formato === "pdf" ? "pdf" : "xlsx"}`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "No se pudo descargar", description: e?.message, variant: "destructive" });
    } finally {
      setDescargando(null);
    }
  };

  const claseDescarga =
    "h-10 px-4 text-sm font-semibold rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-orange-200 hover:text-[#fd6301] shadow-sm";
  // Si falla una actualización automática, siguen a la vista los últimos datos, con su hora.
  const sinDatos = isError && !data;
  const puedeDescargar = fechasListas && !sinDatos && !isLoading && !descargando;

  return (
    <section className="mb-6" data-testid="detalle-facturacion">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={ICONO_CHIP}>
            <FileText className={ICONO_CHIP_ICONO} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Detalle facturación NVV y GDV</h2>
            <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
              Montos netos del período. Notas de venta y guías: solo lo que falta pasar al documento siguiente.
            </p>
            {data?.actualizadoEn && (
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums" data-testid="ultima-actualizacion">
                Última actualización: {fechaHoraChile(data.actualizadoEn)}
                {isError && <span className="text-red-600 dark:text-red-400"> · No se pudo actualizar de nuevo</span>}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <Button variant="outline" className={claseDescarga} disabled={!fechasListas || isFetching} onClick={actualizar} data-testid="detalle-facturacion-actualizar">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" className={claseDescarga} disabled={!puedeDescargar} onClick={() => descargar("pdf")} data-testid="detalle-facturacion-pdf">
            {descargando === "pdf" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            PDF
          </Button>
          <Button variant="outline" className={claseDescarga} disabled={!puedeDescargar} onClick={() => descargar("excel")} data-testid="detalle-facturacion-excel">
            {descargando === "excel" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <PillFiltro
          etiqueta="Sucursal"
          icono={MapPin}
          valor={sucursal}
          onChange={setSucursal}
          testId="filtro-sucursal"
          textoTodos="Todas las sucursales"
          opciones={(data?.opciones.sucursales ?? []).map((s) => ({ valor: s.codigo, etiqueta: s.nombre }))}
        />
        <PillFiltro
          etiqueta="Segmento"
          icono={Layers}
          valor={segmento}
          onChange={setSegmento}
          testId="filtro-segmento"
          textoTodos="Todos los segmentos"
          opciones={(data?.opciones.segmentos ?? []).map((s) => ({ valor: s, etiqueta: s }))}
        />
        <PillFiltro
          etiqueta="Vendedor"
          icono={User}
          valor={vendedor}
          onChange={setVendedor}
          testId="filtro-vendedor"
          textoTodos="Todos los vendedores"
          opciones={(data?.opciones.vendedores ?? []).map((v) => ({ valor: v, etiqueta: v }))}
        />
        <PillFiltro
          etiqueta="Cliente"
          icono={Store}
          valor={cliente}
          onChange={setCliente}
          testId="filtro-cliente"
          textoTodos="Todos los clientes"
          opciones={(data?.opciones.clientes ?? []).map((c) => ({ valor: c.codigo, etiqueta: c.nombre }))}
        />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4" data-sin-brillo>
        <div className="inline-flex self-start max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-1 rounded-2xl bg-slate-100/70 dark:bg-slate-800 p-1">
          {OPCIONES_PERIODO.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              aria-pressed={tipo === opcion.valor}
              onClick={() => setTipo(opcion.valor)}
              data-testid={`periodo-${opcion.valor}`}
              className={claseOpcion(tipo === opcion.valor)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>

        {tipo === "rango" ? (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Input
              type="date"
              aria-label="Desde"
              value={rangoDesde}
              max={rangoHasta || undefined}
              onChange={(e) => setRangoDesde(e.target.value)}
              className="h-10 rounded-2xl sm:w-44"
              data-testid="rango-desde"
            />
            <Input
              type="date"
              aria-label="Hasta"
              value={rangoHasta}
              min={rangoDesde || undefined}
              onChange={(e) => setRangoHasta(e.target.value)}
              className="h-10 rounded-2xl sm:w-44"
              data-testid="rango-hasta"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0" aria-label="Período anterior" onClick={() => mover(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[11rem] text-center text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums" data-testid="periodo-etiqueta">
              {etiquetaDe(tipo, desde, hasta)}
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0" aria-label="Período siguiente" onClick={() => mover(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {sinDatos ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error?.message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {(data?.categorias ?? (CATEGORIAS_BASE as CategoriaResumen[])).map((c) => (
              <TarjetaKpi
                key={c.clave}
                titulo={c.titulo}
                icono={ICONOS[c.clave]}
                valor={isLoading ? "…" : c.monto === null ? "No disponible" : clp(c.monto)}
                detalles={
                  !isLoading && c.documentos !== null
                    ? [{ etiqueta: "Documentos", valor: c.documentos.toLocaleString("es-CL") }]
                    : undefined
                }
                testId={`total-${c.clave}`}
                onClick={() => setCategoria(c.clave)}
                className={categoria === c.clave ? "!border-[#fd6301]" : ""}
              />
            ))}
          </div>

          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ventas netas del período</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total facturado − notas de crédito.</p>
            </div>
            <p className="text-xl font-bold text-[#fd6301] tabular-nums shrink-0" data-testid="total-ventas-netas">
              {isLoading || !data ? "…" : clp(ventasNetas(data))}
            </p>
          </div>

          {data?.incompleto && (
            <p className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400" data-testid="aviso-incompleto">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No se pudo consultar el sistema de gestión: faltan las notas de venta y las guías, y las facturas y notas de crédito vienen de la última carga.
            </p>
          )}

          {fechasListas && (
            <DocumentosDelPeriodo
              desde={desde}
              hasta={hasta}
              filtros={filtros}
              categoria={categoria}
              onCategoria={setCategoria}
              descargando={descargando}
              onDescargar={(formato, busqueda) => descargar(formato, { busqueda })}
            />
          )}
        </>
      )}
    </section>
  );
}
