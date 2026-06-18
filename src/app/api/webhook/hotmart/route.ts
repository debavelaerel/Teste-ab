import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abOrganizations, abVariants, abConversions } from '@/db/schema'

function verifyToken(received: string, expected: string): boolean {
  if (!expected) return false
  try {
    const r = Buffer.from(received)
    const e = Buffer.from(expected)
    if (r.length !== e.length) return false
    return crypto.timingSafeEqual(r, e)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const token = request.headers.get('x-hotmart-webhook-token') ?? ''
  const expected = process.env.HOTMART_WEBHOOK_TOKEN ?? ''

  if (!verifyToken(token, expected)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ ok: true, reason: 'invalid json' })
  }

  if (payload['event'] !== 'PURCHASE_APPROVED') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const data = payload['data'] as Record<string, unknown> | undefined
  const purchase = data?.['purchase'] as Record<string, unknown> | undefined
  const transactionId = purchase?.['transaction'] as string | undefined
  const trackerToken = purchase?.['tracker_token'] as string | undefined
  const priceObj = purchase?.['price'] as Record<string, unknown> | undefined
  const amount = priceObj?.['value'] ?? 0

  if (!transactionId || !trackerToken) {
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  // Format: orgSlug:expSlug:label (exactly 3 parts)
  const colonFirst = trackerToken.indexOf(':')
  const colonLast = trackerToken.lastIndexOf(':')

  if (colonFirst === -1 || colonFirst === colonLast) {
    return NextResponse.json({ ok: true, reason: 'invalid tracker_token format' })
  }

  const orgSlug = trackerToken.slice(0, colonFirst)
  const expSlug = trackerToken.slice(colonFirst + 1, colonLast)
  const label = trackerToken.slice(colonLast + 1).toUpperCase()

  if (!orgSlug || !expSlug || !label) {
    return NextResponse.json({ ok: true, reason: 'empty tracker_token parts' })
  }

  const rows = await db
    .select({ experiment: abExperiments, variant: abVariants })
    .from(abExperiments)
    .innerJoin(abOrganizations, eq(abExperiments.orgId, abOrganizations.id))
    .innerJoin(
      abVariants,
      and(
        eq(abVariants.experimentId, abExperiments.id),
        eq(abVariants.label, label)
      )
    )
    .where(
      and(
        eq(abOrganizations.slug, orgSlug),
        eq(abExperiments.slug, expSlug)
      )
    )
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, reason: 'experiment or variant not found' })
  }

  const { experiment, variant } = rows[0]

  await db
    .insert(abConversions)
    .values({
      experimentId: experiment.id,
      variantId: variant.id,
      externalOrderId: transactionId,
      source: 'hotmart',
      amount: String(amount),
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
