/**
 * Detalle POR PRODUCTO de una obra — el panel que se despliega en cada fila de
 * la pestaña Obras.
 *
 * Es un control aparte del de tinetas de la planilla: acá se sigue, por SKU,
 * cuánto se proyectó, se pidió, se entregó y se usó, para las obras donde
 * además de la tineta de fachada van sellador, esmalte de rejas, diluyente…
 * Los totales de la obra NO se derivan de esta tabla.
 *
 * Está armado para cargar datos seguido, no de una vez:
 *  - se agrega con un buscador de SKU (código, nombre o color) contra el
 *    catálogo real, y el producto entra en la obra con todo en cero;
 *  - las cantidades se editan en la propia celda (Enter o salir guarda);
 *  - los botones + registran un pedido, una entrega o un consumo con su fecha,
 *    que suma al acumulado y queda en el historial de la fila.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CatalogoObraItem, ObraProducto, ObraProductoMovimiento } from "@shared/schema";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Paintbrush,
  PenLine,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { fmtDec, numeroEditable, toNum } from "./formato";

// Unidades de despacho que se usan en obra. La tineta (5 gl) es la unidad de la
// planilla; el resto aparece cuando la obra lleva sellador, esmalte, diluyente…
const UNIDADES = ["tineta", "galón", "litro", "kilo", "unidad"];

type TipoMovimiento = "pedido" | "entrega" | "consumo";

const MOVIMIENTOS: Array<{
  tipo: TipoMovimiento;
  label: string;
  accion: string;
  icono: typeof ShoppingCart;
  clase: string;
}> = [
  { tipo: "pedido", label: "Pedido", accion: "Registrar pedido", icono: ShoppingCart, clase: "text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30" },
  { tipo: "entrega", label: "Entrega", accion: "Registrar entrega", icono: Truck, clase: "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30" },
  { tipo: "consumo", label: "Consumo", accion: "Registrar consumo en obra", icono: Paintbrush, clase: "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30" },
];

const MOV_MAP = Object.fromEntries(MOVIMIENTOS.map((m) => [m.tipo, m])) as Record<TipoMovimiento, (typeof MOVIMIENTOS)[number]>;

/** La unidad del catálogo viene como texto libre ("TINETA 5 GL", "GALON"). */
function unidadDesdeCatalogo(unidad: string | null | undefined): string {
  const u = (unidad ?? "").toLowerCase();
  if (u.includes("tineta")) return "tineta";
  if (u.includes("gal")) return "galón";
  if (u.includes("lit") || u.startsWith("lt")) return "litro";
  if (u.includes("kil") || u.startsWith("kg")) return "kilo";
  return u ? "unidad" : "tineta";
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtFecha = (valor: string | Date | null | undefined) => {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(`${valor.slice(0, 10)}T12:00:00`) : new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CL");
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function PanelProductos({
  obraId,
  obraNombre,
  obraCiudad,
  productos,
}: {
  obraId: string;
  obraNombre: string;
  /** Se muestra en el encabezado para amarrar el panel a su obra. */
  obraCiudad?: string | null;
  productos: ObraProducto[];
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

  return (
    <div className="rounded-2xl border border-orange-200/70 dark:border-orange-900/40 border-l-4 border-l-[#fd6301] bg-white dark:bg-slate-800/60 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-orange-50/70 dark:bg-orange-950/20 border-b border-orange-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#fd6301] text-white flex items-center justify-center flex-shrink-0">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-100 truncate">{obraNombre}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-orange-600/80 dark:text-orange-400/80 truncate">
              Detalle por producto
              {obraCiudad ? ` · ${obraCiudad}` : ""}
              {productos.length > 0 ? ` · ${productos.length} ${productos.length === 1 ? "producto" : "productos"}` : ""}
            </div>
          </div>
        </div>
        <div className="sm:ml-auto w-full sm:w-[340px]">
          <BuscadorCatalogo
            onElegir={elegirDelCatalogo}
            onManual={agregarAMano}
            guardando={agregar.isPending}
          />
        </div>
      </div>

      {productos.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          Sin productos cargados. Busca el SKU o el color arriba para seguir el despacho producto por producto
          (tinetas de fachada, sellador, esmalte…).
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/70 dark:border-slate-700/60">
                <Th className="text-left pl-4 min-w-[240px]">Producto</Th>
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
              {productos.map((p) => (
                <FilaProducto
                  key={p.id}
                  producto={p}
                  abierta={filaAbierta === p.id}
                  onToggle={() => setFilaAbierta(filaAbierta === p.id ? null : p.id)}
                  onGuardar={(data) => actualizar.mutate({ id: p.id, data })}
                  onEliminar={() => eliminar.mutate(p.id)}
                  onMovimiento={(data) => registrarMovimiento.mutate({ id: p.id, data })}
                  registrando={registrarMovimiento.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
      <Input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Agregar producto o color por SKU…"
        className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-orange-400 focus:ring-orange-400/20"
        data-testid="input-obra-producto-buscar"
      />
      {(isFetching || guardando) && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-300" />
      )}

      {abierto && texto.trim().length >= 2 && (
        <div className="absolute z-[60] left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-72 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila de producto
// ---------------------------------------------------------------------------

function FilaProducto({
  producto,
  abierta,
  onToggle,
  onGuardar,
  onEliminar,
  onMovimiento,
  registrando,
}: {
  producto: ObraProducto;
  abierta: boolean;
  onToggle: () => void;
  onGuardar: (data: Record<string, unknown>) => void;
  onEliminar: () => void;
  onMovimiento: (data: Record<string, unknown>) => void;
  registrando: boolean;
}) {
  const proyectada = toNum(producto.cantidadProyectada);
  const pedida = toNum(producto.cantidadPedida);
  const entregada = toNum(producto.cantidadEntregada);
  const utilizada = toNum(producto.cantidadUtilizada);
  const porPedir = Math.max(0, proyectada - pedida);
  const saldo = entregada - utilizada;

  return (
    <>
      <tr
        className="border-b border-slate-100 dark:border-slate-700/40 last:border-0 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors group/prod"
        data-testid={`row-obra-producto-${producto.id}`}
      >
        <td className="pl-4 py-2">
          <div className="flex items-start gap-2">
            <button
              onClick={onToggle}
              className="text-slate-300 dark:text-slate-600 hover:text-orange-500 transition-colors pt-0.5 flex-shrink-0"
              aria-label="Ver movimientos"
              data-testid={`button-historial-${producto.id}`}
            >
              {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0">
              <TextoEditable
                valor={producto.nombre}
                onGuardar={(v) => v && onGuardar({ nombre: v })}
                className="font-semibold text-slate-700 dark:text-slate-100 max-w-[240px]"
                testId={`input-nombre-${producto.id}`}
              />
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                {producto.kopr ? (
                  <span className="font-bold tabular-nums">{producto.kopr}</span>
                ) : (
                  <span className="italic">sin SKU</span>
                )}
                {producto.notas && <span className="truncate max-w-[180px]">{producto.notas}</span>}
              </div>
            </div>
          </div>
        </td>

        <td className="px-3 py-2 text-center">
          <TextoEditable
            valor={producto.color ?? ""}
            onGuardar={(v) => onGuardar({ color: v || null })}
            placeholder="—"
            className="text-slate-600 dark:text-slate-300 text-center max-w-[110px] mx-auto"
            testId={`input-color-${producto.id}`}
          />
        </td>

        <td className="px-3 py-2 text-center">
          <Select value={producto.unidad ?? "tineta"} onValueChange={(v) => onGuardar({ unidad: v })}>
            <SelectTrigger
              className="h-7 w-[92px] mx-auto rounded-lg border-transparent bg-transparent text-xs hover:border-slate-200 dark:hover:border-slate-700 focus:ring-orange-400/20 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40"
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
        </td>

        <CeldaCantidad
          valor={producto.cantidadProyectada}
          onGuardar={(v) => onGuardar({ cantidadProyectada: v })}
          testId={`input-proyectada-${producto.id}`}
        />

        <CeldaCantidad
          valor={producto.cantidadPedida}
          onGuardar={(v) => onGuardar({ cantidadPedida: v })}
          testId={`input-pedida-${producto.id}`}
          movimiento={{ tipo: "pedido", sugerido: porPedir, onRegistrar: onMovimiento, registrando }}
        />

        <Td className={porPedir > 0 ? "font-bold text-orange-600 dark:text-orange-400" : ""}>{fmtDec(porPedir)}</Td>

        <CeldaCantidad
          valor={producto.cantidadEntregada}
          onGuardar={(v) => onGuardar({ cantidadEntregada: v })}
          testId={`input-entregada-${producto.id}`}
          movimiento={{ tipo: "entrega", sugerido: Math.max(0, pedida - entregada), onRegistrar: onMovimiento, registrando }}
        />

        <CeldaCantidad
          valor={producto.cantidadUtilizada}
          onGuardar={(v) => onGuardar({ cantidadUtilizada: v })}
          testId={`input-utilizada-${producto.id}`}
          movimiento={{ tipo: "consumo", sugerido: 0, onRegistrar: onMovimiento, registrando }}
        />

        <Td className={saldo < 0 ? "text-red-600 dark:text-red-400 font-bold" : ""}>{fmtDec(saldo)}</Td>

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
          <td colSpan={10} className="px-4 py-3">
            <DetalleProducto producto={producto} onGuardar={onGuardar} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Notas del producto + historial de sus movimientos. */
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
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
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
// Celdas editables
// ---------------------------------------------------------------------------

/** Cantidad editable en la propia celda, con el botón de movimiento al lado. */
function CeldaCantidad({
  valor,
  onGuardar,
  testId,
  movimiento,
}: {
  valor: string | number | null;
  onGuardar: (valor: string) => void;
  testId: string;
  movimiento?: {
    tipo: TipoMovimiento;
    sugerido: number;
    onRegistrar: (data: Record<string, unknown>) => void;
    registrando: boolean;
  };
}) {
  const [texto, setTexto] = useState(() => numeroEditable(valor));
  const [editando, setEditando] = useState(false);

  // Mientras no se esté escribiendo, la celda sigue a la base (un movimiento
  // registrado desde el botón + cambia el número sin tocar el input).
  useEffect(() => {
    if (!editando) setTexto(numeroEditable(valor));
  }, [valor, editando]);

  const confirmar = () => {
    setEditando(false);
    const nuevo = toNum(texto);
    if (nuevo === toNum(valor)) {
      setTexto(numeroEditable(valor));
      return;
    }
    onGuardar(String(nuevo));
  };

  return (
    <td className="px-1.5 py-2">
      <div className="flex items-center justify-center gap-0.5">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setEditando(true)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setTexto(numeroEditable(valor));
              setEditando(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          inputMode="decimal"
          placeholder="0"
          className="w-14 h-7 rounded-lg border border-transparent bg-transparent text-center text-sm tabular-nums text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-colors"
          data-testid={testId}
        />
        {movimiento && <BotonMovimiento {...movimiento} />}
      </div>
    </td>
  );
}

/** Texto editable en línea (nombre, color, notas). */
function TextoEditable({
  valor,
  onGuardar,
  placeholder,
  className = "",
  testId,
}: {
  valor: string;
  onGuardar: (valor: string) => void;
  placeholder?: string;
  className?: string;
  testId: string;
}) {
  const [texto, setTexto] = useState(valor);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(valor);
  }, [valor, editando]);

  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={() => setEditando(true)}
      onBlur={() => {
        setEditando(false);
        const limpio = texto.trim();
        if (limpio !== (valor ?? "").trim()) onGuardar(limpio);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setTexto(valor);
          setEditando(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      className={`h-6 rounded-md border border-transparent bg-transparent px-1 text-sm hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-colors ${className}`}
      data-testid={testId}
    />
  );
}

/** Botón + de la celda: registra un pedido, una entrega o un consumo. */
function BotonMovimiento({
  tipo,
  sugerido,
  onRegistrar,
  registrando,
}: {
  tipo: TipoMovimiento;
  sugerido: number;
  onRegistrar: (data: Record<string, unknown>) => void;
  registrando: boolean;
}) {
  const def = MOV_MAP[tipo];
  const Icono = def.icono;
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Al abrir, propone lo que falta (lo pendiente por pedir o por entregar).
  useEffect(() => {
    if (!abierto) return;
    setCantidad(sugerido > 0 ? numeroEditable(sugerido) : "");
    setFecha(hoyISO());
    setNota("");
    const t = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, [abierto, sugerido]);

  const registrar = () => {
    const n = toNum(cantidad);
    if (n === 0) return;
    onRegistrar({ tipo, cantidad: String(n), fecha: fecha || null, nota: nota.trim() || null });
    setAbierto(false);
  };

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          className={`h-6 w-6 rounded-md flex items-center justify-center text-slate-300 opacity-0 group-hover/prod:opacity-100 focus:opacity-100 transition-all ${def.clase} ${abierto ? "opacity-100" : ""}`}
          aria-label={def.accion}
          data-testid={`button-movimiento-${tipo}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 p-3 rounded-2xl z-[80]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-200 mb-2.5">
          <Icono className={`h-4 w-4 ${def.clase.split(" ")[0]}`} />
          {def.accion}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && registrar()}
              inputMode="decimal"
              placeholder="Cantidad"
              className="h-8 rounded-lg text-sm"
              data-testid={`input-movimiento-cantidad-${tipo}`}
            />
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 rounded-lg text-xs w-[132px]"
              data-testid={`input-movimiento-fecha-${tipo}`}
            />
          </div>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && registrar()}
            placeholder="Nota (guía, OC…)"
            className="h-8 rounded-lg text-sm"
            data-testid={`input-movimiento-nota-${tipo}`}
          />
          <Button
            onClick={registrar}
            disabled={toNum(cantidad) === 0 || registrando}
            className="w-full h-8 rounded-lg bg-gradient-to-r from-orange-500 to-[#fd6301] hover:from-[#e35400] hover:to-[#e35400] text-white text-xs font-semibold"
            data-testid={`button-movimiento-guardar-${tipo}`}
          >
            {registrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Sumar al {def.label.toLowerCase()}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Celdas de tabla
// ---------------------------------------------------------------------------

function Th({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <th
      title={title}
      className={`px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-300 ${className}`}>{children}</td>;
}
