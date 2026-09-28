/**
 * Carga las ferreterías de la cadena REDMAT como sucursales de su casa matriz.
 *
 * No hace nada salvo que se lo pidas: por defecto solo muestra lo que haría.
 *
 *   npx tsx -r dotenv/config server/scripts/seed-sucursales-redmat.ts
 *   npx tsx -r dotenv/config server/scripts/seed-sucursales-redmat.ts --aplicar
 *   npx tsx -r dotenv/config server/scripts/seed-sucursales-redmat.ts --revertir
 *
 * Es idempotente: corriéndolo dos veces no duplica nada. La segunda vez
 * actualiza los datos de la ficha que ya existe (nombre, dirección, vendedor),
 * identificándola por el par casa matriz + prefijo.
 *
 * --revertir borra SOLO las fichas que creó este script: las que cuelgan de
 * REDMAT SPA, tienen prefijo y no tienen código del ERP ni usuario de acceso.
 * Si alguna llegó a tener usuario, la deja en pie y lo avisa: borrarla dejaría
 * a esa gente sin poder entrar.
 *
 * Lo que NO toca: la ficha de REDMAT SPA, las ventas, la deuda y cualquier
 * ficha con código del ERP.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { REDMAT_RUT, REDMAT_SUCURSALES } from '../data/redmat-sucursales';

const rutKey = (rut: string) => rut.replace(/[.\-\s]/g, '').replace(/[kK]$/, '').slice(0, -1);

interface FichaExistente {
  id: string;
  nokoen: string;
  oc_prefix: string | null;
  koen: string | null;
  user_id: string | null;
}

async function buscarMatriz(): Promise<{ id: string; nokoen: string; rten: string } | null> {
  const clave = rutKey(REDMAT_RUT);
  const r = await db.execute(sql`
    SELECT id, nokoen, rten FROM clients
    WHERE REPLACE(REPLACE(REPLACE(rten, '.', ''), '-', ''), ' ', '') LIKE ${clave + '%'}
      AND parent_client_id IS NULL
    ORDER BY (koen IS NULL), created_at
  `);
  const filas = (r as any).rows || [];
  return filas[0] || null;
}

async function sucursalesActuales(matrizId: string): Promise<FichaExistente[]> {
  const r = await db.execute(sql`
    SELECT id, nokoen, oc_prefix, koen, user_id
    FROM clients
    WHERE parent_client_id = ${matrizId}
    ORDER BY oc_prefix NULLS LAST
  `);
  return ((r as any).rows || []) as FichaExistente[];
}

async function main() {
  // --aplicar es la confirmación de escritura, tanto para cargar como para
  // borrar: sin él, las dos ramas solo muestran lo que harían.
  const aplicar = process.argv.includes('--aplicar');
  const revertir = process.argv.includes('--revertir');

  // La columna puede no existir todavía si la migración 087 no corrió.
  const col = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'oc_prefix'
  `);
  if (((col as any).rows || []).length === 0) {
    console.error('Falta la columna clients.oc_prefix: corré la migración 087 antes (o levantá el server una vez).');
    process.exit(1);
  }

  const matriz = await buscarMatriz();
  if (!matriz) {
    console.error(`No encontré la ficha de REDMAT (RUT ${REDMAT_RUT}) en clients. No creo nada.`);
    process.exit(1);
  }
  console.log(`Casa matriz: ${matriz.nokoen}  (RUT ${matriz.rten})`);

  const existentes = await sucursalesActuales(matriz.id);
  const porPrefijo = new Map(existentes.filter(f => f.oc_prefix).map(f => [f.oc_prefix!, f]));

  if (revertir) {
    const borrables = existentes.filter(f => f.oc_prefix && !f.koen && !f.user_id);
    const conUsuario = existentes.filter(f => f.oc_prefix && f.user_id);
    const conKoen = existentes.filter(f => f.oc_prefix && f.koen);

    console.log(`\nA borrar: ${borrables.length}`);
    for (const f of borrables) console.log(`  - ${f.oc_prefix} ${f.nokoen}`);
    for (const f of conUsuario) console.log(`  ! ${f.oc_prefix} ${f.nokoen}: tiene usuario de acceso, la dejo en pie`);
    for (const f of conKoen) console.log(`  ! ${f.oc_prefix} ${f.nokoen}: tiene código del ERP, la dejo en pie`);

    if (!aplicar) {
      console.log('\nSimulación. Para borrar de verdad: --revertir --aplicar');
      return;
    }
    for (const f of borrables) {
      await db.execute(sql`DELETE FROM clients WHERE id = ${f.id}`);
    }
    console.log(`\n${borrables.length} ficha(s) borrada(s).`);
    return;
  }

  let aCrear = 0;
  let aActualizar = 0;

  for (const s of REDMAT_SUCURSALES) {
    const ficha = porPrefijo.get(s.prefijo);
    const accion = ficha ? 'actualiza' : 'crea    ';
    console.log(`  ${accion} ${s.prefijo}  ${s.nombre}  (${s.comuna})  vendedor: ${s.vendedor ?? '—'}`);
    if (ficha) aActualizar++; else aCrear++;
  }

  const sobrantes = existentes.filter(
    f => f.oc_prefix && !REDMAT_SUCURSALES.some(s => s.prefijo === f.oc_prefix)
  );
  for (const f of sobrantes) {
    console.log(`  ! ${f.oc_prefix} ${f.nokoen}: está en la base pero no en la lista del cliente. No la toco.`);
  }

  console.log(`\nResumen: ${aCrear} a crear, ${aActualizar} a actualizar, ${sobrantes.length} sin tocar.`);

  if (!aplicar) {
    console.log('\nSimulación. Para escribir de verdad: --aplicar');
    return;
  }

  for (const s of REDMAT_SUCURSALES) {
    const ficha = porPrefijo.get(s.prefijo);
    if (ficha) {
      await db.execute(sql`
        UPDATE clients SET
          nokoen = ${s.nombre},
          branch_label = ${s.nombre},
          dien = ${s.direccion},
          comuna = ${s.comuna},
          email = ${s.email},
          kofuen = ${s.vendedor},
          updated_at = NOW()
        WHERE id = ${ficha.id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO clients (nokoen, rten, oc_prefix, parent_client_id, branch_label, dien, comuna, email, kofuen)
        VALUES (${s.nombre}, ${matriz.rten}, ${s.prefijo}, ${matriz.id}, ${s.nombre},
                ${s.direccion}, ${s.comuna}, ${s.email}, ${s.vendedor})
      `);
    }
  }

  const despues = await sucursalesActuales(matriz.id);
  console.log(`\nListo. ${matriz.nokoen} tiene ahora ${despues.filter(f => f.oc_prefix).length} sucursal(es) con prefijo.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Falló:', e?.message || e);
    process.exit(1);
  });
