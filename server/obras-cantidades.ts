/**
 * Pedidas y Entregadas de cada producto de la obra, desde sus documentos.
 *
 * Hasta acá se cargaban a mano en la planilla y los documentos asociados se
 * mostraban aparte, como referencia. Ahora, al asociar un documento, sus
 * cantidades caen solas en la fila del producto con el mismo código (SKU):
 *
 *   Pedidas     lo comprometido por el cliente (notas de venta, guías y
 *               facturas), contando cada unidad UNA vez aunque pase por las tres.
 *   Entregadas  lo despachado: las guías, más las facturas que no tuvieron guía.
 *
 * Por pedir y Saldo se recalculan solos en pantalla a partir de la Proyección,
 * que se sigue cargando a mano.
 *
 * Por qué se guarda una copia de las líneas (obra_venta_lineas) en vez de leer
 * los espejos: el espejo de notas de venta guarda solo lo pendiente de despacho
 * y el de guías solo las abiertas. Un documento ya despachado desaparece de
 * ahí, y con él las cantidades de la obra. Por eso las líneas se leen de Random
 * (solo lectura) al asociar y se refrescan después de cada sincronización.
 *
 * Cómo no contar dos veces: en Random cada línea anota de qué línea salió
 * (IDRST). La nota de venta es la raíz; la guía que la despacha apunta a ella y
 * la factura apunta a la guía. Todas las líneas con la misma raíz son la misma
 * compra, y de esa compra se toma el nivel más alto entre lo pedido en nota de
 * venta, lo despachado en guías y lo facturado. Así, una nota de venta de 100
 * despachada en dos guías (60 + 40) y facturada entera son 100, no 300; y una
 * factura directa sin nota de venta cuenta igual.
 *
 * Las notas de crédito restan (son devoluciones de lo facturado).
 */
import { sql } from "drizzle-orm";
import mssql from "mssql";
import { db } from "./db";
import { erp } from "./obras-ventas";
import { unidadDesdeCatalogo } from "@shared/obras-unidades";

const filasDe = (resultado: any): any[] => resultado.rows ?? resultado;

const sku = (valor: unknown) => String(valor ?? "").trim().toUpperCase();

const soloDigitos = (valor: unknown) => String(valor ?? "").replace(/[^0-9]/g, "");

/** Cuántos saltos de cadena se siguen: NVV → GDV → FCV → NCV y un margen. */
const MAX_SALTOS = 6;

type Nivel = "nvv" | "gdv" | "fac";

const nivelDe = (tido: string | null): Nivel => {
  const t = (tido ?? "").trim().toUpperCase();
  if (t === "NVV") return "nvv";
  if (t === "GDV") return "gdv";
  return "fac";
};

/** Las notas de crédito devuelven: restan de lo facturado. */
const signoDe = (tido: string | null) => ((tido ?? "").trim().toUpperCase().startsWith("NC") ? -1 : 1);

// ---------------------------------------------------------------------------
// Lectura de Random (solo lectura)
// ---------------------------------------------------------------------------

/**
 * Si MAEDDO trae el vínculo con la línea de origen. Se pregunta una vez: si
 * la base no lo tuviera, todo sigue funcionando con una regla más gruesa (ver
 * `calcularPorSku`) en vez de caerse.
 */
let columnasCadena: Promise<{ idrst: boolean; archirst: boolean }> | null = null;

function cadenaDisponible(pool: mssql.ConnectionPool) {
  if (!columnasCadena) {
    columnasCadena = pool
      .request()
      .query(`
        SELECT UPPER(COLUMN_NAME) AS col
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MAEDDO' AND UPPER(COLUMN_NAME) IN ('IDRST', 'ARCHIRST')
      `)
      .then((r) => {
        const cols = new Set(r.recordset.map((f: any) => String(f.col)));
        if (!cols.has("IDRST")) {
          console.warn("⚠️ [Obras] MAEDDO no trae IDRST: las cantidades se cruzan sin seguir la cadena NVV → GDV → FCV");
        }
        return { idrst: cols.has("IDRST"), archirst: cols.has("ARCHIRST") };
      })
      .catch((e) => {
        columnasCadena = null;
        throw e;
      });
  }
  return columnasCadena;
}

interface LineaErp {
  idmaeddo: string;
  idmaeedo: string;
  tido: string | null;
  kopr: string | null;
  nombre: string | null;
  cantidad: number;
  monto: number;
  /** La línea de la que salió esta, si la hay. */
  origen: string | null;
}

async function enTandas<T>(ids: string[], consulta: (lista: string) => Promise<T[]>): Promise<T[]> {
  const resultado: T[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const tanda = ids.slice(i, i + 1000);
    if (tanda.length > 0) resultado.push(...(await consulta(tanda.join(","))));
  }
  return resultado;
}

/** Condición para seguir IDRST solo cuando apunta a otra línea de documento. */
const condicionOrigen = (archirst: boolean) =>
  archirst ? `AND (d.ARCHIRST IS NULL OR LTRIM(RTRIM(d.ARCHIRST)) IN ('', 'MAEDDO'))` : "";

async function leerLineas(
  pool: mssql.ConnectionPool,
  columnas: { idrst: boolean; archirst: boolean },
  filtro: (lista: string) => string,
  ids: string[],
): Promise<LineaErp[]> {
  const origen = columnas.idrst
    ? `CASE WHEN d.IDRST > 0 ${condicionOrigen(columnas.archirst)} THEN d.IDRST END`
    : "NULL";
  return enTandas(ids, async (lista) => {
    const r = await pool.request().query(`
      SELECT
        d.IDMAEDDO, d.IDMAEEDO, e.TIDO, d.KOPRCT, p.NOKOPR,
        -- Lo de la nota de venta que se cerró sin despachar ya no está comprometido.
        CASE WHEN e.TIDO = 'NVV' THEN COALESCE(d.CAPRCO2, 0) - COALESCE(d.CAPRNC2, 0)
             ELSE COALESCE(d.CAPRCO2, 0) END AS CANTIDAD,
        COALESCE(d.VANELI, 0) AS MONTO,
        ${origen} AS ORIGEN
      FROM dbo.MAEDDO d
      JOIN dbo.MAEEDO e ON e.IDMAEEDO = d.IDMAEEDO
      LEFT JOIN dbo.MAEPR p ON p.KOPR = d.KOPRCT
      WHERE ${filtro(lista)}
    `);
    return r.recordset.map((f: any) => ({
      idmaeddo: String(f.IDMAEDDO),
      idmaeedo: String(f.IDMAEEDO),
      tido: f.TIDO ? String(f.TIDO).trim() : null,
      kopr: f.KOPRCT ? String(f.KOPRCT).trim() : null,
      nombre: f.NOKOPR ? String(f.NOKOPR).trim() : null,
      cantidad: Number(f.CANTIDAD ?? 0),
      monto: Number(f.MONTO ?? 0),
      origen: f.ORIGEN != null ? String(f.ORIGEN) : null,
    }));
  });
}

interface LineaConCadena extends LineaErp {
  raiz: string | null;
  conGuia: boolean | null;
}

/**
 * Las líneas de los documentos, cada una con su raíz y si pasó por una guía.
 * Devuelve null si Random no respondió: en ese caso no se toca lo guardado.
 */
async function lineasDesdeErp(idmaeedos: string[]): Promise<LineaConCadena[] | null> {
  const ids = Array.from(new Set(idmaeedos.map(soloDigitos).filter(Boolean)));
  if (ids.length === 0) return [];

  let pool: mssql.ConnectionPool;
  let columnas: { idrst: boolean; archirst: boolean };
  try {
    pool = await erp();
    columnas = await cadenaDisponible(pool);
  } catch (error: any) {
    console.warn("⚠️ [Obras] Sin respuesta del ERP para leer las líneas de los documentos:", error?.message);
    return null;
  }

  try {
    const lineas = await leerLineas(pool, columnas, (l) => `d.IDMAEEDO IN (${l})`, ids);
    if (!columnas.idrst) return lineas.map((l) => ({ ...l, raiz: null, conGuia: null }));

    // Subir por la cadena hasta la raíz, guardando cada eslabón.
    const conocidas = new Map<string, LineaErp>(lineas.map((l) => [l.idmaeddo, l]));
    let pendientes = lineas.map((l) => l.origen).filter((o): o is string => !!o && !conocidas.has(o));
    for (let salto = 0; salto < MAX_SALTOS && pendientes.length > 0; salto++) {
      const padres = await leerLineas(pool, columnas, (l) => `d.IDMAEDDO IN (${l})`, Array.from(new Set(pendientes)));
      for (const p of padres) conocidas.set(p.idmaeddo, p);
      pendientes = padres.map((p) => p.origen).filter((o): o is string => !!o && !conocidas.has(o));
    }

    const cadena = (l: LineaErp) => {
      const eslabones: LineaErp[] = [l];
      let actual = l;
      while (actual.origen && conocidas.has(actual.origen) && eslabones.length <= MAX_SALTOS) {
        actual = conocidas.get(actual.origen)!;
        eslabones.push(actual);
      }
      return eslabones;
    };

    // Las facturas que se despacharon DESPUÉS con una guía: la guía apunta a la
    // factura, así que hay que mirar hacia abajo.
    const lineasFactura = Array.from(conocidas.values()).filter((l) => nivelDe(l.tido) === "fac");
    const conGuiaDespues = new Set<string>();
    if (lineasFactura.length > 0) {
      const hijas = await enTandas(lineasFactura.map((l) => l.idmaeddo), async (lista) => {
        const r = await pool.request().query(`
          SELECT DISTINCT d.IDRST
          FROM dbo.MAEDDO d
          JOIN dbo.MAEEDO e ON e.IDMAEEDO = d.IDMAEEDO
          WHERE e.TIDO = 'GDV' AND d.IDRST IN (${lista}) ${condicionOrigen(columnas.archirst)}
        `);
        return r.recordset.map((f: any) => String(f.IDRST));
      });
      for (const id of hijas) conGuiaDespues.add(id);
    }

    return lineas.map((l) => {
      const eslabones = cadena(l);
      return {
        ...l,
        raiz: eslabones[eslabones.length - 1].idmaeddo,
        conGuia:
          nivelDe(l.tido) === "fac"
            ? eslabones.some((e) => nivelDe(e.tido) === "gdv" || conGuiaDespues.has(e.idmaeddo))
            : null,
      };
    });
  } catch (error: any) {
    console.warn("⚠️ [Obras] No se pudieron leer las líneas de los documentos en el ERP:", error?.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Copia propia de las líneas
// ---------------------------------------------------------------------------

/**
 * Trae de Random las líneas de estos vínculos y las deja guardadas. Las que ya
 * no están en el documento quedan como no vigentes (no se borran).
 * Devuelve false si Random no respondió.
 */
export async function sincronizarLineas(vinculos: Array<{ id: string; idmaeedo: string }>): Promise<boolean> {
  if (vinculos.length === 0) return true;
  const lineas = await lineasDesdeErp(vinculos.map((v) => v.idmaeedo));
  if (!lineas) return false;

  const porDocumento = new Map<string, LineaConCadena[]>();
  for (const l of lineas) {
    const grupo = porDocumento.get(l.idmaeedo);
    if (grupo) grupo.push(l);
    else porDocumento.set(l.idmaeedo, [l]);
  }

  for (const v of vinculos) {
    const propias = porDocumento.get(soloDigitos(v.idmaeedo)) ?? [];
    for (const l of propias) {
      await db.execute(sql`
        INSERT INTO obra_venta_lineas
          (obra_venta_id, idmaeedo, idmaeddo, tido, kopr, nombre, cantidad, monto, raiz, con_guia, vigente, actualizado_en)
        VALUES
          (${v.id}, ${l.idmaeedo}, ${l.idmaeddo}, ${l.tido}, ${l.kopr}, ${l.nombre}, ${l.cantidad}, ${l.monto},
           ${l.raiz}, ${l.conGuia}, true, now())
        ON CONFLICT (obra_venta_id, idmaeddo) DO UPDATE SET
          tido = EXCLUDED.tido, kopr = EXCLUDED.kopr, nombre = EXCLUDED.nombre,
          cantidad = EXCLUDED.cantidad, monto = EXCLUDED.monto, raiz = EXCLUDED.raiz,
          con_guia = EXCLUDED.con_guia, vigente = true, actualizado_en = now()
      `);
    }
    const vigentes = propias.map((l) => sql`${l.idmaeddo}`);
    await db.execute(sql`
      UPDATE obra_venta_lineas SET vigente = false, actualizado_en = now()
      WHERE obra_venta_id = ${v.id} AND vigente
        ${vigentes.length > 0 ? sql`AND idmaeddo NOT IN (${sql.join(vigentes, sql`, `)})` : sql``}
    `);
  }
  return true;
}

/** Las líneas guardadas de estos vínculos, para el detalle de compras de la obra. */
export async function lineasGuardadas(vinculoIds: string[]) {
  if (vinculoIds.length === 0) return [];
  return filasDe(await db.execute(sql`
    SELECT obra_venta_id, idmaeedo, kopr, nombre, cantidad, monto
    FROM obra_venta_lineas
    WHERE vigente AND obra_venta_id IN (${sql.join(vinculoIds.map((i) => sql`${i}`), sql`, `)})
  `)).map((f) => ({
    vinculoId: String(f.obra_venta_id),
    idmaeedo: String(f.idmaeedo),
    kopr: f.kopr != null ? String(f.kopr).trim() : null,
    nombre: f.nombre ?? null,
    cantidad: Number(f.cantidad ?? 0),
    monto: Number(f.monto ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// El cálculo
// ---------------------------------------------------------------------------

interface LineaCalculo {
  tido: string | null;
  kopr: string;
  nombre: string | null;
  cantidad: number;
  raiz: string | null;
  conGuia: boolean | null;
}

export interface CantidadesSku {
  kopr: string;
  nombre: string | null;
  pedidas: number;
  entregadas: number;
}

/**
 * Pedidas y entregadas de un SKU a partir de sus líneas.
 *
 * Exportada para poder probarla sin base de datos.
 */
export function calcularPorSku(lineas: LineaCalculo[]): CantidadesSku[] {
  const porSku = new Map<string, LineaCalculo[]>();
  for (const l of lineas) {
    const grupo = porSku.get(l.kopr);
    if (grupo) grupo.push(l);
    else porSku.set(l.kopr, [l]);
  }

  const resultado: CantidadesSku[] = [];
  for (const [kopr, propias] of Array.from(porSku.entries())) {
    // Cada compra (raíz) aporta su nivel más alto. Las líneas sin cadena
    // conocida se juntan en una sola compra por SKU: sin saber de dónde salió
    // cada una, sumarlas contaría la misma unidad en la nota, la guía y la factura.
    const porRaiz = new Map<string, Record<Nivel, number>>();
    for (const l of propias) {
      const clave = l.raiz ?? `sku:${kopr}`;
      const niveles = porRaiz.get(clave) ?? { nvv: 0, gdv: 0, fac: 0 };
      niveles[nivelDe(l.tido)] += signoDe(l.tido) * l.cantidad;
      porRaiz.set(clave, niveles);
    }
    let pedidas = 0;
    for (const n of Array.from(porRaiz.values())) pedidas += Math.max(n.nvv, n.gdv, n.fac);

    // Entregado: las guías, más lo facturado que no pasó por guía. Si no se
    // sabe si una factura tuvo guía, cuenta como directa solo cuando el SKU no
    // trae ninguna guía en la obra.
    const hayGuias = propias.some((l) => nivelDe(l.tido) === "gdv");
    let entregadas = 0;
    for (const l of propias) {
      const nivel = nivelDe(l.tido);
      if (nivel === "gdv") entregadas += signoDe(l.tido) * l.cantidad;
      else if (nivel === "fac" && (l.conGuia === false || (l.conGuia === null && !hayGuias))) {
        entregadas += signoDe(l.tido) * l.cantidad;
      }
    }

    const nombre = propias.find((l) => l.nombre)?.nombre ?? null;
    resultado.push({ kopr, nombre, pedidas: Math.max(0, pedidas), entregadas: Math.max(0, entregadas) });
  }
  return resultado;
}

/**
 * Escribe Pedidas y Entregadas en los productos de la obra a partir de las
 * líneas guardadas de sus documentos activos.
 *
 * - El SKU ya está en la obra → se le actualizan las dos cantidades.
 * - No está → se agrega con proyección 0 y marcado para revisar.
 * - Un producto que se llenaba desde documentos y ya no tiene ninguno vuelve a
 *   cero y a la carga manual.
 */
export async function recalcularCantidadesObra(obraId: string): Promise<void> {
  const lineas = filasDe(await db.execute(sql`
    SELECT l.tido, l.kopr, l.nombre, l.cantidad, l.raiz, l.con_guia
    FROM obra_venta_lineas l
    JOIN obra_ventas v ON v.id = l.obra_venta_id
    WHERE v.obra_id = ${obraId} AND v.activo AND l.vigente
      AND l.kopr IS NOT NULL AND TRIM(l.kopr) <> ''
  `)).map((f) => ({
    tido: f.tido ?? null,
    kopr: sku(f.kopr),
    nombre: f.nombre ?? null,
    cantidad: Number(f.cantidad ?? 0),
    raiz: f.raiz ?? null,
    conGuia: f.con_guia == null ? null : !!f.con_guia,
  }));

  const cantidades = calcularPorSku(lineas);

  const productos = filasDe(await db.execute(sql`
    SELECT id, kopr, desde_documentos
    FROM obra_productos
    WHERE obra_id = ${obraId}
    ORDER BY created_at
  `));
  // Si el mismo SKU está dos veces (un producto por tipo de vivienda), las
  // cantidades van al primero que se cargó.
  const primeroPorSku = new Map<string, string>();
  for (const p of productos) {
    const clave = sku(p.kopr);
    if (clave && !primeroPorSku.has(clave)) primeroPorSku.set(clave, String(p.id));
  }

  const actualizados = new Set<string>();
  for (const c of cantidades) {
    const existente = primeroPorSku.get(c.kopr);
    if (existente) {
      await db.execute(sql`
        UPDATE obra_productos
        SET cantidad_pedida = ${c.pedidas}, cantidad_entregada = ${c.entregadas},
            desde_documentos = true, updated_at = now()
        WHERE id = ${existente}
      `);
      actualizados.add(existente);
    } else {
      const nombre = c.nombre ?? c.kopr;
      await db.execute(sql`
        INSERT INTO obra_productos
          (obra_id, kopr, nombre, unidad, cantidad_proyectada, cantidad_pedida, cantidad_entregada,
           desde_documentos, revisar)
        VALUES
          (${obraId}, ${c.kopr}, ${nombre}, ${unidadDesdeCatalogo(nombre, null)}, 0, ${c.pedidas}, ${c.entregadas},
           true, true)
      `);
    }
  }

  for (const p of productos) {
    if (p.desde_documentos && !actualizados.has(String(p.id))) {
      await db.execute(sql`
        UPDATE obra_productos
        SET cantidad_pedida = 0, cantidad_entregada = 0, desde_documentos = false, updated_at = now()
        WHERE id = ${p.id}
      `);
    }
  }
}

/**
 * Lo que se hace al asociar o sacar documentos: refrescar las líneas de los
 * documentos activos de la obra y recalcular. Si Random no responde, se
 * recalcula con lo que ya estaba guardado.
 */
export async function actualizarCantidadesObra(obraId: string): Promise<{ erpRespondio: boolean }> {
  const vinculos = filasDe(await db.execute(sql`
    SELECT id, idmaeedo FROM obra_ventas WHERE obra_id = ${obraId} AND activo
  `)).map((f) => ({ id: String(f.id), idmaeedo: String(f.idmaeedo) }));
  const erpRespondio = await sincronizarLineas(vinculos);
  await recalcularCantidadesObra(obraId);
  return { erpRespondio };
}

/**
 * Después de cada sincronización con el ERP: una factura puede haber recibido
 * su guía, o una nota de venta haberse cerrado. Se refrescan todas las obras
 * activas que tienen documentos.
 */
export async function actualizarCantidadesObrasActivas(): Promise<number> {
  const obras = filasDe(await db.execute(sql`
    SELECT DISTINCT v.obra_id
    FROM obra_ventas v
    JOIN obras o ON o.id = v.obra_id
    WHERE v.activo AND o.estado = 'activa'
  `)).map((f) => String(f.obra_id));
  for (const obraId of obras) {
    try {
      await actualizarCantidadesObra(obraId);
    } catch (error: any) {
      console.error(`❌ [Obras] No se pudieron recalcular las cantidades de la obra ${obraId}:`, error?.message);
    }
  }
  return obras.length;
}
