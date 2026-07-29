/**
 * Celdas de las tablas de Obras.
 *
 * La obra y sus productos se leen en la MISMA tabla (la obra es el total, sus
 * productos las filas de abajo), así que las celdas tienen que verse igual en
 * los dos niveles: mismo ancho, mismo formato de número, misma alineación. Por
 * eso viven acá y no dentro de una tabla en particular.
 *
 * Dos reglas que se repiten en todas:
 *  - un cero no es un dato: va en gris claro para que los números que sí
 *    importan salten a la vista en una tabla llena de columnas;
 *  - las celdas del producto se editan en el lugar (Enter o salir guarda) y
 *    llevan el botón + que registra el movimiento con su fecha.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, CheckCircle2, Loader2, Paintbrush, Plus, ShoppingCart, Truck } from "lucide-react";
import { fmt, fmtDec, fmtPct, numeroEditable, toNum } from "./formato";
import { ESTADO_MAP, fmtDesviacion, type EstadoObra } from "./calculos";

// ---------------------------------------------------------------------------
// Movimientos (pedido / entrega / consumo)
// ---------------------------------------------------------------------------

export type TipoMovimiento = "pedido" | "entrega" | "consumo";

export const MOVIMIENTOS: Array<{
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

export const MOV_MAP = Object.fromEntries(MOVIMIENTOS.map((m) => [m.tipo, m])) as Record<
  TipoMovimiento,
  (typeof MOVIMIENTOS)[number]
>;

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Encabezados y celdas base
// ---------------------------------------------------------------------------

export function Th({
  children,
  className = "",
  title,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <th
      title={title}
      colSpan={colSpan}
      className={`px-2.5 py-2.5 text-center text-[10px] uppercase tracking-wider font-bold text-slate-400 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300 ${className}`}>{children}</td>;
}

/** Separador vertical entre bloques de columnas (Avance | Material | Decisión). */
export const BORDE_GRUPO = "border-l border-slate-200/60 dark:border-slate-700/40";

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * Número de la tabla. El cero se apaga: con 15 columnas, dejar todos los ceros
 * en el mismo tono que los datos hace que no se vea nada.
 */
export function Numero({
  valor,
  entero = false,
  className = "",
  title,
}: {
  valor: number;
  entero?: boolean;
  className?: string;
  title?: string;
}) {
  const vacio = valor === 0;
  return (
    <span
      title={title}
      className={`tabular-nums ${vacio ? "text-slate-300 dark:text-slate-600" : className}`}
    >
      {entero ? fmt(valor) : fmtDec(valor)}
    </span>
  );
}

export function SinDato({ title }: { title?: string }) {
  return (
    <span className="text-slate-300 dark:text-slate-600" title={title}>
      —
    </span>
  );
}

/** Barra de avance. Sin viviendas cargadas no hay porcentaje que mostrar. */
export function BarraAvance({ avance, hayDato }: { avance: number; hayDato: boolean }) {
  if (!hayDato) return <SinDato title="Falta el total de viviendas de la obra" />;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden min-w-[52px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-[#fd6301]"
          style={{ width: `${Math.round(avance * 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-300 w-9 text-right">
        {fmtPct(avance)}
      </span>
    </div>
  );
}

/**
 * Cuánto se está desviando el consumo real del rendimiento declarado.
 *
 * Es el reemplazo del viejo "teórico vs real": el número suelto no decía nada,
 * lo que se necesita saber en terreno es si el producto está rindiendo lo que
 * se prometió. Verde = rinde igual o mejor; rojo = se está gastando de más.
 */
export function BadgeDesviacion({
  desviacion,
  hayDato,
  detalle,
}: {
  desviacion: number;
  hayDato: boolean;
  /** Texto extra para el tooltip: "rinde 1,8 y se declaró 1,5". */
  detalle?: string;
}) {
  if (!hayDato) return <SinDato title="Falta el rendimiento declarado o las viviendas pintadas" />;
  // Hasta un 5% es ruido de medición (casas a medio pintar, tinetas abiertas).
  const alerta = desviacion > 0.05;
  const bien = desviacion < -0.05;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
        alerta
          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          : bien
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
      }`}
      title={
        detalle ??
        (alerta
          ? "Se está consumiendo más de lo declarado"
          : bien
            ? "Está rindiendo mejor de lo declarado"
            : "Consume lo declarado")
      }
    >
      {fmtDesviacion(desviacion)}
    </span>
  );
}

export function BadgeEstado({ estado }: { estado: EstadoObra }) {
  const est = ESTADO_MAP[estado];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${est.badge}`}>
      {estado === "terminado" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
      )}
      {est.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Edición en la celda
// ---------------------------------------------------------------------------

/**
 * Cantidad editable en la propia celda, con el botón de movimiento al lado.
 * Devuelve el CONTENIDO de la celda (no el <td>) para que la fila del producto
 * y la de la obra usen exactamente la misma columna.
 */
export function InputCantidad({
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
        className="w-14 h-7 rounded-lg border border-transparent bg-transparent text-center text-sm tabular-nums text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-colors"
        data-testid={testId}
      />
      {movimiento && <BotonMovimiento {...movimiento} />}
    </div>
  );
}

/** Texto editable en línea (nombre, color, notas). */
export function TextoEditable({
  valor,
  onGuardar,
  placeholder,
  className = "",
  title,
  testId,
}: {
  valor: string;
  onGuardar: (valor: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
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
      title={title}
      className={`h-6 rounded-md border border-transparent bg-transparent px-1 hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-colors ${className}`}
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
