import { notFound } from 'next/navigation'
import { eq, sql, count, sum, and } from 'drizzle-orm'
import { Suspense } from 'react'
import { db } from '@/db'
import { abExperiments, abVisits, abConversions } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentTabs } from '@/components/experiment-tabs'

export const dynamic = 'force-dynamic'

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiment = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.slug, expSlug), eq(abExperiments.orgId, org.id)),
    with: { variants: true },
  })
  if (!experiment) notFound()

  const id = experiment.id

  const [visitRows, convRows, dailyVisitRows, dailyConvRows] = await Promise.all([
    db
      .select({ variantId: abVisits.variantId, visits: count() })
      .from(abVisits)
      .where(eq(abVisits.experimentId, id))
      .groupBy(abVisits.variantId),
    db
      .select({ variantId: abConversions.variantId, conversions: count(), revenue: sum(abConversions.amount) })
      .from(abConversions)
      .where(eq(abConversions.experimentId, id))
      .groupBy(abConversions.variantId),
    db
      .select({
        date: sql<string>`DATE(${abVisits.createdAt})`,
        variantId: abVisits.variantId,
        visits: count(),
      })
      .from(abVisits)
      .where(eq(abVisits.experimentId, id))
      .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
      .orderBy(sql`DATE(${abVisits.createdAt})`),
    db
      .select({
        date: sql<string>`DATE(${abConversions.createdAt})`,
        variantId: abConversions.variantId,
        conversions: count(),
      })
      .from(abConversions)
      .where(eq(abConversions.experimentId, id))
      .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
      .orderBy(sql`DATE(${abConversions.createdAt})`),
  ])

  const variants = experiment.variants.map(v => {
    const vr = visitRows.find(r => r.variantId === v.id)
    const cr = convRows.find(r => r.variantId === v.id)
    const visits = Number(vr?.visits ?? 0)
    const conversions = Number(cr?.conversions ?? 0)
    return {
      id: v.id,
      label: v.label,
      name: v.name,
      color: v.color,
      visits,
      conversions,
      rate: visits > 0 ? conversions / visits : 0,
      revenue: cr?.revenue ?? '0',
    }
  })

  const allDates = [
    ...new Set([
      ...dailyVisitRows.map(r => r.date),
      ...dailyConvRows.map(r => r.date),
    ]),
  ].sort()

  const dailyData = allDates.map(date => {
    const entry: Record<string, string | number> = { date }
    for (const v of experiment.variants) {
      const dv = dailyVisitRows.find(r => r.date === date && r.variantId === v.id)
      const dc = dailyConvRows.find(r => r.date === date && r.variantId === v.id)
      const visits = Number(dv?.visits ?? 0)
      const conversions = Number(dc?.conversions ?? 0)
      entry[v.label] = visits > 0 ? conversions / visits : 0
    }
    return entry
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <Suspense>
      <ExperimentTabs
        orgSlug={orgSlug}
        experiment={{
          id: experiment.id,
          name: experiment.name,
          slug: experiment.slug,
          status: experiment.status,
          checkoutType: experiment.checkoutType,
          cookieDays: experiment.cookieDays,
          variants: experiment.variants,
        }}
        variants={variants}
        dailyData={dailyData}
        appUrl={appUrl}
      />
    </Suspense>
  )
}
