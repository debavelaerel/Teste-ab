import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, count, and } from 'drizzle-orm'
import { db } from '@/db'
import { abVisits, abConversions, abExperiments, abOrganizations, abMemberships } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberRows = await db
    .select({ org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(and(eq(abMemberships.userId, session.user.id), eq(abOrganizations.slug, orgSlug)))
    .limit(1)

  if (memberRows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const exp = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, memberRows[0].org.id)),
  })
  if (!exp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [visitRows, convRows] = await Promise.all([
    db.select({ visits: count() }).from(abVisits).where(eq(abVisits.experimentId, id)),
    db.select({ conversions: count() }).from(abConversions).where(eq(abConversions.experimentId, id)),
  ])

  const visits = Number(visitRows[0]?.visits ?? 0)
  const conversions = Number(convRows[0]?.conversions ?? 0)
  const rate = visits > 0 ? conversions / visits : 0

  return NextResponse.json({ visits, conversions, rate })
}
