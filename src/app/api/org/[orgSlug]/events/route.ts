import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abVisits, abConversions, abExperiments, abVariants } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params

  try {
    const { org } = await requireOrgMember(orgSlug)

    const visits = await db
      .select({
        id: abVisits.id,
        createdAt: abVisits.createdAt,
        visitorId: abVisits.visitorId,
        experiment: abExperiments.name,
        experimentSlug: abExperiments.slug,
        variant: abVariants.label,
      })
      .from(abVisits)
      .innerJoin(abExperiments, eq(abVisits.experimentId, abExperiments.id))
      .innerJoin(abVariants, eq(abVisits.variantId, abVariants.id))
      .where(eq(abExperiments.orgId, org.id))
      .orderBy(desc(abVisits.createdAt))
      .limit(100)

    const conversions = await db
      .select({
        id: abConversions.id,
        createdAt: abConversions.createdAt,
        visitorId: abConversions.visitorId,
        experiment: abExperiments.name,
        experimentSlug: abExperiments.slug,
        variant: abVariants.label,
        orderId: abConversions.externalOrderId,
        source: abConversions.source,
        amount: abConversions.amount,
      })
      .from(abConversions)
      .innerJoin(abExperiments, eq(abConversions.experimentId, abExperiments.id))
      .innerJoin(abVariants, eq(abConversions.variantId, abVariants.id))
      .where(eq(abExperiments.orgId, org.id))
      .orderBy(desc(abConversions.createdAt))
      .limit(100)

    return NextResponse.json({ visits, conversions })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
