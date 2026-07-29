/**
 * Columnas de la tabla de Obras — UNA definición para los dos niveles.
 *
 * Antes había dos tablas: la de obras y, al desplegar una fila, otra tabla
 * aparte con el detalle por producto. Eran las mismas magnitudes con otros
 * nombres ("Proyectadas" vs "Proyectado", "Próx. pedido" vs "Por pedir") y
 * columnas que no calzaban, así que había que volver a leer los encabezados en
 * cada nivel. Ahora cada columna sabe dibujarse en los dos:
 *
 *   render          → la celda de la obra (el total de sus productos)
 *   renderProducto  → la celda de uno de sus productos, editable
 *
 * y los productos se muestran como filas indentadas de la MISMA tabla, así el
 * número del producto queda justo debajo del total de la obra.
 *
 * Las columnas van en cuatro bloques, que es el orden en que se lee la
 * planilla: qué obra es → cómo va → cuánto material → qué hago.
 */
import type { ObraProducto } from "@shared/schema";
import { fmt, fmtDec, fmtPct, toInt, toNum } from "./formato";
import type { ObraCalculada, ProductoCalculado, Totales } from "./calculos";
import { BORDE_GRUPO, BadgeDesviacion, BadgeEstado, BarraAvance, InputCantidad, Numero, SinDato } from "./celdas";

/** Todo lo que una celda de producto necesita para dibujarse y guardarse. */
export interface CeldaProducto {
  producto: ObraProducto;
  calc: ProductoCalculado;
  /** Viviendas de la obra: es el denominador del avance del producto. */
  viviendas: number;
  onGuardar: (data: Record<string, unknown>) => void;
  onMovimiento: (data: Record<string, unknown>) => void;
  registrando: boolean;
}

export interface ColumnaDef {
  key: string;
  label: string;
  title?: string;
  /** Bloque al que pertenece; se dibuja como una banda sobre los encabezados. */
  grupo: string;
  soloCompleta?: boolean;
  thClassName?: string;
  /** Línea divisoria al inicio del bloque. La pone prepararColumnas(). */
  borde?: string;
  render: (f: ObraCalculada) => React.ReactNode;
  /** Celda del producto. Sin esto la columna queda vacía en la fila del producto. */
  renderProducto?: (c: CeldaProducto) => React.ReactNode;
  total?: (t: Totales) => React.ReactNode;
}

const OBRA = "Obra";
const AVANCE = "Avance en obra";
const MATERIAL = "Material · unidades";
const DECISION = "Qué hacer";

export const COLUMNAS: ColumnaDef[] = [
  // ---- Qué obra es -------------------------------------------------------
  {
    key: "programa",
    label: "Programa",
    grupo: OBRA,
    soloCompleta: true,
    render: (f) =>
      f.obra.programa ? (
        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {f.obra.programa}
        </span>
      ) : (
        <SinDato />
      ),
  },
  {
    // La ciudad va junto al nombre de la obra (es identidad, no un número que se
    // compare hacia abajo); acá queda solo para quien abre la planilla completa.
    key: "ciudad",
    label: "Ciudad",
    grupo: OBRA,
    soloCompleta: true,
    render: (f) =>
      f.obra.ciudad ? (
        <span className="font-medium text-slate-700 dark:text-slate-200">{f.obra.ciudad}</span>
      ) : (
        <SinDato />
      ),
  },
  {
    key: "etapa",
    label: "Etapa",
    title: "Etapa constructiva",
    grupo: OBRA,
    soloCompleta: true,
    render: (f) =>
      f.obra.etapa ? (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{f.obra.etapa}</span>
      ) : (
        <SinDato />
      ),
  },
  {
    key: "viv",
    label: "Viviendas",
    title: "Viviendas o departamentos del proyecto",
    grupo: OBRA,
    render: (f) => (
      <span title={f.obra.tipoObra === "edificios" ? `${fmt(toInt(f.obra.torres))} torres` : undefined}>
        <Numero valor={f.viviendas} entero />
      </span>
    ),
    total: (t) => fmt(t.viviendas),
  },

  // ---- Cómo va -----------------------------------------------------------
  {
    key: "pintadas",
    label: "Pintadas",
    title: "Viviendas ya pintadas",
    grupo: AVANCE,
    render: (f) => <Numero valor={f.pintadas} entero />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.viviendasPintadas}
        onGuardar={(v) => c.onGuardar({ viviendasPintadas: Math.round(toNum(v)) })}
        testId={`input-pintadas-${c.producto.id}`}
      />
    ),
    total: (t) => fmt(t.pintadas),
  },
  {
    key: "pendientes",
    label: "Pendientes",
    title: "Viviendas que faltan por pintar",
    grupo: AVANCE,
    soloCompleta: true,
    render: (f) => <Numero valor={f.pendientes} entero />,
    renderProducto: (c) => <Numero valor={Math.max(0, c.viviendas - c.calc.pintadas)} entero />,
    total: (t) => fmt(t.pendientes),
  },
  {
    key: "avance",
    label: "% avance",
    grupo: AVANCE,
    thClassName: "min-w-[92px]",
    render: (f) => <BarraAvance avance={f.avance} hayDato={f.viviendas > 0} />,
    renderProducto: (c) => (
      <BarraAvance
        avance={c.viviendas > 0 ? Math.min(1, c.calc.pintadas / c.viviendas) : 0}
        hayDato={c.viviendas > 0}
      />
    ),
    total: (t) => fmtPct(t.avance),
  },

  // ---- Cuánto material ---------------------------------------------------
  {
    key: "proyectadas",
    label: "Proyectadas",
    title: "Lo que la obra necesita en total",
    grupo: MATERIAL,
    render: (f) => <Numero valor={f.proyectadas} />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadProyectada}
        onGuardar={(v) => c.onGuardar({ cantidadProyectada: v })}
        testId={`input-proyectada-${c.producto.id}`}
      />
    ),
    total: (t) => fmtDec(t.proyectadas),
  },
  {
    key: "pedidas",
    label: "Pedidas",
    title: "Lo que ya se le compró a la obra",
    grupo: MATERIAL,
    render: (f) => <Numero valor={f.pedidas} />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadPedida}
        onGuardar={(v) => c.onGuardar({ cantidadPedida: v })}
        testId={`input-pedida-${c.producto.id}`}
        movimiento={{ tipo: "pedido", sugerido: c.calc.porPedir, onRegistrar: c.onMovimiento, registrando: c.registrando }}
      />
    ),
    total: (t) => fmtDec(t.pedidas),
  },
  {
    key: "entregadas",
    label: "Entregadas",
    title: "Lo que llegó a la obra",
    grupo: MATERIAL,
    render: (f) => <Numero valor={f.entregadas} />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadEntregada}
        onGuardar={(v) => c.onGuardar({ cantidadEntregada: v })}
        testId={`input-entregada-${c.producto.id}`}
        movimiento={{
          tipo: "entrega",
          sugerido: Math.max(0, c.calc.pedida - c.calc.entregada),
          onRegistrar: c.onMovimiento,
          registrando: c.registrando,
        }}
      />
    ),
    total: (t) => fmtDec(t.entregadas),
  },
  {
    key: "usadas",
    label: "Utilizadas",
    title: "Lo que se consumió pintando",
    grupo: MATERIAL,
    render: (f) => <Numero valor={f.usadas} />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadUtilizada}
        onGuardar={(v) => c.onGuardar({ cantidadUtilizada: v })}
        testId={`input-utilizada-${c.producto.id}`}
        movimiento={{ tipo: "consumo", sugerido: 0, onRegistrar: c.onMovimiento, registrando: c.registrando }}
      />
    ),
    total: (t) => fmtDec(t.usadas),
  },
  {
    key: "saldo",
    label: "Saldo en obra",
    title: "Entregado − utilizado: lo que debería estar hoy en la bodega de la obra",
    grupo: MATERIAL,
    render: (f) => <SaldoObra saldo={f.saldo} />,
    renderProducto: (c) => <SaldoObra saldo={c.calc.saldo} />,
    total: (t) => fmtDec(t.saldo),
  },

  // ---- Qué hago ----------------------------------------------------------
  {
    // Reemplaza al viejo "teórico vs real": el número suelto no decía nada, lo
    // que se necesita saber es si el producto está rindiendo lo prometido.
    key: "rendimiento",
    label: "Rendimiento",
    title: "Consumo real vs el declarado (+ = se está gastando de más)",
    grupo: DECISION,
    render: (f) => <BadgeDesviacion desviacion={f.desviacion} hayDato={f.consumoTeorico > 0} />,
    renderProducto: (c) => (
      <BadgeDesviacion
        desviacion={c.calc.desviacion}
        hayDato={c.calc.pintadas > 0 && c.calc.rendimiento > 0}
        detalle={`Está rindiendo ${fmtDec(c.calc.rendimientoReal)} por vivienda; se declaró ${fmtDec(c.calc.rendimiento)}`}
      />
    ),
    total: (t) => <BadgeDesviacion desviacion={t.desviacion} hayDato={t.consumoTeorico > 0} />,
  },
  {
    key: "sugerido",
    label: "Próx. pedido",
    title: "Proyectado − pedido − saldo en obra: lo que hay que comprar ahora",
    grupo: DECISION,
    render: (f) => <ProximoPedido valor={f.sugerido} />,
    renderProducto: (c) => <ProximoPedido valor={c.calc.sugerido} />,
    total: (t) => fmtDec(t.sugerido),
  },
  {
    key: "estado",
    label: "Estado",
    grupo: DECISION,
    render: (f) => <BadgeEstado estado={f.estado} />,
  },
];

function SaldoObra({ saldo }: { saldo: number }) {
  // Un saldo negativo es "se consumió más de lo que se entregó": no es un cero
  // apagado, es algo que hay que ir a revisar.
  if (saldo < 0) {
    return (
      <span className="font-bold tabular-nums text-red-600 dark:text-red-400" title="Se consumió más de lo entregado">
        {fmtDec(saldo)}
      </span>
    );
  }
  return <Numero valor={saldo} />;
}

function ProximoPedido({ valor }: { valor: number }) {
  if (valor <= 0) return <Numero valor={0} />;
  return <span className="font-bold tabular-nums text-orange-600 dark:text-orange-400">{fmtDec(valor)}</span>;
}

/**
 * La constructora, para el listado de todas las obras de la cartera (ahí las
 * obras vienen mezcladas). Es una columna aparte porque necesita el callback
 * que abre la planilla de esa constructora.
 */
export function columnaConstructora(nombre: (f: ObraCalculada) => string, onAbrir: (f: ObraCalculada) => void): ColumnaDef {
  return {
    key: "constructora",
    label: "Constructora",
    grupo: OBRA,
    thClassName: "text-left min-w-[180px]",
    render: (f) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAbrir(f);
        }}
        className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-orange-600 transition-colors truncate max-w-[170px] block"
        data-testid={`button-abrir-constructora-${f.obra.clienteId}`}
      >
        {nombre(f)}
      </button>
    ),
  };
}

/** Las columnas del listado de cartera: las de decisión, sin el detalle de compra. */
export const CLAVES_CARTERA = new Set(["viv", "avance", "saldo", "sugerido", "estado"]);

/**
 * Bandas de encabezado y separadores. Con 14 columnas seguidas no se distingue
 * dónde termina el avance y dónde empieza la compra; agrupadas se leen cuatro
 * bloques en vez de catorce números sueltos.
 *
 * Devuelve las columnas ya anotadas con su borde para que la fila de la obra, la
 * del producto y la de totales dibujen la misma división sin recalcularla.
 */
export function prepararColumnas(columnas: ColumnaDef[]) {
  const grupos: Array<{ label: string; span: number }> = [];
  const preparadas = columnas.map((c) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.label === c.grupo) {
      ultimo.span += 1;
      return c;
    }
    grupos.push({ label: c.grupo, span: 1 });
    // El primero de cada bloque lleva la línea divisoria (salvo el primero de
    // todos, que va pegado a la columna del nombre).
    return grupos.length > 1 ? { ...c, borde: BORDE_GRUPO } : c;
  });
  return { columnas: preparadas, grupos };
}
