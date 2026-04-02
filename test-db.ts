import { db } from './server/db';
import { warehouses } from './shared/schema';

async function main() {
  try {
    const crypto = await import('crypto');
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const newKobo = `MNL-${uniqueId}`;
    const newKosu = `RET-${uniqueId}`;
    
    console.log("Attempting insert...");
    const [newWarehouse] = await db.insert(warehouses).values({
      kobo: newKobo,
      kosu: newKosu,
      name: "TEST",
      branchName: "TEST",
      location: null,
      active: true,
      isManual: true
    }).returning();
    console.log("Success:", newWarehouse);
  } catch (err) {
    console.log("Error:", err);
  }
}
main();
