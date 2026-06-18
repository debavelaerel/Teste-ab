import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abMemberships, abOrganizations } from '@/db/schema'
import type { Organization, Membership } from '@/db/schema'

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Unauthorized' : 'Forbidden')
  }
}

export async function requireOrgMember(
  orgSlug: string
): Promise<{ session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>; membership: Membership; org: Organization }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new AuthError(401)

  const rows = await db
    .select({ membership: abMemberships, org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(
      and(
        eq(abMemberships.userId, session.user.id),
        eq(abOrganizations.slug, orgSlug)
      )
    )
    .limit(1)

  if (rows.length === 0) throw new AuthError(403)
  return { session, membership: rows[0].membership, org: rows[0].org }
}
