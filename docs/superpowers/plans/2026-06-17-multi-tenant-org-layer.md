# Multi-tenant Org Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight organization layer to the existing single-tenant A/B testing platform, enabling future multi-client and SaaS usage without rewriting business logic.

**Architecture:** New `ab_organizations` + `ab_memberships` tables gate every dashboard action. All experiments gain an `org_id` FK. Dashboard routes move to `/org/[orgSlug]/`, API routes to `/api/org/[orgSlug]/experiments/`, and the redirector from `/r/[slug]` to `/r/[orgSlug]/[expSlug]`. The `s1` tracking param gains a third segment (`orgSlug:expSlug:label`).

**Tech Stack:** Next.js 16 App Router (`proxy.ts` not `middleware.ts`), Drizzle ORM + postgres.js, Better Auth, Tailwind + shadcn/ui.

## Global Constraints

- All new DB tables must be prefixed `ab_` (shares Postgres with viciolinks project)
- `user.id` in Better Auth is type `text` (not UUID) — `ab_memberships.user_id` must also be `text`
- Experiment slug is unique **per org**, not globally — composite unique `(org_id, slug)`
- s1 format is now exactly 3 colon-separated parts: `orgSlug:expSlug:label` (label = uppercase single letter A–E)
- Cookie name format: `ab_{orgSlug}_{expSlug}`
- Next.js 16: auth guard lives in `src/proxy.ts` with `export function proxy()` — not `middleware.ts`
- No test framework in project — verify with `npx tsc --noEmit` and `npm run build`
- Never commit `.env*` files

---

## File Map

**Create:**
- `src/lib/require-org-member.ts` — shared auth+org guard for API routes and Server Components
- `src/app/org/page.tsx` — redirects logged-in user to their first org
- `src/app/org/[orgSlug]/layout.tsx` — dashboard shell with org-aware sidebar links
- `src/app/org/[orgSlug]/page.tsx` — experiments list filtered by org
- `src/app/org/[orgSlug]/experiments/new/page.tsx` — create experiment form
- `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx` — edit/configure experiment
- `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx` — results + chart
- `src/app/org/[orgSlug]/docs/page.tsx` — quick-start guide
- `src/app/r/[orgSlug]/[expSlug]/route.ts` — new redirector
- `src/app/api/org/[orgSlug]/experiments/route.ts` — POST create experiment
- `src/app/api/org/[orgSlug]/experiments/[id]/route.ts` — PATCH/DELETE experiment
- `src/app/api/org/[orgSlug]/experiments/[id]/results/route.ts` — GET results

**Modify:**
- `src/db/schema.ts` — new tables + orgId on abExperiments
- `src/app/api/webhook/kiwify/route.ts` — 3-part s1 parse
- `src/components/experiment-form.tsx` — orgSlug prop + updated fetch URLs
- `src/proxy.ts` — add `/api/webhook/` to public, redirect login to `/org`
- `src/app/(auth)/login/page.tsx` — redirect to `/org` after sign-in

**Delete:**
- `src/app/(dashboard)/` (entire directory — moved to `/org/[orgSlug]/`)
- `src/app/r/[slug]/route.ts` (old redirector)
- `src/app/api/experiments/` (entire directory — moved to `/api/org/[orgSlug]/`)

---

## Task 1: DB Schema — organizations, memberships, orgId on experiments

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0003_org_layer.sql` (manually edit after generation)

**Interfaces:**
- Produces: `abOrganizations`, `abMemberships` Drizzle table objects; `orgId` column on `abExperiments`; `Organization` and `Membership` TypeScript types

- [ ] **Step 1: Add import for `user` from auth-schema at top of schema.ts**

Open `src/db/schema.ts`. After the existing imports, add:

```typescript
import { user } from './auth-schema'
```

- [ ] **Step 2: Add `abOrganizations` table before `abExperiments`**

In `src/db/schema.ts`, insert after the imports and before `experimentStatusEnum`:

```typescript
export const abOrganizations = pgTable('ab_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const abMemberships = pgTable('ab_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => abOrganizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('ab_memberships_user_org_unique').on(t.userId, t.orgId),
])
```

Note `userId` is type `text` (not `uuid`) to match Better Auth's user.id column type.

- [ ] **Step 3: Modify `abExperiments` — add `orgId`, remove inline `.unique()` from slug, add table constraints**

Replace the `abExperiments` definition:

```typescript
export const abExperiments = pgTable('ab_experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => abOrganizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  status: experimentStatusEnum('status').default('active').notNull(),
  cookieDays: integer('cookie_days').default(30).notNull(),
  winnerVariantId: uuid('winner_variant_id').references((): AnyPgColumn => abVariants.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
}, (t) => [
  unique('ab_exp_slug_org_unique').on(t.orgId, t.slug),
  index('ab_exp_org_idx').on(t.orgId),
])
```

- [ ] **Step 4: Add relations for new tables**

In `src/db/schema.ts`, add after the existing relations block:

```typescript
export const organizationsRelations = relations(abOrganizations, ({ many }) => ({
  memberships: many(abMemberships),
  experiments: many(abExperiments),
}))

export const membershipsRelations = relations(abMemberships, ({ one }) => ({
  org: one(abOrganizations, {
    fields: [abMemberships.orgId],
    references: [abOrganizations.id],
  }),
}))
```

Also update `experimentsRelations` to include the org relation:

```typescript
export const experimentsRelations = relations(abExperiments, ({ many, one }) => ({
  org: one(abOrganizations, {
    fields: [abExperiments.orgId],
    references: [abOrganizations.id],
  }),
  variants: many(abVariants, { relationName: 'variants' }),
  winner: one(abVariants, {
    fields: [abExperiments.winnerVariantId],
    references: [abVariants.id],
    relationName: 'winner',
  }),
}))
```

- [ ] **Step 5: Add `Organization` and `Membership` type exports at the bottom of schema.ts**

```typescript
export type Organization = typeof abOrganizations.$inferSelect
export type Membership = typeof abMemberships.$inferSelect
```

- [ ] **Step 6: Generate the Drizzle migration**

```bash
DATABASE_URL=postgresql://lucasdebavelaere@localhost:5432/abtest npx drizzle-kit generate
```

Expected: new file created at `src/db/migrations/0003_*.sql`. Note the exact filename.

- [ ] **Step 7: Edit the generated migration to handle existing rows safely**

Open the generated migration file. Find the line that adds `org_id` NOT NULL to `ab_experiments` (it will look like `ALTER TABLE "ab_experiments" ADD COLUMN "org_id" uuid NOT NULL`).

Replace the entire `ab_experiments` ALTER section with this safe sequence:

```sql
-- Add org_id as nullable first so existing rows don't break
ALTER TABLE "ab_experiments" ADD COLUMN "org_id" uuid;

-- Seed the Alexia org
INSERT INTO "ab_organizations" ("id", "name", "slug", "created_at")
VALUES ('11111111-0000-0000-0000-000000000001', 'Alexia Duarte', 'alexia', NOW())
ON CONFLICT DO NOTHING;

-- Seed Lucas as admin of Alexia's org (takes the first user in the table)
INSERT INTO "ab_memberships" ("id", "user_id", "org_id", "role", "created_at")
SELECT gen_random_uuid(), u.id, '11111111-0000-0000-0000-000000000001', 'admin', NOW()
FROM "user" u
LIMIT 1
ON CONFLICT DO NOTHING;

-- Assign all existing experiments to Alexia's org
UPDATE "ab_experiments" SET "org_id" = '11111111-0000-0000-0000-000000000001';

-- Now make org_id NOT NULL and add FK + indexes
ALTER TABLE "ab_experiments" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "ab_experiments" ADD CONSTRAINT "ab_experiments_org_id_ab_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "ab_organizations"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "ab_exp_slug_org_unique" ON "ab_experiments" ("org_id", "slug");
CREATE INDEX "ab_exp_org_idx" ON "ab_experiments" ("org_id");
```

Also remove the original single-column `ab_experiments_slug_key` unique constraint if Drizzle generated a DROP for it — keep it. If Drizzle didn't generate a drop, add:
```sql
ALTER TABLE "ab_experiments" DROP CONSTRAINT IF EXISTS "ab_experiments_slug_key";
```

- [ ] **Step 8: Run the migration**

```bash
DATABASE_URL=postgresql://lucasdebavelaere@localhost:5432/abtest npx drizzle-kit migrate
```

Expected output: `[✓] 0003_*.sql` applied successfully. No errors.

- [ ] **Step 9: Verify tables exist**

```bash
DATABASE_URL=postgresql://lucasdebavelaere@localhost:5432/abtest psql -c "\dt ab_*"
```

Expected: `ab_conversions`, `ab_experiments`, `ab_memberships`, `ab_organizations`, `ab_variants`, `ab_visits` all listed.

- [ ] **Step 10: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: add ab_organizations and ab_memberships tables, add org_id to ab_experiments"
```

---

## Task 2: `requireOrgMember` helper

**Files:**
- Create: `src/lib/require-org-member.ts`

**Interfaces:**
- Consumes: `abMemberships`, `abOrganizations` from `@/db/schema`; `auth` from `@/lib/auth`; `db` from `@/db`
- Produces: `requireOrgMember(orgSlug: string): Promise<{ session, membership: Membership, org: Organization }>` and `AuthError` class

- [ ] **Step 1: Create the helper**

Create `src/lib/require-org-member.ts`:

```typescript
import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abMemberships, abOrganizations } from '@/db/schema'
import type { Organization, Membership } from '@/db/schema'

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Unauthorized' : 'Forbidden')
  }
}

export async function requireOrgMember(
  orgSlug: string
): Promise<{ session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>; membership: Membership; org: Organization }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new AuthError(401)

  const rows = await db
    .select({ membership: abMemberships, org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(
      and(
        eq(abMemberships.userId, session.user.id),
        eq(abOrganizations.slug, orgSlug)
      )
    )
    .limit(1)

  if (rows.length === 0) throw new AuthError(403)
  return { session, membership: rows[0].membership, org: rows[0].org }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/require-org-member.ts
git commit -m "feat: add requireOrgMember auth helper with org membership check"
```

---

## Task 3: New redirector `/r/[orgSlug]/[expSlug]`

**Files:**
- Create: `src/app/r/[orgSlug]/[expSlug]/route.ts`
- Delete: `src/app/r/[slug]/route.ts` (and directory `src/app/r/[slug]/`)

**Interfaces:**
- Consumes: `abExperiments`, `abOrganizations`, `abVariants`, `abVisits` from schema; `db` from `@/db`
- Cookie name: `ab_{orgSlug}_{expSlug}`
- s1 value: `{orgSlug}:{expSlug}:{label}`

- [ ] **Step 1: Create the new redirector**

Create `src/app/r/[orgSlug]/[expSlug]/route.ts`:

```typescript
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
    const res = NextResponse.redirect(new URL('/', request.url), { status: 302 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const experiment = expRows[0].experiment

  const variants = await db.query.abVariants.findMany({
    where: eq(abVariants.experimentId, experiment.id),
  })

  if (variants.length === 0) {
    const res = NextResponse.redirect(new URL('/', request.url), { status: 302 })
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

  const destUrl = new URL(variant.url)
  destUrl.searchParams.set('s1', `${orgSlug}:${expSlug}:${variant.label}`)

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
```

- [ ] **Step 2: Delete old redirector**

```bash
rm -rf src/app/r/\[slug\]
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/r/
git commit -m "feat: add org-scoped redirector /r/[orgSlug]/[expSlug] with updated cookie and s1 format"
```

---

## Task 4: Kiwify webhook — 3-part s1 parsing

**Files:**
- Modify: `src/app/api/webhook/kiwify/route.ts`

**Interfaces:**
- Consumes: `abExperiments`, `abOrganizations`, `abVariants`, `abConversions` from schema
- s1 input format: `orgSlug:expSlug:label` (3 colon-separated parts)

- [ ] **Step 1: Update the webhook handler**

Replace the full content of `src/app/api/webhook/kiwify/route.ts`:

```typescript
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
      kiwifyOrderId: orderId,
      amount: String(amount),
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhook/kiwify/route.ts
git commit -m "feat: update kiwify webhook to parse 3-part s1 (orgSlug:expSlug:label)"
```

---

## Task 5: API routes under `/api/org/[orgSlug]/experiments/`

**Files:**
- Create: `src/app/api/org/[orgSlug]/experiments/route.ts`
- Create: `src/app/api/org/[orgSlug]/experiments/[id]/route.ts`
- Create: `src/app/api/org/[orgSlug]/experiments/[id]/results/route.ts`
- Delete: `src/app/api/experiments/` (entire directory)

**Interfaces:**
- Consumes: `requireOrgMember` from `@/lib/require-org-member`; schema tables; `db` from `@/db`
- Produces: same JSON shapes as old routes

- [ ] **Step 1: Create POST /api/org/[orgSlug]/experiments**

Create `src/app/api/org/[orgSlug]/experiments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
const LABELS = ['A', 'B', 'C', 'D', 'E']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params
  let org: Awaited<ReturnType<typeof requireOrgMember>>['org']
  try {
    ;({ org } = await requireOrgMember(orgSlug))
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const body = await request.json()
  const { name, slug, cookieDays = 30, variants } = body as {
    name: string
    slug: string
    cookieDays?: number
    variants: { name: string; url: string; weight: number }[]
  }

  if (!name || !slug || !variants || variants.length < 2) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0)
  if (totalWeight !== 100) {
    return NextResponse.json({ error: 'Weights must sum to 100' }, { status: 400 })
  }

  const [experiment] = await db.insert(abExperiments).values({
    orgId: org.id,
    name,
    slug,
    cookieDays,
  }).returning()

  await db.insert(abVariants).values(
    variants.map((v, i) => ({
      experimentId: experiment.id,
      label: LABELS[i],
      name: v.name,
      url: v.url,
      weight: v.weight,
      color: COLORS[i],
    }))
  )

  return NextResponse.json({ id: experiment.id, slug: experiment.slug }, { status: 201 })
}
```

- [ ] **Step 2: Create PATCH/DELETE /api/org/[orgSlug]/experiments/[id]**

Create `src/app/api/org/[orgSlug]/experiments/[id]/route.ts`:

```typescript
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
```

- [ ] **Step 3: Create GET /api/org/[orgSlug]/experiments/[id]/results**

Create `src/app/api/org/[orgSlug]/experiments/[id]/results/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, count, sum, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants, abVisits, abConversions } from '@/db/schema'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export async function GET(
  _: NextRequest,
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

  const experiment = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, org.id)),
    with: { variants: true, winner: true },
  })
  if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitRows = await db
    .select({ variantId: abVisits.variantId, visits: count() })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(abVisits.variantId)

  const convRows = await db
    .select({ variantId: abConversions.variantId, conversions: count(), revenue: sum(abConversions.amount) })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(abConversions.variantId)

  const dailyVisitRows = await db
    .select({ date: sql<string>`DATE(${abVisits.createdAt})`, variantId: abVisits.variantId, visits: count() })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
    .orderBy(sql`DATE(${abVisits.createdAt})`)

  const dailyConvRows = await db
    .select({ date: sql<string>`DATE(${abConversions.createdAt})`, variantId: abConversions.variantId, conversions: count() })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
    .orderBy(sql`DATE(${abConversions.createdAt})`)

  const variants = experiment.variants.map(v => {
    const vr = visitRows.find(r => r.variantId === v.id)
    const cr = convRows.find(r => r.variantId === v.id)
    const visits = Number(vr?.visits ?? 0)
    const conversions = Number(cr?.conversions ?? 0)
    return { id: v.id, label: v.label, name: v.name, color: v.color, visits, conversions, rate: visits > 0 ? conversions / visits : 0, revenue: cr?.revenue ?? '0' }
  })

  const allDates = [...new Set([...dailyVisitRows.map(r => r.date), ...dailyConvRows.map(r => r.date)])].sort()
  const dailyData = allDates.map(date => {
    const entry: Record<string, string | number> = { date }
    for (const v of experiment.variants) {
      const dv = dailyVisitRows.find(r => r.date === date && r.variantId === v.id)
      const dc = dailyConvRows.find(r => r.date === date && r.variantId === v.id)
      const visits = Number(dv?.visits ?? 0)
      const conversions = Number(dc?.conversions ?? 0)
      entry[v.label] = visits > 0 ? conversions / visits : 0
    }
    return entry
  })

  return NextResponse.json({ experiment: { id: experiment.id, name: experiment.name, slug: experiment.slug, status: experiment.status, winnerId: experiment.winnerVariantId }, variants, dailyData })
}
```

- [ ] **Step 4: Delete old API routes**

```bash
rm -rf src/app/api/experiments
```

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/org/ src/app/api/experiments/
git commit -m "feat: add org-scoped API routes /api/org/[orgSlug]/experiments, remove old /api/experiments"
```

---

## Task 6: Dashboard pages `/org/[orgSlug]/` + ExperimentForm update

**Files:**
- Create: `src/app/org/[orgSlug]/layout.tsx`
- Create: `src/app/org/[orgSlug]/page.tsx`
- Create: `src/app/org/[orgSlug]/experiments/new/page.tsx`
- Create: `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`
- Create: `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx`
- Create: `src/app/org/[orgSlug]/docs/page.tsx`
- Modify: `src/components/experiment-form.tsx` — add `orgSlug` prop
- Delete: `src/app/(dashboard)/` (entire directory)

**Interfaces:**
- Consumes: `requireOrgMember` from `@/lib/require-org-member`
- `ExperimentForm` new prop: `orgSlug: string`

- [ ] **Step 1: Update ExperimentForm to accept orgSlug**

Replace `src/components/experiment-form.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

interface VariantRow {
  id?: string
  name: string
  url: string
  weight: number
}

interface Props {
  orgSlug: string
  experimentId?: string
  initialName?: string
  initialSlug?: string
  initialCookieDays?: number
  initialVariants?: VariantRow[]
}

export function ExperimentForm({
  orgSlug,
  experimentId,
  initialName = '',
  initialSlug = '',
  initialCookieDays = 30,
  initialVariants = [
    { name: 'Controle', url: '', weight: 50 },
    { name: 'Teste B', url: '', weight: 50 },
  ],
}: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [cookieDays, setCookieDays] = useState(initialCookieDays)
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0)

  function autoSlug(val: string) {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function updateVariant(i: number, field: keyof VariantRow, value: string | number) {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    if (variants.length >= 5) return
    const remaining = Math.max(0, 100 - totalWeight)
    setVariants(prev => [
      ...prev,
      { name: `Teste ${String.fromCharCode(65 + prev.length)}`, url: '', weight: remaining },
    ])
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return
    setVariants(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalWeight !== 100) {
      setError('A soma dos pesos deve ser 100')
      return
    }
    setLoading(true)
    setError('')

    const payload = { name, slug, cookieDays, variants }
    const url = experimentId
      ? `/api/org/${orgSlug}/experiments/${experimentId}`
      : `/api/org/${orgSlug}/experiments`

    const res = await fetch(url, {
      method: experimentId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Erro desconhecido')
      return
    }

    const expSlug = experimentId ? slug : data.slug
    router.push(`/org/${orgSlug}/experiments/${expSlug}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Nome do experimento</Label>
          <Input
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!experimentId) setSlug(autoSlug(e.target.value))
            }}
            placeholder="Meu experimento"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Slug (URL)</Label>
          <Input
            value={slug}
            onChange={e => setSlug(autoSlug(e.target.value))}
            placeholder="meu-experimento"
            required
            disabled={!!experimentId}
          />
          {slug && <p className="text-xs text-muted-foreground">/r/{orgSlug}/{slug}</p>}
        </div>
      </div>

      <div className="space-y-1 max-w-xs">
        <Label>Duração do cookie (dias)</Label>
        <Input
          type="number"
          value={cookieDays}
          onChange={e => setCookieDays(Number(e.target.value))}
          min={1}
          max={365}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Variantes</Label>
          <span className={`text-xs font-medium ${totalWeight === 100 ? 'text-green-500' : 'text-destructive'}`}>
            Soma: {totalWeight}%
          </span>
        </div>
        <div className="space-y-3">
          {variants.map((v, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold w-6 text-center">{String.fromCharCode(65 + i)}</span>
                <Input
                  value={v.name}
                  onChange={e => updateVariant(i, 'name', e.target.value)}
                  placeholder={i === 0 ? 'Controle' : `Teste ${String.fromCharCode(65 + i)}`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={v.weight}
                  onChange={e => updateVariant(i, 'weight', Number(e.target.value))}
                  min={0}
                  max={100}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
                {variants.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)}>✕</Button>
                )}
              </div>
              <Input
                value={v.url}
                onChange={e => updateVariant(i, 'url', e.target.value)}
                placeholder="https://seusite.com/pagina-a"
                type="url"
                required
              />
            </Card>
          ))}
        </div>
        {variants.length < 5 && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addVariant}>
            + Adicionar variante
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? 'Salvando...' : experimentId ? 'Salvar alterações' : 'Criar experimento'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create org dashboard layout**

Create `src/app/org/[orgSlug]/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { SignOutButton } from '@/components/sign-out-button'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  try {
    await requireOrgMember(orgSlug)
  } catch (e) {
    if (e instanceof AuthError) redirect('/login')
    throw e
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-card flex flex-col gap-1 p-4 shrink-0">
        <div className="mb-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            A/B Testing
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href={`/org/${orgSlug}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Experimentos
          </Link>
          <Link
            href={`/org/${orgSlug}/docs`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Docs
          </Link>
        </nav>
        <Separator className="my-2" />
        <SignOutButton />
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create org experiments list page**

Create `src/app/org/[orgSlug]/page.tsx`:

```typescript
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abOrganizations } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireOrgMember } from '@/lib/require-org-member'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  finished: 'outline',
}

export default async function OrgExperimentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiments = await db.query.abExperiments.findMany({
    where: eq(abExperiments.orgId, org.id),
    orderBy: [desc(abExperiments.createdAt)],
    with: { variants: true, winner: true },
  })

  const active = experiments.filter(e => e.status !== 'finished')
  const finished = experiments.filter(e => e.status === 'finished')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground mb-8">
          <p className="text-sm">Nenhum experimento ativo</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {active.map(exp => (
            <Card key={exp.id} className="p-4">
              <Link href={`/org/${orgSlug}/experiments/${exp.slug}`} className="flex items-center justify-between hover:opacity-80">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{exp.name}</span>
                  <Badge variant={STATUS_VARIANT[exp.status]}>{STATUS_LABEL[exp.status]}</Badge>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{orgSlug}/{exp.slug}</code>
                </div>
                <span className="text-muted-foreground text-xs">
                  {exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}
                </span>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Finalizados</h2>
          <div className="space-y-2">
            {finished.map(exp => (
              <Card key={exp.id} className="p-4">
                <Link href={`/org/${orgSlug}/experiments/${exp.slug}/results`} className="flex items-center justify-between hover:opacity-80">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{exp.name}</span>
                    {exp.winner && <Badge variant="secondary">Vencedor: {exp.winner.label}</Badge>}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{orgSlug}/{exp.slug}</code>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''} · {exp.finishedAt?.toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create new experiment page**

Create `src/app/org/[orgSlug]/experiments/new/page.tsx`:

```typescript
import { ExperimentForm } from '@/components/experiment-form'

export default async function NewExperimentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Novo experimento</h1>
      <ExperimentForm orgSlug={orgSlug} />
    </div>
  )
}
```

- [ ] **Step 5: Create experiment config page**

Create `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { ExperimentForm } from '@/components/experiment-form'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { requireOrgMember } from '@/lib/require-org-member'

export default async function ExperimentConfigPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiment = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.slug, expSlug), eq(abExperiments.orgId, org.id)),
    with: { variants: true },
  })

  if (!experiment) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const redirectorUrl = `${appUrl}/r/${orgSlug}/${expSlug}`

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{experiment.name}</h1>
        <Badge>{experiment.status}</Badge>
        <Link
          href={`/org/${orgSlug}/experiments/${expSlug}/results`}
          className="ml-auto text-sm text-muted-foreground hover:underline"
        >
          Ver resultados →
        </Link>
      </div>

      <div className="mb-6 p-3 rounded-md bg-muted text-sm font-mono break-all">
        {redirectorUrl}
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </div>

      <ExperimentForm
        orgSlug={orgSlug}
        experimentId={experiment.id}
        initialName={experiment.name}
        initialSlug={experiment.slug}
        initialCookieDays={experiment.cookieDays}
        initialVariants={experiment.variants.map(v => ({
          id: v.id,
          name: v.name,
          url: v.url,
          weight: v.weight,
        }))}
      />
    </div>
  )
}
```

- [ ] **Step 6: Create results page**

Create `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx`:

```typescript
import { notFound } from 'next/navigation'
import { eq, sql, count, sum, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVisits, abConversions } from '@/db/schema'
import { ResultsSummary } from '@/components/results-summary'
import { DailyChart } from '@/components/daily-chart'
import Link from 'next/link'
import { requireOrgMember } from '@/lib/require-org-member'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const experiment = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.slug, expSlug), eq(abExperiments.orgId, org.id)),
    with: { variants: true },
  })
  if (!experiment) notFound()

  const id = experiment.id

  const visitRows = await db
    .select({ variantId: abVisits.variantId, visits: count() })
    .from(abVisits).where(eq(abVisits.experimentId, id)).groupBy(abVisits.variantId)

  const convRows = await db
    .select({ variantId: abConversions.variantId, conversions: count(), revenue: sum(abConversions.amount) })
    .from(abConversions).where(eq(abConversions.experimentId, id)).groupBy(abConversions.variantId)

  const dailyVisitRows = await db
    .select({ date: sql<string>`DATE(${abVisits.createdAt})`, variantId: abVisits.variantId, visits: count() })
    .from(abVisits).where(eq(abVisits.experimentId, id))
    .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
    .orderBy(sql`DATE(${abVisits.createdAt})`)

  const dailyConvRows = await db
    .select({ date: sql<string>`DATE(${abConversions.createdAt})`, variantId: abConversions.variantId, conversions: count() })
    .from(abConversions).where(eq(abConversions.experimentId, id))
    .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
    .orderBy(sql`DATE(${abConversions.createdAt})`)

  const variants = experiment.variants.map(v => {
    const vr = visitRows.find(r => r.variantId === v.id)
    const cr = convRows.find(r => r.variantId === v.id)
    const visits = Number(vr?.visits ?? 0)
    const conversions = Number(cr?.conversions ?? 0)
    return { id: v.id, label: v.label, name: v.name, color: v.color, visits, conversions, rate: visits > 0 ? conversions / visits : 0, revenue: cr?.revenue ?? '0' }
  })

  const allDates = [...new Set([...dailyVisitRows.map(r => r.date), ...dailyConvRows.map(r => r.date)])].sort()
  const dailyData = allDates.map(date => {
    const entry: Record<string, string | number> = { date }
    for (const v of experiment.variants) {
      const dv = dailyVisitRows.find(r => r.date === date && r.variantId === v.id)
      const dc = dailyConvRows.find(r => r.date === date && r.variantId === v.id)
      const visits = Number(dv?.visits ?? 0)
      const conversions = Number(dc?.conversions ?? 0)
      entry[v.label] = visits > 0 ? conversions / visits : 0
    }
    return entry
  })

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{experiment.name}</h1>
          <Link href={`/org/${orgSlug}/experiments/${expSlug}`} className="text-sm text-muted-foreground hover:underline">
            ← Configurar
          </Link>
        </div>
      </div>
      <ResultsSummary experimentId={experiment.id} experimentStatus={experiment.status} variants={variants} />
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Evolução diária — Taxa de conversão
        </h2>
        <DailyChart data={dailyData} variants={variants} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create docs page**

Create `src/app/org/[orgSlug]/docs/page.tsx`:

```typescript
export default async function DocsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  return (
    <div className="max-w-2xl space-y-8 text-sm">
      <h1 className="text-2xl font-semibold">Guia rápido</h1>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Como funciona o redirecionamento</h2>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Visitante acessa a URL do redirecionador <code className="bg-muted px-1 rounded">/r/{orgSlug}/SEU-SLUG</code></li>
          <li>Se já visitou antes, mantém a mesma variante (cookie pelo período configurado)</li>
          <li>Se novo: variante sorteada conforme o split configurado</li>
          <li>Redirecionado para a URL da variante com <code className="bg-muted px-1 rounded">?s1={orgSlug}:SEU-SLUG:VARIANTE</code></li>
          <li>O tracker.js injeta esse parâmetro nos links da Kiwify</li>
          <li>Na compra aprovada, o webhook registra a conversão automaticamente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1 · Instalar o tracker na landing page</h2>
        <p className="text-muted-foreground">Cole antes do fechamento do <code className="bg-muted px-1 rounded">&lt;/body&gt;</code>:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2 · Configurar webhook na Kiwify</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Acesse o painel da Kiwify → Configurações → Webhooks</li>
          <li>Adicione a URL: <code className="bg-muted px-1 rounded">{appUrl}/api/webhook/kiwify</code></li>
          <li>Evento: <strong>order.paid</strong></li>
          <li>Copie o token gerado e adicione como <code className="bg-muted px-1 rounded">KIWIFY_WEBHOOK_SECRET</code> nas variáveis de ambiente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">3 · Pré-requisitos para significância estatística</h2>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Mínimo de 100 visitas por variante antes de analisar resultados</li>
          <li>Confiança ≥ 95% para declarar vencedor com segurança</li>
          <li>Máximo de 5 variantes por experimento</li>
          <li>Cookies podem ser bloqueados por ~3-5% dos usuários com ad blockers</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Ações disponíveis</h2>
        <dl className="space-y-2 text-muted-foreground">
          <div><dt className="font-medium text-foreground inline">Pausar</dt> — suspende o sorteio de variantes e a coleta de dados</div>
          <div><dt className="font-medium text-foreground inline">Retomar</dt> — reativa após pausa</div>
          <div><dt className="font-medium text-foreground inline">Encerrar</dt> — declara vencedor e finaliza o experimento</div>
        </dl>
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Delete old dashboard directory**

```bash
rm -rf "src/app/(dashboard)"
```

- [ ] **Step 9: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/org/ src/components/experiment-form.tsx "src/app/(dashboard)/"
git commit -m "feat: move dashboard to /org/[orgSlug]/, update ExperimentForm with orgSlug prop and new API URLs"
```

---

## Task 7: Cleanup — proxy.ts + login redirect + org root page

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/app/org/page.tsx`

**Interfaces:**
- `src/app/org/page.tsx` reads session + memberships → redirects to `/org/{slug}`

- [ ] **Step 1: Update proxy.ts**

Replace `src/proxy.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // /api/* is excluded from the matcher below — API routes do their own auth
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/r/') ||
    pathname === '/tracker.js'

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/org', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Keep api excluded: API routes handle auth themselves via requireOrgMember
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

The `api` exclusion in the matcher is retained so unauthenticated API requests get a proper 401 from `requireOrgMember` instead of a redirect to `/login`.

- [ ] **Step 2: Update login page post-login redirect**

In `src/app/(auth)/login/page.tsx`, change:

```typescript
router.push('/')
```

to:

```typescript
router.push('/org')
```

- [ ] **Step 3: Create org root redirect page**

Create `src/app/org/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abMemberships, abOrganizations } from '@/db/schema'

export default async function OrgRootPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  const rows = await db
    .select({ org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(eq(abMemberships.userId, session.user.id))
    .limit(1)

  if (rows.length === 0) redirect('/login')
  redirect(`/org/${rows[0].org.slug}`)
}
```

- [ ] **Step 4: Build to verify everything compiles**

```bash
npm run build
```

Expected: no TypeScript or build errors. If errors appear, fix them before committing.

- [ ] **Step 5: Smoke test locally**

Start the dev server:
```bash
npm run dev
```

Verify manually:
1. Visit `http://localhost:3000` → should redirect to `/login`
2. Log in → should redirect to `/org/alexia`
3. `/org/alexia` → experiments list loads
4. Create a new experiment → form works, redirects to `/org/alexia/experiments/{slug}`
5. Visit `http://localhost:3000/r/alexia/{slug}` → should redirect to the variant URL with `?s1=alexia:{slug}:A`

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/app/org/page.tsx src/app/(auth)/login/page.tsx
git commit -m "feat: update proxy.ts public paths, add /org root redirect page, update login redirect to /org"
```
