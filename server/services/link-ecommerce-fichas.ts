import { sql } from 'drizzle-orm';
import { db } from '../db';
import { rutColumnsMatchSql } from '../utils/rut-sql';

/**
 * Vincula por RUT las cuentas de Panorámica Market que quedaron sin ficha.
 *
 * Cuando alguien da de alta el acceso al Market ANTES de que el cliente exista
 * en la intranet (o antes de que el ETL lo traiga del ERP), la cuenta se crea
 * con `client_id` en NULL y nunca se vuelve a vincular sola. El panel de admin
 * igual la reconoce —ahí el match es por RUT— y muestra "En eCommerce", pero
 * como no hay vínculo firme queda con el cartel "Sin ficha", y el portal del
 * cliente, que arranca por `client_id`, no encuentra nada y muestra todo en cero.
 *
 * Este barrido corre al final del ETL de clientes: apenas la ficha aparece en la
 * intranet, la cuenta que la estaba esperando queda vinculada.
 *
 * Es deliberadamente conservador:
 *  - solo cuentas titulares (`parent_user_id IS NULL`) que hoy no tienen ficha;
 *  - solo si el RUT apunta a UNA sola ficha (si hay varias con el mismo RUT no
 *    adivina cuál corresponde y lo deja para el vínculo manual);
 *  - solo rellena NULLs, nunca le saca la ficha a otra cuenta ya vinculada.
 */
export async function linkPendingEcommerceAccounts(): Promise<{ linked: number }> {
  const match = rutColumnsMatchSql(sql`su.client_rut`, sql`c.rten`);

  // Paso 1: fijar la ficha en la cuenta.
  const linkResult: any = await db.execute(sql`
    WITH candidatos AS (
      SELECT su.id AS user_id,
             (SELECT c.id
                FROM clients c
               WHERE ${match}
               ORDER BY c.parent_client_id NULLS FIRST, c.created_at
               LIMIT 1) AS client_id,
             (SELECT COUNT(*) FROM clients c WHERE ${match}) AS coincidencias
        FROM salespeople_users su
       WHERE su.role = 'client'
         AND su.parent_user_id IS NULL
         AND su.client_id IS NULL
         AND COALESCE(TRIM(su.client_rut), '') <> ''
    )
    UPDATE salespeople_users su
       SET client_id = a.client_id, updated_at = NOW()
      FROM candidatos a
     WHERE su.id = a.user_id
       AND a.client_id IS NOT NULL
       AND a.coincidencias = 1
    RETURNING su.id AS user_id, su.client_id
  `);

  const linkedRows = ((Array.isArray(linkResult) ? linkResult : linkResult?.rows) || []) as Array<{
    user_id: string;
    client_id: string;
  }>;

  if (linkedRows.length === 0) return { linked: 0 };

  // Paso 2: espejar clients.user_id, solo donde está libre (igual que el
  // vínculo manual de POST /api/users/clients/:userId/link-client).
  try {
    for (const row of linkedRows) {
      await db.execute(sql`
        UPDATE clients
           SET user_id = ${row.user_id}
         WHERE id = ${row.client_id}
           AND COALESCE(user_id, '') = ''
      `);
    }
  } catch (e) {
    // El vínculo que importa (salespeople_users.client_id) ya quedó escrito.
    console.warn('[link-ecommerce-fichas] no se pudo espejar clients.user_id:', e);
  }

  console.log(`   🔗 ${linkedRows.length} cuentas de Market vinculadas a su ficha por RUT`);
  return { linked: linkedRows.length };
}
