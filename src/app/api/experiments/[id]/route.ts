import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // Handle status change (pause/resume/finish with winner)
  if (body.status !== undefined) {
    const update: Partial<typeof abExperiments.$inferInsert> = {
      status: body.status,
    }
    if (body.status === 'finished') {
      update.finishedAt = new Date()
      if (body.winnerVariantId) update.winnerVariantId = body.winnerVariantId
    }
    await db.update(abExperiments).set(update).where(eq(abExperiments.id, id))
    return NextResponse.json({ ok: true })
  }

  // Handle full update (name, cookieDays, variants)
  const { name, cookieDays, variants } = body as {
    name?: string
    cookieDays?: number
    variants?: { id?: string; name: string; url: string; weight: number }[]
  }

  if (name !== undefined || cookieDays !== undefined) {
    await db.update(abExperiments)
      .set({
        ...(name !== undefined && { name }),
        ...(cookieDays !== undefined && { cookieDays }),
      })
      .where(eq(abExperiments.id, id))
  }

  if (variants) {
    for (const v of variants) {
      if (v.id) {
        await db.update(abVariants)
          .set({ name: v.name, url: v.url, weight: v.weight })
          .where(eq(abVariants.id, v.id))
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await db.delete(abExperiments).where(eq(abExperiments.id, id))
  return NextResponse.json({ ok: true })
}
