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
 * Es idempotente y se corre al final de cada ETL, así una recarga que vuelve a
 * traer "REDMAT SPA" desde el ERP queda corregida en la misma pasada.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';

/** Las tres tablas de hechos que muestran el nombre del cliente en la intranet. */
const TABLAS = ['ventas.fact_ventas', 'nvv.fact_nvv', 'gdv.fact_gdv'] as const;

export interface ImputacionSucursales {
  tabla: string;
  filas: number;
}

export async function imputarSucursalesPorPrefijo(): Promise<ImputacionSucursales[]> {
  const resumen: ImputacionSucursales[] = [];

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
