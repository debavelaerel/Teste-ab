import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abVariants, abConversions } from '@/db/schema'

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
    console.warn('[webhook:hotmart] skipped', { reason: 'invalid json' })
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
    console.warn('[webhook:hotmart] skipped', { reason: 'not trackable', transactionId })
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  const colon = trackerToken.indexOf(':')

  if (colon === -1) {
    console.warn('[webhook:hotmart] skipped', { reason: 'invalid tracker_token format', trackerToken })
    return NextResponse.json({ ok: true, reason: 'invalid tracker_token format' })
  }

  const expSlug = trackerToken.slice(0, colon)
  const label = trackerToken.slice(colon + 1).toUpperCase()

  if (!expSlug || !label) {
    console.warn('[webhook:hotmart] skipped', { reason: 'empty tracker_token parts', trackerToken })
    return NextResponse.json({ ok: true, reason: 'empty tracker_token parts' })
  }

  try {
    const rows = await db
      .select({ experiment: abExperiments, variant: abVariants })
      .from(abExperiments)
      .innerJoin(
        abVariants,
        and(
          eq(abVariants.experimentId, abExperiments.id),
          eq(abVariants.label, label)
        )
      )
      .where(eq(abExperiments.slug, expSlug))
      .limit(1)

    if (rows.length === 0) {
      console.warn('[webhook:hotmart] skipped', { reason: 'experiment not found', expSlug, label })
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
  } catch (err) {
    console.error('[webhook:hotmart]', {
      transactionId,
      trackerToken,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
