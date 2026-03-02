import { db } from './server/db';
import { users } from './shared/schema';

async function main() {
    const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role
    }).from(users);

    console.log(JSON.stringify(allUsers, null, 2));
    process.exit(0);
}
main().catch(console.error);
