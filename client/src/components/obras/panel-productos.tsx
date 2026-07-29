/**
 * Los productos de una obra, como filas de la MISMA tabla de obras.
 *
 * Acá vive TODO el control de la obra: por SKU se sigue cuánto se proyectó, se
 * pidió, se entregó y se usó, más el rendimiento declarado y las viviendas que
 * se pintaron con ese producto. Los números de la obra son la suma de estas
 * filas — la tineta de fachada, el sellador y el esmalte de rejas avanzan a
 * ritmos distintos y por eso ya no se controlan como un solo número.
 *
 * Antes esto era un panel con su propia tabla adentro de la fila: dos grillas
 * que no calzaban y las mismas magnitudes con otro nombre. Ahora cada producto
 * es una fila indentada que usa las columnas de la obra (ver columnas.tsx), así
 * que el número del producto cae justo debajo del total al que suma.
 *
 * Está armado para cargar datos seguido, no de una vez:
 *  - se agrega con un buscador de SKU (código, nombre o color) contra el
 *    catálogo real, y el producto entra en la obra con todo en cero;
 *  - las cantidades se editan en la propia celda (Enter o salir guarda);
 *  - los botones + registran un pedido, una entrega o un consumo con su fecha,
 *    que suma al acumulado y queda en el historial de la fila;
 *  - la columna "Rendimiento" contrasta el consumo contra lo declarado, que es
 *    la revisión que se hace en terreno con el bodeguero.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CatalogoObraItem, ObraProducto, ObraProductoMovimiento } from "@shared/schema";
import { ChevronDown, ChevronRight, Clock, Loader2, PenLine, Plus, Trash2 } from "lucide-react";
import { fmtDec, toNum } from "./formato";
import { calcularProducto } from "./calculos";
import type { CeldaProducto, ColumnaDef } from "./columnas";
import { InputCantidad, MOV_MAP, TextoEditable, type TipoMovimiento } from "./celdas";

// Unidades de despacho que se usan en obra. La tineta (5 gl) es la unidad de la
// planilla; el resto aparece cuando la obra lleva sellador, esmalte, diluyente…
const UNIDADES = ["tineta", "galón", "litro", "kilo", "unidad"];

/** La unidad del catálogo viene como texto libre ("TINETA 5 GL", "GALON"). */
function unidadDesdeCatalogo(unidad: string | null | undefined): string {
  const u = (unidad ?? "").toLowerCase();
  if (u.includes("tineta")) return "tineta";
  if (u.includes("gal")) return "galón";
  if (u.includes("lit") || u.startsWith("lt")) return "litro";
  if (u.includes("kil") || u.startsWith("kg")) return "kilo";
  return u ? "unidad" : "tineta";
}

/** "0,8 galones por vivienda" — el plural a mano, que en español no es solo +s. */
const PLURAL: Record<string, string> = {
  tineta: "tinetas",
  "galón": "galones",
  litro: "litros",
  kilo: "kilos",
  unidad: "unidades",
};

const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(`${valor.slice(0, 10)}T12:00:00`) : new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

// Fondos de las filas de producto. Van más claras que la obra y con la línea del
// árbol a la izquierda: se leen como hijas de la fila de arriba.
const FONDO_FILA = "bg-orange-50/30 dark:bg-orange-950/[0.08] hover:bg-orange-50/70 dark:hover:bg-orange-950/20";
const FONDO_STICKY = "bg-[#fff7f1] dark:bg-slate-800/95";

// ---------------------------------------------------------------------------
// Filas de producto de una obra
// ---------------------------------------------------------------------------

export function FilasProductos({
  obraId,
  viviendas,
  productos,
  columnas,
  /** La primera columna queda fija al hacer scroll lateral (tabla de la planilla). */
  sticky = false,
}: {
  obraId: string;
  viviendas: number;
  productos: ObraProducto[];
  columnas: ColumnaDef[];
  sticky?: boolean;
}) {
  const { toast } = useToast();
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
  };

  const agregar = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("/api/obra-productos", { method: "POST", data });
      return res.json();
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Producto agregado a la obra" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo agregar el producto", description: error?.message, variant: "destructive" });
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/obra-productos/${id}`, { method: "PUT", data });
      return res.json();
    },
    onSuccess: invalidar,
    onError: (error: any) => {
      toast({ title: "No se pudo guardar el cambio", description: error?.message, variant: "destructive" });
      invalidar(); // devuelve la celda al valor de la base
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obra-productos/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      invalidar();
      toast({ title: "Producto quitado de la obra" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo quitar el producto", description: error?.message, variant: "destructive" });
    },
  });

  const registrarMovimiento = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/obra-productos/${id}/movimientos`, { method: "POST", data });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidar();
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos/movimientos"] });
      const mov = MOV_MAP[vars.data.tipo as TipoMovimiento];
      toast({ title: `${mov?.label ?? "Movimiento"} registrado` });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo registrar el movimiento", description: error?.message, variant: "destructive" });
    },
  });

  const elegirDelCatalogo = (item: CatalogoObraItem) => {
    agregar.mutate({
      obraId,
      kopr: item.sku || null,
      nombre: item.nombre,
      color: item.color || null,
      unidad: unidadDesdeCatalogo(item.unidad),
      cantidadProyectada: "0",
      cantidadPedida: "0",
      cantidadEntregada: "0",
      cantidadUtilizada: "0",
    });
  };

  const agregarAMano = (nombre: string) => {
    agregar.mutate({
      obraId,
      kopr: null,
      nombre,
      color: null,
      unidad: "tineta",
      cantidadProyectada: "0",
      cantidadPedida: "0",
      cantidadEntregada: "0",
      cantidadUtilizada: "0",
    });
  };

  const colSpan = columnas.length + 2;

  return (
    <>
      {productos.map((producto) => (
        <FilaProducto
          key={producto.id}
          producto={producto}
          viviendas={viviendas}
          columnas={columnas}
          sticky={sticky}
          colSpan={colSpan}
          abierta={filaAbierta === producto.id}
          onToggle={() => setFilaAbierta(filaAbierta === producto.id ? null : producto.id)}
          onGuardar={(data) => actualizar.mutate({ id: producto.id, data })}
          onEliminar={() => eliminar.mutate(producto.id)}
          onMovimiento={(data) => registrarMovimiento.mutate({ id: producto.id, data })}
          registrando={registrarMovimiento.isPending}
        />
      ))}

      {/* Última fila: agregar un producto más. Queda al pie de los que ya están
          cargados, que es donde uno mira después de revisar la lista. */}
      <tr className={`border-b border-slate-100 dark:border-slate-700/40 ${FONDO_FILA}`}>
        <td
          colSpan={colSpan}
          className="pl-4 pr-4 py-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* La fila cruza toda la tabla, así que el buscador se queda pegado a
              la izquierda aunque se scrollee de lado. */}
          <div className="sticky left-0 w-fit flex flex-wrap items-center gap-x-3 gap-y-2 pl-5">
            <div className="w-full sm:w-[340px]">
              <BuscadorCatalogo
                onElegir={elegirDelCatalogo}
                onManual={agregarAMano}
                guardando={agregar.isPending}
              />
            </div>
            <span className="text-[11px] text-slate-400">
              {productos.length === 0
                ? "Cargá los productos de la obra: la fachada, el sellador, el esmalte de rejas… Los números de la obra son la suma de ellos."
                : "Busca por SKU, nombre o color."}
            </span>
          </div>
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Una fila de producto
// ---------------------------------------------------------------------------

function FilaProducto({
  producto,
  viviendas,
  columnas,
  sticky,
  colSpan,
  abierta,
  onToggle,
  onGuardar,
  onEliminar,
  onMovimiento,
  registrando,
}: {
  producto: ObraProducto;
  viviendas: number;
  columnas: ColumnaDef[];
  sticky: boolean;
  colSpan: number;
  abierta: boolean;
  onToggle: () => void;
  onGuardar: (data: Record<string, unknown>) => void;
  onEliminar: () => void;
  onMovimiento: (data: Record<string, unknown>) => void;
  registrando: boolean;
}) {
  const calc = calcularProducto(producto);
  const ctx: CeldaProducto = { producto, calc, viviendas, onGuardar, onMovimiento, registrando };

  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-700/40 transition-colors group/prod ${FONDO_FILA}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={`row-obra-producto-${producto.id}`}
      >
        <td
          className={`pl-4 py-2 align-top ${sticky ? `sticky left-0 z-10 ${FONDO_STICKY}` : ""}`}
        >
          <div className="flex items-start gap-1.5">
            {/* Codo del árbol: la fila se lee como hija de la obra de arriba. */}
            <span
              className="mt-2 ml-3 h-3 w-3 border-l-2 border-b-2 border-orange-200 dark:border-orange-900/60 rounded-bl-[4px] flex-shrink-0"
              aria-hidden
            />
            <button
              onClick={onToggle}
              className="mt-1 text-slate-300 dark:text-slate-600 hover:text-orange-500 transition-colors flex-shrink-0"
              aria-label="Ver rendimiento, notas y movimientos"
              data-testid={`button-historial-${producto.id}`}
            >
              {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0">
              {/* Los nombres del catálogo son largos ("LATEX SUPERCUBRIENTE
                  BLANCO TINETA"): la celda se estira y el título muestra el
                  nombre completo al pasar por encima. */}
              <TextoEditable
                valor={producto.nombre}
                onGuardar={(v) => v && onGuardar({ nombre: v })}
                title={producto.nombre}
                className="text-sm font-medium text-slate-700 dark:text-slate-100 w-[205px]"
                testId={`input-nombre-${producto.id}`}
              />
              {/* Color, unidad y SKU son la identidad del producto, no números:
                  van acá y no ocupando columnas de la planilla. */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400 w-[205px]">
                <TextoEditable
                  valor={producto.color ?? ""}
                  onGuardar={(v) => onGuardar({ color: v || null })}
                  placeholder="+ color"
                  className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 w-[74px] flex-shrink-0"
                  testId={`input-color-${producto.id}`}
                />
                <Select value={producto.unidad ?? "tineta"} onValueChange={(v) => onGuardar({ unidad: v })}>
                  <SelectTrigger
                    className="h-5 w-[64px] flex-shrink-0 rounded-md border-transparent bg-transparent px-1 text-[10px] hover:border-slate-200 dark:hover:border-slate-700 focus:ring-orange-400/20 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:opacity-40"
                    data-testid={`select-unidad-${producto.id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[80]">
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {producto.kopr ? (
                  <span className="font-bold tabular-nums truncate">{producto.kopr}</span>
                ) : (
                  <span className="italic truncate">sin SKU</span>
                )}
              </div>
            </div>
          </div>
        </td>

        {columnas.map((c) => (
          <td
            key={c.key}
            className={`px-2.5 py-2 text-center tabular-nums text-slate-600 dark:text-slate-300 ${c.borde ?? ""}`}
          >
            {c.renderProducto ? c.renderProducto(ctx) : null}
          </td>
        ))}

        <td className="pr-4 py-2">
          <div className="flex items-center justify-end opacity-0 group-hover/prod:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={onEliminar}
              aria-label="Quitar producto"
              data-testid={`button-eliminar-obra-producto-${producto.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {abierta && (
        <tr className="border-b border-slate-100 dark:border-slate-700/40 bg-slate-50/70 dark:bg-slate-900/40">
          <td colSpan={colSpan} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <DetalleProducto producto={producto} onGuardar={onGuardar} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Rendimiento declarado, notas y el historial de movimientos del producto. */
function DetalleProducto({
  producto,
  onGuardar,
}: {
  producto: ObraProducto;
  onGuardar: (data: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();

  const { data: movimientos = [], isLoading } = useQuery<ObraProductoMovimiento[]>({
    queryKey: ["/api/obra-productos/movimientos", producto.id],
    queryFn: async () => {
      const res = await apiRequest(`/api/obra-productos/movimientos?obraProductoId=${encodeURIComponent(producto.id)}`);
      return res.json();
    },
  });

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/obra-productos/movimientos/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/obra-productos/movimientos"] });
      toast({ title: "Movimiento deshecho" });
    },
    onError: (error: any) => {
      toast({ title: "No se pudo deshacer el movimiento", description: error?.message, variant: "destructive" });
    },
  });

  return (
    // Ancho acotado y pegado a la izquierda: el detalle no tiene que ensanchar
    // la tabla ni irse de pantalla cuando se scrollea de lado.
    <div className="sticky left-0 w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-4 pl-6">
      {/* El rendimiento declarado se carga una vez por producto: es un dato de
          setup, no del día a día, así que vive acá y no ocupa una columna. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
          Rendimiento declarado
        </div>
        <div className="flex items-center gap-1.5">
          <InputCantidad
            valor={producto.rendimientoPorVivienda}
            onGuardar={(v) => onGuardar({ rendimientoPorVivienda: v })}
            testId={`input-rendimiento-${producto.id}`}
          />
          <span className="text-xs text-slate-400">
            {PLURAL[producto.unidad ?? "tineta"] ?? "unidades"} por vivienda
          </span>
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">Notas del producto</div>
        <TextoEditable
          valor={producto.notas ?? ""}
          onGuardar={(v) => onGuardar({ notas: v || null })}
          placeholder="Anota acá lo que no cabe en la tabla…"
          className="text-sm text-slate-600 dark:text-slate-300 w-full"
          testId={`input-notas-${producto.id}`}
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
          <Clock className="h-3 w-3" />
          Movimientos
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
          </div>
        ) : movimientos.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">
            Todavía no hay movimientos. Los botones + de la fila registran cada pedido, entrega y consumo con su fecha.
          </p>
        ) : (
          <ul className="space-y-1">
            {movimientos.map((m) => {
              const def = MOV_MAP[m.tipo as TipoMovimiento];
              const Icono = def?.icono ?? Clock;
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1 hover:bg-white dark:hover:bg-slate-800/60 transition-colors group/mov"
                  data-testid={`row-movimiento-${m.id}`}
                >
                  <Icono className={`h-3.5 w-3.5 flex-shrink-0 ${def?.clase.split(" ")[0] ?? "text-slate-400"}`} />
                  <span className="font-semibold w-16 flex-shrink-0">{def?.label ?? m.tipo}</span>
                  <span className="font-bold tabular-nums w-12 text-right flex-shrink-0">{fmtDec(toNum(m.cantidad))}</span>
                  <span className="text-slate-400 tabular-nums flex-shrink-0">{fmtFecha(m.fecha ?? m.createdAt)}</span>
                  {m.nota && <span className="truncate text-slate-400">{m.nota}</span>}
                  <button
                    onClick={() => borrar.mutate(m.id)}
                    className="ml-auto text-slate-300 hover:text-red-600 opacity-0 group-hover/mov:opacity-100 transition-opacity flex-shrink-0"
                    aria-label="Deshacer movimiento"
                    data-testid={`button-deshacer-movimiento-${m.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buscador del catálogo (SKU / nombre / color)
// ---------------------------------------------------------------------------

function BuscadorCatalogo({
  onElegir,
  onManual,
  guardando,
}: {
  onElegir: (item: CatalogoObraItem) => void;
  onManual: (nombre: string) => void;
  guardando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [termino, setTermino] = useState("");
  const [abierto, setAbierto] = useState(false);

  // La búsqueda pega contra tres maestros: no vale la pena dispararla en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setTermino(texto.trim()), 250);
    return () => clearTimeout(t);
  }, [texto]);

  const { data: resultados = [], isFetching } = useQuery<CatalogoObraItem[]>({
    queryKey: ["/api/obra-productos/catalogo", termino],
    queryFn: async () => {
      const res = await apiRequest(`/api/obra-productos/catalogo?q=${encodeURIComponent(termino)}`);
      return res.json();
    },
    enabled: termino.length >= 2,
  });

  const elegir = (item: CatalogoObraItem) => {
    onElegir(item);
    setTexto("");
    setTermino("");
    setAbierto(false);
  };

  const manual = () => {
    const nombre = texto.trim();
    if (!nombre) return;
    onManual(nombre);
    setTexto("");
    setTermino("");
    setAbierto(false);
  };

  // El buscador vive dentro de una tabla con scroll horizontal, y un desplegable
  // posicionado en el flujo queda recortado por ese contenedor (se veía cortado
  // por abajo). Va en un popover, que se renderiza en un portal fuera de la
  // tabla; el ancla es el input para que quede pegado y del mismo ancho.
  return (
    <Popover open={abierto && texto.trim().length >= 2} onOpenChange={setAbierto}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
          <Input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            placeholder="Agregar producto por SKU, nombre o color…"
            className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20"
            data-testid="input-obra-producto-buscar"
          />
          {(isFetching || guardando) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        // El foco se queda en el input: se sigue escribiendo para filtrar.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px] max-h-72 overflow-y-auto rounded-2xl border-slate-200/80 dark:border-slate-700 z-[80]"
      >
        {resultados.map((item) => (
          <button
            key={item.sku}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir(item)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-orange-50/60 dark:hover:bg-orange-950/20 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
            data-testid={`option-catalogo-${item.sku}`}
          >
            <span
              className="w-4 h-4 rounded-full border border-slate-200 dark:border-slate-600 flex-shrink-0"
              style={{ background: item.hex || "linear-gradient(135deg,#f1f5f9,#cbd5e1)" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {item.nombre}
              </span>
              <span className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="font-bold tabular-nums">{item.sku}</span>
                {item.color && <span className="uppercase tracking-wide">{item.color}</span>}
                {item.unidad && <span className="truncate">{item.unidad}</span>}
              </span>
            </span>
          </button>
        ))}

        {resultados.length === 0 && !isFetching && (
          <div className="px-3 py-2.5 text-sm text-slate-400">Sin resultados en el catálogo.</div>
        )}

        {/* Tonos de tintometría y productos que todavía no están en el maestro. */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={manual}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
          data-testid="button-catalogo-manual"
        >
          <PenLine className="h-3.5 w-3.5 flex-shrink-0" />
          Agregar «{texto.trim()}» a mano
        </button>
      </PopoverContent>
    </Popover>
  );
}
