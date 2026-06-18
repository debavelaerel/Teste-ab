import { NextRequest, NextResponse } from 'next/server'
import { eq, and, count } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants, abConversions } from '@/db/schema'
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

  // Guard: block checkoutType change if conversions already exist
  if (body.checkoutType !== undefined && body.checkoutType !== existing.checkoutType) {
    const [{ convCount }] = await db
      .select({ convCount: count() })
      .from(abConversions)
      .where(eq(abConversions.experimentId, id))
    if (Number(convCount) > 0) {
      return NextResponse.json(
        { error: 'Não é possível alterar o checkout após registrar conversões' },
        { status: 409 }
      )
    }
    await db.update(abExperiments)
      .set({ checkoutType: body.checkoutType })
      .where(and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)))
    // Do not return early — other fields in the same request continue below
  }

  if (body.status !== undefined) {
    const update: Partial<typeof abExperiments.$inferInsert> = { status: body.status }
    if (body.status === 'finished') {
      update.finishedAt = new Date()
      if (body.winnerVariantId) update.winnerVariantId = body.winnerVariantId
    }
    await db.update(abExperiments).set(update).where(and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)))
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
      .where(and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)))
  }

  if (variants) {
    for (const v of variants) {
      if (v.url !== undefined) {
        try {
          const u = new URL(v.url)
          if (u.protocol !== 'https:' && u.protocol !== 'http:')
            return NextResponse.json({ error: 'URLs de variantes devem usar http:// ou https://' }, { status: 400 })
        } catch {
          return NextResponse.json({ error: 'URL de variante inválida' }, { status: 400 })
        }
      }
    }
    for (const v of variants) {
      if (v.id) {
        await db.update(abVariants)
          .set({ name: v.name, url: v.url, weight: v.weight })
          .where(and(eq(abVariants.id, v.id), eq(abVariants.experimentId, id)))
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

  await db.delete(abExperiments).where(and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)))
  return NextResponse.json({ ok: true })
}
