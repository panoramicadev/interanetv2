/**
 * Obras — pestaña del Seguimiento del Panel de Trabajo (área Construcción).
 *
 * El Seguimiento seguía cliente por cliente, pero en Construcción lo que se
 * sigue de verdad es la OBRA: la constructora es una razón social, la obra es
 * la que avanza, la que se queda sin material y la que hay que ir a ver.
 *
 * Esta pestaña es el resumen de la pestaña Obras leído desde ahí: la misma
 * cartera, sin la planilla ni la edición, ordenada por lo que hay que atender.
 * Al abrir una obra aparece todo lo que se sabe de ella —su ficha, su control y
 * sus productos— y, debajo, su BITÁCORA: el relato de las visitas, los avances
 * y los problemas, que es lo que el control por números no puede contar.
 *
 * El día a día (cargar productos, registrar pedidos y entregas, crear o editar
 * obras) sigue viviendo en la pestaña Obras — acá se lee y se anota.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BitacoraObra } from "@/components/obras/bitacora";
import { BadgeEstado, BarraAvance } from "@/components/obras/celdas";
import {
  calcularObra,
  calcularProducto,
  calcularTotales,
  fmtDesviacion,
  type EstadoObra,
  type ObraCalculada,
} from "@/components/obras/calculos";
import { fmt, fmtDec, fmtPct, normalizar } from "@/components/obras/formato";
import type { ObraConCliente, ObraProducto } from "@shared/schema";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  HardHat,
  Home,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Paintbrush,
  Search,
  ShoppingCart,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

/** Una fila de /api/obras/bitacora-resumen: cuánta bitácora tiene cada obra. */
interface ResumenBitacora {
  obraId: string;
  total: number;
  ultimaNota: string | null;
  ultimoAutor: string | null;
  ultimaFecha: string | null;
}

/** "hace 3 días" — la antigüedad de la última nota es lo que se mira primero. */
const hace = (valor: string | Date | null | undefined) => {
  if (!valor) return "";
  const d = new Date(valor);
  if (isNaN(d.getTime())) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 31) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  const meses = Math.round(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
};

interface FilaSeguimiento {
  calc: ObraCalculada;
  productos: ObraProducto[];
  bitacora: ResumenBitacora | null;
}

/**
 * Orden de la lista: primero lo que hay que atender.
 *
 * Es el mismo criterio del control (crítico antes que pedir, antes que
 * revisar), con una vuelta de tuerca propia del seguimiento: una obra "Sin
 * cargar" también pide atención —nadie le puso los productos todavía— así que
 * va antes que las que están OK.
 */
const PRIORIDAD_ESTADO: Record<EstadoObra, number> = {
  critico: 0,
  pedir: 1,
  revisar: 2,
  sindatos: 3,
  ok: 4,
  terminado: 5,
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SeguimientoObrasContent({ onIrAObras }: { onIrAObras?: () => void }) {
  // Obra abierta. null = listado.
  const [obraAbierta, setObraAbierta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoObra | "todos">("todos");

  const { data: obras = [], isLoading } = useQuery<ObraConCliente[]>({
    queryKey: ["/api/obras"],
    queryFn: async () => {
      const res = await apiRequest("/api/obras");
      return res.json();
    },
  });

  const { data: productos = [] } = useQuery<ObraProducto[]>({
    queryKey: ["/api/obra-productos"],
    queryFn: async () => {
      const res = await apiRequest("/api/obra-productos");
      return res.json();
    },
  });

  // Cuánta bitácora tiene cada obra y cuál fue la última entrada, en una sola
  // consulta: el listado lo muestra en cada fila.
  const { data: resumenBitacora = [] } = useQuery<ResumenBitacora[]>({
    queryKey: ["/api/obras/bitacora-resumen"],
    queryFn: async () => {
      const res = await apiRequest("/api/obras/bitacora-resumen");
      return res.json();
    },
  });

  const productosPorObra = useMemo(() => {
    const mapa = new Map<string, ObraProducto[]>();
    for (const p of productos) {
      const lista = mapa.get(p.obraId);
      if (lista) lista.push(p);
      else mapa.set(p.obraId, [p]);
    }
    return mapa;
  }, [productos]);

  const bitacoraPorObra = useMemo(() => {
    const mapa = new Map<string, ResumenBitacora>();
    for (const r of resumenBitacora) mapa.set(r.obraId, r);
    return mapa;
  }, [resumenBitacora]);

  const filas = useMemo<FilaSeguimiento[]>(() => {
    return obras
      .map((o) => {
        const propios = productosPorObra.get(o.id) ?? [];
        return {
          calc: calcularObra(o, propios),
          productos: propios,
          bitacora: bitacoraPorObra.get(o.id) ?? null,
        };
      })
      .sort((a, b) => {
        const prio = PRIORIDAD_ESTADO[a.calc.estado] - PRIORIDAD_ESTADO[b.calc.estado];
        if (prio !== 0) return prio;
        // Dentro del mismo estado, arriba lo que hace más tiempo que no se
        // anota (sin bitácora es lo más "abandonado" de todo).
        const fa = a.bitacora?.ultimaFecha ? new Date(a.bitacora.ultimaFecha).getTime() : 0;
        const fb = b.bitacora?.ultimaFecha ? new Date(b.bitacora.ultimaFecha).getTime() : 0;
        return fa - fb || a.calc.obra.nombre.localeCompare(b.calc.obra.nombre);
      });
  }, [obras, productosPorObra, bitacoraPorObra]);

  const totales = useMemo(() => calcularTotales(filas.map((f) => f.calc)), [filas]);

  const sinBitacora = useMemo(() => filas.filter((f) => !f.bitacora || f.bitacora.total === 0).length, [filas]);

  const conAlerta = useMemo(
    () => filas.filter((f) => ["critico", "pedir", "revisar"].includes(f.calc.estado)).length,
    [filas],
  );

  const filtradas = useMemo(() => {
    const q = normalizar(filtro.trim());
    return filas.filter((f) => {
      if (filtroEstado !== "todos" && f.calc.estado !== filtroEstado) return false;
      if (!q) return true;
      const o = f.calc.obra;
      return (
        normalizar(o.nombre).includes(q) ||
        normalizar(o.clienteNombre ?? "").includes(q) ||
        normalizar(o.ciudad ?? "").includes(q) ||
        normalizar(o.programa ?? "").includes(q) ||
        normalizar(o.etapa ?? "").includes(q)
      );
    });
  }, [filas, filtro, filtroEstado]);

  const abierta = useMemo(
    () => (obraAbierta ? filas.find((f) => f.calc.obra.id === obraAbierta) ?? null : null),
    [filas, obraAbierta],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Detalle de una obra
  // ---------------------------------------------------------------------
  if (abierta) {
    return (
      <DetalleObra
        fila={abierta}
        onVolver={() => setObraAbierta(null)}
        onIrAObras={onIrAObras}
      />
    );
  }

  // ---------------------------------------------------------------------
  // Listado
  // ---------------------------------------------------------------------
  if (filas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-16">
        <span className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
          <HardHat className="h-8 w-8" />
        </span>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Todavía no hay obras</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Las obras se dan de alta en la pestaña Obras. Cuando existan, acá vas a poder seguirlas una por una y
          llevarles la bitácora.
        </p>
        {onIrAObras && (
          <Button
            onClick={onIrAObras}
            className="mt-5 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
            data-testid="button-seguimiento-obras-ir-a-obras-vacio"
          >
            <HardHat className="h-4 w-4 mr-2" />
            Ir a Obras
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Obras en seguimiento</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filas.length} {filas.length === 1 ? "obra" : "obras"} · toca una para ver su ficha y su bitácora
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar obra, constructora, ciudad…"
              className="pl-9 rounded-2xl bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60"
              data-testid="input-seguimiento-obras-buscar"
            />
          </div>
          {onIrAObras && (
            <Button
              variant="ghost"
              onClick={onIrAObras}
              className="rounded-2xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              data-testid="button-seguimiento-obras-ir-a-obras"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir a Obras
            </Button>
          )}
        </div>
      </div>

      {/* Los cuatro números con los que se entra: cuánto hay, cuánto pide
          atención, qué quedó sin anotar y cuánto hay que comprar. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Indicador icono={<HardHat className="h-3.5 w-3.5" />} tono="sky" label="Obras" valor={fmt(filas.length)} />
        <Indicador
          icono={<AlertTriangle className="h-3.5 w-3.5" />}
          tono={conAlerta > 0 ? "red" : "emerald"}
          label="Piden atención"
          valor={fmt(conAlerta)}
          sufijo="críticas, por pedir o a revisar"
        />
        <Indicador
          icono={<MessageSquare className="h-3.5 w-3.5" />}
          tono={sinBitacora > 0 ? "amber" : "emerald"}
          label="Sin bitácora"
          valor={fmt(sinBitacora)}
          sufijo="sin ninguna anotación"
        />
        <Indicador
          icono={<ShoppingCart className="h-3.5 w-3.5" />}
          tono="amber"
          label="Próximo pedido"
          valor={fmtDec(totales.sugerido)}
          sufijo="unidades"
        />
      </div>

      {/* Filtro por estado — el mismo de la pestaña Obras. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFiltroEstado("todos")}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
            filtroEstado === "todos"
              ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          }`}
          data-testid="button-seguimiento-obras-estado-todos"
        >
          Todas
          <span className="tabular-nums opacity-70">{filas.length}</span>
        </button>
        {totales.conteoEstados
          .filter((e) => e.cantidad > 0)
          .map((e) => (
            <button
              key={e.key}
              onClick={() => setFiltroEstado(filtroEstado === e.key ? "todos" : e.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${e.badge} ${
                filtroEstado === e.key ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900" : "opacity-80 hover:opacity-100"
              }`}
              data-testid={`button-seguimiento-obras-estado-${e.key}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
              {e.label}
              <span className="tabular-nums">{e.cantidad}</span>
            </button>
          ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-12 text-center text-sm text-slate-500">
          Ninguna obra coincide con la búsqueda.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex-1 min-w-0">Obra</span>
            <span className="w-[150px] text-center">Avance</span>
            <span className="w-24 text-right">Próx. pedido</span>
            <span className="w-[230px]">Última anotación</span>
            <span className="w-[104px]">Estado</span>
            <span className="w-4" />
          </div>
          {filtradas.map((f) => (
            <FilaObraSeguimiento key={f.calc.obra.id} fila={f} onAbrir={() => setObraAbierta(f.calc.obra.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila del listado
// ---------------------------------------------------------------------------

function FilaObraSeguimiento({ fila, onAbrir }: { fila: FilaSeguimiento; onAbrir: () => void }) {
  const { calc, bitacora } = fila;
  const obra = calc.obra;

  const contexto = [obra.ciudad, obra.programa, obra.temporada, obra.etapa].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onAbrir}
      className="w-full text-left flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group"
      data-testid={`row-seguimiento-obra-${obra.id}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
          <HardHat className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight truncate group-hover:text-orange-600 transition-colors">
            {obra.nombre}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {obra.clienteNombre ?? "Sin constructora"}
            {contexto && ` · ${contexto}`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 flex-shrink-0 pl-12 lg:pl-0">
        <div className="w-[150px]">
          <BarraAvance avance={calc.avance} hayDato={calc.viviendas > 0} />
        </div>

        <div className="w-24 text-right">
          <div className="lg:hidden text-[9px] uppercase tracking-wider font-bold text-slate-400">Próx. pedido</div>
          <div className={`text-sm font-bold tabular-nums ${calc.sugerido > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>
            {fmtDec(calc.sugerido)}
          </div>
        </div>

        {/* Lo último que se anotó: es lo que dice si la obra está siendo seguida. */}
        <div className="w-[230px] min-w-0">
          {bitacora && bitacora.total > 0 ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {hace(bitacora.ultimaFecha)}
                </span>
                {bitacora.ultimoAutor && (
                  <span className="text-[10px] text-slate-400 truncate">· {bitacora.ultimoAutor}</span>
                )}
                <span className="text-[10px] tabular-nums text-slate-300 dark:text-slate-600 ml-auto">
                  {bitacora.total}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{bitacora.ultimaNota}</div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <MessageSquare className="h-3 w-3" />
              Sin bitácora
            </span>
          )}
        </div>

        <div className="w-[104px]">
          <BadgeEstado estado={calc.estado} />
        </div>

        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detalle: ficha + control + productos + bitácora
// ---------------------------------------------------------------------------

function DetalleObra({
  fila,
  onVolver,
  onIrAObras,
}: {
  fila: FilaSeguimiento;
  onVolver: () => void;
  onIrAObras?: () => void;
}) {
  const { calc, productos } = fila;
  const obra = calc.obra;
  const esEdificio = obra.tipoObra === "edificios";
  const unidad = esEdificio ? "departamentos" : "viviendas";
  const calculados = productos.map(calcularProducto);

  return (
    <div className="space-y-5">
      {/* Volver + acceso a la planilla */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Button
          variant="ghost"
          onClick={onVolver}
          className="rounded-2xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
          data-testid="button-seguimiento-obra-volver"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Obras en seguimiento
        </Button>
        {onIrAObras && (
          <Button
            variant="ghost"
            onClick={onIrAObras}
            className="rounded-2xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
            data-testid="button-seguimiento-obra-ir-a-obras"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Editar en Obras
          </Button>
        )}
      </div>

      {/* Banner: quién es la obra y cómo viene */}
      <div className="rounded-2xl overflow-hidden shadow-md shadow-orange-500/25">
        <div className="bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <HardHat className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide truncate" data-testid="text-seguimiento-obra-nombre">
                {obra.nombre}
              </h3>
              <p className="text-[11px] text-white/75 truncate">
                {obra.clienteNombre ?? "Sin constructora"}
                {obra.ciudad ? ` · ${obra.ciudad}` : ""}
                {obra.temporada ? ` · Temporada ${obra.temporada}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <BannerDato label={esEdificio ? "Departamentos" : "Viviendas"} valor={fmt(calc.viviendas)} />
            <BannerDato label="Pintadas" valor={fmt(calc.pintadas)} sufijo={fmtPct(calc.avance)} />
            <BannerDato label="Saldo en obra" valor={fmtDec(calc.saldo)} />
            <div className="rounded-xl bg-white/15 px-3 py-1.5">
              <div className="text-[9px] uppercase tracking-wider font-bold text-white/70 flex items-center gap-1.5">
                <ShoppingCart className="h-3 w-3" />
                Próximo pedido
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums">{fmtDec(calc.sugerido)}</span>
                <span className="text-[10px] font-semibold text-white/80">unidades</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estado + control, los números que resumen la obra */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Indicador
          icono={<Paintbrush className="h-3.5 w-3.5" />}
          tono="emerald"
          label="Avance"
          valor={calc.viviendas > 0 ? fmtPct(calc.avance) : "—"}
          sufijo={calc.viviendas > 0 ? `${fmt(calc.pintadas)} de ${fmt(calc.viviendas)} ${unidad}` : `Sin ${unidad} cargadas`}
          pie={<div className="mt-2"><BadgeEstado estado={calc.estado} /></div>}
        />
        <Indicador
          icono={<Package className="h-3.5 w-3.5" />}
          tono="sky"
          label="Pedido / entregado"
          valor={`${fmtDec(calc.pedidas)} / ${fmtDec(calc.entregadas)}`}
          sufijo={`de ${fmtDec(calc.proyectadas)} proyectadas`}
        />
        <Indicador
          icono={<ShoppingCart className="h-3.5 w-3.5" />}
          tono="amber"
          label="Falta por pedir"
          valor={fmtDec(calc.faltantePorPedir)}
          sufijo={`${fmtDec(calc.saldo)} en bodega de obra`}
        />
        <Indicador
          icono={<Layers className="h-3.5 w-3.5" />}
          tono="slate"
          label="Rendimiento real"
          valor={calc.rendimientoReal > 0 ? `${fmtDec(calc.rendimientoReal)}/${esEdificio ? "depto" : "viv"}` : "—"}
          sufijo={
            calc.consumoTeorico > 0
              ? `${fmtDesviacion(calc.desviacion)} vs lo declarado`
              : "Falta rendimiento declarado"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---------- Lo que se sabe de la obra ---------- */}
        <div className="space-y-5">
          <Seccion icono={<Building2 className="h-3.5 w-3.5" />} titulo="Ficha de la obra">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato label="Constructora" valor={obra.clienteNombre} icono={<Building2 className="h-3 w-3" />} />
              <Dato label="Ciudad" valor={obra.ciudad} icono={<MapPin className="h-3 w-3" />} />
              <Dato label="Dirección" valor={obra.direccion} className="col-span-2" />
              <Dato label="Programa" valor={obra.programa} />
              <Dato label="Temporada" valor={obra.temporada} />
              <Dato label="Etapa constructiva" valor={obra.etapa} icono={<Layers className="h-3 w-3" />} />
              <Dato
                label="Tipo de obra"
                valor={esEdificio ? `Edificios${obra.torres ? ` · ${fmt(obra.torres)} torres` : ""}` : "Casas"}
                icono={<Home className="h-3 w-3" />}
              />
              <Dato label="Estado del registro" valor={obra.estado} />
              <Dato label={esEdificio ? "Total departamentos" : "Total viviendas"} valor={fmt(calc.viviendas)} />
              <Dato
                label="Inicio"
                valor={fmtFechaCorta(obra.fechaInicio)}
                icono={<CalendarDays className="h-3 w-3" />}
              />
              <Dato
                label="Fin estimado"
                valor={fmtFechaCorta(obra.fechaEstimadaFin)}
                icono={<CalendarDays className="h-3 w-3" />}
              />
              {obra.descripcion && <Dato label="Descripción" valor={obra.descripcion} className="col-span-2" />}
            </div>

            {obra.tiposVivienda?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {esEdificio ? "Tipos de departamento" : "Modelos de vivienda"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {obra.tiposVivienda.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                    >
                      {t.nombre}
                      <span className="tabular-nums text-slate-400">{fmt(t.cantidad)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Seccion>

          <Seccion
            icono={<Package className="h-3.5 w-3.5" />}
            titulo="Productos"
            descripcion={
              calculados.length === 0
                ? "Todavía no se le cargó ninguno"
                : `${calculados.length} ${calculados.length === 1 ? "producto" : "productos"} en control`
            }
          >
            {calculados.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                El control se lleva por producto. Cargálos desde la pestaña Obras para ver acá su proyectado, sus
                pedidos y su consumo.
              </p>
            ) : (
              <div className="space-y-2.5">
                {calculados.map((p) => (
                  <div
                    key={p.producto.id}
                    className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60 px-3 py-2.5"
                    data-testid={`producto-seguimiento-${p.producto.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                          {p.producto.nombre}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {[p.producto.color, p.producto.unidad, p.producto.kopr].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {p.sugerido > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                          <ShoppingCart className="h-2.5 w-2.5" />
                          pedir {fmtDec(p.sugerido)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <Mini label="Proyectado" valor={fmtDec(p.proyectada)} />
                      <Mini label="Pedido" valor={fmtDec(p.pedida)} />
                      <Mini label="Entregado" valor={fmtDec(p.entregada)} />
                      <Mini label="Usado" valor={fmtDec(p.utilizada)} />
                      <Mini label="Saldo" valor={fmtDec(p.saldo)} alerta={p.saldo < 0} />
                      <Mini label={esEdificio ? "Deptos pintados" : "Viviendas pintadas"} valor={fmt(p.pintadas)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Seccion>
        </div>

        {/* ---------- La bitácora ---------- */}
        <Seccion
          icono={<MessageSquare className="h-3.5 w-3.5" />}
          titulo="Bitácora de la obra"
          descripcion="Visitas, avances, pedidos comprometidos y problemas"
        >
          <BitacoraObra obraId={obra.id} obraNombre={obra.nombre} />
        </Seccion>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas de UI
// ---------------------------------------------------------------------------

const TONOS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
};

function Indicador({
  icono,
  tono,
  label,
  valor,
  sufijo,
  pie,
}: {
  icono: React.ReactNode;
  tono: string;
  label: string;
  valor: string;
  sufijo?: string;
  pie?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 px-3.5 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${TONOS[tono] ?? TONOS.slate}`}>
          {icono}
        </span>
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{valor}</div>
      {sufijo && <div className="text-[11px] font-semibold text-slate-400 leading-tight">{sufijo}</div>}
      {pie}
    </div>
  );
}

function BannerDato({ label, valor, sufijo }: { label: string; valor: string; sufijo?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9px] uppercase tracking-wider font-bold text-white/70">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums">{valor}</span>
        {sufijo && <span className="text-[10px] font-semibold text-white/70">{sufijo}</span>}
      </div>
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  descripcion,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
          {icono}
        </span>
        <div className="leading-tight min-w-0">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</div>
          {descripcion && <div className="text-[11px] text-slate-400 truncate">{descripcion}</div>}
        </div>
      </div>
      <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4">
        {children}
      </div>
    </section>
  );
}

function Dato({
  label,
  valor,
  icono,
  className = "",
}: {
  label: string;
  valor: string | null | undefined;
  icono?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200 break-words">
        {icono && <span className="text-slate-300 dark:text-slate-600 flex-shrink-0">{icono}</span>}
        {valor ? valor : <span className="text-slate-300 dark:text-slate-600">—</span>}
      </div>
    </div>
  );
}

function Mini({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold tabular-nums ${alerta ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>
        {valor}
      </span>
    </span>
  );
}

/** Las fechas de la obra son días sueltos (no llevan hora). */
const fmtFechaCorta = (valor: string | Date | null | undefined) => {
  if (!valor) return null;
  const texto = String(valor);
  // Vienen como 'YYYY-MM-DD' desde Postgres: parsear con new Date() las correría
  // un día por zona horaria.
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const d = new Date(texto);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("es-CL");
};

export default SeguimientoObrasContent;
