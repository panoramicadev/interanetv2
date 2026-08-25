/**
 * Qué le compró de verdad la obra: las ventas del ERP asociadas a una obra.
 *
 * Las ventas viven en tres espejos distintos, uno por tipo de documento, y cada
 * sincronización los reescribe enteros:
 *
 *   facturado → ventas.fact_ventas  (tido FCV, y NCV que son las devoluciones)
 *   nvv       → nvv.fact_nvv        (notas de venta)
 *   gdv       → gdv.fact_gdv        (guías de despacho)
 *
 * Los tres tienen la misma forma: `idmaeedo` es el documento y `idmaeddo` cada
 * una de sus líneas, con `koprct` (el SKU), `caprco2` (la cantidad en unidades)
 * y `monto`.
 *
 * Los tres se llevan SEPARADOS y no se suman entre sí: una nota de venta que
 * después se factura y se despacha es la misma compra apareciendo tres veces.
 * La pantalla muestra tres columnas, no un total.
 *
 * Por qué la cantidad se compara sin convertir: cada SKU del ERP ES una
 * presentación (la tineta de 4, la de 5, el galón), y la obra guarda el mismo
 * SKU con su formato. Entonces "3 unidades compradas" del SKU X se comparan
 * directo contra "3 tinetas proyectadas" del mismo SKU X, sin inventar
 * equivalencias entre formatos.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { normalizeSql } from "./utils/sql-search";
import { rutContainsCondition, looksLikeRut } from "./utils/rut-sql";


/**
 * "Contiene" tolerante a cómo está escrito el nombre en el ERP.
 *
 * Un ILIKE pelado no servía: el maestro tiene nombres con tilde y con espacios
 * de más ("CONSTRUCTORA  POCURO SPA", con dos), así que el cliente existía y
 * el buscador decía que no. Se normalizan los dos lados —minúsculas, sin
 * tildes y con los espacios colapsados a uno— antes de comparar.
 */
function contieneTexto(columna: SQL, termino: string): SQL {
  const aplanar = (expr: SQL) => sql`regexp_replace(${normalizeSql(expr)}, '\\s+', ' ', 'g')`;
  const patron = `%${termino.replace(/\s+/g, " ").trim()}%`;
  return sql`${aplanar(columna)} LIKE ${aplanar(sql`${patron}`)}`;
}

/** Los tres espejos, y de cuál sale cada número de la pantalla. */
export type OrigenVenta = "facturado" | "nvv" | "gdv";

export const ORIGENES: OrigenVenta[] = ["facturado", "nvv", "gdv"];

export interface DocumentoVenta {
  origen: OrigenVenta;
  tido: string | null;
  idmaeedo: string;
  nudo: string | null;
  clienteRut: string | null;
  clienteNombre: string | null;
  fechaEmision: string | null;
  monto: number;
  lineas: number;
  /** A qué obra ya está asociado (para no asociarlo dos veces sin darse cuenta). */
  obraId?: string | null;
  obraNombre?: string | null;
}

export interface LineaVenta {
  origen: OrigenVenta;
  idmaeedo: string;
  kopr: string | null;
  nombre: string | null;
  cantidad: number;
  monto: number;
}

/**
 * Cabecera de cada espejo, con los nombres de columna ya unificados.
 *
 * Van como SQL crudo y no por el ORM porque son tres esquemas distintos y las
 * columnas se llaman apenas distinto en cada uno (`nokopr` vs `nokoprct`).
 */
const FUENTES: Record<OrigenVenta, { tabla: string; nombreProducto: string }> = {
  facturado: { tabla: "ventas.fact_ventas", nombreProducto: "nokoprct" },
  nvv: { tabla: "nvv.fact_nvv", nombreProducto: "nokopr" },
  gdv: { tabla: "gdv.fact_gdv", nombreProducto: "nokoprct" },
};

/**
 * En fact_ventas conviven todos los tipos de documento, así que se descartan
 * los dos que tienen espejo propio (NVV y GDV) para no traerlos duplicados.
 *
 * A propósito NO hay lista blanca de tipos: si mañana aparece un NVI, un FDV o
 * cualquier otro, entra solo. Con una lista cerrada el documento simplemente no
 * aparecía en el buscador y no había forma de darse cuenta de por qué.
 */
const FILTRO_TIPO: Record<OrigenVenta, string> = {
  facturado: "(tido IS NULL OR tido NOT IN ('NVV', 'GDV'))",
  nvv: "TRUE",
  gdv: "TRUE",
};

/**
 * Busca documentos para asociar a una obra.
 *
 * `q` matchea nombre de cliente, RUT o número de documento. No se acota al RUT
 * de la constructora a propósito: en muchas obras el material lo compra el
 * contratista, así que el documento viene a nombre de otro.
 */
export async function buscarDocumentos(opciones: {
  q?: string;
  clienteRut?: string;
  desde?: string;
  hasta?: string;
  origenes?: OrigenVenta[];
  limit?: number;
}): Promise<DocumentoVenta[]> {
  const { q, clienteRut, desde, hasta } = opciones;
  const origenes = opciones.origenes?.length ? opciones.origenes : ORIGENES;
  // Con un cliente ya elegido se traen TODOS sus documentos: el tope existe
  // para la búsqueda libre, y si recorta ahí esconde clientes enteros.
  const limit = Math.min(opciones.limit ?? (clienteRut ? 3000 : 100), 5000);

  // Lo que escribe la persona viaja SIEMPRE como parámetro, nunca pegado al
  // texto de la consulta: si no, un nombre con comilla la rompe y, peor, deja
  // colar SQL escrito a mano desde el buscador.
  const texto = (q ?? "").trim();
  const consultas = origenes.map((origen) => {
    const condiciones = [sql.raw(FILTRO_TIPO[origen])];
    if (desde) condiciones.push(sql`feemdo >= ${desde}`);
    if (hasta) condiciones.push(sql`feemdo <= ${hasta}`);
    // Cliente ya elegido: se compara por RUT, tolerando que un lado lo tenga
    // con puntos y guion y el otro no.
    if (clienteRut) {
      const porRut = rutContainsCondition(sql`endo`, clienteRut);
      condiciones.push(porRut ?? sql`endo = ${clienteRut}`);
    } else if (texto) {
      // Búsqueda libre: nombre (sin tildes ni espacios de más), RUT (en
      // cualquier formato) o número de documento.
      const alternativas = [contieneTexto(sql`nokoen`, texto), contieneTexto(sql`CAST(nudo AS TEXT)`, texto)];
      const porRut = rutContainsCondition(sql`endo`, texto);
      if (porRut) alternativas.push(porRut);
      else if (!looksLikeRut(texto)) alternativas.push(contieneTexto(sql`endo`, texto));
      condiciones.push(sql`(${sql.join(alternativas, sql` OR `)})`);
    }
    return sql`
      SELECT
        ${origen}::text                  AS origen,
        MAX(tido)::text                  AS tido,
        CAST(idmaeedo AS TEXT)           AS idmaeedo,
        MAX(CAST(nudo AS TEXT))          AS nudo,
        MAX(endo)                        AS cliente_rut,
        MAX(nokoen)                      AS cliente_nombre,
        MAX(feemdo)                      AS fecha_emision,
        COALESCE(SUM(monto), 0)          AS monto,
        COUNT(*)                         AS lineas
      FROM ${sql.raw(FUENTES[origen].tabla)}
      WHERE ${sql.join(condiciones, sql` AND `)}
      GROUP BY idmaeedo
    `;
  });

  const filas: any = await db.execute(sql`
    SELECT * FROM (${sql.join(consultas, sql` UNION ALL `)}) AS docs
    ORDER BY fecha_emision DESC NULLS LAST
    LIMIT ${limit}
  `);

  return (filas.rows ?? filas).map(mapearDocumento);
}

export interface ClienteConDocumentos {
  rut: string;
  nombre: string;
  documentos: number;
  ultimaCompra: string | null;
}

/**
 * Los clientes que TIENEN documentos, para elegir uno antes de ver sus ventas.
 *
 * El buscador antes iba directo a los documentos y devolvía los más recientes
 * de todos: con un término común se llenaba de clientes mezclados y el que se
 * buscaba podía quedar afuera, tapado por documentos más nuevos de otros. Acá
 * se agrupa por cliente, así siempre aparece completo el que uno escribió.
 */
export async function buscarClientes(q: string, limit = 25): Promise<ClienteConDocumentos[]> {
  const texto = (q ?? "").trim();
  if (texto.length < 2) return [];

  const consultas = ORIGENES.map((origen) => {
    const porRut = rutContainsCondition(sql`endo`, texto);
    const alternativas = [contieneTexto(sql`nokoen`, texto)];
    if (porRut) alternativas.push(porRut);
    else if (!looksLikeRut(texto)) alternativas.push(contieneTexto(sql`endo`, texto));

    return sql`
      SELECT
        endo AS rut,
        nokoen AS nombre,
        feemdo,
        ${origen}::text || ':' || CAST(idmaeedo AS TEXT) AS doc
      FROM ${sql.raw(FUENTES[origen].tabla)}
      WHERE ${sql.raw(FILTRO_TIPO[origen])} AND (${sql.join(alternativas, sql` OR `)})
    `;
  });

  const filas: any = await db.execute(sql`
    SELECT
      rut,
      MAX(nombre)          AS nombre,
      -- Documentos, NO líneas: cada factura trae varias y contarlas todas
      -- mostraba "1.850 docs" donde en realidad hay 1.254.
      COUNT(DISTINCT doc)  AS documentos,
      MAX(feemdo)          AS ultima_compra
    FROM (${sql.join(consultas, sql` UNION ALL `)}) AS t
    WHERE rut IS NOT NULL
    GROUP BY rut
    ORDER BY ultima_compra DESC NULLS LAST
    LIMIT 200
  `);

  // El MISMO cliente aparece con el RUT escrito de varias formas: el ERP guarda
  // unos con dígito verificador y otros sin él ("79840820" y "79840820-8" son
  // CONSTRUCTORA POCURO las dos veces, con 548 y 1.302 documentos cada una).
  // Agrupados por RUT tal cual, la lista mostraba el mismo cliente tres veces y
  // eligiendo uno se perdían los documentos de los otros. Se juntan por el
  // cuerpo del RUT con la misma regla que usa el resto del sistema.
  //
  // La regla es la misma que usa rutColumnsMatchSql: son el mismo RUT si
  // coinciden tal cual, o si a uno le sobra exactamente el último carácter
  // respecto del otro. No se usa rutMatchKey acá porque necesita saber si el
  // último dígito es un verificador válido, y con "79840820" (que ya viene sin
  // DV) se come un dígito de más y deja de calzar con "79840820-8".
  //
  // A propósito NO se juntan "79840820" y "79840821": difieren en el cuerpo, y
  // aunque se llamen parecido pueden ser dos empresas distintas.
  const limpiar = (r: string) => r.toUpperCase().replace(/[^0-9K]/g, "");
  const mismoRut = (a: string, b: string) =>
    a === b || a === b.slice(0, -1) || a.slice(0, -1) === b;

  const grupos: Array<ClienteConDocumentos & { _norma: string }> = [];
  for (const f of (filas.rows ?? filas)) {
    const rut = String(f.rut);
    const norma = limpiar(rut);
    const nombre = f.nombre ?? rut;
    const documentos = Number(f.documentos ?? 0);
    const ultimaCompra = f.ultima_compra ? String(f.ultima_compra).slice(0, 10) : null;

    const previo = norma.length >= 7 ? grupos.find((g) => mismoRut(g._norma, norma)) : undefined;
    if (!previo) {
      grupos.push({ _norma: norma, rut, nombre, documentos, ultimaCompra });
      continue;
    }
    previo.documentos += documentos;
    if (ultimaCompra && (!previo.ultimaCompra || ultimaCompra > previo.ultimaCompra)) {
      previo.ultimaCompra = ultimaCompra;
      // Se queda el nombre y el RUT de la versión con la compra más reciente:
      // suele ser la ficha que el ERP mantiene al día.
      previo.nombre = nombre;
      previo.rut = rut;
      previo._norma = norma;
    }
  }

  return grupos
    .sort((a, b) => (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? ""))
    .slice(0, limit)
    .map(({ _norma, ...cliente }) => cliente);
}

/** Trae un documento puntual, para guardarle la foto al asociarlo. */
export async function obtenerDocumento(origen: OrigenVenta, idmaeedo: string): Promise<DocumentoVenta | null> {
  const { tabla } = FUENTES[origen];
  const id = String(idmaeedo).replace(/[^0-9]/g, "");
  if (!id) return null;

  const filas: any = await db.execute(sql`
    SELECT
      ${origen}::text            AS origen,
      MAX(tido)::text            AS tido,
      CAST(idmaeedo AS TEXT)     AS idmaeedo,
      MAX(CAST(nudo AS TEXT))    AS nudo,
      MAX(endo)                  AS cliente_rut,
      MAX(nokoen)                AS cliente_nombre,
      MAX(feemdo)                AS fecha_emision,
      COALESCE(SUM(monto), 0)    AS monto,
      COUNT(*)                   AS lineas
    FROM ${sql.raw(tabla)}
    WHERE idmaeedo = ${id} AND ${sql.raw(FILTRO_TIPO[origen])}
    GROUP BY idmaeedo
  `);

  const fila = (filas.rows ?? filas)[0];
  return fila ? mapearDocumento(fila) : null;
}

/**
 * Las líneas de los documentos ya asociados, agrupadas por producto.
 *
 * Devuelve una fila por (origen, SKU): es lo que después se compara contra lo
 * proyectado de cada producto de la obra.
 */
export async function lineasDeDocumentos(
  vinculos: Array<{ origen: string; idmaeedo: string }>,
): Promise<LineaVenta[]> {
  const porOrigen = new Map<OrigenVenta, string[]>();
  for (const v of vinculos) {
    if (!ORIGENES.includes(v.origen as OrigenVenta)) continue;
    const id = String(v.idmaeedo).replace(/[^0-9]/g, "");
    if (!id) continue;
    const lista = porOrigen.get(v.origen as OrigenVenta);
    if (lista) lista.push(id);
    else porOrigen.set(v.origen as OrigenVenta, [id]);
  }
  if (porOrigen.size === 0) return [];

  const consultas = Array.from(porOrigen.entries()).map(([origen, ids]: [OrigenVenta, string[]]) => {
    const { tabla, nombreProducto } = FUENTES[origen];
    return sql`
      SELECT
        ${origen}::text                       AS origen,
        CAST(idmaeedo AS TEXT)                AS idmaeedo,
        koprct                                AS kopr,
        MAX(${sql.raw(nombreProducto)})       AS nombre,
        COALESCE(SUM(caprco2), 0)             AS cantidad,
        COALESCE(SUM(monto), 0)               AS monto
      FROM ${sql.raw(tabla)}
      WHERE idmaeedo IN (${sql.join(ids.map((i: string) => sql`${i}`), sql`, `)})
      GROUP BY idmaeedo, koprct
    `;
  });

  const filas: any = await db.execute(sql.join(consultas, sql` UNION ALL `));

  return (filas.rows ?? filas).map((f: any) => ({
    origen: f.origen as OrigenVenta,
    idmaeedo: String(f.idmaeedo),
    kopr: f.kopr != null ? String(f.kopr).trim() : null,
    nombre: f.nombre ?? null,
    cantidad: Number(f.cantidad ?? 0),
    monto: Number(f.monto ?? 0),
  }));
}

function mapearDocumento(f: any): DocumentoVenta {
  return {
    origen: f.origen as OrigenVenta,
    tido: f.tido ?? null,
    idmaeedo: String(f.idmaeedo),
    nudo: f.nudo != null ? String(f.nudo) : null,
    clienteRut: f.cliente_rut ?? null,
    clienteNombre: f.cliente_nombre ?? null,
    fechaEmision: f.fecha_emision ? String(f.fecha_emision).slice(0, 10) : null,
    monto: Number(f.monto ?? 0),
    lineas: Number(f.lineas ?? 0),
  };
}
