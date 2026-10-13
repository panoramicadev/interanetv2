/**
 * Columnas de la tabla de Obras — UNA definición para los dos niveles.
 *
 * Antes había dos tablas: la de obras y, al desplegar una fila, otra tabla
 * aparte con el detalle por producto. Eran las mismas magnitudes con otros
 * nombres ("Proyectadas" vs "Proyectado", "Próx. pedido" vs "Por pedir") y
 * columnas que no calzaban, así que había que volver a leer los encabezados en
 * cada nivel. Ahora cada columna sabe dibujarse en los dos:
 *
 *   render          → la celda de la obra (el total de sus productos; las
 *                     viviendas pintadas se cargan ahí mismo)
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
import { porFormato, textoMaterial, type CampoMaterial, type Material, type ObraCalculada, type ProductoCalculado, type Totales } from "./calculos";
import { BORDE_GRUPO, BadgeEstado, BarraAvance, CeldaRendimiento, InputCantidad, Numero, SinDato } from "./celdas";
import { etiquetaCortaUnidad } from "./unidades";
import { AlertTriangle, FileText } from "lucide-react";

/** Todo lo que una celda de producto necesita para dibujarse y guardarse. */
export interface CeldaProducto {
  producto: ObraProducto;
  calc: ProductoCalculado;
  /** Viviendas de la obra: es el denominador del avance del producto. */
  viviendas: number;
  /** Pintadas cargadas en la obra: lo que hereda el producto sin número propio. */
  pintadasObra: number;
  onGuardar: (data: Record<string, unknown>) => void;
  onMovimiento: (data: Record<string, unknown>) => void;
  registrando: boolean;
}

/** Lo que la fila de la obra le pasa a sus celdas editables. */
export interface CeldaObra {
  /** Sin esto la celda queda de solo lectura. */
  onGuardar?: (data: Record<string, unknown>) => void;
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
  render: (f: ObraCalculada, c?: CeldaObra) => React.ReactNode;
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
    // El avance se cuenta por obra, así que se escribe en su fila. El clic no
    // tiene que desplegar la obra: por eso se corta acá.
    render: (f, c) =>
      c?.onGuardar ? (
        <div onClick={(e) => e.stopPropagation()}>
          <InputCantidad
            valor={f.pintadas}
            max={f.viviendas > 0 ? f.viviendas : undefined}
            onGuardar={(v) => c.onGuardar?.({ viviendasPintadas: Math.round(toNum(v)) })}
            testId={`input-pintadas-obra-${f.obra.id}`}
          />
        </div>
      ) : (
        <Numero valor={f.pintadas} entero />
      ),
    // Las viviendas pintadas son de la obra: el producto no lleva las suyas.
    total: (t) => fmt(t.pintadas),
  },
  {
    key: "pendientes",
    label: "Pendientes",
    title: "Viviendas que faltan por pintar",
    grupo: AVANCE,
    soloCompleta: true,
    render: (f) => <Numero valor={f.pendientes} entero />,
    total: (t) => fmt(t.pendientes),
  },
  {
    // Dos avances distintos en la misma columna: en la obra, viviendas pintadas
    // sobre viviendas; en el producto, material utilizado sobre proyectado.
    // Que se pintaran 40 casas no dice cuánto esmalte de rejas se aplicó.
    key: "avance",
    label: "% avance",
    title: "Obra: viviendas pintadas ÷ viviendas · Producto: utilizado ÷ proyectado",
    grupo: AVANCE,
    thClassName: "min-w-[92px]",
    render: (f) => <BarraAvance avance={f.avance} hayDato={f.viviendas > 0} />,
    renderProducto: (c) => (
      <BarraAvance
        avance={c.calc.avance}
        hayDato={c.calc.proyectada > 0}
        faltante="Falta la proyección del producto"
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
    render: (f) => <CeldaMaterial material={f.material} campo="proyectadas" />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadProyectada}
        onGuardar={(v) => c.onGuardar({ cantidadProyectada: v })}
        testId={`input-proyectada-${c.producto.id}`}
      />
    ),
    total: (t) => <CeldaMaterial material={t.material} campo="proyectadas" />,
  },
  {
    key: "pedidas",
    label: "Pedidas",
    title: "Lo que ya se le compró a la obra (notas de venta, guías y facturas asociadas, cada unidad una vez)",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="pedidas" />,
    renderProducto: (c) => (
      <ConAlerta
        alerta={c.calc.alertaPedido}
        motivo={`Se pidió ${fmtDec(c.calc.pedida)} y se proyectó ${fmtDec(c.calc.proyectada)}`}
      >
        {c.producto.desdeDocumentos ? (
          <DesdeDocumentos valor={c.calc.pedida} que="Suma de lo comprometido en los documentos asociados" />
        ) : (
          <InputCantidad
            valor={c.producto.cantidadPedida}
            onGuardar={(v) => c.onGuardar({ cantidadPedida: v })}
            testId={`input-pedida-${c.producto.id}`}
            movimiento={{ tipo: "pedido", sugerido: c.calc.porPedir, onRegistrar: c.onMovimiento, registrando: c.registrando }}
          />
        )}
      </ConAlerta>
    ),
    total: (t) => <CeldaMaterial material={t.material} campo="pedidas" />,
  },
  {
    // Proyectado − pedido, sin descontar nada más: es el "todavía no se le
    // compró" que se lee de corrido con las dos columnas de al lado (proyectado
    // 100, pedido 20 → por pedir 80). No confundir con "Próx. pedido", que
    // además descuenta lo que ya está en la bodega de la obra.
    key: "porPedir",
    label: "Por pedir",
    title: "Proyectado − pedido: lo que falta comprarle a la obra",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="faltante" />,
    renderProducto: (c) => <Numero valor={c.calc.porPedir} />,
    total: (t) => <CeldaMaterial material={t.material} campo="faltante" />,
  },
  {
    key: "entregadas",
    label: "Entregadas",
    title: "Lo que llegó a la obra (guías de despacho, o la factura cuando no hubo guía)",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="entregadas" />,
    renderProducto: (c) =>
      c.producto.desdeDocumentos ? (
        <DesdeDocumentos valor={c.calc.entregada} que="Lo despachado según los documentos asociados" />
      ) : (
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
    total: (t) => <CeldaMaterial material={t.material} campo="entregadas" />,
  },
  {
    key: "usadas",
    label: "Utilizadas",
    title: "Lo que se aplicó en obra de lo entregado: da el saldo y el avance del producto",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="usadas" />,
    renderProducto: (c) => (
      <InputCantidad
        valor={c.producto.cantidadUtilizada}
        onGuardar={(v) => c.onGuardar({ cantidadUtilizada: v })}
        testId={`input-utilizada-${c.producto.id}`}
        movimiento={{ tipo: "consumo", sugerido: 0, onRegistrar: c.onMovimiento, registrando: c.registrando }}
      />
    ),
    total: (t) => <CeldaMaterial material={t.material} campo="usadas" />,
  },
  {
    key: "saldo",
    label: "Saldo en obra",
    title: "Entregado − utilizado: lo que debería estar hoy en la bodega de la obra",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="saldo" />,
    renderProducto: (c) => <SaldoObra saldo={c.calc.saldo} />,
    total: (t) => <CeldaMaterial material={t.material} campo="saldo" />,
  },

  // ---- Qué hago ----------------------------------------------------------
  {
    // Cuánto producto se está yendo en cada vivienda (utilizado ÷ pintadas), que
    // es lo que se va a preguntar en terreno y sale con lo que ya está cargado.
    // La desviación contra el rendimiento declarado va al lado, cuando lo hay.
    key: "rendimiento",
    label: "Rendimiento",
    title: "Consumo real por vivienda pintada (y su desviación vs lo declarado)",
    grupo: DECISION,
    // En la obra va una cifra por formato: sumar tinetas con galones por
    // vivienda no era ninguna de las dos cosas.
    render: (f) => (
      <CeldaRendimiento
        real={f.rendimientoReal}
        formatos={rendimientoPorFormato(f.material, f.pintadas)}
        desviacion={f.desviacion}
        hayDesviacion={f.consumoTeorico > 0}
        detalle={`La obra está usando ${textoMaterial(f.material, "usadas", f.pintadas)} por vivienda (${textoMaterial(f.material, "usadas")} en ${fmt(f.pintadas)} pintadas)`}
      />
    ),
    renderProducto: (c) => (
      <CeldaRendimiento
        real={c.calc.rendimientoReal}
        unidad={etiquetaCortaUnidad(c.producto.unidad)}
        desviacion={c.calc.desviacion}
        hayDesviacion={c.calc.pintadas > 0 && c.calc.rendimiento > 0}
        detalle={
          c.calc.rendimiento > 0
            ? `Está rindiendo ${fmtDec(c.calc.rendimientoReal)} por vivienda; se declaró ${fmtDec(c.calc.rendimiento)}`
            : `Está rindiendo ${fmtDec(c.calc.rendimientoReal)} por vivienda (${fmtDec(c.calc.utilizada)} en ${fmt(c.calc.pintadas)} pintadas). Declará el rendimiento esperado para compararlo.`
        }
      />
    ),
    total: (t) => (
      <CeldaRendimiento
        real={t.rendimientoReal}
        formatos={rendimientoPorFormato(t.material, t.pintadas)}
        desviacion={t.desviacion}
        hayDesviacion={t.consumoTeorico > 0}
      />
    ),
  },
  {
    key: "sugerido",
    label: "Próx. pedido",
    title: "Proyectado − pedido − saldo en obra: lo que hay que comprar ahora",
    grupo: DECISION,
    render: (f) => <CeldaMaterial material={f.material} campo="sugerido" />,
    renderProducto: (c) => <ProximoPedido valor={c.calc.sugerido} />,
    total: (t) => <CeldaMaterial material={t.material} campo="sugerido" />,
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
      <span
        className="inline-flex items-center gap-1 font-bold tabular-nums text-red-600 dark:text-red-400"
        title="Se utilizó más de lo entregado: revisar las entregas o lo informado como utilizado"
      >
        <AlertTriangle className="h-3 w-3" />
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

/** Consumo por vivienda pintada de cada formato. */
const rendimientoPorFormato = (material: Material, pintadas: number) =>
  pintadas > 0
    ? porFormato(material, "usadas").map(({ unidad, valor }) => ({
        corto: unidad.corto,
        plural: unidad.plural,
        valor: valor / pintadas,
      }))
    : [];

/** La celda con un aviso al lado cuando el número no cuadra. */
function ConAlerta({ alerta, motivo, children }: { alerta: boolean; motivo: string; children: React.ReactNode }) {
  if (!alerta) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <span title={motivo} aria-label={motivo} className="text-amber-500 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
    </span>
  );
}

/** Cantidad que viene de los documentos asociados: se lee, no se escribe. */
function DesdeDocumentos({ valor, que }: { valor: number; que: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums font-semibold text-slate-700 dark:text-slate-200"
      title={`${que}. Para cambiarla, asocia o saca documentos en "Compras de la obra".`}
    >
      {fmtDec(valor)}
      <FileText className="h-3 w-3 text-slate-400" aria-label="Desde documentos" />
    </span>
  );
}

/**
 * Material de la obra en las unidades en que se cargan los productos: una
 * cifra por formato, no una suma de tinetas con galones.
 */
export function CeldaMaterial({ material, campo }: { material: Material; campo: CampoMaterial }) {
  const filas = porFormato(material, campo);
  if (filas.length === 0) return <Numero valor={0} />;

  const pinta = (valor: number) => {
    if (campo === "saldo" && valor < 0) return "font-bold text-red-600 dark:text-red-400";
    if (campo === "sugerido" && valor > 0) return "font-bold text-orange-600 dark:text-orange-400";
    return valor === 0 ? "text-slate-300 dark:text-slate-600" : "";
  };

  // Un solo formato: el número como siempre, con su unidad al pasar el mouse.
  if (filas.length === 1) {
    const { unidad, valor } = filas[0];
    return (
      <span className={`tabular-nums ${pinta(valor)}`} title={`${fmtDec(valor)} ${unidad.plural}`}>
        {fmtDec(valor)}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-end leading-tight">
      {filas.map(({ unidad, valor }) => (
        <span key={unidad.valor} className="whitespace-nowrap" title={`${fmtDec(valor)} ${unidad.plural}`}>
          <span className={`tabular-nums ${pinta(valor)}`}>{fmtDec(valor)}</span>
          <span className="ml-1 text-[9px] uppercase tracking-wide text-slate-400">{unidad.corto}</span>
        </span>
      ))}
    </div>
  );
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
