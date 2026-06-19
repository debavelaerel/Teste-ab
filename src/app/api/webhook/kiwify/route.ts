import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abVariants, abConversions } from '@/db/schema'

function verifyToken(token: string, secret: string): boolean {
  if (!secret || !token) return false
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-kiwify-event-token') ?? ''
  const secret = process.env.KIWIFY_WEBHOOK_SECRET ?? ''

  if (!verifyToken(signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    console.warn('[webhook:kiwify] skipped', { reason: 'invalid json' })
    return NextResponse.json({ ok: true, reason: 'invalid json' })
  }

  if (payload['event'] !== 'order.paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  console.log('[webhook:kiwify] payload', JSON.stringify(payload))

  const order = payload['order'] as Record<string, unknown> | undefined
  const orderId = order?.['id'] as string | undefined
  const tracker = order?.['tracker'] as Record<string, unknown> | undefined
  const s1 = tracker?.['s1'] as string | undefined
  const amount = (order?.['product'] as Record<string, unknown> | undefined)?.['price'] ?? '0'

  if (!orderId || !s1) {
    console.warn('[webhook:kiwify] skipped', { reason: 'not trackable', orderId })
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  const colon = s1.indexOf(':')

  if (colon === -1) {
    console.warn('[webhook:kiwify] skipped', { reason: 'invalid s1 format', s1 })
    return NextResponse.json({ ok: true, reason: 'invalid s1 format' })
  }

  const expSlug = s1.slice(0, colon)
  const label = s1.slice(colon + 1).toUpperCase()

  if (!expSlug || !label) {
    console.warn('[webhook:kiwify] skipped', { reason: 'empty s1 parts', s1 })
    return NextResponse.json({ ok: true, reason: 'empty s1 parts' })
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
      console.warn('[webhook:kiwify] skipped', { reason: 'experiment not found', expSlug, label })
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
  } catch (err) {
    console.error('[webhook:kiwify]', {
      orderId,
      s1,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
