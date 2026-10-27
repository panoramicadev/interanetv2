// Una sola vez (27-oct-2026): las áreas de los reclamos quedan en Laboratorio,
// Producción, Logística, Cliente y Comercial. Ordena los que estaban fuera de esas:
//   área inicial "aplicacion"   → "cliente"
//   área actual  "envase"       → "logistica" (el equipo que ya atendía Envase)
// Antes guarda cómo estaban en scripts/_areas-reclamos-respaldo-2026-10-27.json.
//   npx tsx -r dotenv/config scripts/_areas-reclamos-a-5-2026-10-27.ts
import { writeFileSync } from "fs";
import { pool } from "../server/db";

async function main() {
  const antes = await pool.query(
    `select id, client_name, client_rut, estado, area_asignada_inicial, area_responsable_actual
       from reclamos_generales
      where area_asignada_inicial = 'aplicacion' or area_responsable_actual = 'envase'`,
  );
  writeFileSync(
    new URL("./_areas-reclamos-respaldo-2026-10-27.json", import.meta.url),
    JSON.stringify(antes.rows, null, 2),
  );
  console.log(`respaldo: ${antes.rows.length} reclamos`);

  const inicial = await pool.query(
    `update reclamos_generales set area_asignada_inicial = 'cliente' where area_asignada_inicial = 'aplicacion'`,
  );
  const actual = await pool.query(
    `update reclamos_generales set area_responsable_actual = 'logistica' where area_responsable_actual = 'envase'`,
  );
  console.log(`área inicial → cliente: ${inicial.rowCount} · área actual → logística: ${actual.rowCount}`);
  process.exit(0);
}
main();
