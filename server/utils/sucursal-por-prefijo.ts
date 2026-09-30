/**
 * Sucursales de una cadena que solo se distinguen por el prefijo de su orden de compra.
 *
 * Caso REDMAT: las ferreterías de la cadena facturan con un solo RUT y un solo
 * código de cliente del ERP, así que todas sus ventas llegan con el mismo `endo`
 * y el mismo nombre, "REDMAT SPA". Lo único que separa una de otra es el prefijo
 * con el que numeran la orden de compra: "009-1129" es Ferretería Chávez de Cabrero.
 *
 * Dónde vive ese dato: NO en el encabezado del documento (dbo.MAEEDO no tiene
 * columna OCDO) sino en su ficha de observaciones, dbo.MAEEDOOB.OCDO, una fila
 * por documento. Los tres ETL la traen con un LEFT JOIN por IDMAEEDO.
 *
 * Qué hace esta imputación: a la venta que trae un prefijo conocido le escribe el
 * nombre de la ferretería. Cambia SOLO el nombre, nunca el código de cliente, y
 * esa distinción es deliberada:
 *   · los informes de la intranet agrupan por nombre  → las ferreterías se ven separadas;
 *   · la deuda, la cartera y el crédito van por código → siguen consolidados en
 *     REDMAT, que es como lo pidió el cliente.
 *
 * Normalización del prefijo: se toma lo que está antes del primer guion y se
 * completa con ceros a la izquierda, porque en el ERP conviven "028-624" y
 * "28-624" escritos a mano. Lo que no calce con una ficha cargada conserva el
 * nombre de la casa matriz: no se adivina nada.
 *
 * Es idempotente y corre en dos momentos: al arrancar el server (así un
 * despliegue la aplica sin esperar al ETL) y al final de cada uno de los tres
 * ETL, porque una recarga vuelve a traer "REDMAT SPA" desde el ERP y hay que
 * corregirla en la misma pasada. El UPDATE recorre la tabla entera, no solo lo
 * recién cargado.
 *
 * Antes de renombrar, replica las reglas de comisión de la matriz en cada
 * sucursal (ver asegurarComisionesDeSucursales). Si eso falla, no renombra.
 */

import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { db } from '../db';

/** Las tres tablas de hechos que muestran el nombre del cliente en la intranet. */
const TABLAS = ['ventas.fact_ventas', 'nvv.fact_nvv', 'gdv.fact_gdv'] as const;

export interface ImputacionSucursales {
  tabla: string;
  filas: number;
}

/**
 * Replica en cada sucursal las reglas de comisión por cliente de su casa matriz.
 *
 * Las comisiones calzan al cliente POR NOMBRE (commissions.ts: `cli_ovr.value =
 * fv.nokoen`). Al imputar, una venta deja de llamarse "REDMAT SPA" y pasa a
 * llamarse como su ferretería, así que una regla escrita para "REDMAT SPA"
 * dejaría de aplicarle y esa venta caería a la tasa por defecto sin aviso. Al
 * escribir esto, REDMAT tiene al menos una regla así.
 *
 * Solo inserta lo que falta. No toca la regla de la matriz —las ventas sin
 * prefijo siguen llamándose "REDMAT SPA" y la necesitan— ni actualiza una copia
 * existente: si alguien le cambia la tasa a una ferretería desde el panel, se
 * respeta. La contracara: si después se cambia la tasa de la matriz, las copias
 * de las ferreterías no la siguen solas.
 */
export async function asegurarComisionesDeSucursales(): Promise<number> {
  const r = await db.execute(sql`
    INSERT INTO commission_overrides (salesperson_name, override_type, value, commission_pct, updated_by)
    SELECT DISTINCT o.salesperson_name, 'client', suc.nokoen, o.commission_pct, 'sucursal-por-prefijo'
    FROM commission_overrides o
    JOIN clients matriz ON matriz.nokoen = o.value AND matriz.parent_client_id IS NULL
    JOIN clients suc ON suc.parent_client_id = matriz.id AND suc.oc_prefix IS NOT NULL
    WHERE o.override_type = 'client'
    ON CONFLICT (salesperson_name, override_type, value) DO NOTHING
  `);
  return (r as any).rowCount ?? 0;
}

export async function imputarSucursalesPorPrefijo(): Promise<ImputacionSucursales[]> {
  const resumen: ImputacionSucursales[] = [];

  // Las comisiones van SIEMPRE antes que el nombre, y dentro de esta misma
  // función: la llame el arranque o cualquiera de los tres ETL, cuando una venta
  // cambia de nombre su regla de comisión ya está copiada.
  try {
    const copiadas = await asegurarComisionesDeSucursales();
    if (copiadas > 0) console.log(`   💰 ${copiadas} regla(s) de comisión replicadas a sucursales`);
  } catch (e: any) {
    // Sin las reglas copiadas, renombrar cambiaría comisiones en silencio.
    // Mejor no imputar nada y reintentar en la próxima corrida.
    console.warn(`   ⚠️  No se pudieron replicar las comisiones, no se imputan sucursales: ${e?.message || e}`);
    return resumen;
  }

  for (const tabla of TABLAS) {
    try {
      const r = await db.execute(sql`
        UPDATE ${sql.raw(tabla)} f
        SET nokoen = suc.nokoen
        FROM clients suc
        JOIN clients matriz ON matriz.id = suc.parent_client_id
        WHERE suc.oc_prefix IS NOT NULL
          AND matriz.koen IS NOT NULL
          AND f.endo = matriz.koen
          AND lpad(split_part(btrim(f.ocdo), '-', 1), 3, '0') = suc.oc_prefix
          AND f.nokoen IS DISTINCT FROM suc.nokoen
      `);
      const filas = (r as any).rowCount ?? 0;
      resumen.push({ tabla, filas });
      if (filas > 0) console.log(`   🏪 ${tabla}: ${filas} venta(s) imputadas a su sucursal`);
    } catch (e: any) {
      // Una tabla que no existe todavía no puede voltear el ETL completo.
      console.warn(`   ⚠️  No se pudo imputar sucursales en ${tabla}: ${e?.message || e}`);
      resumen.push({ tabla, filas: 0 });
    }
  }

  return resumen;
}

/**
 * Nombre de la cadena para mostrar junto a una sucursal, sin la razón social:
 * "REDMAT SPA" → "REDMAT". En un buscador se lee "FERRETERIA FLANDEZ - REDMAT".
 */
export function nombreCortoCadena(nombreMatriz: string): string {
  const corto = nombreMatriz
    .trim()
    .replace(/[\s,.]+(SPA|S\.?P\.?A\.?|LTDA\.?|LIMITADA|S\.?A\.?|EIRL|E\.I\.R\.L\.?)$/i, '')
    .trim();
  return corto || nombreMatriz.trim();
}

/**
 * Qué sucursales por prefijo hay y a qué cadena pertenecen, para marcarlas en
 * el buscador de clientes: nombre de la sucursal en mayúsculas → nombre corto
 * de su cadena. Son pocas filas y van por el índice parcial de oc_prefix.
 */
export async function cadenasPorSucursal(): Promise<Map<string, string>> {
  const r = await db.execute(sql`
    SELECT suc.nokoen AS sucursal, matriz.nokoen AS matriz
    FROM clients suc
    JOIN clients matriz ON matriz.id = suc.parent_client_id
    WHERE suc.oc_prefix IS NOT NULL
  `);
  const mapa = new Map<string, string>();
  for (const f of ((r as any).rows || []) as Array<{ sucursal: string; matriz: string }>) {
    if (f.sucursal && f.matriz) mapa.set(f.sucursal.trim().toUpperCase(), nombreCortoCadena(f.matriz));
  }
  return mapa;
}

/**
 * Agrega `cadena` ("REDMAT") a las filas cuyo nombre es el de una sucursal por
 * prefijo, para que un listado de clientes muestre "FERRETERIA FLANDEZ - REDMAT".
 * `campo` es la propiedad que trae el nombre en ese listado (`name`, `nokoen`,
 * `clientName`...). El nombre no se toca: es lo que usan los enlaces a la ficha.
 * Si la consulta falla, devuelve las filas como vinieron: una etiqueta no puede
 * tumbar un listado.
 */
export async function marcarCadenas<T extends Record<string, any>>(filas: T[], campo: string): Promise<T[]> {
  if (!Array.isArray(filas) || filas.length === 0) return filas;
  try {
    const cadenas = await cadenasPorSucursal();
    if (cadenas.size === 0) return filas;
    return filas.map((f) => {
      const cadena = cadenas.get(String(f[campo] ?? '').trim().toUpperCase());
      return cadena ? { ...f, cadena } : f;
    });
  } catch (e) {
    console.warn('[cadenas] No se pudieron marcar las sucursales:', e);
    return filas;
  }
}

/**
 * Nombres de las sucursales de una cadena, si `nombre` es su casa matriz
 * ("REDMAT SPA" → las ferreterías). Vacío si no es la matriz de una cadena.
 */
export async function sucursalesDeCadena(nombre: string): Promise<string[]> {
  const limpio = (nombre || '').trim();
  if (!limpio) return [];
  try {
    const r = await db.execute(sql`
      SELECT suc.nokoen AS sucursal
      FROM clients matriz
      JOIN clients suc ON suc.parent_client_id = matriz.id AND suc.oc_prefix IS NOT NULL
      WHERE matriz.parent_client_id IS NULL
        AND UPPER(btrim(matriz.nokoen)) = UPPER(${limpio})
      ORDER BY suc.nokoen
    `);
    return (((r as any).rows || []) as Array<{ sucursal: string }>).map((f) => f.sucursal).filter(Boolean);
  } catch (e) {
    // Sin la lista se filtra como antes, por el nombre exacto: nunca de más.
    console.warn('[cadenas] No se pudieron leer las sucursales de la cadena:', e);
    return [];
  }
}

/**
 * Nombres con los que se filtran las ventas de un cliente en los informes.
 *
 * La imputación le pone a cada venta de la cadena el nombre de su ferretería,
 * así que filtrar por "REDMAT SPA" a secas dejaba afuera todo lo que se compró
 * con orden de compra: solo quedaban las ventas sin prefijo. Si el cliente es la
 * matriz de una cadena, van también los nombres de sus sucursales; si no, el
 * suyo solo, igual que siempre.
 */
export async function nombresParaFiltrarCliente(nombre: string): Promise<string[]> {
  const sucursales = await sucursalesDeCadena(nombre);
  return [nombre, ...sucursales.filter((s) => s !== nombre)];
}

/**
 * Condición sobre la columna del nombre del cliente: `col = nombre` o, si es la
 * matriz de una cadena, `col IN (matriz, sucursales...)`. Sirve igual para una
 * columna de Drizzle (`factVentas.nokoen`) que para SQL crudo (sql`fv."nokoen"`).
 */
export async function condicionNombreCliente(columna: SQLWrapper, nombre: string): Promise<SQL> {
  const nombres = await nombresParaFiltrarCliente(nombre);
  if (nombres.length === 1) return sql`${columna} = ${nombre}`;
  return sql`${columna} IN (${sql.join(nombres.map((n) => sql`${n}`), sql`, `)})`;
}

/**
 * Fichas de sucursal cuya cadena calza con lo que se buscó: escribir "redmat"
 * tiene que traer también las ferreterías, que no llevan ese texto en su nombre.
 */
export async function sucursalesDeCadenasQueCalzan(
  termino: string,
): Promise<Array<{ id: string; nokoen: string; koen: string | null; cadena: string }>> {
  const t = (termino || '').trim();
  if (t.length < 2) return [];
  try {
    const r = await db.execute(sql`
      SELECT suc.id, suc.nokoen, suc.koen, matriz.nokoen AS matriz
      FROM clients matriz
      JOIN clients suc ON suc.parent_client_id = matriz.id AND suc.oc_prefix IS NOT NULL
      WHERE matriz.parent_client_id IS NULL
        AND matriz.nokoen ILIKE ${'%' + t + '%'}
      ORDER BY suc.nokoen
    `);
    return (((r as any).rows || []) as Array<{ id: string; nokoen: string; koen: string | null; matriz: string }>).map(
      (f) => ({ id: f.id, nokoen: f.nokoen, koen: f.koen, cadena: nombreCortoCadena(f.matriz) }),
    );
  } catch (e) {
    console.warn('[cadenas] No se pudieron buscar sucursales por cadena:', e);
    return [];
  }
}

/**
 * Condición de búsqueda por nombre sobre las ventas que también trae a las
 * sucursales de las cadenas cuyo nombre calza: buscar "redmat" en un ranking
 * lista cada ferretería, no solo las ventas que quedaron como "REDMAT SPA".
 */
export function condicionBusquedaConCadenas(columna: SQLWrapper, termino: string): SQL {
  const patron = `%${termino.trim().toLowerCase()}%`;
  return sql`(LOWER(${columna}) LIKE ${patron} OR ${columna} IN (
    SELECT suc.nokoen
    FROM clients suc
    JOIN clients matriz ON matriz.id = suc.parent_client_id
    WHERE suc.oc_prefix IS NOT NULL
      AND matriz.parent_client_id IS NULL
      AND LOWER(matriz.nokoen) LIKE ${patron}
  ))`;
}
