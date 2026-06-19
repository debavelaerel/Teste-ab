import 'dotenv/config'
import { db } from '../src/db'
import { abOrganizations, abMemberships } from '../src/db/schema'
import { user as userTable } from '../src/db/auth-schema'

async function main() {
  const users = await db.select({ id: userTable.id, email: userTable.email }).from(userTable)
  console.log('Users:', JSON.stringify(users, null, 2))

  const orgs = await db.select().from(abOrganizations)
  console.log('Orgs:', JSON.stringify(orgs, null, 2))

  const members = await db.select().from(abMemberships)
  console.log('Memberships:', JSON.stringify(members, null, 2))

  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
