import 'dotenv/config';
import { db } from './server/db';
import { warehouses } from './shared/schema';

async function main() {
  const allWarehouses = await db.select().from(warehouses);
  console.log(JSON.stringify(allWarehouses, null, 2));
  process.exit(0);
}
main();
