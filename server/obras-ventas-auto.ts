/**
 * Documentos del ERP que se vinculan SOLOS a su obra.
 *
 * Asociar a mano no servía: el vendedor no ve las facturas (están en Random y
 * las maneja recepción), así que no tiene cómo saber cuál es de cuál obra sin
 * preguntar una por una.
 *
 * El problema de fondo es que el documento del ERP no dice de qué obra es: trae
 * el cliente, los productos, la fecha y la orden de compra, nada más. Por eso
 * acá se vincula solo lo que no deja dudas y el resto se SUGIERE en la obra,
 * para confirmarlo con un clic. Las reglas, de la más firme a la más floja:
 *
 *   nvv_recepcion  recepción anotó la nota de venta al ingresar a Random una
 *                  cotización que ya sabía de qué obra era;
 *   oc_cotizacion  la factura trae la misma orden de compra que esa cotización;
 *   obra_unica     la constructora tiene una sola obra activa y el documento
 *                  trae algún producto proyectado en ella;
 *   sku_exclusivo  tiene varias obras, pero los productos del documento solo
 *                  están proyectados en una.
 *
 * Las dos últimas miran solo lo FACTURADO: el espejo de notas de venta guarda
 * nada más que lo pendiente de despacho y el de guías solo las abiertas del
 * mes, así que un vínculo ahí quedaría con las líneas a medias.
 *
 * Lo que una persona sacó de una obra, o marcó como "no es de esta obra", no se
 * vuelve a vincular: cualquier fila que ya exista para el documento —activa o
 * no— lo deja fuera. Por eso se puede correr todas las veces que haga falta
 * (corre al final de los ETL de ventas y de notas de venta).
 *
 * Lo que queda afuera: las compras a nombre del contratista. La obra no guarda
 * su RUT, así que esos documentos se siguen asociando con el buscador, salvo
 * que hayan salido de una cotización hecha para la obra.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { computeDv, rutMatchKey } from "@shared/rut";
import { FILTRO_TIPO, type DocumentoVenta, type OrigenVenta } from "./obras-ventas";

export type ReglaAuto = "nvv_recepcion" | "oc_cotizacion" | "obra_unica" | "sku_exclusivo";

const AUTOMATICO = "Automático";

/** Un documento facturado, con lo que hace falta para decidir de qué obra es. */
interface DocumentoCandidato extends DocumentoVenta {
  oc: string | null;
  skus: string[];
}

export interface DocumentoSugerido extends DocumentoVenta {
  /** Trae algún producto de los proyectados en la obra. */
  coincide: boolean;
}

interface ObraDeCartera {
  id: string;
  nombre: string;
  estado: string;
  /** Cuerpo del RUT de la constructora: junta las fichas con y sin dígito verificador. */
  rut: string;
  /** Desde cuándo un documento puede ser de esta obra. */
  desde: string;
  skus: Set<string>;
}

const filasDe = (resultado: any): any[] => resultado.rows ?? resultado;

const sku = (valor: unknown) => String(valor ?? "").trim().toUpperCase();

/** La orden de compra, para comparar: sin espacios ni ceros de relleno. */
const normalizarOc = (valor: unknown) => String(valor ?? "").toUpperCase().replace(/\s+/g, "").replace(/^0+/, "");

/** "S/N", "-" o "0" no identifican nada: una OC sirve si trae al menos tres caracteres y un número. */
const ocUtil = (oc: string) => oc.length >= 3 && /\d/.test(oc);

/**
 * Cómo puede venir escrito un RUT en el ERP: el cuerpo solo, o con su dígito
 * verificador. Se compara por igualdad contra esas dos formas y no por
 * "contiene", que es lo que usa el buscador: ahí un parecido se ve en pantalla,
 * acá terminaría colgando el documento de otra empresa.
 */
function formasDeRut(...valores: Array<string | null | undefined>): string[] {
  const formas = new Set<string>();
  for (const valor of valores) {
    const cuerpo = rutMatchKey(valor);
    if (!/^\d{6,}$/.test(cuerpo)) continue;
    formas.add(cuerpo);
    formas.add(cuerpo + computeDv(cuerpo));
  }
  return Array.from(formas);
}

const rutNormalizado = (columna: SQL) =>
  sql`REPLACE(REPLACE(REPLACE(UPPER(COALESCE(${columna}, '')), '.', ''), '-', ''), ' ', '')`;

const lista = (valores: string[]) => sql.join(valores.map((v) => sql`${v}`), sql`, `);

/** Los documentos facturados de un cliente desde una fecha, uno por fila. */
async function documentosFacturados(ruts: string[], desde: string): Promise<DocumentoCandidato[]> {
  if (ruts.length === 0) return [];
  const filas = filasDe(await db.execute(sql`
    SELECT
      CAST(idmaeedo AS TEXT)                         AS idmaeedo,
      MAX(tido)::text                                AS tido,
      MAX(CAST(nudo AS TEXT))                        AS nudo,
      MAX(endo)                                      AS cliente_rut,
      MAX(nokoen)                                    AS cliente_nombre,
      MAX(feemdo)                                    AS fecha_emision,
      COALESCE(SUM(monto), 0)                        AS monto,
      COUNT(*)                                       AS lineas,
      MAX(ocdo)                                      AS oc,
      STRING_AGG(DISTINCT UPPER(TRIM(koprct)), '|')  AS skus
    FROM ventas.fact_ventas
    WHERE ${sql.raw(FILTRO_TIPO.facturado)}
      AND ${rutNormalizado(sql`endo`)} IN (${lista(ruts)})
      AND feemdo >= ${desde}
    GROUP BY idmaeedo
    ORDER BY MAX(feemdo) DESC NULLS LAST
    LIMIT 5000
  `));
  return filas.map((f) => ({
    origen: "facturado" as OrigenVenta,
    tido: f.tido ?? null,
    idmaeedo: String(f.idmaeedo),
    nudo: f.nudo != null ? String(f.nudo) : null,
    clienteRut: f.cliente_rut ?? null,
    clienteNombre: f.cliente_nombre ?? null,
    fechaEmision: f.fecha_emision ? fechaIso(f.fecha_emision) : null,
    monto: Number(f.monto ?? 0),
    lineas: Number(f.lineas ?? 0),
    oc: f.oc ?? null,
    skus: f.skus ? String(f.skus).split("|").filter(Boolean) : [],
  }));
}

/** El driver devuelve las fechas como Date; acá se comparan como "2026-10-09". */
function fechaIso(valor: unknown): string {
  if (valor instanceof Date) {
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }
  return String(valor).slice(0, 10);
}

/**
 * Qué se sabe ya de cada documento: en qué obras tiene fila, y si está activa.
 * Devuelve un mapa por idmaeedo.
 */
async function vinculosExistentes(origen: OrigenVenta, ids: string[]) {
  const mapa = new Map<string, Array<{ obraId: string; activo: boolean }>>();
  // De a tandas: un cliente grande trae miles de documentos.
  for (let i = 0; i < ids.length; i += 1000) {
    const tanda = ids.slice(i, i + 1000);
    const filas = filasDe(await db.execute(sql`
      SELECT obra_id, idmaeedo, activo
      FROM obra_ventas
      WHERE origen = ${origen} AND idmaeedo IN (${lista(tanda)})
    `));
    for (const f of filas) {
      const previos = mapa.get(String(f.idmaeedo));
      const vinculo = { obraId: String(f.obra_id), activo: !!f.activo };
      if (previos) previos.push(vinculo);
      else mapa.set(String(f.idmaeedo), [vinculo]);
    }
  }
  return mapa;
}

/** Las obras con su constructora y los SKU que tienen proyectados. */
async function obrasDeCartera(filtro: SQL): Promise<ObraDeCartera[]> {
  const filas = filasDe(await db.execute(sql`
    SELECT
      o.id, o.nombre, o.estado, c.koen, c.rten,
      COALESCE(o.fecha_inicio, o.created_at::date) AS desde,
      (
        SELECT STRING_AGG(DISTINCT UPPER(TRIM(p.kopr)), '|')
        FROM obra_productos p
        WHERE p.obra_id = o.id AND p.kopr IS NOT NULL AND TRIM(p.kopr) <> ''
      ) AS skus
    FROM obras o
    JOIN clients c ON c.id = o.cliente_id
    WHERE ${filtro}
  `));
  return filas
    .map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      estado: String(f.estado),
      // En el ERP el código del cliente ES su RUT; la ficha manual lo trae en rten.
      rut: rutMatchKey(f.koen) || rutMatchKey(f.rten),
      desde: fechaIso(f.desde),
      skus: new Set<string>(f.skus ? String(f.skus).split("|").filter(Boolean) : []),
    }))
    .filter((o) => /^\d{6,}$/.test(o.rut));
}

const comparte = (doc: { skus: string[] }, obra: ObraDeCartera) => doc.skus.some((s) => obra.skus.has(s));

async function vincular(obraId: string, doc: DocumentoVenta, regla: ReglaAuto) {
  await storage.asociarObraVenta({
    obraId,
    origen: doc.origen,
    tido: doc.tido,
    idmaeedo: doc.idmaeedo,
    nudo: doc.nudo,
    clienteRut: doc.clienteRut,
    clienteNombre: doc.clienteNombre,
    fechaEmision: doc.fechaEmision,
    montoDocumento: String(doc.monto),
    regla,
    asociadoPorNombre: AUTOMATICO,
  });
}

/**
 * Lo que dejó recepción: cotizaciones hechas para una obra que ya se
 * ingresaron a Random. Cada una trae el cliente al que se le vendió —que puede
 * ser el contratista— y, cuando las hay, la nota de venta y la orden de compra.
 */
async function vincularPorCotizaciones(soloCotizacion?: string): Promise<number> {
  const cotizaciones = filasDe(await db.execute(sql`
    SELECT
      q.id, q.obra_id, q.oc_number, q.erp_nvv_number, q.client_rut,
      q.created_at::date AS desde,
      c.koen, c.rten, oc.koen AS obra_koen, oc.rten AS obra_rten
    FROM quotes q
    JOIN obras o ON o.id = q.obra_id
    LEFT JOIN clients c ON c.id = q.client_id
    LEFT JOIN clients oc ON oc.id = o.cliente_id
    WHERE q.obra_id IS NOT NULL
      AND (COALESCE(q.erp_nvv_number, '') <> '' OR COALESCE(q.oc_number, '') <> '')
      ${soloCotizacion ? sql`AND q.id = ${soloCotizacion}` : sql``}
  `));

  let vinculados = 0;
  for (const q of cotizaciones) {
    const obraId = String(q.obra_id);
    // A quién se le vendió: el cliente de la cotización, y si no lo trae, la
    // constructora de la obra.
    let ruts = formasDeRut(q.koen, q.rten, q.client_rut);
    if (ruts.length === 0) ruts = formasDeRut(q.obra_koen, q.obra_rten);
    if (ruts.length === 0) continue;

    // La nota de venta que anotó recepción. El número solo no alcanza (se
    // repite entre sucursales): tiene que ser además del mismo cliente.
    const numero = String(q.erp_nvv_number ?? "").replace(/\D/g, "").replace(/^0+/, "");
    if (numero) {
      const notas = filasDe(await db.execute(sql`
        SELECT
          CAST(idmaeedo AS TEXT)   AS idmaeedo,
          MAX(tido)::text          AS tido,
          MAX(CAST(nudo AS TEXT))  AS nudo,
          MAX(endo)                AS cliente_rut,
          MAX(nokoen)              AS cliente_nombre,
          MAX(feemdo)              AS fecha_emision,
          COALESCE(SUM(monto), 0)  AS monto,
          COUNT(*)                 AS lineas
        FROM nvv.fact_nvv
        WHERE LTRIM(REGEXP_REPLACE(CAST(nudo AS TEXT), '\\D', '', 'g'), '0') = ${numero}
          AND ${rutNormalizado(sql`endo`)} IN (${lista(ruts)})
        GROUP BY idmaeedo
      `));
      // Dos notas con el mismo número y el mismo cliente: no se elige ninguna.
      if (notas.length === 1) {
        const f = notas[0];
        const yaEsta = await vinculosExistentes("nvv", [String(f.idmaeedo)]);
        if (!yaEsta.has(String(f.idmaeedo))) {
          await vincular(obraId, {
            origen: "nvv",
            tido: f.tido ?? null,
            idmaeedo: String(f.idmaeedo),
            nudo: f.nudo != null ? String(f.nudo) : null,
            clienteRut: f.cliente_rut ?? null,
            clienteNombre: f.cliente_nombre ?? null,
            fechaEmision: f.fecha_emision ? fechaIso(f.fecha_emision) : null,
            monto: Number(f.monto ?? 0),
            lineas: Number(f.lineas ?? 0),
          }, "nvv_recepcion");
          vinculados += 1;
        }
      }
    }

    // Las facturas que traen la misma orden de compra que la cotización.
    const oc = normalizarOc(q.oc_number);
    if (ocUtil(oc)) {
      const facturas = (await documentosFacturados(ruts, fechaIso(q.desde))).filter(
        (d) => normalizarOc(d.oc) === oc,
      );
      const yaEstan = await vinculosExistentes("facturado", facturas.map((d) => d.idmaeedo));
      for (const doc of facturas) {
        if (yaEstan.has(doc.idmaeedo)) continue;
        await vincular(obraId, doc, "oc_cotizacion");
        vinculados += 1;
      }
    }
  }
  return vinculados;
}

/**
 * Las facturas de cada constructora contra sus obras activas: se vincula la
 * que solo puede ser de una.
 */
async function vincularPorProductos(): Promise<number> {
  const obras = await obrasDeCartera(sql`o.estado = 'activa'`);
  const porConstructora = new Map<string, ObraDeCartera[]>();
  for (const obra of obras) {
    const grupo = porConstructora.get(obra.rut);
    if (grupo) grupo.push(obra);
    else porConstructora.set(obra.rut, [obra]);
  }

  let vinculados = 0;
  for (const [rut, grupo] of Array.from(porConstructora.entries())) {
    // Sin productos con SKU no hay contra qué reconocer un documento.
    if (!grupo.some((o) => o.skus.size > 0)) continue;

    const desde = grupo.map((o) => o.desde).sort()[0];
    const documentos = await documentosFacturados(formasDeRut(rut), desde);
    if (documentos.length === 0) continue;
    const yaEstan = await vinculosExistentes("facturado", documentos.map((d) => d.idmaeedo));

    for (const doc of documentos) {
      if (yaEstan.has(doc.idmaeedo)) continue;
      const posibles = grupo.filter(
        (o) => (!doc.fechaEmision || o.desde <= doc.fechaEmision) && comparte(doc, o),
      );
      if (posibles.length !== 1) continue;
      await vincular(posibles[0].id, doc, grupo.length === 1 ? "obra_unica" : "sku_exclusivo");
      vinculados += 1;
    }
  }
  return vinculados;
}

/** Corre todas las reglas. Devuelve cuántos documentos vinculó. */
export async function autoAsociarVentasObras(): Promise<number> {
  const porCotizacion = await vincularPorCotizaciones();
  const porProductos = await vincularPorProductos();
  const total = porCotizacion + porProductos;
  if (total > 0) {
    console.log(`🏗️ Obras: ${total} documento(s) vinculados solos (${porCotizacion} por cotización, ${porProductos} por productos)`);
  }
  return total;
}

/** Lo mismo, pero solo para una cotización: recepción la acaba de ingresar. */
export async function autoAsociarVentasDeCotizacion(cotizacionId: string): Promise<number> {
  return vincularPorCotizaciones(cotizacionId);
}

/**
 * Los documentos de la constructora que podrían ser de esta obra y todavía no
 * son de ninguna. No se guardan: se calculan cada vez que se abre la obra.
 *
 * Primero van los que traen algún producto proyectado en la obra, que son los
 * más probables.
 */
export async function sugerirDocumentosParaObra(
  obraId: string,
  limite = 60,
): Promise<{ documentos: DocumentoSugerido[]; total: number; otrasObras: string[] }> {
  const vacio = { documentos: [], total: 0, otrasObras: [] };
  const [obra] = await obrasDeCartera(sql`o.id = ${obraId}`);
  if (!obra) return vacio;

  const documentos = await documentosFacturados(formasDeRut(obra.rut), obra.desde);
  if (documentos.length === 0) return vacio;
  const yaEstan = await vinculosExistentes("facturado", documentos.map((d) => d.idmaeedo));

  const libres = documentos
    .filter((d) => {
      const vinculos = yaEstan.get(d.idmaeedo) ?? [];
      // Fuera los que ya son de alguna obra y los que acá se descartaron.
      return !vinculos.some((v) => v.activo || v.obraId === obraId);
    })
    .map(({ oc, skus, ...doc }) => ({ ...doc, coincide: comparte({ skus }, obra) }))
    .sort(
      (a, b) =>
        Number(b.coincide) - Number(a.coincide) || (b.fechaEmision ?? "").localeCompare(a.fechaEmision ?? ""),
    );

  // Las otras obras de la misma constructora: es entre cuáles hay que decidir.
  const hermanas = await obrasDeCartera(sql`o.estado = 'activa' AND o.id <> ${obraId}`);
  const otrasObras = hermanas.filter((o) => o.rut === obra.rut).map((o) => o.nombre);

  return { documentos: libres.slice(0, limite), total: libres.length, otrasObras };
}
