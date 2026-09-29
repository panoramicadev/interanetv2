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

import { sql } from 'drizzle-orm';
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
 * dejaría de aplicarle y esa venta caería a la tasa por defecto sin aviso. Hoy
 * existe una: PABLO SOTO VERA, 3%, sobre unas 2.000 líneas de venta.
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
