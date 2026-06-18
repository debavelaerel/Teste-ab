import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await params
  let org: Awaited<ReturnType<typeof requireOrgMember>>['org']
  try {
    ;({ org } = await requireOrgMember(orgSlug))
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // Verify experiment belongs to this org
  const existing = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)),
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()

  if (body.status !== undefined) {
    const update: Partial<typeof abExperiments.$inferInsert> = { status: body.status }
    if (body.status === 'finished') {
      update.finishedAt = new Date()
      if (body.winnerVariantId) update.winnerVariantId = body.winnerVariantId
    }
    await db.update(abExperiments).set(update).where(eq(abExperiments.id, id))
    return NextResponse.json({ ok: true })
  }

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
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await params
  let org: Awaited<ReturnType<typeof requireOrgMember>>['org']
  try {
    ;({ org } = await requireOrgMember(orgSlug))
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // Verify experiment belongs to this org (404 instead of 403 to not leak existence)
  const existing = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)),
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(abExperiments).where(eq(abExperiments.id, id))
  return NextResponse.json({ ok: true })
}
