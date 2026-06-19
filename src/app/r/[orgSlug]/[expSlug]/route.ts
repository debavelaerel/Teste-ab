import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { abExperiments, abOrganizations, abVariants, abVisits } from '@/db/schema'

function weightedRandom(variants: { label: string; weight: number }[]): string {
  const total = variants.reduce((s, v) => s + v.weight, 0)
  let rand = Math.random() * total
  for (const v of variants) {
    rand -= v.weight
    if (rand <= 0) return v.label
  }
  return variants[variants.length - 1].label
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; expSlug: string }> }
) {
  const { orgSlug, expSlug } = await params

  // Find experiment by org slug + experiment slug
  const expRows = await db
    .select({ experiment: abExperiments })
    .from(abExperiments)
    .innerJoin(abOrganizations, eq(abExperiments.orgId, abOrganizations.id))
    .where(
      and(
        eq(abOrganizations.slug, orgSlug),
        eq(abExperiments.slug, expSlug)
      )
    )
    .limit(1)

  if (expRows.length === 0) {
    const res = new NextResponse('Experiment not found', { status: 404 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const experiment = expRows[0].experiment

  const variants = await db.query.abVariants.findMany({
    where: eq(abVariants.experimentId, experiment.id),
  })

  if (variants.length === 0) {
    const res = new NextResponse('No variants configured', { status: 404 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const cookieName = `ab_${orgSlug}_${expSlug}`
  const existingCookie = request.cookies.get(cookieName)?.value

  let visitorId: string
  let variantLabel: string

  if (existingCookie && existingCookie.includes(':')) {
    const colonIdx = existingCookie.indexOf(':')
    visitorId = existingCookie.slice(0, colonIdx)
    variantLabel = existingCookie.slice(colonIdx + 1)
  } else {
    visitorId = randomUUID()
    variantLabel =
      experiment.status === 'active'
        ? weightedRandom(variants)
        : variants[0].label
  }

  const variant =
    variants.find((v) => v.label === variantLabel) ?? variants[0]

  if (experiment.status === 'active') {
    await db
      .insert(abVisits)
      .values({
        experimentId: experiment.id,
        variantId: variant.id,
        visitorId,
      })
      .onConflictDoNothing()
  }

  let destUrl: URL
  try {
    destUrl = new URL(variant.url)
  } catch {
    const res = NextResponse.redirect(new URL('/', request.url), { status: 302 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  if (destUrl.protocol !== 'https:' && destUrl.protocol !== 'http:') {
    const res = NextResponse.redirect(new URL('/', request.url), { status: 302 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
  destUrl.searchParams.set('s1', `${expSlug}:${variant.label}`)

  const response = NextResponse.redirect(destUrl.toString(), { status: 302 })

  response.cookies.set(cookieName, `${visitorId}:${variant.label}`, {
    maxAge: experiment.cookieDays * 86400,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  response.headers.set('Cache-Control', 'no-store')
  return response
}
