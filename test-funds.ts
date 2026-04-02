import 'dotenv/config';
import { db } from './server/db';
import { fundAllocations } from './shared/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const userId = 'fad9462a-6c0f-4da6-9cd0-3a3a7ba52479'; // Israel
  const allocations = await db.select().from(fundAllocations).where(eq(fundAllocations.assignedToId, userId));
  console.log('Israel allocations:', allocations.length);
}
main().catch(console.error).finally(() => process.exit(0));
