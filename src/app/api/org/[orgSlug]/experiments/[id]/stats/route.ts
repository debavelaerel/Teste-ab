import { NextRequest, NextResponse } from 'next/server'
import { eq, count, and } from 'drizzle-orm'
import { db } from '@/db'
import { abVisits, abConversions, abExperiments } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await params
  let org: Awaited<ReturnType<typeof requireOrgMember>>['org']
  try {
    ;({ org } = await requireOrgMember(orgSlug))
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const exp = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)),
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
