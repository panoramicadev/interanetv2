/**
 * Control de Obras — pestaña "Obras" del Panel de Trabajo (área Construcción).
 *
 * Reemplaza la planilla Excel de temporada que llevaba Construcción por
 * constructora ("Planilla Control <cliente> Temporada 2026-2027").
 *
 * La pantalla tiene DOS niveles:
 *  1. Portada — listado de la cartera, en dos vistas: por constructora (una fila
 *     cada una con su avance y su próximo pedido) o todas las obras juntas,
 *     filtrables por estado, para cuando lo que se busca es una obra puntual.
 *     De acá se entra a una constructora y se agregan nuevas (el buscador contra
 *     la base de clientes).
 *  2. Detalle — la planilla de esa constructora: resumen arriba y una fila por
 *     obra.
 *
 * En los dos listados, cada obra se despliega y sus productos aparecen como
 * filas indentadas de la MISMA tabla (components/obras/panel-productos.tsx),
 * usando las mismas columnas que la obra (components/obras/columnas.tsx): así el
 * número de cada SKU queda justo debajo del total al que suma. Ahí se cargan los
 * productos y se lleva el día a día de pedidos, entregas y consumo.
 *
 * El control se lleva a nivel de PRODUCTO: cada SKU tiene su proyectado, su
 * rendimiento declarado y sus viviendas pintadas, y los números de la obra son
 * la suma de sus productos (ver components/obras/calculos.ts). La obra en sí
 * solo declara qué es y cuánto mide: casas o edificios, cuántas torres, el
 * total de viviendas y su desglose por modelo.
 *
 * El formulario de alta también deja elegir los productos, como atajo: entran
 * en la obra con todo en cero, igual que si se agregaran después desde el panel
 * (que es donde se les lleva el día a día). Es opcional — una obra se puede
 * crear sin productos y cargárselos más adelante.
 *
 * Lo ÚNICO que se elige desde el sistema es el cliente y los productos (ambos
 * contra sus maestros); el resto se ingresa a mano. Todo lo derivado (% avance,
 * saldo, faltante, próximo pedido, rendimiento, estado) se calcula acá en el
 * cliente; en la base solo viven los datos ingresados (ver `obras`,
 * `obra_tipos_vivienda` y `obra_productos` en shared/schema.ts).
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FilasProductos } from "@/components/obras/panel-productos";
import { BitacoraObra } from "@/components/obras/bitacora";
import { BuscadorCatalogo, unidadDeObra } from "@/components/obras/buscador-catalogo";
import { UNIDAD_POR_DEFECTO, etiquetaCortaUnidad } from "@/components/obras/unidades";
import { fmt, fmtDec, fmtPct, normalizar, toInt } from "@/components/obras/formato";
import {
  calcularObra,
  calcularProducto,
  calcularTotales,
  fmtDesviacion,
  type EstadoObra,
  type ObraCalculada,
  type Totales,
} from "@/components/obras/calculos";
import {
  CLAVES_CARTERA,
  COLUMNAS,
  columnaConstructora,
  prepararColumnas,
  type ColumnaDef,
} from "@/components/obras/columnas";
import { BORDE_GRUPO, Th } from "@/components/obras/celdas";
import { useAuth } from "@/hooks/useAuth";
import type { CatalogoObraItem, Obra, ObraConCliente, ObraEtapa, ObraProducto } from "@shared/schema";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
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

interface Constructora {
  id: string;
  nombre: string;
  comuna: string | null;
  filas: ObraCalculada[];
  totales: Totales;
  ciudades: string[];
}

/** Agrupa todas las obras por constructora — es la cartera de la portada. */
function armarCartera(obras: ObraConCliente[], productosPorObra: Map<string, ObraProducto[]>): Constructora[] {
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
        .map((o) => calcularObra(o, productosPorObra.get(o.id) ?? []));
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

// El alta de la obra quedó reducida a lo que la identifica y la dimensiona: el
// avance y los pedidos ya no se cargan acá, se llevan producto por producto en
// el panel de cada obra.
const emptyForm = {
  ciudad: "",
  nombre: "",
  programa: "",
  temporada: "",
  direccion: "",
  descripcion: "",
  estado: "activa",
  tipoObra: "casas",
  etapa: "",
  torres: "",
  viviendas: "",
  fechaInicio: "",
  fechaEstimadaFin: "",
};

type ObraForm = typeof emptyForm;

/** Una fila del desglose por modelo dentro del formulario. */
interface TipoViviendaForm {
  nombre: string;
  cantidad: string;
}

// Casi todo proyecto tiene al menos dos modelos (el estándar y el de
// discapacidad), así que el formulario parte con dos y desde ahí se agregan.
const TIPOS_INICIALES: TipoViviendaForm[] = [
  { nombre: "Tipo A", cantidad: "" },
  { nombre: "Tipo B", cantidad: "" },
];

/**
 * Un producto elegido en el formulario y todavía sin guardar.
 *
 * Elegir los productos acá es un atajo del alta: en la obra real se cargan igual
 * que siempre (con todo en cero) y el día a día —proyectado, pedidos, entregas y
 * consumo— se sigue llevando en el panel de la obra, no en este formulario.
 */
interface ProductoForm {
  kopr: string | null;
  nombre: string;
  color: string | null;
  unidad: string;
  /** Solo para la muestra de color de la lista; no se guarda. */
  hex: string | null;
}

/** Dos veces el mismo SKU es un error de tipeo; a mano se compara por nombre. */
const claveProducto = (p: { kopr: string | null; nombre: string }) =>
  p.kopr ? `sku:${p.kopr}` : `nom:${normalizar(p.nombre)}`;

// Clases compartidas de los campos del formulario de obra: un solo alto y un
// solo foco naranja para todos los inputs, selects y textareas.
const INPUT_FORM =
  "h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20";

/** Casas y edificios se controlan igual; solo cambia cómo se llaman las cosas. */
const VOCABULARIO = {
  casas: {
    total: "Total de viviendas",
    unidad: "viviendas",
    tipo: "Tipo de vivienda",
    ejemplo: "Ej: Alerce",
  },
  edificios: {
    total: "Total de departamentos",
    unidad: "departamentos",
    tipo: "Tipo de departamento",
    ejemplo: "Ej: 2 dormitorios",
  },
} as const;

const vocab = (tipoObra: string) => VOCABULARIO[tipoObra === "edificios" ? "edificios" : "casas"];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Lo que el Panel de Trabajo puede pedirle a esta pestaña desde afuera.
 * El botón (+) del header cambia según la pestaña activa, y en "Obras" tiene
 * que abrir el alta de obra, que vive acá adentro.
 */
export interface ControlObrasHandle {
  nuevaObra: () => void;
}

export const ControlObrasContent = forwardRef<ControlObrasHandle>(function ControlObrasContent(_props, ref) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Las etapas quedan disponibles para todas las obras, así que solo las suman
  // los roles que mandan en el área.
  const puedeAgregarEtapas = user?.role === "admin" || user?.role === "supervisor";

  // Constructora abierta. null = portada (cartera).
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [filtroCartera, setFiltroCartera] = useState("");
  // Portada: agrupada por constructora o el listado plano de todas las obras.
  const [vistaCartera, setVistaCartera] = useState<"constructoras" | "obras">("constructoras");
  const [filtroEstado, setFiltroEstado] = useState<EstadoObra | "todos">("todos");
  const [dialogAgregarCliente, setDialogAgregarCliente] = useState(false);
  // Detalle del "próximo pedido total": qué productos faltan y cuáles ya están críticos.
  const [dialogPedido, setDialogPedido] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [temporadaFiltro, setTemporadaFiltro] = useState("todas");
  const [planillaCompleta, setPlanillaCompleta] = useState(false);
  // Los indicadores van plegados: la tabla de obras es lo primero que se ve.
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [obraExpandida, setObraExpandida] = useState<string | null>(null);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [obraEditando, setObraEditando] = useState<Obra | null>(null);
  const [obraAEliminar, setObraAEliminar] = useState<Obra | null>(null);
  const [form, setForm] = useState<ObraForm>(emptyForm);
  const [tipos, setTipos] = useState<TipoViviendaForm[]>(TIPOS_INICIALES);
  // Productos elegidos en el formulario, todavía sin guardar (ver ProductoForm).
  const [productosForm, setProductosForm] = useState<ProductoForm[]>([]);
  // Si el usuario escribe el total a mano dejamos de derivarlo de los tipos.
  const totalTocado = useRef(false);
  const [nuevaEtapa, setNuevaEtapa] = useState<string | null>(null);

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

  // --- Productos de todas las obras ---
  // Sin filtrar por constructora: el mismo fetch alimenta el detalle de una y el
  // listado de todas las obras de la cartera, donde también se despliega el
  // panel de productos.
  const { data: productos = [] } = useQuery<ObraProducto[]>({
    queryKey: ["/api/obra-productos"],
    queryFn: async () => {
      const res = await apiRequest("/api/obra-productos");
      return res.json();
    },
  });

  // --- Catálogo de etapas constructivas ---
  const { data: etapas = [] } = useQuery<ObraEtapa[]>({
    queryKey: ["/api/obras/etapas"],
    queryFn: async () => {
      const res = await apiRequest("/api/obras/etapas");
      return res.json();
    },
  });

  const crearEtapa = useMutation({
    mutationFn: async (nombre: string) => {
      const res = await apiRequest("/api/obras/etapas", { method: "POST", data: { nombre } });
      return res.json();
    },
    onSuccess: (etapa: ObraEtapa) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras/etapas"] });
      // La etapa recién creada queda seleccionada: se agrega justamente porque
      // es la que tiene esta obra.
      setForm((p) => ({ ...p, etapa: etapa.nombre }));
      setNuevaEtapa(null);
      toast({ title: `Etapa «${etapa.nombre}» agregada` });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo agregar la etapa", description: error?.message, variant: "destructive" });
    },
  });

  const guardar = useMutation({
    mutationFn: async ({
      id,
      data,
      productos,
    }: {
      id?: string;
      data: Record<string, unknown>;
      productos: ProductoForm[];
    }) => {
      const res = await apiRequest(id ? `/api/obras/${id}` : "/api/obras", {
        method: id ? "PUT" : "POST",
        data,
      });
      const obra = await res.json();

      // Los productos elegidos en el formulario entran con todo en cero: el día
      // a día (proyectado, pedidos, entregas y consumo) se sigue llevando en el
      // panel de la obra. La obra ya quedó guardada, así que si alguno falla se
      // dice cuál en vez de dar el alta entera por perdida.
      const fallidos: string[] = [];
      for (const p of productos) {
        try {
          await apiRequest("/api/obra-productos", {
            method: "POST",
            data: {
              obraId: obra.id,
              kopr: p.kopr,
              nombre: p.nombre,
              color: p.color,
              unidad: p.unidad,
              cantidadProyectada: "0",
              cantidadPedida: "0",
              cantidadEntregada: "0",
              cantidadUtilizada: "0",
            },
          });
        } catch {
          fallidos.push(p.nombre);
        }
      }
      return { obra, fallidos };
    },
    onSuccess: ({ fallidos }, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      setDialogAbierto(false);
      setObraEditando(null);
      setProductosForm([]);
      toast({ title: vars.id ? "Obra actualizada" : "Obra creada" });
      if (fallidos.length > 0) {
        toast({
          title: "Algunos productos no se agregaron",
          description: `${fallidos.join(", ")}. Cargálos desde el panel de la obra.`,
          variant: "destructive",
        });
      }
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

  // --- Derivados ---
  // Productos agrupados por obra: alimentan el panel desplegable de cada fila y
  // además TODOS los números de la planilla, que ahora se derivan de ellos.
  const productosPorObra = useMemo(() => {
    const mapa = new Map<string, ObraProducto[]>();
    for (const p of productos) {
      const lista = mapa.get(p.obraId);
      if (lista) lista.push(p);
      else mapa.set(p.obraId, [p]);
    }
    return mapa;
  }, [productos]);

  const cartera = useMemo(() => armarCartera(todasLasObras, productosPorObra), [todasLasObras, productosPorObra]);

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

  /**
   * Qué hay que comprar, producto por producto y de toda la cartera.
   *
   * El "próximo pedido total" era un número suelto: decía cuánto pero no de
   * qué ni para quién. Acá se abre en sus productos, con los críticos primero
   * —los que ya no tienen nada en obra y todavía tienen viviendas por pintar,
   * que es cuando la cuadrilla se para— y después los que solo faltan pedir.
   */
  const pedidoPendiente = useMemo(() => {
    const items = cartera.flatMap((c) =>
      c.filas.flatMap((f) =>
        (productosPorObra.get(f.obra.id) ?? []).map((p) => {
          const calc = calcularProducto(p);
          const critico = f.pendientes > 0 && calc.saldo <= 0;
          return { producto: p, calc, obra: f.obra, constructora: c, pendientes: f.pendientes, critico };
        }),
      ),
    );
    return items
      .filter((i) => i.calc.sugerido > 0 || i.critico)
      .sort(
        (a, b) =>
          Number(b.critico) - Number(a.critico) ||
          b.calc.sugerido - a.calc.sugerido ||
          a.constructora.nombre.localeCompare(b.constructora.nombre),
      );
  }, [cartera, productosPorObra]);

  const criticos = useMemo(() => pedidoPendiente.filter((i) => i.critico).length, [pedidoPendiente]);

  // Todas las obras de la cartera, cada una con su constructora al lado: es el
  // listado plano de la portada. Primero lo que hay que comprar.
  const obrasDeLaCartera = useMemo(
    () =>
      cartera
        .flatMap((c) => c.filas.map((fila) => ({ fila, constructora: c })))
        .sort(
          (a, b) =>
            b.fila.sugerido - a.fila.sugerido ||
            a.constructora.nombre.localeCompare(b.constructora.nombre) ||
            a.fila.obra.nombre.localeCompare(b.fila.obra.nombre),
        ),
    [cartera],
  );

  const obrasFiltradas = useMemo(() => {
    const q = normalizar(filtroCartera.trim());
    return obrasDeLaCartera.filter(({ fila, constructora }) => {
      if (filtroEstado !== "todos" && fila.estado !== filtroEstado) return false;
      if (!q) return true;
      return (
        normalizar(fila.obra.nombre).includes(q) ||
        normalizar(fila.obra.ciudad ?? "").includes(q) ||
        normalizar(fila.obra.programa ?? "").includes(q) ||
        normalizar(constructora.nombre).includes(q)
      );
    });
  }, [obrasDeLaCartera, filtroCartera, filtroEstado]);

  // Columnas del listado plano: la constructora (acá las obras vienen
  // mezcladas) más las de decisión de la planilla. Al desplegar una obra, sus
  // productos usan estas mismas columnas.
  const constructoraPorCliente = useMemo(() => {
    const mapa = new Map<string, Constructora>();
    for (const c of cartera) mapa.set(c.id, c);
    return mapa;
  }, [cartera]);

  const { columnas: columnasCartera } = prepararColumnas([
    columnaConstructora(
      (f) => constructoraPorCliente.get(f.obra.clienteId)?.nombre ?? "—",
      (f) => {
        const destino = constructoraPorCliente.get(f.obra.clienteId);
        if (destino) seleccionarConstructora(destino);
      },
    ),
    ...COLUMNAS.filter((c) => CLAVES_CARTERA.has(c.key)),
  ]);

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
      .map((o) => calcularObra(o, productosPorObra.get(o.id) ?? []));
  }, [obras, temporadaFiltro, productosPorObra]);

  const totales = useMemo(() => calcularTotales(filas), [filas]);

  // Columnas de la planilla, agrupadas en bloques (obra / avance / material /
  // qué hacer). El toggle "planilla completa" suma las columnas de detalle.
  const { columnas: columnasVisibles, grupos } = useMemo(
    () => prepararColumnas(COLUMNAS.filter((c) => planillaCompleta || !c.soloCompleta)),
    [planillaCompleta],
  );

  // --- Formulario de obra ---
  const abrirNueva = () => {
    totalTocado.current = false;
    setNuevaEtapa(null);
    setObraEditando(null);
    setTipos(TIPOS_INICIALES);
    setProductosForm([]);
    setForm({
      ...emptyForm,
      temporada: temporadaFiltro !== "todas" ? temporadaFiltro : temporadas[0] ?? "",
    });
    setDialogAbierto(true);
  };

  // Sin lista de dependencias a propósito: `abrirNueva` se recrea en cada render
  // y cierra sobre la temporada filtrada, así el (+) del header abre el
  // formulario con lo que hay en pantalla ahora.
  useImperativeHandle(ref, () => ({ nuevaObra: abrirNueva }));

  const abrirEdicion = (obra: ObraConCliente) => {
    totalTocado.current = true;
    setNuevaEtapa(null);
    setObraEditando(obra);
    // Los que ya están cargados se muestran aparte y no se tocan desde acá: su
    // día a día vive en el panel de la obra. Esta lista es solo para sumar.
    setProductosForm([]);
    setTipos(
      obra.tiposVivienda?.length
        ? obra.tiposVivienda.map((t) => ({ nombre: t.nombre, cantidad: String(t.cantidad ?? 0) }))
        : TIPOS_INICIALES,
    );
    setForm({
      ciudad: obra.ciudad ?? "",
      nombre: obra.nombre ?? "",
      programa: obra.programa ?? "",
      temporada: obra.temporada ?? "",
      direccion: obra.direccion ?? "",
      descripcion: obra.descripcion ?? "",
      estado: obra.estado ?? "activa",
      tipoObra: obra.tipoObra ?? "casas",
      etapa: obra.etapa ?? "",
      torres: obra.torres ? String(obra.torres) : "",
      viviendas: String(obra.viviendas ?? 0),
      fechaInicio: (obra.fechaInicio as any) ?? "",
      fechaEstimadaFin: (obra.fechaEstimadaFin as any) ?? "",
    });
    setDialogAbierto(true);
  };

  const setCampo = (campo: keyof ObraForm, valor: string) => {
    if (campo === "viviendas") totalTocado.current = true;
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  // El total se propone sumando los modelos; queda editable porque no siempre
  // cuadra exacto con lo que dice el contrato.
  const totalTipos = tipos.reduce((a, t) => a + toInt(t.cantidad), 0);

  // Mientras el total no se escriba a mano, sigue a la suma de los modelos.
  const aplicarTipos = (next: TipoViviendaForm[]) => {
    setTipos(next);
    if (!totalTocado.current) {
      const suma = next.reduce((a, t) => a + toInt(t.cantidad), 0);
      setForm((f) => ({ ...f, viviendas: suma > 0 ? String(suma) : "" }));
    }
  };

  const setTipo = (indice: number, campo: keyof TipoViviendaForm, valor: string) =>
    aplicarTipos(tipos.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)));

  const agregarTipo = () =>
    // Tipo A, Tipo B, Tipo C… siguiendo la letra que toca.
    setTipos([...tipos, { nombre: `Tipo ${String.fromCharCode(65 + tipos.length)}`, cantidad: "" }]);

  const quitarTipo = (indice: number) => aplicarTipos(tipos.filter((_, i) => i !== indice));

  // --- Productos del formulario ---
  // En edición, los que ya están en la obra: se listan para no volver a
  // agregarlos, pero se siguen editando en el panel de la obra.
  const productosYaCargados = useMemo(
    () => (obraEditando ? productosPorObra.get(obraEditando.id) ?? [] : []),
    [obraEditando, productosPorObra],
  );

  const agregarProducto = (p: ProductoForm) => {
    const clave = claveProducto(p);
    const repetido =
      productosForm.some((x) => claveProducto(x) === clave) ||
      productosYaCargados.some((x) => claveProducto(x) === clave);
    if (repetido) {
      toast({ title: "Ese producto ya está en la obra" });
      return;
    }
    setProductosForm((prev) => [...prev, p]);
  };

  const quitarProducto = (indice: number) =>
    setProductosForm((prev) => prev.filter((_, i) => i !== indice));

  // Con cuántos productos va a quedar la obra al guardar.
  const productosEnLaObra = productosYaCargados.length + productosForm.length;

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
      productos: productosForm,
      data: {
        clienteId: cliente.id,
        nombre,
        ciudad: ciudad || null,
        programa: form.programa.trim() || null,
        temporada: form.temporada.trim() || null,
        direccion: form.direccion.trim() || null,
        descripcion: form.descripcion.trim() || null,
        estado: form.estado,
        tipoObra: form.tipoObra,
        etapa: form.etapa || null,
        torres: form.tipoObra === "edificios" ? toInt(form.torres) : 0,
        viviendas: toInt(form.viviendas),
        fechaInicio: form.fechaInicio || null,
        fechaEstimadaFin: form.fechaEstimadaFin || null,
        // Los modelos sin nombre o en cero no se guardan: son filas que el
        // formulario ofrece y el usuario no llegó a llenar.
        tiposVivienda: tipos
          .filter((t) => t.nombre.trim() && toInt(t.cantidad) > 0)
          .map((t) => ({ nombre: t.nombre.trim(), cantidad: toInt(t.cantidad) })),
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
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {vistaCartera === "obras" ? "Todas las obras" : "Cartera de constructoras"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {cartera.length === 0
                  ? "Agrega la primera constructora para empezar a controlar sus obras"
                  : `${cartera.length} ${cartera.length === 1 ? "constructora" : "constructoras"} · ${totalesCartera.conteoEstados.reduce((a, e) => a + e.cantidad, 0)} obras en control`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {cartera.length > 0 && (
                <>
                  {/* Las mismas obras en dos listados: agrupadas por constructora
                      o todas juntas cuando lo que se busca es una obra puntual. */}
                  <div className="flex items-center gap-0.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 flex-shrink-0">
                    {([
                      { key: "constructoras", label: "Constructoras" },
                      { key: "obras", label: "Todas las obras" },
                    ] as const).map((v) => (
                      <button
                        key={v.key}
                        onClick={() => setVistaCartera(v.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                          vistaCartera === v.key
                            ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                        data-testid={`button-vista-${v.key}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 sm:min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <Input
                      value={filtroCartera}
                      onChange={(e) => setFiltroCartera(e.target.value)}
                      placeholder={vistaCartera === "obras" ? "Buscar obra, ciudad o constructora…" : "Buscar constructora, obra o ciudad…"}
                      className="pl-9 rounded-2xl bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60"
                      data-testid="input-obras-filtrar-cartera"
                    />
                  </div>
                </>
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
                <MiniStat
                  icon={<ShoppingCart className="h-3.5 w-3.5" />}
                  tono="amber"
                  label="Próximo pedido total"
                  valor={fmtDec(totalesCartera.sugerido)}
                  sufijo="unidades"
                  onClick={() => setDialogPedido(true)}
                  testId="button-abrir-proximo-pedido"
                  pie={
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-orange-600">
                      {criticos > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {fmt(criticos)} {criticos === 1 ? "crítico" : "críticos"}
                        </span>
                      )}
                      <span className={criticos > 0 ? "text-slate-300 dark:text-slate-600" : ""}>
                        {criticos > 0 ? "·" : ""}
                      </span>
                      <span>Ver qué falta</span>
                    </div>
                  }
                />
              </div>

              {/* ---------- Listado de constructoras ---------- */}
              {vistaCartera === "constructoras" && (
                carteraFiltrada.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-12 text-center text-sm text-slate-500">
                    Ninguna constructora coincide con «{filtroCartera}».
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                    <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="flex-1 min-w-0">Constructora</span>
                      <span className="w-[150px] text-center">Avance</span>
                      <span className="w-20 text-right">Saldo obra</span>
                      <span className="w-24 text-right">Próx. pedido</span>
                      <span className="w-[180px]">Alertas</span>
                      <span className="w-4" />
                    </div>
                    {carteraFiltrada.map((c) => (
                      <FilaConstructora key={c.id} constructora={c} onAbrir={() => seleccionarConstructora(c)} />
                    ))}
                  </div>
                )
              )}

              {/* ---------- Listado de todas las obras de la cartera ---------- */}
              {vistaCartera === "obras" && (
                <>
                  {/* Filtro por estado: la lista larga se usa para ir a lo que hay que pedir. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setFiltroEstado("todos")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                        filtroEstado === "todos"
                          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                      data-testid="button-filtro-estado-todos"
                    >
                      Todas
                      <span className="tabular-nums opacity-70">{obrasDeLaCartera.length}</span>
                    </button>
                    {totalesCartera.conteoEstados
                      .filter((e) => e.cantidad > 0)
                      .map((e) => (
                        <button
                          key={e.key}
                          onClick={() => setFiltroEstado(filtroEstado === e.key ? "todos" : e.key)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${e.badge} ${
                            filtroEstado === e.key ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900" : "opacity-80 hover:opacity-100"
                          }`}
                          data-testid={`button-filtro-estado-${e.key}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
                          {e.label}
                          <span className="tabular-nums">{e.cantidad}</span>
                        </button>
                      ))}
                  </div>

                  {obrasFiltradas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-12 text-center text-sm text-slate-500">
                      Ninguna obra coincide con la búsqueda.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/60">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {obrasFiltradas.length} {obrasFiltradas.length === 1 ? "obra" : "obras"}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            Toca una obra para cargar sus productos
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        {/* Mismas columnas que la planilla, recortadas a las de
                            decisión: una obra se lee igual en los dos listados. */}
                        <table className="w-full text-sm min-w-[900px]">
                          <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60">
                              <Th className="text-left pl-4 min-w-[260px]">Obra</Th>
                              {columnasCartera.map((c) => (
                                <Th key={c.key} title={c.title} className={`${c.borde ?? ""} ${c.thClassName ?? ""}`}>
                                  {c.label}
                                </Th>
                              ))}
                              <Th className="pr-4"> </Th>
                            </tr>
                          </thead>
                          <tbody>
                            {obrasFiltradas.map(({ fila, constructora }) => {
                              const expandida = obraExpandida === fila.obra.id;
                              return (
                                <FilaObraGlobal
                                  key={fila.obra.id}
                                  fila={fila}
                                  columnas={columnasCartera}
                                  productos={productosPorObra.get(fila.obra.id) ?? []}
                                  expandida={expandida}
                                  onToggle={() => setObraExpandida(expandida ? null : fila.obra.id)}
                                  onAbrirConstructora={() => seleccionarConstructora(constructora)}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
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
              {/* Franja de resumen: banner + los cuatro números que se miran
                  siempre. El resto de los indicadores va plegado para que la
                  tabla de obras quede a la vista al entrar. */}
              <div className="rounded-2xl overflow-hidden shadow-md shadow-orange-500/25">
                <div className="bg-gradient-to-r from-[#fd6301] to-[#e35400] text-white px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                      <HardHat className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide truncate">
                        Control {cliente.nokoen}
                      </h3>
                      <p className="text-[11px] text-white/75 truncate">
                        {temporadaFiltro !== "todas" ? `Temporada ${temporadaFiltro} · ` : ""}
                        Avance, compra, entrega y saldo
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                    {/* El total del cliente, no el de una obra: suma las viviendas
                        de TODAS sus obras, que es el número con el que se habla
                        con una constructora que tiene varios proyectos. */}
                    <BannerStat
                      label="Viviendas"
                      valor={fmt(totales.viviendas)}
                      sufijo={`en ${fmt(filas.length)} ${filas.length === 1 ? "obra" : "obras"}`}
                    />
                    <BannerStat label="Proyectadas" valor={fmtDec(totales.proyectadas)} />
                    <BannerStat
                      label="Pintadas"
                      valor={fmt(totales.pintadas)}
                      sufijo={`${fmtPct(totales.avance)} de ${fmt(totales.viviendas)}`}
                    />
                    {/* Próximo pedido — el número que la planilla usaba para gatillar la compra */}
                    <div className="rounded-xl bg-white/15 px-3 py-1.5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/70 flex items-center gap-1.5">
                        <ShoppingCart className="h-3 w-3" />
                        Próximo pedido
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-bold tabular-nums" data-testid="text-obras-sugerido">{fmtDec(totales.sugerido)}</span>
                        <span className="text-[10px] font-semibold text-white/80">unidades</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setDetalleAbierto((v) => !v)}
                      className="flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
                      data-testid="button-toggle-detalle-obras"
                    >
                      {detalleAbierto ? "Ocultar" : "Indicadores"}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detalleAbierto ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {detalleAbierto && (
                  <div className="bg-white dark:bg-slate-900 border border-t-0 border-slate-200/70 dark:border-slate-700/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>Faltan {fmt(totales.faltante)} tinetas por pedir del total proyectado</span>
                      <span>
                        <span className="uppercase tracking-wider font-bold">Última actualización</span>{" "}
                        <span className="font-semibold text-slate-500 dark:text-slate-300">
                          {totales.ultima ? totales.ultima.toLocaleDateString("es-CL") : "—"}
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                      <div className="xl:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <MiniStat icon={<ShoppingCart className="h-3.5 w-3.5" />} tono="sky" label="Pedidas" valor={fmtDec(totales.pedidas)} />
                        <MiniStat icon={<Truck className="h-3.5 w-3.5" />} tono="violet" label="Entregadas" valor={fmtDec(totales.entregadas)} />
                        <MiniStat
                          icon={<Paintbrush className="h-3.5 w-3.5" />}
                          tono="slate"
                          label="Utilizadas en obra"
                          valor={fmtDec(totales.usadas)}
                        />
                        {/* Reemplaza al "teórico vs real": lo que se mira es si
                            el producto rinde lo que se prometió. */}
                        <MiniStat
                          icon={<Scale className="h-3.5 w-3.5" />}
                          tono={totales.consumoTeorico === 0 ? "slate" : totales.desviacion > 0.05 ? "red" : "emerald"}
                          label="Rendimiento vs declarado"
                          valor={totales.consumoTeorico > 0 ? fmtDesviacion(totales.desviacion) : "—"}
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
                  </div>
                )}
              </div>

              {/* Tabla de obras */}
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/70 dark:border-slate-700/60">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Obras
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      Cada fila es el total de sus productos · toca una para abrirlos
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
                  {/* Columnas de la hoja "Control General" de la planilla, en
                      bloques: qué obra es → cómo va → cuánto material → qué
                      hago. La primera queda fija al hacer scroll lateral. */}
                  <table className={`w-full text-sm ${planillaCompleta ? "min-w-[1720px]" : "min-w-[1180px]"}`}>
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                        <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800" />
                        {grupos.map((g, i) => (
                          <th
                            key={g.label}
                            colSpan={g.span}
                            className={`px-3 pt-2.5 pb-1 text-center text-[9px] uppercase tracking-[0.14em] font-bold text-slate-400/80 whitespace-nowrap ${i > 0 ? BORDE_GRUPO : ""}`}
                          >
                            {g.label}
                          </th>
                        ))}
                        <th />
                      </tr>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60">
                        <Th className="text-left pl-4 sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 min-w-[270px]">
                          Proyecto
                        </Th>
                        {columnasVisibles.map((c) => (
                          <Th key={c.key} title={c.title} className={`pt-1 ${c.borde ?? ""} ${c.thClassName ?? ""}`}>
                            {c.label}
                          </Th>
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
                          />
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-t border-slate-200/70 dark:border-slate-700/60 font-bold text-slate-700 dark:text-slate-100">
                        <td className="pl-4 py-3 text-left sticky left-0 z-10 bg-slate-50 dark:bg-slate-800">Total</td>
                        {columnasVisibles.map((c) => (
                          <td key={c.key} className={`px-2.5 py-3 text-center tabular-nums ${c.borde ?? ""}`}>
                            {c.total ? c.total(totales) : null}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Las tres fórmulas que no se adivinan mirando la tabla. El resto
                  (proyectado, pedido, entregado) se explica solo. */}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-[11px] text-slate-400 px-1">
                <div>
                  <dt className="font-bold text-slate-500 dark:text-slate-400">Saldo en obra</dt>
                  <dd>Entregado − utilizado: lo que debería quedar en la bodega de la obra.</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500 dark:text-slate-400">Próx. pedido</dt>
                  <dd>Proyectado − pedido − saldo en obra: lo que hay que comprar ahora.</dd>
                </div>
                <div>
                  <dt className="font-bold text-slate-500 dark:text-slate-400">Rendimiento</dt>
                  <dd>Utilizado ÷ viviendas pintadas: cuánto producto se va en cada una.</dd>
                </div>
              </dl>
            </>
          )}
        </>
      )}

      {/* ===================== DIÁLOGOS ===================== */}

      {/* Qué falta comprar: el "próximo pedido total" abierto por producto */}
      <Dialog open={dialogPedido} onOpenChange={setDialogPedido}>
        <DialogContent
          className="sm:max-w-[680px] max-h-[85vh] flex flex-col p-0 overflow-hidden z-[70]"
          overlayClassName="z-[70]"
        >
          <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">Qué hay que pedir</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {fmtDec(totalesCartera.sugerido)} unidades en {fmt(pedidoPendiente.length)}{" "}
                  {pedidoPendiente.length === 1 ? "producto" : "productos"}
                  {criticos > 0 && ` · ${fmt(criticos)} sin stock en obra`}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {pedidoPendiente.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                No hay nada pendiente de pedir: todas las obras tienen material suficiente para lo que
                les falta pintar.
              </p>
            ) : (
              <ul className="space-y-2">
                {pedidoPendiente.map(({ producto, calc, obra, constructora, pendientes, critico }) => (
                  <li
                    key={producto.id}
                    className={`rounded-2xl border px-3.5 py-3 ${
                      critico
                        ? "border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20"
                        : "border-slate-200/70 bg-white dark:border-slate-700/60 dark:bg-slate-800/40"
                    }`}
                    data-testid={`row-pedido-pendiente-${producto.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                          {producto.nombre}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                          {producto.kopr && <span className="font-bold tabular-nums">{producto.kopr}</span>}
                          {producto.color && <span className="uppercase tracking-wide">{producto.color}</span>}
                          <span className="uppercase tracking-wide">{producto.unidad}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            seleccionarConstructora(constructora);
                            setDialogPedido(false);
                          }}
                          className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-orange-600 dark:text-slate-400 transition-colors text-left"
                          data-testid={`link-pedido-obra-${producto.id}`}
                        >
                          {constructora.nombre} · {obra.nombre}
                        </button>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold tabular-nums text-[#fd6301] leading-tight">
                          {fmtDec(calc.sugerido)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                          a pedir
                        </div>
                      </div>
                    </div>

                    {/* Por qué está en la lista: lo que queda en obra contra lo
                        que todavía falta pintar. */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {critico ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2 py-0.5 font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          Sin material en obra
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 font-bold">
                          Falta pedir
                        </span>
                      )}
                      <span className="text-slate-400">
                        Saldo en obra {fmtDec(calc.saldo)} · quedan {fmt(pendientes)}{" "}
                        {pendientes === 1 ? "vivienda" : "viviendas"} por pintar
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/60 flex justify-end">
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogPedido(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          className="sm:max-w-[760px] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden z-[70]"
          overlayClassName="z-[70]"
        >
          <div className="px-6 py-5 border-b border-slate-200/70 dark:border-slate-700/60 bg-gradient-to-br from-orange-50 via-white to-orange-50/60 dark:from-orange-950/40 dark:via-slate-900 dark:to-orange-950/30">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-[#fd6301] rounded-xl p-2.5 shadow-md shadow-orange-500/25 flex-shrink-0">
                <HardHat className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-foreground leading-tight">
                  {obraEditando ? "Editar obra" : "Nueva obra"}
                </DialogTitle>
                <DialogDescription className="text-[11px] font-bold uppercase tracking-wider text-orange-700/70 dark:text-orange-300/70 truncate">
                  {cliente?.nokoen ?? ""}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto flex-1 px-6 py-5">
            {/* Identificación */}
            <Seccion
              icono={<Building2 className="w-3.5 h-3.5" />}
              titulo="Identificación"
              descripcion="Qué obra es y en qué estado está"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {/* Lo primero que define la obra: un edificio se cuenta por
                    torres y sus modelos son departamentos. */}
                <Campo label="Tipo de obra" className="sm:col-span-2">
                  <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-full sm:w-[280px]">
                    {([
                      { key: "casas", label: "Casas", icono: <Home className="h-3.5 w-3.5" /> },
                      { key: "edificios", label: "Edificios", icono: <Building2 className="h-3.5 w-3.5" /> },
                    ] as const).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setCampo("tipoObra", t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          form.tipoObra === t.key
                            ? "bg-white dark:bg-slate-900 text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                        data-testid={`button-tipo-obra-${t.key}`}
                      >
                        {t.icono}
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Campo>
                <Campo label="Proyecto" requerido className="sm:col-span-2">
                  <Input
                    value={form.nombre}
                    onChange={(e) => setCampo("nombre", e.target.value)}
                    placeholder="Ej: COMITÉ BUEN VIVIR"
                    className={INPUT_FORM}
                    data-testid="input-obra-nombre"
                  />
                </Campo>
                <Campo label="Ciudad">
                  <Input
                    value={form.ciudad}
                    onChange={(e) => setCampo("ciudad", e.target.value)}
                    placeholder="Ej: PUERTO MONTT"
                    className={INPUT_FORM}
                    data-testid="input-obra-ciudad"
                  />
                </Campo>
                <Campo label="Programa">
                  <Input
                    value={form.programa}
                    onChange={(e) => setCampo("programa", e.target.value)}
                    placeholder="Ej: DS-49"
                    className={INPUT_FORM}
                    data-testid="input-obra-programa"
                  />
                </Campo>
                <Campo label="Temporada">
                  <Input
                    value={form.temporada}
                    onChange={(e) => setCampo("temporada", e.target.value)}
                    placeholder="Ej: 2026-2027"
                    className={INPUT_FORM}
                    data-testid="input-obra-temporada"
                  />
                </Campo>
                <Campo label="Estado del registro">
                  <Select value={form.estado} onValueChange={(v) => setCampo("estado", v)}>
                    <SelectTrigger className={INPUT_FORM} data-testid="select-obra-estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      <SelectItem value="activa">Activa</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </Campo>
                {/* Etapa constructiva: es otra cosa que el estado del registro
                    (una obra en terminaciones sigue estando activa). El catálogo
                    se completa desde acá mismo cuando aparece una que falta. */}
                <Campo label="Etapa de la obra" className="sm:col-span-2">
                  {nuevaEtapa === null ? (
                    <Select
                      value={form.etapa || "__sin"}
                      onValueChange={(v) => {
                        if (v === "__nueva") setNuevaEtapa("");
                        else setCampo("etapa", v === "__sin" ? "" : v);
                      }}
                    >
                      <SelectTrigger className={INPUT_FORM} data-testid="select-obra-etapa">
                        <SelectValue placeholder="Sin etapa" />
                      </SelectTrigger>
                      <SelectContent className="z-[80]">
                        <SelectItem value="__sin">Sin etapa</SelectItem>
                        {etapas.map((e) => (
                          <SelectItem key={e.id} value={e.nombre}>{e.nombre}</SelectItem>
                        ))}
                        {/* La obra puede tener una etapa vieja que ya se sacó
                            del catálogo: se muestra igual para no perderla. */}
                        {form.etapa && !etapas.some((e) => e.nombre === form.etapa) && (
                          <SelectItem value={form.etapa}>{form.etapa}</SelectItem>
                        )}
                        {puedeAgregarEtapas && (
                          <SelectItem value="__nueva" className="text-orange-600 font-semibold">
                            + Agregar etapa…
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        value={nuevaEtapa}
                        onChange={(e) => setNuevaEtapa(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && nuevaEtapa.trim().length >= 2) crearEtapa.mutate(nuevaEtapa.trim());
                          if (e.key === "Escape") setNuevaEtapa(null);
                        }}
                        placeholder="Ej: Entrega de viviendas"
                        className={INPUT_FORM}
                        data-testid="input-obra-etapa-nueva"
                      />
                      <Button
                        type="button"
                        size="icon"
                        disabled={nuevaEtapa.trim().length < 2 || crearEtapa.isPending}
                        onClick={() => crearEtapa.mutate(nuevaEtapa.trim())}
                        className="h-10 w-10 rounded-xl bg-[#fd6301] hover:bg-[#e35400] text-white flex-shrink-0"
                        aria-label="Guardar etapa"
                        data-testid="button-obra-etapa-guardar"
                      >
                        {crearEtapa.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setNuevaEtapa(null)}
                        className="h-10 w-10 rounded-xl text-slate-400 flex-shrink-0"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Campo>
                <Campo label="Dirección" hint="Opcional" className="sm:col-span-2">
                  <Input
                    value={form.direccion}
                    onChange={(e) => setCampo("direccion", e.target.value)}
                    placeholder="Calle y número de la obra"
                    className={INPUT_FORM}
                    data-testid="input-obra-direccion"
                  />
                </Campo>
              </div>
            </Seccion>

            {/* Dimensión de la obra. El avance y los pedidos ya no se cargan
                acá: cada producto lleva los suyos en el panel de la obra. */}
            <Seccion
              icono={<Home className="w-3.5 h-3.5" />}
              titulo={form.tipoObra === "edificios" ? "Departamentos" : "Viviendas"}
              descripcion="Cuánto mide la obra y cómo se reparte por modelo"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {form.tipoObra === "edificios" && (
                  <Campo label="Torres">
                    <Input
                      type="number"
                      min={0}
                      value={form.torres}
                      onChange={(e) => setCampo("torres", e.target.value)}
                      placeholder="0"
                      className={INPUT_FORM}
                      data-testid="input-obra-torres"
                    />
                  </Campo>
                )}
                <Campo label={vocab(form.tipoObra).total}>
                  <Input
                    type="number"
                    min={0}
                    value={form.viviendas}
                    onChange={(e) => setCampo("viviendas", e.target.value)}
                    placeholder="0"
                    className={INPUT_FORM}
                    data-testid="input-obra-viviendas"
                  />
                </Campo>
              </div>

              {totalTipos > 0 && toInt(form.viviendas) !== totalTipos && (
                <button
                  type="button"
                  onClick={() => {
                    totalTocado.current = false;
                    setForm((p) => ({ ...p, viviendas: String(totalTipos) }));
                  }}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 -ml-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                  data-testid="button-obra-sugerir-total"
                >
                  Usar {fmt(totalTipos)} {vocab(form.tipoObra).unidad} (suma de los modelos)
                </button>
              )}

              {/* Desglose por modelo: cada tipo tiene su metraje y por lo tanto
                  su propio consumo, así que el total solo no alcanza. */}
              <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-700/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {vocab(form.tipoObra).tipo}
                  </div>
                  <button
                    type="button"
                    onClick={agregarTipo}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                    data-testid="button-obra-agregar-tipo"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex-1">Modelo</span>
                  <span className="w-24 text-center">Cantidad</span>
                  <span className="w-10" />
                </div>
                <div className="space-y-2">
                  {tipos.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={t.nombre}
                        onChange={(e) => setTipo(i, "nombre", e.target.value)}
                        placeholder={vocab(form.tipoObra).ejemplo}
                        className={`flex-1 ${INPUT_FORM}`}
                        data-testid={`input-obra-tipo-nombre-${i}`}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={t.cantidad}
                        onChange={(e) => setTipo(i, "cantidad", e.target.value)}
                        placeholder="0"
                        className={`w-24 text-center ${INPUT_FORM}`}
                        data-testid={`input-obra-tipo-cantidad-${i}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => quitarTipo(i)}
                        disabled={tipos.length <= 1}
                        className="h-10 w-10 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                        aria-label="Quitar tipo"
                        data-testid={`button-obra-quitar-tipo-${i}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {totalTipos > 0 && (
                  <div className="flex items-center gap-2 pt-2.5 mt-2.5 border-t border-dashed border-slate-200 dark:border-slate-700 text-xs">
                    <span className="flex-1 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Suma de los modelos
                    </span>
                    <span className="w-24 text-center font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {fmt(totalTipos)}
                    </span>
                    <span className="w-10" />
                  </div>
                )}
              </div>
            </Seccion>

            {/* Productos de la obra. Elegirlos acá es un atajo del alta: entran
                con todo en cero y su día a día se lleva en el panel de la obra,
                que es donde viven pedidos, entregas y consumo. */}
            <Seccion
              icono={<Paintbrush className="w-3.5 h-3.5" />}
              titulo="Productos"
              descripcion="Opcional · el control de la obra se lleva sobre estos SKU"
              accion={
                productosEnLaObra > 0 ? (
                  <span className="text-[11px] font-bold tabular-nums text-slate-400">
                    {fmt(productosEnLaObra)} en la obra
                  </span>
                ) : undefined
              }
            >
              <BuscadorCatalogo
                variante="inline"
                guardando={guardar.isPending}
                placeholder="Buscar en catálogo e inventario: SKU, nombre o color…"
                testId="input-obra-form-producto-buscar"
                onElegir={(item) =>
                  agregarProducto({
                    kopr: item.sku || null,
                    nombre: item.nombre,
                    color: item.color || null,
                    unidad: unidadDeObra(item),
                    hex: item.hex,
                  })
                }
                onManual={(nombre) =>
                  agregarProducto({ kopr: null, nombre, color: null, unidad: UNIDAD_POR_DEFECTO, hex: null })
                }
              />

              {/* En edición: los que la obra ya tiene, para no repetirlos. */}
              {productosYaCargados.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ya cargados · se editan en el panel de la obra
                  </div>
                  {productosYaCargados.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 px-3 py-2"
                    >
                      <span className="text-sm text-slate-500 dark:text-slate-400 break-words leading-snug flex-1 min-w-0">
                        {p.nombre}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 flex-shrink-0">
                        {etiquetaCortaUnidad(p.unidad)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {productosForm.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {productosForm.map((p, i) => (
                    <li
                      key={`${p.kopr ?? p.nombre}-${i}`}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                      data-testid={`row-obra-form-producto-${i}`}
                    >
                      <span
                        className="mt-1 w-4 h-4 rounded-full border border-slate-200 dark:border-slate-600 flex-shrink-0"
                        style={{ background: p.hex || "linear-gradient(135deg,#f1f5f9,#cbd5e1)" }}
                      />
                      <div className="min-w-0 flex-1">
                        {/* El nombre completo, en varias líneas si hace falta:
                            cortado, dos SKU del catálogo se leen igual. */}
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 break-words leading-snug">
                          {p.nombre}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
                          {p.kopr ? (
                            <span className="font-bold tabular-nums">{p.kopr}</span>
                          ) : (
                            <span className="italic">sin SKU</span>
                          )}
                          {p.color && <span className="uppercase tracking-wide">{p.color}</span>}
                          <span className="uppercase tracking-wide">{p.unidad}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => quitarProducto(i)}
                        className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                        aria-label="Quitar producto"
                        data-testid={`button-obra-quitar-producto-${i}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[11px] text-slate-400">
                  {productosYaCargados.length > 0
                    ? "Buscá arriba para sumarle otro producto a la obra."
                    : "La fachada, el sellador, el esmalte de rejas… Entran con todo en cero y después se les lleva el día a día en el panel de la obra. También se pueden cargar más adelante."}
                </p>
              )}
            </Seccion>

            {/* Plazos y notas */}
            <Seccion
              icono={<Package className="w-3.5 h-3.5" />}
              titulo="Plazos y notas"
              descripcion="Opcional"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo label="Fecha de inicio">
                  <Input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setCampo("fechaInicio", e.target.value)}
                    className={INPUT_FORM}
                    data-testid="input-obra-fecha-inicio"
                  />
                </Campo>
                <Campo label="Fecha estimada de término">
                  <Input
                    type="date"
                    value={form.fechaEstimadaFin}
                    onChange={(e) => setCampo("fechaEstimadaFin", e.target.value)}
                    className={INPUT_FORM}
                    data-testid="input-obra-fecha-fin"
                  />
                </Campo>
                <Campo label="Notas" className="sm:col-span-3">
                  <Textarea
                    value={form.descripcion}
                    onChange={(e) => setCampo("descripcion", e.target.value)}
                    rows={2}
                    placeholder="Observaciones de la obra"
                    className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20"
                    data-testid="input-obra-notas"
                  />
                </Campo>
              </div>
            </Seccion>
          </div>

          {/* Pie: lo que se va a guardar, resumido, y las acciones. */}
          <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Pastilla icono={form.tipoObra === "edificios" ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}>
                {form.tipoObra === "edificios" ? "Edificios" : "Casas"}
              </Pastilla>
              <Pastilla icono={<Layers className="h-3 w-3" />}>
                {fmt(toInt(form.viviendas))} {vocab(form.tipoObra).unidad}
              </Pastilla>
              <Pastilla icono={<Paintbrush className="h-3 w-3" />}>
                {fmt(productosEnLaObra)} {productosEnLaObra === 1 ? "producto" : "productos"}
              </Pastilla>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
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

    </div>
  );
});

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

/** Una constructora en el listado de la portada, con su avance y lo que hay que pedir. */
function FilaConstructora({ constructora, onAbrir }: { constructora: Constructora; onAbrir: () => void }) {
  const { totales, filas } = constructora;
  // En el listado solo interesan los estados que piden acción.
  const alertas = totales.conteoEstados.filter(
    (e) => e.cantidad > 0 && (e.key === "critico" || e.key === "pedir" || e.key === "revisar"),
  );

  return (
    <button
      onClick={onAbrir}
      className="w-full text-left flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group"
      data-testid={`row-constructora-${constructora.id}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight truncate group-hover:text-orange-600 transition-colors">
            {constructora.nombre}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {filas.length} {filas.length === 1 ? "obra" : "obras"}
            {constructora.ciudades.length > 0 && ` · ${constructora.ciudades.slice(0, 3).join(", ")}`}
            {constructora.ciudades.length > 3 && ` +${constructora.ciudades.length - 3}`}
            {` · ${fmt(totales.pintadas)} de ${fmt(totales.viviendas)} viviendas pintadas`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 pl-12 lg:pl-0">
        <div className="w-[150px] flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 to-[#fd6301]"
              style={{ width: `${Math.round(totales.avance * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right">
            {fmtPct(totales.avance)}
          </span>
        </div>

        <div className="w-20 text-right">
          <div className="lg:hidden text-[9px] uppercase tracking-wider font-bold text-slate-400">Saldo</div>
          <div className={`text-sm font-bold tabular-nums ${totales.saldo < 0 ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>
            {fmtDec(totales.saldo)}
          </div>
        </div>

        <div className="w-24 text-right">
          <div className="lg:hidden text-[9px] uppercase tracking-wider font-bold text-slate-400">Próx. pedido</div>
          <div className={`text-sm font-bold tabular-nums ${totales.sugerido > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>
            {fmtDec(totales.sugerido)}
          </div>
        </div>

        <div className="w-[180px] flex flex-wrap gap-1">
          {alertas.length === 0 ? (
            <span className="text-[11px] text-slate-300 dark:text-slate-600">Sin alertas</span>
          ) : (
            alertas.map((e) => (
              <span key={e.key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />
                {e.cantidad} {e.label}
              </span>
            ))
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

/**
 * Fila de la obra — el TOTAL de sus productos. Al abrirla, sus productos
 * aparecen debajo como filas de la misma tabla, en las mismas columnas.
 */
function FilaObra({
  fila,
  indice,
  columnas,
  productos,
  expandida,
  onToggle,
  onEditar,
  onEliminar,
}: {
  fila: ObraCalculada;
  indice: number;
  columnas: ColumnaDef[];
  productos: ObraProducto[];
  expandida: boolean;
  onToggle: () => void;
  onEditar: () => void;
  onEliminar: () => void;
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
              <div className="font-semibold text-slate-700 dark:text-slate-100 truncate max-w-[210px]">
                {fila.obra.nombre}
              </div>
              {/* Ciudad y estado de la obra son identidad: van con el nombre y
                  no ocupando columnas de números. */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                {fila.obra.ciudad && <span className="truncate max-w-[100px]">{fila.obra.ciudad}</span>}
                {fila.obra.estado !== "activa" && (
                  <span className="inline-flex uppercase tracking-wide font-bold">{fila.obra.estado}</span>
                )}
                <span className="inline-flex items-center gap-1 font-bold flex-shrink-0">
                  <Layers className="h-3 w-3" />
                  {productos.length === 0
                    ? "sin productos"
                    : `${productos.length} ${productos.length === 1 ? "producto" : "productos"}`}
                </span>
              </div>
            </div>
          </div>
        </td>
        {columnas.map((c) => (
          <td
            key={c.key}
            className={`px-2.5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300 ${c.borde ?? ""}`}
          >
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

      {/* Los productos son filas de esta misma tabla: cada número cae en la
          columna del total al que suma. */}
      {expandida && (
        <>
          <FilasProductos
            obraId={fila.obra.id}
            viviendas={fila.viviendas}
            productos={productos}
            columnas={columnas}
            sticky
          />
          {/* La bitácora cierra la obra: los números arriba, lo que pasó abajo. */}
          <tr className="border-b border-slate-100 dark:border-slate-700/40 bg-slate-50/70 dark:bg-slate-900/40">
            <td colSpan={columnas.length + 2} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
              <div className="sticky left-0 w-full max-w-[720px] pl-6">
                <BitacoraObra obraId={fila.obra.id} obraNombre={fila.obra.nombre} />
              </div>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

/**
 * Fila del listado de TODAS las obras de la cartera. Muestra las columnas de
 * decisión (avance, saldo, próximo pedido) más la constructora, porque acá las
 * obras vienen mezcladas; el detalle completo de la planilla sigue estando al
 * entrar a la constructora. Al desplegarla, sus productos aparecen como filas
 * de esta misma tabla, igual que en la planilla.
 */
function FilaObraGlobal({
  fila,
  columnas,
  productos,
  expandida,
  onToggle,
  onAbrirConstructora,
}: {
  fila: ObraCalculada;
  columnas: ColumnaDef[];
  productos: ObraProducto[];
  expandida: boolean;
  onToggle: () => void;
  onAbrirConstructora: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-700/40 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group cursor-pointer ${expandida ? "bg-orange-50/40 dark:bg-orange-950/10" : ""}`}
        onClick={onToggle}
        data-testid={`row-obra-global-${fila.obra.id}`}
      >
        <td className="pl-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-slate-300 dark:text-slate-600 pt-0.5 flex-shrink-0">
              {expandida ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-slate-700 dark:text-slate-100 truncate max-w-[240px]">
                {fila.obra.nombre}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                {fila.obra.ciudad && <span className="truncate">{fila.obra.ciudad}</span>}
                {fila.obra.programa && <span className="font-bold">{fila.obra.programa}</span>}
                <span className="inline-flex items-center gap-1 font-bold">
                  <Layers className="h-3 w-3" />
                  {productos.length === 0 ? "sin productos" : productos.length}
                </span>
              </div>
            </div>
          </div>
        </td>

        {columnas.map((c) => (
          <td
            key={c.key}
            className={`px-2.5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300 ${c.borde ?? ""}`}
          >
            {c.render(fila)}
          </td>
        ))}

        <td className="pr-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={onAbrirConstructora}
              className="h-8 rounded-lg text-xs text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              data-testid={`button-ver-planilla-${fila.obra.id}`}
            >
              Ver planilla
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </td>
      </tr>

      {expandida && (
        <>
          <FilasProductos
            obraId={fila.obra.id}
            viviendas={fila.viviendas}
            productos={productos}
            columnas={columnas}
          />
          <tr className="border-b border-slate-100 dark:border-slate-700/40 bg-slate-50/70 dark:bg-slate-900/40">
            <td colSpan={columnas.length + 2} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
              <div className="w-full max-w-[720px] pl-6">
                <BitacoraObra obraId={fila.obra.id} obraNombre={fila.obra.nombre} />
              </div>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

/** Número suelto dentro del banner naranja (sin tarjeta, para ahorrar alto). */
function BannerStat({ label, valor, sufijo }: { label: string; valor: string; sufijo?: string }) {
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

function MiniStat({
  icon,
  tono,
  label,
  valor,
  sufijo,
  pie,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  tono: string;
  label: string;
  valor: string;
  /** Unidad del número ("unidades"): un total suelto no dice de qué. */
  sufijo?: string;
  /** Línea de abajo, para invitar a abrir el detalle. */
  pie?: React.ReactNode;
  onClick?: () => void;
  testId?: string;
}) {
  const contenido = (
    <>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${TONOS[tono] ?? TONOS.slate}`}>{icon}</span>
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{valor}</span>
        {sufijo && <span className="text-[11px] font-semibold text-slate-400">{sufijo}</span>}
      </div>
      {pie}
    </>
  );

  const base = "rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 px-3.5 py-3 shadow-sm";

  if (!onClick) return <div className={base}>{contenido}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} text-left hover:border-orange-300 dark:hover:border-orange-700 hover:shadow transition-all`}
      data-testid={testId}
    >
      {contenido}
    </button>
  );
}

function Seccion({
  icono,
  titulo,
  descripcion,
  accion,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  /** Para qué sirve la sección: evita tener que deducirlo de los campos. */
  descripcion?: string;
  /** Contador o botón alineado a la derecha del título. */
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            {icono}
          </span>
          <div className="leading-tight min-w-0">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{titulo}</div>
            {descripcion && <div className="text-[11px] text-slate-400 truncate">{descripcion}</div>}
          </div>
        </div>
        {accion}
      </div>
      <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-4">
        {children}
      </div>
    </section>
  );
}

function Campo({
  label,
  requerido,
  hint,
  children,
  className = "",
}: {
  label: string;
  requerido?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        {requerido && <span className="text-[10px] font-bold text-[#fd6301]">obligatorio</span>}
        {hint && <span className="text-[10px] text-slate-400 ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Resumen chico de lo que se va a guardar, para el pie del formulario. */
function Pastilla({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
      <span className="text-slate-400">{icono}</span>
      {children}
    </span>
  );
}

export default ControlObrasContent;
