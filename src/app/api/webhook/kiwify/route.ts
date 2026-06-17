import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abConversions } from '@/db/schema'

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return process.env.NODE_ENV !== 'production' // Only skip in dev when unconfigured
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
    // Always return 200 to prevent Kiwify retry storms
    return NextResponse.json({ ok: true, reason: 'invalid json' })
  }

  // Only process paid orders
  if (payload['event'] !== 'order.paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const order = payload['order'] as Record<string, unknown> | undefined
  const orderId = order?.['id'] as string | undefined
  const tracker = order?.['tracker'] as Record<string, unknown> | undefined
  const s1 = tracker?.['s1'] as string | undefined
  const amount = (order?.['product'] as Record<string, unknown> | undefined)?.['price'] ?? '0'

  // Always return 200 to prevent Kiwify retry storms
  if (!orderId || !s1 || !s1.includes(':')) {
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  // Use lastIndexOf to split slug from label (slug can contain colons, label never does)
  const colonIdx = s1.lastIndexOf(':')
  const slug = s1.slice(0, colonIdx)
  const label = s1.slice(colonIdx + 1).toUpperCase()

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })

  if (!experiment) {
    return NextResponse.json({ ok: true, reason: 'experiment not found' })
  }

  const variant = experiment.variants.find(v => v.label === label)
  if (!variant) {
    return NextResponse.json({ ok: true, reason: 'variant not found' })
  }

  await db
    .insert(abConversions)
    .values({
      experimentId: experiment.id,
      variantId: variant.id,
      kiwifyOrderId: orderId,
      amount: String(amount),
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
