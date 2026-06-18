import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
const LABELS = ['A', 'B', 'C', 'D', 'E']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params
  let org: Awaited<ReturnType<typeof requireOrgMember>>['org']
  try {
    ;({ org } = await requireOrgMember(orgSlug))
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const body = await request.json()
  const { name, slug, cookieDays = 30, variants } = body as {
    name: string
    slug: string
    cookieDays?: number
    variants: { name: string; url: string; weight: number }[]
  }

  if (!name || !slug || !variants || variants.length < 2) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0)
  if (totalWeight !== 100) {
    return NextResponse.json({ error: 'Weights must sum to 100' }, { status: 400 })
  }

  const [experiment] = await db.insert(abExperiments).values({
    orgId: org.id,
    name,
    slug,
    cookieDays,
  }).returning()

  await db.insert(abVariants).values(
    variants.map((v, i) => ({
      experimentId: experiment.id,
      label: LABELS[i],
      name: v.name,
      url: v.url,
      weight: v.weight,
      color: COLORS[i],
    }))
  )

  return NextResponse.json({ id: experiment.id, slug: experiment.slug }, { status: 201 })
}
