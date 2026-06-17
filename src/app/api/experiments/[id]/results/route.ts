import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, sql, count, sum } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abExperiments, abVariants, abVisits, abConversions } from '@/db/schema'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.id, id),
    with: { variants: true, winner: true },
  })
  if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Aggregate visits per variant
  const visitRows = await db
    .select({ variantId: abVisits.variantId, visits: count() })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(abVisits.variantId)

  // Aggregate conversions per variant
  const convRows = await db
    .select({
      variantId: abConversions.variantId,
      conversions: count(),
      revenue: sum(abConversions.amount),
    })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(abConversions.variantId)

  // Daily visits per variant
  const dailyVisitRows = await db
    .select({
      date: sql<string>`DATE(${abVisits.createdAt})`,
      variantId: abVisits.variantId,
      visits: count(),
    })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
    .orderBy(sql`DATE(${abVisits.createdAt})`)

  // Daily conversions per variant
  const dailyConvRows = await db
    .select({
      date: sql<string>`DATE(${abConversions.createdAt})`,
      variantId: abConversions.variantId,
      conversions: count(),
    })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
    .orderBy(sql`DATE(${abConversions.createdAt})`)

  // Merge into variant stats
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

  // Build daily chart data: array of { date, [variantLabel]: rate }
  const allDates = [...new Set([
    ...dailyVisitRows.map(r => r.date),
    ...dailyConvRows.map(r => r.date),
  ])].sort()

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

  return NextResponse.json({
    experiment: {
      id: experiment.id,
      name: experiment.name,
      slug: experiment.slug,
      status: experiment.status,
      winnerId: experiment.winnerVariantId,
    },
    variants,
    dailyData,
  })
}
