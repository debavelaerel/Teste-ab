import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abOrganizations, abVariants, abConversions } from '@/db/schema'

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return process.env.NODE_ENV !== 'production'
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-kiwify-event-token') ?? ''
  const secret = process.env.KIWIFY_WEBHOOK_SECRET ?? ''

  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ ok: true, reason: 'invalid json' })
  }

  if (payload['event'] !== 'order.paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const order = payload['order'] as Record<string, unknown> | undefined
  const orderId = order?.['id'] as string | undefined
  const tracker = order?.['tracker'] as Record<string, unknown> | undefined
  const s1 = tracker?.['s1'] as string | undefined
  const amount = (order?.['product'] as Record<string, unknown> | undefined)?.['price'] ?? '0'

  if (!orderId || !s1) {
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  // s1 format: orgSlug:expSlug:label (exactly 3 parts)
  const colonFirst = s1.indexOf(':')
  const colonLast = s1.lastIndexOf(':')

  if (colonFirst === -1 || colonFirst === colonLast) {
    return NextResponse.json({ ok: true, reason: 'invalid s1 format' })
  }

  const orgSlug = s1.slice(0, colonFirst)
  const expSlug = s1.slice(colonFirst + 1, colonLast)
  const label = s1.slice(colonLast + 1).toUpperCase()

  if (!orgSlug || !expSlug || !label) {
    return NextResponse.json({ ok: true, reason: 'empty s1 parts' })
  }

  // Find experiment + variant in one query
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
      externalOrderId: orderId,
      source: 'kiwify',
      amount: String(amount),
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
