import { db } from './server/db';
import { quotes, users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const result = await db.select({
    quoteId: quotes.id,
    createdBy: quotes.createdBy,
    userId: users.id,
    userEmail: users.email,
    userFirstName: users.firstName,
    userLastName: users.lastName
  })
    .from(quotes)
    .leftJoin(users, eq(quotes.createdBy, users.id))
    .orderBy(quotes.createdAt)
    .limit(5);

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(console.error);
