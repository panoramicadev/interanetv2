// Una sola vez (27-oct-2026): la gravedad de los reclamos queda en Baja / Media / Alta.
// Guarda primero cuáles estaban en "critica" (scripts/_gravedad-critica-respaldo-2026-10-27.json)
// y después los pasa a "alta". Para devolverlos, usar los ids de ese respaldo.
//   npx tsx -r dotenv/config scripts/_gravedad-critica-a-alta-2026-10-27.ts
import { writeFileSync } from "fs";
import { pool } from "../server/db";

async function main() {
  const antes = await pool.query(
    `select id, client_name, client_rut, gravedad, estado, fecha_registro from reclamos_generales where gravedad = 'critica' order by fecha_registro`,
  );
  writeFileSync(
    new URL("./_gravedad-critica-respaldo-2026-10-27.json", import.meta.url),
    JSON.stringify(antes.rows, null, 2),
  );
  console.log(`respaldo: ${antes.rows.length} reclamos en "critica"`);

  const cambio = await pool.query(
    `update reclamos_generales set gravedad = 'alta' where gravedad = 'critica' returning id`,
  );
  console.log(`actualizados a "alta": ${cambio.rowCount}`);
  process.exit(0);
}
main();
