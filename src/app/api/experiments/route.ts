import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
const LABELS = ['A', 'B', 'C', 'D', 'E']

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
