import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abMemberships, abOrganizations } from '@/db/schema'

export default async function OrgRootPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const rows = await db
    .select({ org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(eq(abMemberships.userId, session.user.id))
    .limit(1)

  if (rows.length === 0) redirect('/login')
  redirect(`/org/${rows[0].org.slug}`)
}
