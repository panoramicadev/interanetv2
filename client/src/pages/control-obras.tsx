/**
 * Control de Obras — pestaña "Obras" del Panel de Trabajo (área Construcción).
 *
 * Reemplaza la planilla Excel de temporada que llevaba Construcción por
 * constructora ("Planilla Control <cliente> Temporada 2026-2027").
 *
 * La pantalla tiene DOS niveles:
 *  1. Cartera — todas las constructoras con obras, una tarjeta cada una con su
 *     avance y su próximo pedido. Es la portada: de acá se entra a una y se
 *     agregan nuevas (el buscador contra la base de clientes).
 *  2. Detalle — la planilla de esa constructora: resumen arriba y una fila por
 *     obra. Cada fila se despliega para ver el detalle POR PRODUCTO del despacho.
 *
 * Lo ÚNICO que se elige desde el sistema es el cliente y los productos (ambos
 * contra sus maestros); el resto se ingresa a mano. Todo lo derivado (% avance,
 * saldo, faltante, próximo pedido, estado) se calcula acá en el cliente; en la
 * base solo viven los datos ingresados (ver `obras` y `obra_productos` en
 * shared/schema.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Obra, ObraConCliente, ObraProducto } from "@shared/schema";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HardHat,
  Home,
  Layers,
  Loader2,
  Package,
  Paintbrush,
  Pencil,
  Plus,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tipos y helpers
// ---------------------------------------------------------------------------

interface ClienteBusqueda {
  id: string;
  nokoen: string;
  koen?: string;
  comuna?: string;
}

interface ProductoCatalogo {
  kopr: string;
  name: string;
  ud02pr?: string | null;
}

type EstadoObra = "critico" | "pedir" | "ok" | "terminado" | "revisar";

// Orden fijo del resumen por estado (mismo orden que traía la planilla).
const ESTADOS: Array<{
  key: EstadoObra;
  label: string;
  badge: string;
  dot: string;
}> = [
  { key: "critico", label: "Crítico", badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500" },
  { key: "pedir", label: "Pedir", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "ok", label: "OK", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "terminado", label: "Terminado", badge: "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200", dot: "bg-slate-400" },
  { key: "revisar", label: "Revisar saldo", badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
];

const ESTADO_MAP = Object.fromEntries(ESTADOS.map((e) => [e.key, e])) as Record<EstadoObra, (typeof ESTADOS)[number]>;

// Unidades de despacho que se usan en obra. La tineta (5 gl) es la unidad de la
// planilla; el resto aparece cuando la obra lleva sellador, esmalte, diluyente…
const UNIDADES = ["tineta", "galón", "litro", "kilo", "unidad"];

const nf = new Intl.NumberFormat("es-CL");
const nfDec = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (n: number) => nf.format(Math.round(n));
// Las tinetas utilizadas/saldo van con un decimal, igual que en la planilla.
const fmtDec = (n: number) => nfDec.format(n);
const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

const toInt = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").replace(/\./g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const toNum = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// El buscador de la cartera ignora tildes: "concepcion" encuentra "CONCEPCIÓN".
const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface ObraCalculada {
  obra: ObraConCliente;
  viviendas: number;
  proyectadas: number;
  pintadas: number;
  pendientes: number;
  pedidas: number;
  entregadas: number;
  ratio: number;
  avance: number;
  usadasTeorico: number;
  usadasReal: number;
  teoricoVsReal: number;
  usadasControl: number;
  saldo: number;
  faltantePorPedir: number;
  sugerido: number;
  estado: EstadoObra;
}

/**
 * Derivadas de una obra — mismas fórmulas que la hoja "Control General" de la
 * planilla:
 *  - viviendas pendientes  = viviendas − pintadas
 *  - tinetas usadas teórico = pintadas × tinetas por vivienda
 *  - teórico vs real        = teórico − real (negativo = se gastó de más)
 *  - tinetas usadas control = el real informado por la obra; si aún no hay
 *                             dato real, se usa el teórico
 *  - saldo tineta en obra   = entregadas − usadas control
 *  - faltante por pedir     = proyectadas − pedidas
 *  - próximo pedido         = proyectadas − pedidas − saldo disponible
 *  - estado = Terminado si está todo pintado; Revisar saldo si se consumió más
 *             de lo entregado; Crítico si no queda nada en obra y falta pintar;
 *             Pedir si el saldo cubre menos del 20% de lo que falta.
 */
function calcularObra(obra: ObraConCliente): ObraCalculada {
  const viviendas = toInt(obra.viviendas);
  const proyectadas = toInt(obra.tinetasProyectadas);
  const pintadas = toInt(obra.viviendasPintadas);
  const pedidas = toInt(obra.tinetasPedidas);
  const entregadas = toInt(obra.tinetasEntregadas);
  const usadasReal = toNum(obra.tinetasUtilizadasReal);

  // "Tinetas x Viv" es un dato de entrada de la planilla, no una división: las
  // proyectadas van redondeadas hacia arriba, así que derivarlo de
  // proyectadas/viviendas desviaría el teórico (1,502 en vez de 1,5).
  const ratio = toNum(obra.tinetasPorVivienda) || (viviendas > 0 ? proyectadas / viviendas : 1.5);

  const avance = viviendas > 0 ? Math.min(1, pintadas / viviendas) : 0;
  const pendientes = Math.max(0, viviendas - pintadas);
  const usadasTeorico = pintadas * ratio;
  const teoricoVsReal = usadasTeorico - usadasReal;
  // Mientras la obra no informe consumo real, el control se hace con el teórico.
  const usadasControl = usadasReal > 0 ? usadasReal : usadasTeorico;
  const saldo = entregadas - usadasControl;
  const faltantePorPedir = Math.max(0, proyectadas - pedidas);
  const sugerido = Math.max(0, proyectadas - pedidas - Math.max(0, saldo));
  const cobertura = ratio > 0 ? Math.max(0, saldo) / ratio : 0; // viviendas que alcanza el saldo

  let estado: EstadoObra;
  if (viviendas > 0 && pintadas >= viviendas) estado = "terminado";
  else if (saldo < 0) estado = "revisar";
  else if (viviendas === 0) estado = "ok";
  else if (saldo <= 0) estado = "critico";
  else if (cobertura < pendientes * 0.2) estado = "pedir";
  else estado = "ok";

  return {
    obra, viviendas, proyectadas, pintadas, pendientes, pedidas, entregadas, ratio, avance,
    usadasTeorico, usadasReal, teoricoVsReal, usadasControl, saldo, faltantePorPedir, sugerido, estado,
  };
}

/** Suma de un conjunto de obras — sirve igual para la tarjeta de una
 *  constructora en la cartera que para el resumen del detalle. */
function calcularTotales(filas: ObraCalculada[]) {
  const t = filas.reduce(
    (acc, f) => {
      acc.viviendas += f.viviendas;
      acc.proyectadas += f.proyectadas;
      acc.pintadas += f.pintadas;
      acc.pendientes += f.pendientes;
      acc.usadasTeorico += f.usadasTeorico;
      acc.usadasReal += f.usadasReal;
      acc.usadasControl += f.usadasControl;
      acc.pedidas += f.pedidas;
      acc.entregadas += f.entregadas;
      acc.saldo += f.saldo;
      acc.faltante += f.faltantePorPedir;
      acc.sugerido += f.sugerido;
      return acc;
    },
    {
      viviendas: 0, proyectadas: 0, pintadas: 0, pendientes: 0, usadasTeorico: 0, usadasReal: 0,
      usadasControl: 0, pedidas: 0, entregadas: 0, saldo: 0, faltante: 0, sugerido: 0,
    },
  );
  const conteoEstados = ESTADOS.map((e) => ({
    ...e,
    cantidad: filas.filter((f) => f.estado === e.key).length,
  }));
  const ultima = filas.reduce<Date | null>((max, f) => {
    const d = f.obra.updatedAt ? new Date(f.obra.updatedAt as any) : null;
    return d && (!max || d > max) ? d : max;
  }, null);
  return {
    ...t,
    avance: t.viviendas > 0 ? t.pintadas / t.viviendas : 0,
    teoricoVsReal: t.usadasTeorico - t.usadasReal,
    conteoEstados,
    ultima,
  };
}

type Totales = ReturnType<typeof calcularTotales>;

interface Constructora {
  id: string;
  nombre: string;
  comuna: string | null;
  filas: ObraCalculada[];
  totales: Totales;
  ciudades: string[];
}

/** Agrupa todas las obras por constructora — es la cartera de la portada. */
function armarCartera(obras: ObraConCliente[]): Constructora[] {
  const porCliente = new Map<string, ObraConCliente[]>();
  for (const o of obras) {
    const lista = porCliente.get(o.clienteId);
    if (lista) lista.push(o);
    else porCliente.set(o.clienteId, [o]);
  }

  return Array.from(porCliente.entries())
    .map(([id, lista]) => {
      const filas = lista
        .slice()
        .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())
        .map(calcularObra);
      return {
        id,
        // El nombre viene del join contra clients; si el cliente se borró del
        // maestro dejamos el id a la vista en vez de una tarjeta sin título.
        nombre: lista[0].clienteNombre || `Cliente ${id.slice(0, 8)}`,
        comuna: lista[0].clienteComuna ?? null,
        filas,
        totales: calcularTotales(filas),
        ciudades: Array.from(new Set(lista.map((o) => o.ciudad).filter(Boolean) as string[])),
      };
    })
    // Primero las que tienen algo que pedir (que es para lo que se abre la
    // pantalla), y dentro de eso alfabético.
    .sort((a, b) => b.totales.sugerido - a.totales.sugerido || a.nombre.localeCompare(b.nombre));
}

const emptyForm = {
  ciudad: "",
  nombre: "",
  programa: "",
  temporada: "",
  direccion: "",
  descripcion: "",
  estado: "activa",
  viviendas: "",
  tinetasPorVivienda: "1.5",
  tinetasProyectadas: "",
  viviendasPintadas: "",
  tinetasUtilizadasReal: "",
  tinetasPedidas: "",
  tinetasEntregadas: "",
  fechaInicio: "",
  fechaEstimadaFin: "",
};

type ObraForm = typeof emptyForm;

const emptyProductoForm = {
  kopr: "",
  nombre: "",
  color: "",
  unidad: "tineta",
  cantidadProyectada: "",
  cantidadPedida: "",
  cantidadEntregada: "",
  cantidadUtilizada: "",
  notas: "",
};

type ProductoForm = typeof emptyProductoForm;

// ---------------------------------------------------------------------------
// Columnas de la tabla de obras
// ---------------------------------------------------------------------------
// La planilla trae 18 columnas: mostrarlas todas de entrada obliga a leer con
// scroll lateral. Por defecto se ven las de decisión (avance, saldo, próximo
// pedido) y con el toggle aparece la planilla completa. La definición es una
// sola para que fila y totales nunca se desalineen.

interface ColumnaDef {
  key: string;
  label: string;
  title?: string;
  soloCompleta?: boolean;
  thClassName?: string;
  render: (f: ObraCalculada) => React.ReactNode;
  total?: (t: Totales) => React.ReactNode;
}

const COLUMNAS: ColumnaDef[] = [
  {
    key: "programa",
    label: "Programa",
    soloCompleta: true,
    render: (f) =>
      f.obra.programa ? (
        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {f.obra.programa}
        </span>
      ) : (
        <span className="text-slate-300">—</span>
      ),
  },
  {
    key: "ciudad",
    label: "Ciudad",
    render: (f) => <span className="font-medium text-slate-700 dark:text-slate-200">{f.obra.ciudad || "—"}</span>,
  },
  { key: "viv", label: "VIV", title: "Viviendas del proyecto", render: (f) => fmt(f.viviendas), total: (t) => fmt(t.viviendas) },
  { key: "ratio", label: "Tinetas x Viv", title: "Tinetas por vivienda", soloCompleta: true, render: (f) => fmtDec(f.ratio) },
  { key: "proyectadas", label: "Proyectadas", title: "Total tinetas proyectadas", render: (f) => fmt(f.proyectadas), total: (t) => fmt(t.proyectadas) },
  { key: "pintadas", label: "Pintadas", title: "Viviendas pintadas", render: (f) => fmt(f.pintadas), total: (t) => fmt(t.pintadas) },
  { key: "pendientes", label: "Pendientes", title: "Viviendas pendientes de pintar", soloCompleta: true, render: (f) => fmt(f.pendientes), total: (t) => fmt(t.pendientes) },
  {
    key: "avance",
    label: "% avance",
    thClassName: "min-w-[120px]",
    render: (f) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden min-w-[52px]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-[#fd6301]"
            style={{ width: `${Math.round(f.avance * 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-300 w-9 text-right">
          {fmtPct(f.avance)}
        </span>
      </div>
    ),
    total: (t) => fmtPct(t.avance),
  },
  { key: "teorico", label: "Usadas teórico", title: "Tinetas utilizadas teórico = pintadas × tinetas por vivienda", soloCompleta: true, render: (f) => fmtDec(f.usadasTeorico), total: (t) => fmtDec(t.usadasTeorico) },
  { key: "real", label: "Usadas real", title: "Tinetas utilizadas real informadas por la obra", soloCompleta: true, render: (f) => fmtDec(f.usadasReal), total: (t) => fmtDec(t.usadasReal) },
  {
    key: "teoricoVsReal",
    label: "Teórico vs real",
    title: "Teórico − real (negativo = se gastó de más)",
    soloCompleta: true,
    render: (f) => (
      <span className={f.teoricoVsReal < 0 ? "text-red-600 dark:text-red-400 font-semibold" : ""}>{fmtDec(f.teoricoVsReal)}</span>
    ),
    total: (t) => fmtDec(t.teoricoVsReal),
  },
  { key: "control", label: "Usadas control", title: "Consumo con el que se controla el saldo", soloCompleta: true, render: (f) => fmtDec(f.usadasControl), total: (t) => fmtDec(t.usadasControl) },
  { key: "pedidas", label: "Pedidas", title: "Tinetas pedidas", render: (f) => fmt(f.pedidas), total: (t) => fmt(t.pedidas) },
  { key: "entregadas", label: "Entregadas", title: "Tinetas entregadas", render: (f) => fmt(f.entregadas), total: (t) => fmt(t.entregadas) },
  {
    key: "saldo",
    label: "Saldo obra",
    title: "Saldo de tinetas en obra",
    render: (f) => <span className={f.saldo < 0 ? "text-red-600 dark:text-red-400 font-bold" : ""}>{fmtDec(f.saldo)}</span>,
    total: (t) => fmtDec(t.saldo),
  },
  {
    key: "sugerido",
    label: "Próx. pedido",
    title: "Próximo pedido sugerido",
    render: (f) => <span className="font-bold text-slate-700 dark:text-slate-100">{fmt(f.sugerido)}</span>,
    total: (t) => fmt(t.sugerido),
  },
  {
    key: "estado",
    label: "Estado",
    render: (f) => {
      const est = ESTADO_MAP[f.estado];
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${est.badge}`}>
          {f.estado === "terminado" ? <CheckCircle2 className="h-3 w-3" /> : <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />}
          {est.label}
        </span>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ControlObrasContent() {
  const { toast } = useToast();

  // Constructora abierta. null = portada (cartera).
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [filtroCartera, setFiltroCartera] = useState("");
  const [dialogAgregarCliente, setDialogAgregarCliente] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [temporadaFiltro, setTemporadaFiltro] = useState("todas");
  const [planillaCompleta, setPlanillaCompleta] = useState(false);
  const [obraExpandida, setObraExpandida] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [obraEditando, setObraEditando] = useState<Obra | null>(null);
  const [obraAEliminar, setObraAEliminar] = useState<Obra | null>(null);
  const [form, setForm] = useState<ObraForm>(emptyForm);
  // Si el usuario escribe las proyectadas a mano dejamos de auto-calcularlas.
  const proyectadasTocadas = useRef(false);

  // Productos: la obra sobre la que se está agregando/editando un producto.
  const [productoObraId, setProductoObraId] = useState<string | null>(null);
  const [productoEditando, setProductoEditando] = useState<ObraProducto | null>(null);
  const [productoForm, setProductoForm] = useState<ProductoForm>(emptyProductoForm);
  const [productoAEliminar, setProductoAEliminar] = useState<ObraProducto | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [mostrarSugerenciasProducto, setMostrarSugerenciasProducto] = useState(false);

  // --- Todas las obras: alimenta la cartera y el detalle con un solo fetch ---
  const { data: todasLasObras = [], isLoading: cargandoObras } = useQuery<ObraConCliente[]>({
    queryKey: ["/api/obras"],
    queryFn: async () => {
      const res = await apiRequest("/api/obras");
      return res.json();
    },
  });

  // --- Buscador de clientes (para sumar una constructora a la cartera) ---
  const { data: clientes = [], isFetching: buscandoClientes } = useQuery<ClienteBusqueda[]>({
    queryKey: ["/api/clients/search", "control-obras", busqueda],
    queryFn: async () => {
      if (busqueda.trim().length < 2) return [];
      const res = await apiRequest(`/api/clients/search?q=${encodeURIComponent(busqueda.trim())}`);
      return res.json();
    },
    enabled: busqueda.trim().length >= 2,
  });

  // --- Productos de todas las obras de la constructora abierta ---
  const { data: productos = [] } = useQuery<ObraProducto[]>({
    queryKey: ["/api/obra-productos", cliente?.id],
    queryFn: async () => {
      const res = await apiRequest(`/api/obra-productos?clienteId=${encodeURIComponent(cliente!.id)}`);
      return res.json();
    },
    enabled: !!cliente?.id,
  });

  // --- Catálogo de productos (buscador del diálogo) ---
  const { data: catalogo = [], isFetching: buscandoProductos } = useQuery<ProductoCatalogo[]>({
    queryKey: ["/api/products", "obra-producto", busquedaProducto],
    queryFn: async () => {
      const res = await apiRequest(`/api/products?search=${encodeURIComponent(busquedaProducto.trim())}&limit=15`);
      return res.json();
    },
    enabled: busquedaProducto.trim().length >= 2,
  });

  const guardar = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      const res = await apiRequest(id ? `/api/obras/${id}` : "/api/obras", {
        method: id ? "PUT" : "POST",
        data,
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras"] });
      setDialogAbierto(false);
      setObraEditando(null);
      toast({ title: vars.id ? "Obra actualizada" : "Obra creada" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo guardar la obra", description: error?.message, variant: "destructive" });
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obras/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      setObraAEliminar(null);
      toast({ title: "Obra eliminada" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo eliminar la obra", description: error?.message, variant: "destructive" });
    },
  });

  const guardarProducto = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, unknown> }) => {
      const res = await apiRequest(id ? `/api/obra-productos/${id}` : "/api/obra-productos", {
        method: id ? "PUT" : "POST",
        data,
      });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      cerrarDialogProducto();
      toast({ title: vars.id ? "Producto actualizado" : "Producto agregado a la obra" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo guardar el producto", description: error?.message, variant: "destructive" });
    },
  });

  const eliminarProducto = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obra-productos/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      setProductoAEliminar(null);
      toast({ title: "Producto quitado de la obra" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo quitar el producto", description: error?.message, variant: "destructive" });
    },
  });

  // --- Derivados ---
  const cartera = useMemo(() => armarCartera(todasLasObras), [todasLasObras]);

  const carteraFiltrada = useMemo(() => {
    const q = normalizar(filtroCartera.trim());
    if (!q) return cartera;
    return cartera.filter(
      (c) =>
        normalizar(c.nombre).includes(q) ||
        c.ciudades.some((ciudad) => normalizar(ciudad).includes(q)) ||
        c.filas.some((f) => normalizar(f.obra.nombre).includes(q)),
    );
  }, [cartera, filtroCartera]);

  const totalesCartera = useMemo(
    () => calcularTotales(cartera.flatMap((c) => c.filas)),
    [cartera],
  );

  const obras = useMemo(
    () => todasLasObras.filter((o) => o.clienteId === cliente?.id),
    [todasLasObras, cliente?.id],
  );

  // Temporadas presentes en las obras del cliente (para el filtro del header).
  const temporadas = useMemo(
    () => Array.from(new Set(obras.map((o) => o.temporada).filter(Boolean) as string[])).sort().reverse(),
    [obras],
  );

  useEffect(() => {
    setTemporadaFiltro("todas");
    setObraExpandida(null);
  }, [cliente?.id]);

  // Orden de la planilla: por ID (orden de carga), no alfabético.
  const filas = useMemo(() => {
    const visibles = temporadaFiltro === "todas" ? obras : obras.filter((o) => o.temporada === temporadaFiltro);
    return visibles
      .slice()
      .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())
      .map(calcularObra);
  }, [obras, temporadaFiltro]);

  const totales = useMemo(() => calcularTotales(filas), [filas]);

  // Productos agrupados por obra, para el panel desplegable de cada fila.
  const productosPorObra = useMemo(() => {
    const mapa = new Map<string, ObraProducto[]>();
    for (const p of productos) {
      const lista = mapa.get(p.obraId);
      if (lista) lista.push(p);
      else mapa.set(p.obraId, [p]);
    }
    return mapa;
  }, [productos]);

  const columnasVisibles = useMemo(
    () => COLUMNAS.filter((c) => planillaCompleta || !c.soloCompleta),
    [planillaCompleta],
  );

  // --- Formulario de obra ---
  const abrirNueva = () => {
    proyectadasTocadas.current = false;
    setObraEditando(null);
    setForm({
      ...emptyForm,
      temporada: temporadaFiltro !== "todas" ? temporadaFiltro : temporadas[0] ?? "",
    });
    setDialogAbierto(true);
  };

  const abrirEdicion = (obra: Obra) => {
    proyectadasTocadas.current = true;
    setObraEditando(obra);
    setForm({
      ciudad: obra.ciudad ?? "",
      nombre: obra.nombre ?? "",
      programa: obra.programa ?? "",
      temporada: obra.temporada ?? "",
      direccion: obra.direccion ?? "",
      descripcion: obra.descripcion ?? "",
      estado: obra.estado ?? "activa",
      viviendas: String(obra.viviendas ?? 0),
      tinetasPorVivienda: String(obra.tinetasPorVivienda ?? "1.5"),
      tinetasProyectadas: String(obra.tinetasProyectadas ?? 0),
      viviendasPintadas: String(obra.viviendasPintadas ?? 0),
      tinetasUtilizadasReal: String(obra.tinetasUtilizadasReal ?? 0),
      tinetasPedidas: String(obra.tinetasPedidas ?? 0),
      tinetasEntregadas: String(obra.tinetasEntregadas ?? 0),
      fechaInicio: (obra.fechaInicio as any) ?? "",
      fechaEstimadaFin: (obra.fechaEstimadaFin as any) ?? "",
    });
    setDialogAbierto(true);
  };

  // Al tocar viviendas o el ratio, proponemos las tinetas proyectadas (redondeo
  // hacia arriba, igual que la planilla). Queda editable.
  const setCampo = (campo: keyof ObraForm, valor: string) => {
    setForm((prev) => {
      const next = { ...prev, [campo]: valor };
      if (campo === "tinetasProyectadas") {
        proyectadasTocadas.current = true;
      } else if ((campo === "viviendas" || campo === "tinetasPorVivienda") && !proyectadasTocadas.current) {
        const viviendas = toInt(campo === "viviendas" ? valor : prev.viviendas);
        const ratio = toNum(campo === "tinetasPorVivienda" ? valor : prev.tinetasPorVivienda);
        next.tinetasProyectadas = viviendas > 0 && ratio > 0 ? String(Math.ceil(viviendas * ratio)) : "";
      }
      return next;
    });
  };

  const enviar = () => {
    if (!cliente) return;
    const ciudad = form.ciudad.trim();
    const nombre = form.nombre.trim() || ciudad;
    if (!nombre) {
      toast({ title: "Falta el proyecto o la ciudad de la obra", variant: "destructive" });
      return;
    }
    guardar.mutate({
      id: obraEditando?.id,
      data: {
        clienteId: cliente.id,
        nombre,
        ciudad: ciudad || null,
        programa: form.programa.trim() || null,
        temporada: form.temporada.trim() || null,
        direccion: form.direccion.trim() || null,
        descripcion: form.descripcion.trim() || null,
        estado: form.estado,
        viviendas: toInt(form.viviendas),
        tinetasPorVivienda: String(toNum(form.tinetasPorVivienda) || 1.5),
        tinetasProyectadas: toInt(form.tinetasProyectadas),
        viviendasPintadas: toInt(form.viviendasPintadas),
        tinetasUtilizadasReal: String(toNum(form.tinetasUtilizadasReal)),
        tinetasPedidas: toInt(form.tinetasPedidas),
        tinetasEntregadas: toInt(form.tinetasEntregadas),
        fechaInicio: form.fechaInicio || null,
        fechaEstimadaFin: form.fechaEstimadaFin || null,
      },
    });
  };

  const previewProyectadas = toInt(form.viviendas) > 0 && toNum(form.tinetasPorVivienda) > 0
    ? Math.ceil(toInt(form.viviendas) * toNum(form.tinetasPorVivienda))
    : 0;

  // --- Formulario de productos ---
  const abrirNuevoProducto = (obraId: string) => {
    setProductoObraId(obraId);
    setProductoEditando(null);
    setProductoForm(emptyProductoForm);
    setBusquedaProducto("");
  };

  const abrirEdicionProducto = (producto: ObraProducto) => {
    setProductoObraId(producto.obraId);
    setProductoEditando(producto);
    setProductoForm({
      kopr: producto.kopr ?? "",
      nombre: producto.nombre ?? "",
      color: producto.color ?? "",
      unidad: producto.unidad ?? "tineta",
      cantidadProyectada: String(producto.cantidadProyectada ?? 0),
      cantidadPedida: String(producto.cantidadPedida ?? 0),
      cantidadEntregada: String(producto.cantidadEntregada ?? 0),
      cantidadUtilizada: String(producto.cantidadUtilizada ?? 0),
      notas: producto.notas ?? "",
    });
    setBusquedaProducto("");
  };

  const cerrarDialogProducto = () => {
    setProductoObraId(null);
    setProductoEditando(null);
    setBusquedaProducto("");
    setMostrarSugerenciasProducto(false);
  };

  const enviarProducto = () => {
    if (!productoObraId) return;
    const nombre = productoForm.nombre.trim();
    if (!nombre) {
      toast({ title: "Elige un producto o escribe su nombre", variant: "destructive" });
      return;
    }
    guardarProducto.mutate({
      id: productoEditando?.id,
      data: {
        obraId: productoObraId,
        kopr: productoForm.kopr.trim() || null,
        nombre,
        color: productoForm.color.trim() || null,
        unidad: productoForm.unidad,
        cantidadProyectada: String(toNum(productoForm.cantidadProyectada)),
        cantidadPedida: String(toNum(productoForm.cantidadPedida)),
        cantidadEntregada: String(toNum(productoForm.cantidadEntregada)),
        cantidadUtilizada: String(toNum(productoForm.cantidadUtilizada)),
        notas: productoForm.notas.trim() || null,
      },
    });
  };

  const seleccionarConstructora = (c: Constructora) => {
    setCliente({ id: c.id, nokoen: c.nombre, comuna: c.comuna ?? undefined });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (cargandoObras) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===================== PORTADA: CARTERA ===================== */}
      {!cliente && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cartera de constructoras</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {cartera.length === 0
                  ? "Agrega la primera constructora para empezar a controlar sus obras"
                  : `${cartera.length} ${cartera.length === 1 ? "constructora" : "constructoras"} · ${totalesCartera.conteoEstados.reduce((a, e) => a + e.cantidad, 0)} obras en control`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {cartera.length > 0 && (
                <div className="relative flex-1 sm:min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                  <Input
                    value={filtroCartera}
                    onChange={(e) => setFiltroCartera(e.target.value)}
                    placeholder="Buscar constructora, obra o ciudad…"
                    className="pl-9 rounded-2xl bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60"
                    data-testid="input-obras-filtrar-cartera"
                  />
                </div>
              )}
              <Button
                onClick={() => {
                  setBusqueda("");
                  setDialogAgregarCliente(true);
                }}
                className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all flex-shrink-0"
                data-testid="button-agregar-constructora"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar constructora
              </Button>
            </div>
          </div>

          {cartera.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-16">
              <span className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                <HardHat className="h-8 w-8" />
              </span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Control de obras</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Agrega las constructoras con las que estás trabajando esta temporada. De cada una vas a ver el avance
                de sus obras, las tinetas pedidas y entregadas, el saldo en obra y el próximo pedido sugerido.
              </p>
              <Button
                onClick={() => {
                  setBusqueda("");
                  setDialogAgregarCliente(true);
                }}
                className="mt-5 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
                data-testid="button-agregar-constructora-vacio"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar constructora
              </Button>
            </div>
          )}

          {cartera.length > 0 && (
            <>
              {/* Resumen de toda la cartera */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <MiniStat icon={<Building2 className="h-3.5 w-3.5" />} tono="sky" label="Constructoras" valor={fmt(cartera.length)} />
                <MiniStat icon={<Home className="h-3.5 w-3.5" />} tono="slate" label="Viviendas en control" valor={fmt(totalesCartera.viviendas)} />
                <MiniStat icon={<Paintbrush className="h-3.5 w-3.5" />} tono="emerald" label="Avance global" valor={fmtPct(totalesCartera.avance)} />
                <MiniStat icon={<ShoppingCart className="h-3.5 w-3.5" />} tono="amber" label="Próximo pedido total" valor={fmt(totalesCartera.sugerido)} />
              </div>

              {carteraFiltrada.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-12 text-center text-sm text-slate-500">
                  Ninguna constructora coincide con «{filtroCartera}».
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {carteraFiltrada.map((c) => (
                    <TarjetaConstructora key={c.id} constructora={c} onAbrir={() => seleccionarConstructora(c)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ===================== DETALLE DE UNA CONSTRUCTORA ===================== */}
      {cliente && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                onClick={() => setCliente(null)}
                className="rounded-2xl self-start text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 flex-shrink-0"
                data-testid="button-volver-cartera"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cartera
              </Button>

              {/* Constructora abierta — el mismo control sirve para saltar a otra */}
              <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-3 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all min-w-0 flex-1 max-w-md">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex-shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex flex-col leading-none flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Constructora</span>
                  {cartera.length > 1 ? (
                    <Select
                      value={cliente.id}
                      onValueChange={(id) => {
                        const destino = cartera.find((c) => c.id === id);
                        if (destino) seleccionarConstructora(destino);
                      }}
                    >
                      <SelectTrigger
                        className="h-5 border-0 shadow-none p-0 gap-2 w-full bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                        data-testid="select-obras-constructora"
                      >
                        <span className="truncate" data-testid="text-obras-cliente">{cliente.nokoen}</span>
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {cartera.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="h-5 font-semibold text-sm text-slate-700 dark:text-slate-200 truncate" data-testid="text-obras-cliente">
                      {cliente.nokoen}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCliente(null)}
                  className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
                  aria-label="Volver a la cartera"
                  data-testid="button-obras-limpiar-cliente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Temporada — solo tiene sentido cuando el cliente ya tiene obras */}
              {temporadas.length > 0 && (
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl pl-2.5 pr-4 py-2.5 shadow-sm hover:border-orange-200 hover:shadow transition-all">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex-shrink-0">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Temporada</span>
                    <Select value={temporadaFiltro} onValueChange={setTemporadaFiltro}>
                      <SelectTrigger
                        className="h-5 border-0 shadow-none p-0 gap-2 w-auto bg-transparent font-semibold text-sm text-slate-700 dark:text-slate-200 focus:ring-0 focus:ring-offset-0 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:opacity-60"
                        data-testid="select-obras-temporada"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {temporadas.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {filas.length > 0 && (
                <Badge className="bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">
                  {filas.length} {filas.length === 1 ? "obra" : "obras"}
                </Badge>
              )}
              <Button
                onClick={abrirNueva}
                className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all"
                data-testid="button-nueva-obra"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva obra
              </Button>
            </div>
          </div>

          {filas.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-16">
              <span className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                <Plus className="h-8 w-8" />
              </span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {obras.length === 0 ? "Sin obras registradas" : "Sin obras en esta temporada"}
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Agrega la primera obra de {cliente.nokoen} con sus viviendas y tinetas proyectadas.
              </p>
              <Button
                onClick={abrirNueva}
                className="mt-5 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
                data-testid="button-nueva-obra-vacio"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva obra
              </Button>
            </div>
          )}

          {filas.length > 0 && (
            <>
              {/* Banner de la planilla */}
              <div className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white px-5 py-4 shadow-md shadow-orange-500/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                    <HardHat className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide truncate">
                      Control {cliente.nokoen}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/80">
                      {temporadaFiltro !== "todas" ? `Temporada ${temporadaFiltro} · ` : ""}
                      Avance, compra, entrega, saldo y próximo pedido sugerido
                    </p>
                  </div>
                </div>
                <div className="text-xs sm:text-right text-white/80 flex-shrink-0">
                  <div className="uppercase tracking-wider font-bold text-[10px] text-white/70">Última actualización</div>
                  <div className="font-semibold">
                    {totales.ultima ? totales.ultima.toLocaleDateString("es-CL") : "—"}
                  </div>
                </div>
              </div>

              {/* KPIs principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KpiCard icon={<Home className="h-4 w-4" />} tono="slate" label="Total viviendas" valor={fmt(totales.viviendas)} sufijo="VIV" />
                <KpiCard icon={<Package className="h-4 w-4" />} tono="sky" label="Tinetas proyectadas" valor={fmt(totales.proyectadas)} sufijo="tinetas" />
                <KpiCard
                  icon={<Paintbrush className="h-4 w-4" />}
                  tono="emerald"
                  label="Viviendas pintadas"
                  valor={fmt(totales.pintadas)}
                  sufijo={`de ${fmt(totales.viviendas)}`}
                  progreso={totales.avance}
                />
                {/* Próximo pedido — el número que la planilla usaba para gatillar la compra */}
                <div className="rounded-2xl border-0 bg-gradient-to-br from-orange-500 to-[#fd6301] text-white p-4 shadow-md shadow-orange-500/25">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-white/80">
                    <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4" />
                    </span>
                    Próximo pedido sugerido
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tabular-nums" data-testid="text-obras-sugerido">{fmt(totales.sugerido)}</span>
                    <span className="text-xs font-semibold text-white/80">tinetas</span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/75">
                    Faltan {fmt(totales.faltante)} por pedir del total proyectado
                  </div>
                </div>
              </div>

              {/* Segunda fila: compra / entrega / consumo / saldo + resumen por estado */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                <div className="xl:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <MiniStat icon={<ShoppingCart className="h-3.5 w-3.5" />} tono="sky" label="Tinetas pedidas" valor={fmt(totales.pedidas)} />
                  <MiniStat icon={<Truck className="h-3.5 w-3.5" />} tono="violet" label="Tinetas entregadas" valor={fmt(totales.entregadas)} />
                  <MiniStat
                    icon={<Paintbrush className="h-3.5 w-3.5" />}
                    tono="slate"
                    label="Tinetas usadas (control)"
                    valor={fmtDec(totales.usadasControl)}
                  />
                  <MiniStat
                    icon={<Scale className="h-3.5 w-3.5" />}
                    tono={totales.teoricoVsReal < 0 ? "red" : "emerald"}
                    label="Teórico vs real"
                    valor={fmtDec(totales.teoricoVsReal)}
                  />
                  <MiniStat
                    icon={<Package className="h-3.5 w-3.5" />}
                    tono={totales.saldo < 0 ? "red" : "emerald"}
                    label="Saldo en obra"
                    valor={fmtDec(totales.saldo)}
                  />
                  <MiniStat icon={<AlertTriangle className="h-3.5 w-3.5" />} tono="amber" label="Faltante por pedir" valor={fmt(totales.faltante)} />
                </div>

                {/* Resumen por estado */}
                <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-4 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">Obras por estado</div>
                  <div className="space-y-2">
                    {totales.conteoEstados.map((e) => {
                      const pct = filas.length > 0 ? e.cantidad / filas.length : 0;
                      return (
                        <div key={e.key} className="flex items-center gap-2.5" data-testid={`row-estado-${e.key}`}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e.dot}`} />
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 flex-1 min-w-0 truncate">{e.label}</span>
                          <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-100">{e.cantidad}</span>
                          <span className="text-[11px] tabular-nums text-slate-400 w-10 text-right">{fmtPct(pct)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tabla de obras */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/60">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Obras
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      Toca una fila para ver sus productos
                    </span>
                  </div>
                  <button
                    onClick={() => setPlanillaCompleta((v) => !v)}
                    className="text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors flex-shrink-0"
                    data-testid="button-toggle-planilla-completa"
                  >
                    {planillaCompleta ? "Ver resumen" : "Ver planilla completa"}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  {/* Columnas de la hoja "Control General" de la planilla. La
                      primera queda fija al hacer scroll lateral. */}
                  <table className={`w-full text-sm ${planillaCompleta ? "min-w-[1680px]" : "min-w-[980px]"}`}>
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60">
                        <Th className="text-left pl-4 sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 min-w-[250px]">
                          Proyecto
                        </Th>
                        {columnasVisibles.map((c) => (
                          <Th key={c.key} title={c.title} className={c.thClassName}>{c.label}</Th>
                        ))}
                        <Th className="pr-4"> </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f, i) => {
                        const productosObra = productosPorObra.get(f.obra.id) ?? [];
                        const expandida = obraExpandida === f.obra.id;
                        return (
                          <FilaObra
                            key={f.obra.id}
                            fila={f}
                            indice={i}
                            columnas={columnasVisibles}
                            productos={productosObra}
                            expandida={expandida}
                            onToggle={() => setObraExpandida(expandida ? null : f.obra.id)}
                            onEditar={() => abrirEdicion(f.obra)}
                            onEliminar={() => setObraAEliminar(f.obra)}
                            onAgregarProducto={() => abrirNuevoProducto(f.obra.id)}
                            onEditarProducto={abrirEdicionProducto}
                            onEliminarProducto={setProductoAEliminar}
                          />
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200/70 dark:border-slate-700/60 font-bold text-slate-700 dark:text-slate-100">
                        <td className="pl-4 py-3 text-left sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">Total</td>
                        {columnasVisibles.map((c) => (
                          <td key={c.key} className="px-3 py-3 text-center tabular-nums">
                            {c.total ? c.total(totales) : null}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 px-1">
                Usadas teórico = viviendas pintadas × tinetas por vivienda. Usadas control = el consumo real informado
                por la obra, o el teórico mientras no haya dato real. Saldo en obra = entregadas − usadas control.
                Próximo pedido sugerido = proyectadas − pedidas − saldo disponible. El detalle por producto de cada
                obra es un control aparte: no altera estos totales.
              </p>
            </>
          )}
        </>
      )}

      {/* ===================== DIÁLOGOS ===================== */}

      {/* Agregar constructora a la cartera */}
      <Dialog open={dialogAgregarCliente} onOpenChange={setDialogAgregarCliente}>
        <DialogContent className="sm:max-w-[520px] z-[70]" overlayClassName="z-[70]">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </span>
            Agregar constructora
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Busca la constructora en la base de clientes. Después le vas a cargar sus obras.
          </DialogDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o RUT de la constructora…"
              className="pl-9 rounded-2xl"
              data-testid="input-obras-buscar-cliente"
            />
            {buscandoClientes && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />}
          </div>
          <div className="max-h-72 overflow-y-auto -mx-1 px-1">
            {busqueda.trim().length < 2 && (
              <div className="py-6 text-center text-sm text-slate-400">Escribe al menos 2 letras</div>
            )}
            {busqueda.trim().length >= 2 && clientes.length === 0 && !buscandoClientes && (
              <div className="py-6 text-center text-sm text-slate-400">Sin resultados</div>
            )}
            {clientes.slice(0, 20).map((c) => {
              const yaEnCartera = cartera.some((x) => x.id === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setCliente(c);
                    setDialogAgregarCliente(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                  data-testid={`option-obras-cliente-${c.id}`}
                >
                  <Building2 className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                  <span className="truncate flex-1">{c.nokoen}</span>
                  {yaEnCartera && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 flex-shrink-0">En cartera</span>
                  )}
                  {!yaEnCartera && c.comuna && (
                    <span className="text-[11px] text-slate-400 truncate flex-shrink-0">{c.comuna}</span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alta/edición de obra */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent
          className="sm:max-w-[680px] max-h-[90vh] flex flex-col p-0 overflow-hidden z-[70]"
          overlayClassName="z-[70]"
        >
          <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {obraEditando ? "Editar obra" : "Nueva obra"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {cliente?.nokoen ?? ""}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto flex-1 px-6 py-5">
            {/* Identificación */}
            <Seccion icono={<Building2 className="w-3.5 h-3.5" />} titulo="Identificación">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Proyecto *" className="sm:col-span-2">
                  <Input
                    value={form.nombre}
                    onChange={(e) => setCampo("nombre", e.target.value)}
                    placeholder="Ej: COMITÉ BUEN VIVIR"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-nombre"
                  />
                </Campo>
                <Campo label="Ciudad">
                  <Input
                    value={form.ciudad}
                    onChange={(e) => setCampo("ciudad", e.target.value)}
                    placeholder="Ej: PUERTO MONTT"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-ciudad"
                  />
                </Campo>
                <Campo label="Programa">
                  <Input
                    value={form.programa}
                    onChange={(e) => setCampo("programa", e.target.value)}
                    placeholder="Ej: DS-49"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-programa"
                  />
                </Campo>
                <Campo label="Temporada">
                  <Input
                    value={form.temporada}
                    onChange={(e) => setCampo("temporada", e.target.value)}
                    placeholder="Ej: 2026-2027"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-temporada"
                  />
                </Campo>
                <Campo label="Estado de la obra">
                  <Select value={form.estado} onValueChange={(v) => setCampo("estado", v)}>
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200" data-testid="select-obra-estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      <SelectItem value="activa">Activa</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Dirección" className="sm:col-span-2">
                  <Input
                    value={form.direccion}
                    onChange={(e) => setCampo("direccion", e.target.value)}
                    placeholder="Opcional"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-direccion"
                  />
                </Campo>
              </div>
            </Seccion>

            {/* Proyección */}
            <Seccion icono={<Package className="w-3.5 h-3.5" />} titulo="Proyección">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo label="Viviendas">
                  <Input
                    type="number"
                    min={0}
                    value={form.viviendas}
                    onChange={(e) => setCampo("viviendas", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-viviendas"
                  />
                </Campo>
                <Campo label="Tinetas por vivienda">
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    value={form.tinetasPorVivienda}
                    onChange={(e) => setCampo("tinetasPorVivienda", e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-ratio"
                  />
                </Campo>
                <Campo label="Tinetas proyectadas">
                  <Input
                    type="number"
                    min={0}
                    value={form.tinetasProyectadas}
                    onChange={(e) => setCampo("tinetasProyectadas", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-proyectadas"
                  />
                </Campo>
              </div>
              {previewProyectadas > 0 && toInt(form.tinetasProyectadas) !== previewProyectadas && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tinetasProyectadas: String(previewProyectadas) }))}
                  className="mt-3 text-xs font-semibold text-orange-600 hover:text-[#e35400] transition-colors"
                  data-testid="button-obra-sugerir-proyectadas"
                >
                  Usar {fmt(previewProyectadas)} tinetas ({form.viviendas} viviendas × {form.tinetasPorVivienda})
                </button>
              )}
            </Seccion>

            {/* Avance y pedidos */}
            <Seccion icono={<Paintbrush className="w-3.5 h-3.5" />} titulo="Avance y pedidos">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo label="Viviendas pintadas">
                  <Input
                    type="number"
                    min={0}
                    value={form.viviendasPintadas}
                    onChange={(e) => setCampo("viviendasPintadas", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-pintadas"
                  />
                </Campo>
                {/* El teórico se calcula; acá va lo que la obra informa que gastó de verdad. */}
                <Campo label="Tinetas utilizadas (real)">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={form.tinetasUtilizadasReal}
                    onChange={(e) => setCampo("tinetasUtilizadasReal", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-usadas-real"
                  />
                </Campo>
                <Campo label="Tinetas pedidas">
                  <Input
                    type="number"
                    min={0}
                    value={form.tinetasPedidas}
                    onChange={(e) => setCampo("tinetasPedidas", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-pedidas"
                  />
                </Campo>
                <Campo label="Tinetas entregadas">
                  <Input
                    type="number"
                    min={0}
                    value={form.tinetasEntregadas}
                    onChange={(e) => setCampo("tinetasEntregadas", e.target.value)}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-entregadas"
                  />
                </Campo>
                <Campo label="Fecha de inicio">
                  <Input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setCampo("fechaInicio", e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-fecha-inicio"
                  />
                </Campo>
                <Campo label="Fecha estimada de término">
                  <Input
                    type="date"
                    value={form.fechaEstimadaFin}
                    onChange={(e) => setCampo("fechaEstimadaFin", e.target.value)}
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-fecha-fin"
                  />
                </Campo>
                <Campo label="Notas" className="sm:col-span-3">
                  <Textarea
                    value={form.descripcion}
                    onChange={(e) => setCampo("descripcion", e.target.value)}
                    rows={2}
                    placeholder="Observaciones de la obra"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-notas"
                  />
                </Campo>
              </div>
            </Seccion>
          </div>

          <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/60 flex justify-end gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={enviar}
              disabled={guardar.isPending}
              className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
              data-testid="button-guardar-obra"
            >
              {guardar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {obraEditando ? "Guardar cambios" : "Crear obra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alta/edición de producto de una obra */}
      <Dialog open={!!productoObraId} onOpenChange={(open) => !open && cerrarDialogProducto()}>
        <DialogContent
          className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-0 overflow-hidden z-[70]"
          overlayClassName="z-[70]"
        >
          <div className="px-6 py-5 border-b bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground">
                  {productoEditando ? "Editar producto" : "Agregar producto a la obra"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground truncate">
                  {obras.find((o) => o.id === productoObraId)?.nombre ?? ""}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto flex-1 px-6 py-5">
            <Seccion icono={<Package className="w-3.5 h-3.5" />} titulo="Producto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Buscador del catálogo. El nombre queda editable por si el
                    producto todavía no está en el maestro. */}
                <Campo label="Buscar en el catálogo" className="sm:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input
                      value={busquedaProducto}
                      onChange={(e) => {
                        setBusquedaProducto(e.target.value);
                        setMostrarSugerenciasProducto(true);
                      }}
                      onFocus={() => setMostrarSugerenciasProducto(true)}
                      onBlur={() => setTimeout(() => setMostrarSugerenciasProducto(false), 150)}
                      placeholder="Código o nombre del producto…"
                      className="pl-9 bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                      data-testid="input-obra-producto-buscar"
                    />
                    {buscandoProductos && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />
                    )}
                    {mostrarSugerenciasProducto && busquedaProducto.trim().length >= 2 && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                        {catalogo.length === 0 && !buscandoProductos && (
                          <div className="px-3 py-3 text-sm text-slate-400">Sin resultados — puedes escribir el nombre a mano abajo</div>
                        )}
                        {catalogo.map((p) => (
                          <button
                            key={p.kopr}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setProductoForm((prev) => ({
                                ...prev,
                                kopr: p.kopr,
                                nombre: p.name,
                                unidad: prev.unidad,
                              }));
                              setBusquedaProducto("");
                              setMostrarSugerenciasProducto(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors"
                            data-testid={`option-obra-producto-${p.kopr}`}
                          >
                            <span className="text-[10px] font-bold tabular-nums text-slate-400 flex-shrink-0">{p.kopr}</span>
                            <span className="truncate font-medium">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Campo>
                <Campo label="Producto *" className="sm:col-span-2">
                  <Input
                    value={productoForm.nombre}
                    onChange={(e) => setProductoForm((p) => ({ ...p, nombre: e.target.value }))}
                    placeholder="Nombre del producto"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-nombre"
                  />
                  {productoForm.kopr && (
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-bold">SKU {productoForm.kopr}</span>
                      <button
                        onClick={() => setProductoForm((p) => ({ ...p, kopr: "" }))}
                        className="hover:text-slate-600 transition-colors"
                      >
                        quitar
                      </button>
                    </div>
                  )}
                </Campo>
                <Campo label="Color / tono">
                  <Input
                    value={productoForm.color}
                    onChange={(e) => setProductoForm((p) => ({ ...p, color: e.target.value }))}
                    placeholder="Ej: BLANCO"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-color"
                  />
                </Campo>
                <Campo label="Unidad">
                  <Select
                    value={productoForm.unidad}
                    onValueChange={(v) => setProductoForm((p) => ({ ...p, unidad: v }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200" data-testid="select-obra-producto-unidad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      {UNIDADES.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
              </div>
            </Seccion>

            <Seccion icono={<Truck className="w-3.5 h-3.5" />} titulo="Seguimiento">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Campo label="Proyectado">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={productoForm.cantidadProyectada}
                    onChange={(e) => setProductoForm((p) => ({ ...p, cantidadProyectada: e.target.value }))}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-proyectada"
                  />
                </Campo>
                <Campo label="Pedido">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={productoForm.cantidadPedida}
                    onChange={(e) => setProductoForm((p) => ({ ...p, cantidadPedida: e.target.value }))}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-pedida"
                  />
                </Campo>
                <Campo label="Entregado">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={productoForm.cantidadEntregada}
                    onChange={(e) => setProductoForm((p) => ({ ...p, cantidadEntregada: e.target.value }))}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-entregada"
                  />
                </Campo>
                <Campo label="Utilizado">
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    value={productoForm.cantidadUtilizada}
                    onChange={(e) => setProductoForm((p) => ({ ...p, cantidadUtilizada: e.target.value }))}
                    placeholder="0"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-utilizada"
                  />
                </Campo>
                <Campo label="Notas" className="col-span-2 sm:col-span-4">
                  <Input
                    value={productoForm.notas}
                    onChange={(e) => setProductoForm((p) => ({ ...p, notas: e.target.value }))}
                    placeholder="Opcional"
                    className="bg-white dark:bg-slate-900 border-slate-200 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-producto-notas"
                  />
                </Campo>
              </div>
            </Seccion>
          </div>

          <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/60 flex justify-end gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={cerrarDialogProducto}>
              Cancelar
            </Button>
            <Button
              onClick={enviarProducto}
              disabled={guardarProducto.isPending}
              className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
              data-testid="button-guardar-obra-producto"
            >
              {guardarProducto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {productoEditando ? "Guardar cambios" : "Agregar producto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado de obra */}
      <Dialog open={!!obraAEliminar} onOpenChange={(open) => !open && setObraAEliminar(null)}>
        <DialogContent className="sm:max-w-[420px] z-[70]" overlayClassName="z-[70]">
          <DialogTitle className="text-base font-bold">Eliminar obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Se eliminará «{obraAEliminar?.ciudad || obraAEliminar?.nombre}», su control de avance y los productos
            cargados en ella. Esta acción no se puede deshacer.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setObraAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => obraAEliminar && eliminar.mutate(obraAEliminar.id)}
              disabled={eliminar.isPending}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirmar-eliminar-obra"
            >
              {eliminar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado de producto */}
      <Dialog open={!!productoAEliminar} onOpenChange={(open) => !open && setProductoAEliminar(null)}>
        <DialogContent className="sm:max-w-[420px] z-[70]" overlayClassName="z-[70]">
          <DialogTitle className="text-base font-bold">Quitar producto</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            «{productoAEliminar?.nombre}» dejará de seguirse en esta obra.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setProductoAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => productoAEliminar && eliminarProducto.mutate(productoAEliminar.id)}
              disabled={eliminarProducto.isPending}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirmar-eliminar-obra-producto"
            >
              {eliminarProducto.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Quitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas de UI
// ---------------------------------------------------------------------------

const TONOS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

/** Tarjeta de la portada: una constructora con su avance y lo que hay que pedir. */
function TarjetaConstructora({ constructora, onAbrir }: { constructora: Constructora; onAbrir: () => void }) {
  const { totales, filas } = constructora;
  // En la tarjeta solo interesan los estados que piden acción.
  const alertas = totales.conteoEstados.filter((e) => e.cantidad > 0 && (e.key === "critico" || e.key === "pedir" || e.key === "revisar"));

  return (
    <button
      onClick={onAbrir}
      className="text-left rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-4 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group"
      data-testid={`card-constructora-${constructora.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight line-clamp-2 group-hover:text-orange-600 transition-colors">
            {constructora.nombre}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400 truncate">
            {filas.length} {filas.length === 1 ? "obra" : "obras"}
            {constructora.ciudades.length > 0 && ` · ${constructora.ciudades.slice(0, 2).join(", ")}`}
            {constructora.ciudades.length > 2 && ` +${constructora.ciudades.length - 2}`}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-[#fd6301]"
            style={{ width: `${Math.round(totales.avance * 100)}%` }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{fmtPct(totales.avance)}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        {fmt(totales.pintadas)} de {fmt(totales.viviendas)} viviendas pintadas
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Saldo en obra</div>
          <div className={`text-base font-bold tabular-nums ${totales.saldo < 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-100"}`}>
            {fmtDec(totales.saldo)}
          </div>
        </div>
        <div className={`rounded-xl px-3 py-2 ${totales.sugerido > 0 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-slate-50 dark:bg-slate-800/60"}`}>
          <div className={`text-[10px] uppercase tracking-wider font-bold ${totales.sugerido > 0 ? "text-orange-500" : "text-slate-400"}`}>
            Próx. pedido
          </div>
          <div className={`text-base font-bold tabular-nums ${totales.sugerido > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-700 dark:text-slate-100"}`}>
            {fmt(totales.sugerido)}
          </div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {alertas.map((e) => (
            <span key={e.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
              {e.cantidad} {e.label}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** Fila de la tabla + su panel desplegable con el detalle por producto. */
function FilaObra({
  fila,
  indice,
  columnas,
  productos,
  expandida,
  onToggle,
  onEditar,
  onEliminar,
  onAgregarProducto,
  onEditarProducto,
  onEliminarProducto,
}: {
  fila: ObraCalculada;
  indice: number;
  columnas: ColumnaDef[];
  productos: ObraProducto[];
  expandida: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onEliminar: () => void;
  onAgregarProducto: () => void;
  onEditarProducto: (p: ObraProducto) => void;
  onEliminarProducto: (p: ObraProducto) => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-700/40 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group cursor-pointer ${expandida ? "bg-orange-50/40 dark:bg-orange-950/10" : ""}`}
        onClick={onToggle}
        data-testid={`row-obra-${fila.obra.id}`}
      >
        <td className={`pl-4 py-3 sticky left-0 z-10 group-hover:bg-orange-50/90 dark:group-hover:bg-slate-800 ${expandida ? "bg-orange-50/90 dark:bg-slate-800" : "bg-white dark:bg-slate-800/95"}`}>
          <div className="flex items-start gap-2">
            <span className="text-slate-300 dark:text-slate-600 pt-0.5 flex-shrink-0">
              {expandida ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-slate-300 dark:text-slate-600 pt-0.5 w-4 text-right flex-shrink-0">
              {indice + 1}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-slate-700 dark:text-slate-100 truncate max-w-[180px]">
                {fila.obra.nombre}
              </div>
              <div className="flex items-center gap-2">
                {fila.obra.estado !== "activa" && (
                  <span className="inline-flex text-[10px] uppercase tracking-wide font-bold text-slate-400">
                    {fila.obra.estado}
                  </span>
                )}
                {productos.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <Layers className="h-3 w-3" />
                    {productos.length} {productos.length === 1 ? "producto" : "productos"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        {columnas.map((c) => (
          <td key={c.key} className="px-3 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
            {c.render(fila)}
          </td>
        ))}
        <td className="pr-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              onClick={onEditar}
              aria-label="Editar obra"
              data-testid={`button-editar-obra-${fila.obra.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={onEliminar}
              aria-label="Eliminar obra"
              data-testid={`button-eliminar-obra-${fila.obra.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {expandida && (
        <tr className="border-b border-slate-100 dark:border-slate-700/40 bg-slate-50/60 dark:bg-slate-900/40">
          <td colSpan={columnas.length + 2} className="px-4 py-4">
            <PanelProductos
              obraNombre={fila.obra.nombre}
              productos={productos}
              onAgregar={onAgregarProducto}
              onEditar={onEditarProducto}
              onEliminar={onEliminarProducto}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/** Detalle por producto de una obra: proyectado / pedido / entregado / usado. */
function PanelProductos({
  obraNombre,
  productos,
  onAgregar,
  onEditar,
  onEliminar,
}: {
  obraNombre: string;
  productos: ObraProducto[];
  onAgregar: () => void;
  onEditar: (p: ObraProducto) => void;
  onEliminar: (p: ObraProducto) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Layers className="h-3.5 w-3.5 text-orange-500" />
          Productos de {obraNombre}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAgregar}
          className="h-8 rounded-xl text-xs border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950/30"
          data-testid="button-agregar-obra-producto"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Agregar producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          Sin productos cargados. Agrégalos para seguir el despacho por SKU (tinetas de fachada, sellador, esmalte…).
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/70 dark:border-slate-700/60">
              <Th className="text-left pl-4 min-w-[220px]">Producto</Th>
              <Th>Color</Th>
              <Th>Unidad</Th>
              <Th>Proyectado</Th>
              <Th>Pedido</Th>
              <Th title="Proyectado − pedido">Por pedir</Th>
              <Th>Entregado</Th>
              <Th>Utilizado</Th>
              <Th title="Entregado − utilizado">Saldo</Th>
              <Th className="pr-4"> </Th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const proyectada = toNum(p.cantidadProyectada);
              const pedida = toNum(p.cantidadPedida);
              const entregada = toNum(p.cantidadEntregada);
              const utilizada = toNum(p.cantidadUtilizada);
              const porPedir = Math.max(0, proyectada - pedida);
              const saldo = entregada - utilizada;
              return (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors group/prod"
                  data-testid={`row-obra-producto-${p.id}`}
                >
                  <td className="pl-4 py-2.5">
                    <div className="font-semibold text-slate-700 dark:text-slate-100 truncate max-w-[260px]">{p.nombre}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {p.kopr && <span className="font-bold tabular-nums">{p.kopr}</span>}
                      {p.notas && <span className="truncate max-w-[200px]">{p.notas}</span>}
                    </div>
                  </td>
                  <Td>{p.color || "—"}</Td>
                  <Td>{p.unidad}</Td>
                  <Td>{fmtDec(proyectada)}</Td>
                  <Td>{fmtDec(pedida)}</Td>
                  <Td className={porPedir > 0 ? "font-bold text-orange-600 dark:text-orange-400" : ""}>{fmtDec(porPedir)}</Td>
                  <Td>{fmtDec(entregada)}</Td>
                  <Td>{fmtDec(utilizada)}</Td>
                  <Td className={saldo < 0 ? "text-red-600 dark:text-red-400 font-bold" : ""}>{fmtDec(saldo)}</Td>
                  <td className="pr-4 py-2.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover/prod:opacity-100 focus-within:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                        onClick={() => onEditar(p)}
                        aria-label="Editar producto"
                        data-testid={`button-editar-obra-producto-${p.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => onEliminar(p)}
                        aria-label="Quitar producto"
                        data-testid={`button-eliminar-obra-producto-${p.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  tono,
  label,
  valor,
  sufijo,
  progreso,
}: {
  icon: React.ReactNode;
  tono: keyof typeof TONOS | string;
  label: string;
  valor: string;
  sufijo?: string;
  progreso?: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${TONOS[tono] ?? TONOS.slate}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{valor}</span>
        {sufijo && <span className="text-xs font-semibold text-slate-400">{sufijo}</span>}
      </div>
      {progreso !== undefined && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-[#fd6301]"
              style={{ width: `${Math.round(progreso * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-300">{fmtPct(progreso)}</span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon, tono, label, valor }: { icon: React.ReactNode; tono: string; label: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 px-3.5 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${TONOS[tono] ?? TONOS.slate}`}>{icon}</span>
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{valor}</div>
    </div>
  );
}

function Th({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <th
      title={title}
      className={`px-3 py-2.5 text-center text-[10px] uppercase tracking-wider font-bold text-slate-400 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300 ${className}`}>{children}</td>;
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
          {icono}
        </span>
        {titulo}
      </div>
      <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4">
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export default ControlObrasContent;
