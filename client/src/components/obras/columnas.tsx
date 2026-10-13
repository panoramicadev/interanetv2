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
 * Las columnas van en tres bloques, que es el orden en que se lee la
 * planilla: qué obra es → cómo va → cuánto material.
 */
import type { ObraProducto } from "@shared/schema";
import { fmt, fmtDec, fmtPct, toInt } from "./formato";
import { porFormato, type CampoMaterial, type Material, type ObraCalculada, type ProductoCalculado, type Totales } from "./calculos";
import { BORDE_GRUPO, BarraAvance, InputCantidad, Numero, SinDato } from "./celdas";
import { FileText } from "lucide-react";

/**
 * Encabezado de la columna "viv" según las obras de la tabla: "Edificio" si
 * son todas edificios, "Casa" si son todas casas, "Edificio / Casa" mezcladas.
 */
export function etiquetaUnidades(obras: { tipoObra?: string | null }[]): string {
  if (obras.length > 0 && obras.every((o) => o.tipoObra === "edificios")) return "Edificio";
  if (obras.length > 0 && obras.every((o) => o.tipoObra !== "edificios")) return "Casa";
  return "Edificio / Casa";
}

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

export const COLUMNAS: ColumnaDef[] = [
  // ---- Qué obra es -------------------------------------------------------
  {
    // Columna propia (pedido del usuario, oct-2026): antes iba en una línea
    // chica debajo del nombre de la obra.
    key: "ciudad",
    label: "Ciudad",
    grupo: OBRA,
    render: (f) =>
      f.obra.ciudad ? (
        <span className="font-medium text-slate-700 dark:text-slate-200">{f.obra.ciudad}</span>
      ) : (
        <SinDato />
      ),
  },
  {
    key: "viv",
    label: "Viviendas",
    title: "Edificio: cantidad de torres · Casas: cantidad de viviendas",
    grupo: OBRA,
    // Edificio: la cantidad de torres; casas: la cantidad de viviendas
    // (pedido del usuario, oct-2026). El encabezado lo ajusta la tabla con
    // etiquetaUnidades().
    render: (f) => {
      const esEdificio = f.obra.tipoObra === "edificios";
      const torres = toInt(f.obra.torres);
      return (
        <div className="leading-tight">
          <Numero valor={esEdificio ? torres : f.viviendas} entero />
          <div className="text-[10px] text-slate-400 whitespace-nowrap">
            {esEdificio ? (torres === 1 ? "torre" : "torres") : "viviendas"}
          </div>
        </div>
      );
    },
    total: (t) =>
      t.torres > 0 && t.casas > 0
        ? `${fmt(t.torres)} torres · ${fmt(t.casas)} viv.`
        : t.torres > 0
          ? fmt(t.torres)
          : fmt(t.casas),
  },

  // ---- Cómo va -----------------------------------------------------------
  {
    // Dos avances distintos en la misma columna: en la obra, viviendas pintadas
    // sobre viviendas; en el producto, material utilizado sobre proyectado.
    // Que se pintaran 40 casas no dice cuánto esmalte de rejas se aplicó.
    key: "avance",
    label: "% avance",
    // (Facturado + NVV) ÷ proyectado, en la obra y en cada producto (pedido del
    // usuario, oct-2026). Antes la obra iba por viviendas pintadas.
    title: "(Facturado + NVV) ÷ proyectado",
    grupo: AVANCE,
    thClassName: "min-w-[92px]",
    render: (f) => (
      <BarraAvance avance={f.avanceVenta} hayDato={f.proyectadas > 0} faltante="Falta la proyección de la obra" />
    ),
    renderProducto: (c) => (
      <BarraAvance
        avance={c.calc.avance}
        hayDato={c.calc.proyectada > 0}
        faltante="Falta la proyección del producto"
      />
    ),
    total: (t) => fmtPct(t.avanceVenta),
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
    // Facturado y NVV por separado (pedido del usuario, oct-2026). Salen de los
    // documentos asociados; un producto cargado a mano no los tiene.
    key: "facturadas",
    label: "Facturado",
    title: "Lo facturado según los documentos asociados (menos notas de crédito)",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="facturadas" />,
    renderProducto: (c) =>
      c.producto.desdeDocumentos ? (
        <DesdeDocumentos valor={c.calc.facturada} que="Lo facturado en los documentos asociados" />
      ) : (
        <SinDato />
      ),
    total: (t) => <CeldaMaterial material={t.material} campo="facturadas" />,
  },
  {
    key: "nvv",
    label: "NVV",
    title: "Notas de venta (y guías) que todavía no se facturan",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="nvv" />,
    renderProducto: (c) =>
      c.producto.desdeDocumentos ? (
        <DesdeDocumentos valor={c.calc.nvv} que="Lo comprometido en notas de venta o guías, aún sin facturar" />
      ) : (
        <SinDato />
      ),
    total: (t) => <CeldaMaterial material={t.material} campo="nvv" />,
  },
  {
    // Proyectado − pedido, sin descontar nada más: es el "todavía no se le
    // compró" que se lee de corrido con las dos columnas de al lado (proyectado
    // 100, pedido 20 → por pedir 80). No confundir con "Próx. pedido", que
    // además descuenta lo que ya está en la bodega de la obra.
    key: "porPedir",
    label: "Por Pedir",
    // Facturado + NVV es lo pedido, así que es lo mismo que proyectado − pedido.
    title: "Proyectado − facturado − NVV: lo que falta comprarle a la obra",
    grupo: MATERIAL,
    render: (f) => <CeldaMaterial material={f.material} campo="faltante" />,
    renderProducto: (c) => <Numero valor={c.calc.porPedir} />,
    total: (t) => <CeldaMaterial material={t.material} campo="faltante" />,
  },
];

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
