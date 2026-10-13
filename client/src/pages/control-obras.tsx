/**
 * Control de Obras — pestaña "Obras" del Panel de Trabajo (área Construcción).
 *
 * Reemplaza la planilla Excel de temporada que llevaba Construcción por
 * constructora ("Planilla Control <cliente> Temporada 2026-2027").
 *
 * La pantalla tiene DOS niveles:
 *  1. Portada — listado de la cartera por constructora (una fila cada una con
 *     sus obras y su avance). De acá se entra a una constructora y se agregan
 *     nuevas (el buscador contra la base de clientes).
 *  2. Detalle — la planilla de esa constructora: resumen arriba y una fila por
 *     obra (en celular, una tarjeta por obra).
 *
 * Cada obra se despliega y sus productos aparecen como filas indentadas de la
 * MISMA tabla (components/obras/panel-productos.tsx),
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
import { ComprasObra } from "@/components/obras/ventas";
import { BuscadorCatalogo, unidadDeObra } from "@/components/obras/buscador-catalogo";
import { UNIDAD_POR_DEFECTO, etiquetaCortaUnidad } from "@/components/obras/unidades";
import { fmt, fmtDec, fmtPct, normalizar, toInt } from "@/components/obras/formato";
import {
  calcularObra,
  calcularProducto,
  calcularTotales,
  textoMaterial,
  porFormato,
  type EstadoObra,
  type ObraCalculada,
  type Totales,
} from "@/components/obras/calculos";
import {
  COLUMNAS,
  etiquetaUnidades,
  prepararColumnas,
  type ColumnaDef,
} from "@/components/obras/columnas";
import { BORDE_GRUPO, Th } from "@/components/obras/celdas";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Search,
  ShoppingCart,
  Trash2,
  Users,
  X,
  DollarSign,
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
  // Vendedor a cargo. Solo lo edita admin/supervisor; el vendedor no ve el
  // campo y el servidor le estampa la obra a su nombre igual. "" = sin asignar.
  vendedorId: "",
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

export const ControlObrasContent = forwardRef<ControlObrasHandle, {
  /** Vendedor elegido en el encabezado del Panel ("all" = toda la cartera visible,
      "sin-asignar" = las obras sin dueño). El selector vive arriba, junto al de Área y
      Sección (pedido del usuario, sep-2026). */
  vendedorFiltro?: string;
  /** Vuelve el filtro del encabezado a "Todos" desde el estado vacío. */
  onVerTodaLaCartera?: () => void;
}>(function ControlObrasContent({ vendedorFiltro = "all", onVerTodaLaCartera }, ref) {
  const { toast } = useToast();
  const { user } = useAuth();
  // Las etapas quedan disponibles para todas las obras, así que solo las suman
  // los roles que mandan en el área.
  const puedeAgregarEtapas = user?.role === "admin" || user?.role === "supervisor";
  // Quién manda en la cartera: ve la de todo el equipo, la filtra por vendedor y
  // puede decidir de quién es cada obra. El vendedor solo ve las suyas y no
  // tiene selector — el propio servidor le acota el listado (ver GET /api/obras).
  const mandaEnCartera =
    user?.role === "admin" || user?.role === "supervisor" || user?.role === "encargado_area";
  const esSupervisor = user?.role === "supervisor" || user?.role === "encargado_area";
  // Constructora abierta. null = portada (cartera).
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [filtroCartera, setFiltroCartera] = useState("");
  // Portada: agrupada por constructora o el listado plano de todas las obras.
  // En celular las pestañas, el buscador y los dos botones bajan debajo de las
  // tarjetas de resumen (pedido del usuario, ago-2026); en computador siguen
  // arriba, en la misma fila del título.
  const esCelular = useIsMobile();
  const [dialogAgregarCliente, setDialogAgregarCliente] = useState(false);
  // El buscador de constructoras se usa para dos cosas: sumarla a la cartera o
  // elegirla como paso previo a cargarle una obra (ver abrirNueva).
  const [altaTrasElegir, setAltaTrasElegir] = useState(false);
  // Detalle del "próximo pedido total": qué productos faltan y cuáles ya están críticos.
  const [busqueda, setBusqueda] = useState("");

  const [temporadaFiltro, setTemporadaFiltro] = useState("todas");
  // Los indicadores van plegados: la tabla de obras es lo primero que se ve.
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
  // El filtro por vendedor va en el servidor, no acá: así el vendedor no puede
  // pedir la cartera de otro, y el detalle de una constructora queda acotado
  // igual que la portada sin filtrar dos veces lo mismo.
  const { data: todasLasObras = [], isLoading: cargandoObras } = useQuery<ObraConCliente[]>({
    queryKey: ["/api/obras", vendedorFiltro],
    queryFn: async () => {
      const qs = vendedorFiltro !== "all" ? `?vendedorId=${encodeURIComponent(vendedorFiltro)}` : "";
      const res = await apiRequest(`/api/obras${qs}`);
      return res.json();
    },
  });

  // --- Vendedores del selector y de la asignación de la obra ---
  // El admin elige entre todos; el supervisor, solo dentro de su equipo (el
  // servidor ignora igual cualquier vendedor de afuera). Los supervisores
  // también venden y pueden quedar a cargo de una obra, así que entran en la
  // lista; el supervisor se ve a sí mismo además de su equipo.
  // La clave lleva "control-obras" también para el supervisor: el Panel de
  // Trabajo cachea la misma URL sin el supervisor agregado, y con la clave
  // compartida esta lista salía de ese caché y nunca lo incluía a él.
  const { data: vendedores = [] } = useQuery<Array<{ id: string; salespersonName: string; fullName?: string }>>({
    queryKey: esSupervisor
      ? ["/api/supervisor", user?.id, "salespeople", "control-obras"]
      : ["/api/users/salespeople", "control-obras"],
    queryFn: async () => {
      const res = await apiRequest(
        esSupervisor ? `/api/supervisor/${user?.id}/salespeople` : "/api/users/salespeople",
      );
      const lista = await res.json();
      if (esSupervisor) {
        const yo = user as any;
        return lista.some((v: any) => v.id === yo?.id)
          ? lista
          : [{ id: yo.id, salespersonName: yo.salespersonName || `${yo.firstName || ""} ${yo.lastName || ""}`.trim() || yo.email }, ...lista];
      }
      return lista.filter(
        (v: any) => (v.role === "salesperson" || v.role === "supervisor") && v.isActive !== false,
      );
    },
    enabled: mandaEnCartera && !!user?.id,
  });

  const nombreVendedor = (v: { salespersonName?: string; fullName?: string }) =>
    v.fullName || v.salespersonName || "Sin nombre";

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

  // Total proyecto en $ de la constructora abierta. La clave arranca con
  // "/api/obra-productos" para que se recalcule cada vez que cambian los
  // productos (esas mutaciones invalidan ese prefijo).
  const { data: proyectadoPesos } = useQuery<{ total: number; porPedir: number; sinPrecio: number; conPrecioLista: number }>({
    queryKey: ["/api/obra-productos", "proyectado-pesos", cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/proyectado-pesos?clienteId=${encodeURIComponent(cliente!.id)}`);
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

  // Las viviendas pintadas se escriben en la fila de la obra. El número cambia
  // en el acto sobre la caché (igual que las celdas de producto) y, si el
  // servidor falla, vuelve al valor de la base.
  const actualizarObra = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/obras/${id}`, { method: "PUT", data });
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      const clave = ["/api/obras", vendedorFiltro];
      await queryClient.cancelQueries({ queryKey: clave });
      const anteriores = queryClient.getQueryData<ObraConCliente[]>(clave);
      queryClient.setQueryData<ObraConCliente[]>(clave, (obras) =>
        obras?.map((o) => (o.id === id ? { ...o, ...(data as Partial<ObraConCliente>) } : o)),
      );
      return { clave, anteriores };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obras"] });
    },
    onError: (error: any, _vars, context) => {
      if (context) queryClient.setQueryData(context.clave, context.anteriores);
      toast({ title: "No se pudo guardar el cambio", description: error?.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/obras"] });
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

  // Total proyectado en $ de toda la cartera (pedido del usuario, oct-2026).
  // Mismo cálculo que el de cada constructora, sumado.
  const idsCartera = useMemo(() => cartera.map((c) => c.id).sort(), [cartera]);
  const { data: proyectadoCartera } = useQuery<{ total: number; sinPrecio: number }>({
    queryKey: ["/api/obra-productos", "proyectado-pesos-cartera", idsCartera.join(",")],
    enabled: idsCartera.length > 0,
    queryFn: async () => {
      const res = await apiRequest(`/api/obras/proyectado-pesos?clienteIds=${encodeURIComponent(idsCartera.join(","))}`);
      return res.json();
    },
  });

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
      .map((o) => calcularObra(o, productosPorObra.get(o.id) ?? []));
  }, [obras, temporadaFiltro, productosPorObra]);

  const totales = useMemo(() => calcularTotales(filas), [filas]);

  // Columnas de la planilla, agrupadas en bloques (obra / avance / material).
  const { columnas: columnasVisibles, grupos } = useMemo(
    () => prepararColumnas(COLUMNAS),
    [],
  );

  // --- Formulario de obra ---
  const abrirFormularioObra = () => {
    totalTocado.current = false;
    setNuevaEtapa(null);
    setObraEditando(null);
    setTipos(TIPOS_INICIALES);
    setProductosForm([]);
    setForm({
      ...emptyForm,
      temporada: temporadaFiltro !== "todas" ? temporadaFiltro : temporadas[0] ?? "",
      // Si se está mirando la cartera de un vendedor, la obra nueva nace suya.
      vendedorId: vendedorFiltro !== "all" && vendedorFiltro !== "sin-asignar" ? vendedorFiltro : "",
    });
    setDialogAbierto(true);
  };

  // Una obra siempre es DE una constructora. Desde la portada todavía no hay
  // ninguna abierta, así que primero se elige y recién ahí se abre el formulario
  // (antes el alta se abría igual y al guardar no pasaba nada).
  const abrirNueva = () => {
    if (!cliente) {
      setBusqueda("");
      setAltaTrasElegir(true);
      setDialogAgregarCliente(true);
      return;
    }
    abrirFormularioObra();
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
      vendedorId: obra.vendedorId ?? "",
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
        // Solo viaja si quien guarda puede decidir de quién es la obra; para el
        // resto el servidor lo ignora y mantiene la asignación que ya tenía.
        ...(mandaEnCartera ? { vendedorId: form.vendedorId || null } : {}),
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

  // Las piezas de la barra de la cartera. Se arman una sola vez y se ubican
  // arriba (computador) o debajo de las tarjetas de resumen (celular).
  // Sin título ni pestañas Constructoras / Todas las obras (pedido del usuario,
  // oct-2026): la portada abre siempre en el listado por constructora.
  const buscadorCartera = (
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
  );

  // "Agregar constructora" ya no va acá (pedido del usuario, oct-2026): una
  // constructora nueva se elige al añadir su obra, y con la cartera vacía queda
  // el botón del aviso de más abajo.
  const botonesCartera = (
    <>
      <Button
        onClick={abrirNueva}
        className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all flex-shrink-0"
        data-testid="button-obras-nueva-portada"
      >
        <Plus className="h-4 w-4 mr-2" />
        Añadir obra
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* ===================== PORTADA: CARTERA ===================== */}
      {!cliente && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-end">
            <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
              {/* El filtro por vendedor se fue al encabezado del Panel, debajo del
                  selector de Sección (pedido del usuario, sep-2026): es contexto de toda
                  la pestaña, igual que el del CRM y el de Estimación, y acá abajo quedaba
                  perdido entre el título y las tarjetas. Llega por prop. */}
              {cartera.length > 0 && !esCelular && (
                buscadorCartera
              )}
              {/* Agregar constructora suma una a la cartera; Añadir obra le
                  carga una obra a la que ya está. En celular estos dos bajan con
                  las pestañas y el buscador; solo se quedan arriba cuando la
                  cartera está vacía y abajo no hay nada donde ponerlos. */}
              {(!esCelular || cartera.length === 0) && botonesCartera}
            </div>
          </div>

          {cartera.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-16">
              <span className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                <HardHat className="h-8 w-8" />
              </span>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {vendedorFiltro !== "all" ? "Sin obras para este filtro" : "Control de obras"}
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                {vendedorFiltro !== "all"
                  ? vendedorFiltro === "sin-asignar"
                    ? "Todas las obras de la cartera ya tienen un vendedor a cargo."
                    : "Este vendedor todavía no tiene obras a su nombre. Si la obra existe pero la cargó otra persona, ábrela con el filtro en “Todos” y asígnasela desde el formulario de la obra."
                  : "Agrega las constructoras con las que estás trabajando esta temporada. De cada una vas a ver el avance de sus obras, las tinetas pedidas y entregadas, el saldo en obra y el producto por vender."}
              </p>
              {vendedorFiltro !== "all" && onVerTodaLaCartera ? (
                <Button
                  variant="outline"
                  onClick={onVerTodaLaCartera}
                  className="mt-5 rounded-2xl"
                  data-testid="button-obras-ver-todos"
                >
                  Ver toda la cartera
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setBusqueda("");
                    setAltaTrasElegir(false);
                    setDialogAgregarCliente(true);
                  }}
                  className="mt-5 rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25"
                  data-testid="button-agregar-constructora-vacio"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar constructora
                </Button>
              )}
            </div>
          )}

          {cartera.length > 0 && (
            <>
              {/* En celular el buscador y "Añadir obra" van arriba del resumen,
                  igual que en computador (pedido del usuario, oct-2026; antes
                  quedaban debajo de las tarjetas). */}
              {esCelular && (
                <div className="space-y-2">
                  <div className="flex">{buscadorCartera}</div>
                  <div className="flex items-center gap-2">{botonesCartera}</div>
                </div>
              )}

              {/* Resumen de toda la cartera */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <MiniStat icon={<Building2 className="h-3.5 w-3.5" />} tono="sky" label="Constructoras" valor={fmt(cartera.length)} />
                {/* Sin "Viviendas en control" (pedido del usuario, oct-2026). */}
                <MiniStat icon={<Paintbrush className="h-3.5 w-3.5" />} tono="emerald" label="Avance global" valor={fmtPct(
                    // Promedio del avance de cada constructora del listado
                    // (pedido del usuario, oct-2026): cada una pesa lo mismo.
                    cartera.length > 0
                      ? cartera.reduce((a, c) => a + c.totales.avanceVenta, 0) / cartera.length
                      : 0,
                  )} />
                {/* Cuántas obras hay en la cartera. Reemplaza a "Próximo pedido
                    total" (pedido del usuario, oct-2026). */}
                <MiniStat
                  icon={<HardHat className="h-3.5 w-3.5" />}
                  tono="amber"
                  label="Obras"
                  valor={fmt(totalesCartera.conteoEstados.reduce((a, e) => a + e.cantidad, 0))}
                />
                <MiniStat
                  icon={<DollarSign className="h-3.5 w-3.5" />}
                  tono="emerald"
                  label={
                    proyectadoCartera && proyectadoCartera.sinPrecio > 0
                      ? `Total proyectado · ${proyectadoCartera.sinPrecio} sin precio`
                      : "Total proyectado"
                  }
                  valor={proyectadoCartera ? `$${Math.round(proyectadoCartera.total).toLocaleString("es-CL")}` : "—"}
                  testId="text-cartera-proyectado-pesos"
                />
              </div>

              {/* ---------- Listado de constructoras ---------- */}
              {carteraFiltrada.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-6 py-12 text-center text-sm text-slate-500">
                    Ninguna constructora coincide con «{filtroCartera}».
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                    <div className={`hidden lg:grid ${GRID_CONSTRUCTORAS} items-center gap-6 px-4 py-2 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-400`}>
                      <span className="min-w-0">Constructora</span>
                      <span className="text-center">Obras</span>
                      <span className="text-center">Avance global</span>
                      <span />
                    </div>
                    {carteraFiltrada.map((c) => (
                      <FilaConstructora key={c.id} constructora={c} onAbrir={() => seleccionarConstructora(c)} />
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
                <div className="flex items-center justify-center w-9 h-9 text-orange-600 dark:text-orange-400 flex-shrink-0">
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

              {/* Sin selector de Temporada (pedido del usuario, oct-2026): la
                  constructora se ve siempre con todas sus temporadas. */}
            </div>

            {/* En celular: la fecha y "Nueva obra" en una sola línea; el contador
                de obras se oculta porque ya lo dice la primera tarjeta. */}
            <div className="flex items-center justify-between lg:justify-end gap-2">
              {/* Última actualización junto a los botones, en negro y sin negrita
                  (pedido del usuario, oct-2026). */}
              {filas.length > 0 && (
                <span className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 lg:mr-2 min-w-0" data-testid="text-obras-ultima-actualizacion">
                  {temporadaFiltro !== "todas" && `Temporada ${temporadaFiltro} · `}
                  Última actualización {totales.ultima ? totales.ultima.toLocaleDateString("es-CL") : "—"}
                </span>
              )}
              {filas.length > 0 && (
                <Badge className="hidden sm:inline-flex bg-gradient-to-r from-orange-500 to-[#fd6301] text-white border-0 text-sm font-semibold px-4 py-2 shadow-sm shadow-orange-500/25 rounded-full">
                  {filas.length} {filas.length === 1 ? "obra" : "obras"}
                </Badge>
              )}
              <Button
                onClick={abrirNueva}
                className="rounded-2xl bg-gradient-to-r from-[#fd6301] to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white shadow-md shadow-orange-500/25 transition-all flex-shrink-0"
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
              {/* Resumen de la constructora con las mismas tarjetas blancas de la
                  portada (pedido del usuario, oct-2026): reemplaza al banner
                  naranjo. Solo los cuatro números que se miran siempre. */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {/* El total del cliente, no el de una obra. Igual que la columna
                      "Edificio / Casa" (pedido del usuario, oct-2026): los
                      edificios suman sus torres y las casas sus viviendas; si la
                      constructora tiene de los dos, van uno debajo del otro. */}
                  {(() => {
                    const obrasTxt = `${fmt(filas.length)} ${filas.length === 1 ? "obra" : "obras"}`;
                    const hayEdificios = filas.some((f) => f.obra.tipoObra === "edificios");
                    const hayCasas = filas.some((f) => f.obra.tipoObra !== "edificios");
                    const torresTxt = `${fmt(totales.torres)} ${totales.torres === 1 ? "torre" : "torres"}`;
                    const casasTxt = `${fmt(totales.casas)} viviendas`;
                    return (
                      <MiniStat
                        icon={hayEdificios && !hayCasas ? <Building2 className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                        tono="slate"
                        label={
                          hayEdificios && hayCasas
                            ? obrasTxt
                            : `${hayEdificios ? "Torres" : "Viviendas"} · ${obrasTxt}`
                        }
                        valor={
                          hayEdificios && hayCasas
                            ? `${torresTxt} · ${casasTxt}`
                            : hayEdificios
                              ? fmt(totales.torres)
                              : fmt(totales.casas)
                        }
                      />
                    );
                  })()}
                  {/* Sin tarjeta de Pintadas (pedido del usuario, oct-2026). */}
                  {/* Avance de todas las obras juntas (pedido del usuario, oct-2026):
                      (facturado + NVV) ÷ proyectado sumando todos sus productos,
                      igual que la columna "% avance". */}
                  <MiniStat icon={<HardHat className="h-3.5 w-3.5" />} tono="amber" label="Avance global" valor={fmtPct(totales.avanceVenta)} />
                  {/* Producto por Vender (antes "Próximo pedido") — el número que la planilla usaba para gatillar la compra */}
                  <MiniStat
                    icon={<ShoppingCart className="h-3.5 w-3.5" />}
                    tono="sky"
                    label="Por Pedir"
                    // Lo de la columna "Por Pedir" (proyectado − facturado − NVV),
                    // pero en dinero y en un solo total (pedido del usuario,
                    // oct-2026): las unidades por formato quedan en la tabla.
                    valor={proyectadoPesos ? `$${Math.round(proyectadoPesos.porPedir).toLocaleString("es-CL")}` : "—"}
                    testId="text-obras-sugerido"
                  />
                  {/* Total proyecto en $ (pedido del usuario, oct-2026): lo
                      proyectado × el precio de venta real de cada producto. */}
                  <MiniStat
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    tono="emerald"
                    label={
                      proyectadoPesos && proyectadoPesos.sinPrecio > 0
                        ? `Total proyecto · ${proyectadoPesos.sinPrecio} sin precio`
                        : "Total proyecto"
                    }
                    valor={proyectadoPesos ? `$${Math.round(proyectadoPesos.total).toLocaleString("es-CL")}` : "—"}
                    testId="text-obras-proyectado-pesos"
                  />
                </div>

                {/* Sin "Ver más indicadores" ni su panel (Pedidas, Entregadas,
                    Utilizadas, Rendimiento, Saldo, Faltante y Obras por estado):
                    se quitaron a pedido del usuario (oct-2026). */}
              </div>

              {/* Celular: cada obra es una tarjeta (pedido del usuario, oct-2026);
                  en la tabla la columna del proyecto tapaba los números. */}
              {esCelular ? (
                <div className="space-y-3">
                  {filas.map((f, i) => {
                    const expandida = obraExpandida === f.obra.id;
                    return (
                      <TarjetaObra
                        key={f.obra.id}
                        fila={f}
                        indice={i}
                        columnas={columnasVisibles}
                        productos={productosPorObra.get(f.obra.id) ?? []}
                        expandida={expandida}
                        onToggle={() => setObraExpandida(expandida ? null : f.obra.id)}
                        onGuardar={(data) => actualizarObra.mutate({ id: f.obra.id, data })}
                        onEditar={() => abrirEdicion(f.obra)}
                        onEliminar={() => setObraAEliminar(f.obra)}
                      />
                    );
                  })}
                </div>
              ) : (
              /* Tabla de obras */
              <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden">
                {/* Sin barra de título ni botón "Ver planilla completa" (pedido del
                    usuario, oct-2026): la tabla arranca directo en sus columnas. */}
                <div className="overflow-x-auto">
                  {/* Columnas de la hoja "Control General" de la planilla, en
                      bloques: qué obra es → cómo va → cuánto material → qué
                      hago. La primera queda fija al hacer scroll lateral. */}
                  <table className="w-full text-sm min-w-[1180px]">
                    {/* Encabezado en naranjo fuerte con letra blanca (pedido del
                        usuario, oct-2026), igual que la cabecera de la obra en celular. */}
                    <thead className="[&_th]:!text-white [&_th]:!border-white/30">
                      <tr className="bg-[#fd6301]">
                        <th className="sticky left-0 z-10 bg-[#fd6301]" />
                        {grupos.map((g, i) => (
                          <th
                            key={g.label}
                            colSpan={g.span}
                            className={`px-3 pt-2.5 pb-1 text-center text-[9px] uppercase tracking-[0.14em] font-bold whitespace-nowrap ${i > 0 ? BORDE_GRUPO : ""}`}
                          >
                            {g.label}
                          </th>
                        ))}
                        <th />
                      </tr>
                      <tr className="bg-[#fd6301]">
                        <Th className="text-left pl-4 sticky left-0 z-10 bg-[#fd6301] min-w-[270px]">
                          Proyecto
                        </Th>
                        {columnasVisibles.map((c) => (
                          <Th key={c.key} title={c.title} className={`pt-1 ${c.borde ?? ""} ${c.thClassName ?? ""}`}>
                            {c.key === "viv" ? etiquetaUnidades(filas.map((f) => f.obra)) : c.label}
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
                            onGuardar={(data) => actualizarObra.mutate({ id: f.obra.id, data })}
                            onEditar={() => abrirEdicion(f.obra)}
                            onEliminar={() => setObraAEliminar(f.obra)}
                          />
                        );
                      })}
                    </tbody>
                    {/* Sin fila de Total (pedido del usuario, oct-2026). */}
                  </table>
                </div>
              </div>
              )}

              {/* Compras y bitácora de la obra abierta van DEBAJO de la tabla, para
                  que el Total quede pegado a las obras y sus productos (pedido
                  del usuario, oct-2026). */}
              {(() => {
                const abierta = filas.find((f) => f.obra.id === obraExpandida);
                // En celular van dentro de la tarjeta de la obra.
                if (!abierta || esCelular) return null;
                return (
                  // Lado a lado (pedido del usuario, oct-2026): el chat de la
                  // obra a la izquierda, compras y documentos a la derecha.
                  // En celular quedan uno debajo del otro.
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                    <BitacoraObra obraId={abierta.obra.id} obraNombre={abierta.obra.nombre} />
                    <ComprasObra
                      obraId={abierta.obra.id}
                      obraNombre={abierta.obra.nombre}
                      clienteNombre={abierta.obra.clienteNombre}
                    />
                  </div>
                );
              })()}

            </>
          )}
        </>
      )}

      {/* ===================== DIÁLOGOS ===================== */}

      {/* Agregar constructora a la cartera */}
      <Dialog
        open={dialogAgregarCliente}
        onOpenChange={(abierto) => {
          setDialogAgregarCliente(abierto);
          if (!abierto) setAltaTrasElegir(false);
        }}
      >
        <DialogContent className="sm:max-w-[520px] z-[70]" overlayClassName="z-[70]">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </span>
            {altaTrasElegir ? "¿De qué constructora es la obra?" : "Agregar constructora"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {altaTrasElegir
              ? "Elige la constructora y se abre el formulario de la obra."
              : "Busca la constructora en la base de clientes. Después le vas a cargar sus obras."}
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
                    if (altaTrasElegir) {
                      setAltaTrasElegir(false);
                      abrirFormularioObra();
                    }
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
                {/* Vendedor a cargo: define a quién le aparece la obra en su
                    cartera. Solo lo tocan admin y supervisor — el vendedor no ve
                    el campo y la obra que crea queda a su nombre sola. */}
                {mandaEnCartera && (
                  <Campo label="Vendedor a cargo" className="sm:col-span-2">
                    <Select
                      value={form.vendedorId || "__sin"}
                      onValueChange={(v) => setCampo("vendedorId", v === "__sin" ? "" : v)}
                    >
                      <SelectTrigger className={INPUT_FORM} data-testid="select-obra-vendedor">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent className="z-[80]">
                        <SelectItem value="__sin">Sin asignar</SelectItem>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{nombreVendedor(v)}</SelectItem>
                        ))}
                        {/* La obra puede estar a nombre de alguien que ya no
                            está en la lista (cambió de equipo, quedó inactivo):
                            se muestra igual para no reasignarla sin querer. */}
                        {form.vendedorId && !vendedores.some((v) => v.id === form.vendedorId) && (
                          <SelectItem value={form.vendedorId}>Vendedor actual (fuera de la lista)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Campo>
                )}
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

/** Columnas del listado de constructoras: encabezado y filas comparten la grilla. */
const GRID_CONSTRUCTORAS = "lg:grid-cols-[minmax(0,2.6fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_1rem]";

/** Una constructora en el listado de la portada: obras, viviendas, pintadas y avance global. */
function FilaConstructora({ constructora, onAbrir }: { constructora: Constructora; onAbrir: () => void }) {
  const { totales, filas } = constructora;

  return (
    <button
      onClick={onAbrir}
      className={`w-full text-left grid grid-cols-3 ${GRID_CONSTRUCTORAS} items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition-colors group`}
      data-testid={`row-constructora-${constructora.id}`}
    >
      {/* Sin ícono ni línea de detalle bajo el nombre (pedido del usuario, oct-2026). */}
      <div className="col-span-3 lg:col-span-1 min-w-0 text-sm text-slate-800 dark:text-slate-100 leading-tight truncate group-hover:text-orange-600 transition-colors">
        {constructora.nombre}
      </div>

      {/* Solo obras y avance global (pedido del usuario, oct-2026): sin viviendas
          ni pintadas; el detalle se ve al abrir la constructora. */}
      {/* En celular sin rótulos por fila: "2 obras" y la barra en una línea. */}
      <div className="lg:text-center whitespace-nowrap">
        <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmt(filas.length)}</span>
        <span className="lg:hidden text-xs text-slate-500"> {filas.length === 1 ? "obra" : "obras"}</span>
      </div>


      <div className="col-span-2 lg:col-span-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#fd6301]"
              // (Facturado + NVV) ÷ proyectado, igual que dentro de la
              // constructora (pedido del usuario, oct-2026).
              style={{ width: `${Math.round(totales.avanceVenta * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right">
            {fmtPct(totales.avanceVenta)}
          </span>
        </div>
      </div>

      {/* Sin columna de alertas en el listado (pedido del usuario, oct-2026):
          el estado de cada obra se ve al abrir la constructora. */}
      <ChevronRight className="hidden lg:block h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
    </button>
  );
}

/**
 * La obra como tarjeta (celular): nombre arriba, cada columna de la planilla con
 * su nombre debajo, y al abrirla sus productos también como tarjetas.
 */
function TarjetaObra({
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
  onGuardar: (data: Record<string, unknown>) => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const esEdificio = fila.obra.tipoObra === "edificios";
  const torres = toInt(fila.obra.torres);
  const tamano = esEdificio
    ? torres > 0 ? `${fmt(torres)} ${torres === 1 ? "torre" : "torres"}` : "Edificio"
    : `${fmt(fila.viviendas)} viviendas`;

  // Material por formato en una tablita: así las cifras de cada formato quedan
  // alineadas y se comparan de un vistazo (en columnas sueltas no se leían).
  const campos = [
    { campo: "proyectadas" as const, label: "Proy." },
    { campo: "facturadas" as const, label: "Fact." },
    { campo: "nvv" as const, label: "NVV" },
    { campo: "faltante" as const, label: "Por pedir" },
  ];
  const formatos = porFormato(fila.material, "proyectadas")
    .map(({ unidad }) => unidad)
    .filter((u) => campos.some(({ campo }) => (fila.material[u.valor]?.[campo] ?? 0) !== 0));

  // La cabecera de la obra va siempre en naranjo fuerte con letra blanca
  // (pedido del usuario, oct-2026).
  return (
    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 shadow-sm overflow-hidden" data-testid={`card-obra-${fila.obra.id}`}>
      <div className="p-4 bg-[#fd6301]">
        <div className="flex items-start gap-1">
          <button onClick={onToggle} className="flex items-start gap-2 min-w-0 flex-1 text-left" data-testid={`button-abrir-obra-${fila.obra.id}`}>
            <span className="pt-0.5 flex-shrink-0 text-white">
              {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold break-words text-white`}>
                <span className={`text-[11px] font-bold tabular-nums mr-1.5 text-white/60`}>{indice + 1}</span>
                {fila.obra.nombre}
              </span>
              <span className={`block text-xs text-white/85`}>{[fila.obra.ciudad, tamano].filter(Boolean).join(" · ")}</span>
              {/* Avance corto, bajo el nombre (pedido del usuario, oct-2026):
                  (facturado + NVV) ÷ proyectado, igual que en la tabla. */}
              {fila.proyectadas > 0 && (
                <span className="mt-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-24 rounded-full overflow-hidden bg-white/30`}>
                    <span className={`block h-full rounded-full bg-white`} style={{ width: `${Math.round(fila.avanceVenta * 100)}%` }} />
                  </span>
                  <span className={`text-[11px] font-bold tabular-nums text-white`}>{fmtPct(fila.avanceVenta)}</span>
                </span>
              )}
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg flex-shrink-0 text-white/90 hover:text-white hover:bg-white/15`}
            onClick={onEditar}
            aria-label="Editar obra"
            data-testid={`button-editar-obra-${fila.obra.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 rounded-lg flex-shrink-0 text-white/90 hover:text-white hover:bg-white/15`}
            onClick={onEliminar}
            aria-label="Eliminar obra"
            data-testid={`button-eliminar-obra-${fila.obra.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {formatos.length > 0 && (
          <table className="mt-3 w-full text-xs tabular-nums">
            <thead>
              <tr className={`text-[9px] uppercase tracking-wider text-white/75`}>
                <th className="text-left font-bold pb-1" />
                {campos.map(({ label }) => (
                  <th key={label} className="text-right font-bold pb-1 pl-2">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formatos.map((u) => (
                <tr key={u.valor} className={`border-t border-white/25`}>
                  <td className={`py-1.5 text-[10px] uppercase tracking-wide whitespace-nowrap text-white/75`}>{u.corto}</td>
                  {campos.map(({ campo }) => {
                    const v = fila.material[u.valor]?.[campo] ?? 0;
                    return (
                      <td key={campo} className={`py-1.5 pl-2 text-right ${v === 0 ? "text-white/45" : campo === "faltante" ? "font-bold text-white" : "text-white"}`}>
                        {fmtDec(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Abierta: sus productos, y la compra y el chat de ESTA obra, dentro de la
          misma tarjeta y sin fondo de color (pedido del usuario, oct-2026). */}
      {expandida && (
        <div className="px-3 py-3 space-y-3">
          <FilasProductos
            obraId={fila.obra.id}
            viviendas={fila.viviendas}
            pintadasObra={toInt(fila.obra.viviendasPintadas)}
            productos={productos}
            columnas={columnas}
            tarjetas
          />
          <ComprasObra obraId={fila.obra.id} obraNombre={fila.obra.nombre} clienteNombre={fila.obra.clienteNombre} />
          <BitacoraObra obraId={fila.obra.id} obraNombre={fila.obra.nombre} />
        </div>
      )}
    </div>
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
  onGuardar,
  onEditar,
  onEliminar,
}: {
  fila: ObraCalculada;
  indice: number;
  columnas: ColumnaDef[];
  productos: ObraProducto[];
  expandida: boolean;
  onToggle: () => void;
  onGuardar: (data: Record<string, unknown>) => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-slate-100 dark:border-slate-700/40 bg-white dark:bg-slate-800/40 group"
        data-testid={`row-obra-${fila.obra.id}`}
      >
        {/* Solo el nombre abre y cierra la obra (pedido del usuario, oct-2026):
            antes toda la fila lo hacía y un clic en un número —por ejemplo para
            cargar las pintadas— cerraba la obra y la página saltaba. */}
        <td
          onClick={onToggle}
          className="pl-4 py-3 cursor-pointer sticky left-0 z-10 bg-white dark:bg-slate-800/95">
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
              {/* Sin línea de detalle bajo el nombre (pedido del usuario,
                  oct-2026): la ciudad pasó a su propia columna. */}
            </div>
          </div>
        </td>
        {columnas.map((c) => (
          <td
            key={c.key}
            className={`px-2.5 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300 ${c.borde ?? ""}`}
          >
            {c.render(fila, { onGuardar })}
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
            pintadasObra={toInt(fila.obra.viviendasPintadas)}
            productos={productos}
            columnas={columnas}
            sticky
          />
        </>
      )}
    </>
  );
}

/**
 * Valor de una tarjeta. Si trae unidades ("3.617 Balde 4 gl · 0 Galón") el
 * número va grande y la unidad chica al lado, para que el texto no se coma la
 * tarjeta (pedido del usuario, oct-2026). Un valor sin unidad ("1.783", "37%")
 * se ve igual que antes.
 */
function ValorConUnidad({ valor }: { valor: string }) {
  const partes = valor.split(" · ").map((p) => p.match(/^(-?[\d.,]+)\s+(.+)$/));
  if (partes.some((m) => !m)) {
    // Los montos largos ("$206.230.428") bajan de tamaño para no quedar
    // apretados contra el borde de la tarjeta (pedido del usuario, oct-2026).
    const tamano = valor.length > 10 ? "text-lg sm:text-xl" : valor.length > 7 ? "text-xl sm:text-2xl" : "text-2xl";
    return <span className={`${tamano} font-bold tabular-nums leading-none text-[#fd6301]`}>{valor}</span>;
  }
  // Con más de un formato van uno debajo del otro (pedido del usuario,
  // oct-2026): en fila se partían a mitad y no se leían.
  return (
    <div className="flex flex-col items-center sm:items-start gap-1">
      {partes.map((m, i) => (
        <span key={i} className="whitespace-nowrap">
          <span className="text-2xl font-bold tabular-nums leading-none text-[#fd6301]">{m![1]}</span>{" "}
          <span className="text-[11px] font-semibold text-orange-500/80">{m![2]}</span>
        </span>
      ))}
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
  // Mismo molde que las tarjetas del CRM (pedido del usuario, ago-2026): el ícono en
  // negro y suelto arriba, el número grande y, debajo, el nombre del indicador en gris.
  // En celular va todo centrado; en pantalla grande el ícono pasa al costado.
  const contenido = (
    <>
      <span className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 text-slate-900 dark:text-slate-100 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-x-1.5 gap-y-1">
          <ValorConUnidad valor={valor} />
          {sufijo && <span className="text-[11px] font-semibold text-slate-400">{sufijo}</span>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
        {pie}
      </div>
    </>
  );

  const base = "rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/40 p-4 shadow-sm flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-2 sm:gap-3";

  if (!onClick) return <div className={base}>{contenido}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} hover:border-orange-300 dark:hover:border-orange-700 hover:shadow transition-all`}
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
