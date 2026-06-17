import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { abExperiments, abVariants, abVisits } from '@/db/schema'

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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })

  // Fallback: redirect home if experiment not found or has no variants
  if (!experiment || experiment.variants.length === 0) {
    const fallbackResponse = NextResponse.redirect(new URL('/', request.url), { status: 302 })
    fallbackResponse.headers.set('Cache-Control', 'no-store')
    return fallbackResponse
  }

  const cookieName = `ab_${slug}`
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
        ? weightedRandom(experiment.variants)
        : experiment.variants[0].label
  }

  const variant =
    experiment.variants.find((v) => v.label === variantLabel) ??
    experiment.variants[0]

  // Register visit server-side (deduped — unique constraint on experiment+visitor)
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

  // Build destination URL with UTM tracking
  const destUrl = new URL(variant.url)
  destUrl.searchParams.set('utm_content', `${slug}:${variant.label.toLowerCase()}`)

  const response = NextResponse.redirect(destUrl.toString(), { status: 302 })

  response.cookies.set(cookieName, `${visitorId}:${variant.label}`, {
    maxAge: experiment.cookieDays * 86400,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  // Prevent Cloudflare (and any CDN) from caching the redirect
  response.headers.set('Cache-Control', 'no-store')

  return response
}
