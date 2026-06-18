# Hotmart Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hotmart as a second checkout option alongside Kiwify, using `xcod` URL param and `tracker-hotmart.js` for tracking, with a separate webhook handler.

**Architecture:** Each experiment declares a fixed `checkoutType` ('kiwify' | 'hotmart'). A new `public/tracker-hotmart.js` reads the same `s1` cookie set by the redirector and injects it as `xcod` into `pay.hotmart.com` links. A new webhook route handles `PURCHASE_APPROVED` events. `ab_conversions` gains an `externalOrderId` + `source` pair (replacing the Kiwify-specific `kiwifyOrderId`) with a composite unique constraint for idempotency.

**Tech Stack:** Next.js 16, Drizzle ORM 0.45 + drizzle-kit 0.31, PostgreSQL, Better Auth, vanilla JS (tracker scripts)

## Global Constraints

- All DB table names prefixed `ab_`
- No test framework — verify with `npx tsc --noEmit` then `npm run build`
- Never commit `.env*` files
- Next.js 16: `params` is always `Promise<{...}>` — always `await params`
- Migration must be safe for existing data: backfill `external_order_id` from `kiwify_order_id` before dropping old column
- New env var: `HOTMART_WEBHOOK_TOKEN` (plain string, not HMAC) — add to Railway production env vars and to `.env.local` for local testing (this file is gitignored)
- `checkoutType` is immutable if the experiment already has conversions (API enforces via 409)
- `source` values: exactly `'kiwify'` or `'hotmart'` (lowercase)

---

### Task 1: Schema + Safe Migration

**Files:**
- Modify: `src/db/schema.ts`
- Generate+edit: `src/db/migrations/0004_<drizzle_name>.sql` (created by drizzle-kit)

**Interfaces:**
- Produces:
  - `abExperiments.checkoutType: string` (default `'kiwify'`)
  - `abConversions.externalOrderId: string`
  - `abConversions.source: string` (default `'kiwify'`)
  - Unique constraint `ab_conversions_external_order_id_source_unique` on `(externalOrderId, source)`
  - `Conversion` type (auto-updated via `$inferSelect`)

- [ ] **Step 1: Update `src/db/schema.ts`**

In `abExperiments`, add `checkoutType` after `cookieDays`:

```typescript
// existing line:
cookieDays: integer('cookie_days').default(30).notNull(),
// ADD after it:
checkoutType: varchar('checkout_type', { length: 20 }).notNull().default('kiwify'),
```

In `abConversions`, replace `kiwifyOrderId` with `externalOrderId` + `source`, and add composite unique to the table-level constraints array:

```typescript
// REMOVE this line:
//   kiwifyOrderId: varchar('kiwify_order_id', { length: 255 }).notNull().unique(),

// ADD these two lines in its place:
externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
source: varchar('source', { length: 20 }).notNull().default('kiwify'),
```

Change the second argument of `abConversions` (currently only has `index`):

```typescript
// BEFORE:
}, (t) => [
  index('ab_conv_exp_idx').on(t.experimentId, t.variantId),
])

// AFTER:
}, (t) => [
  index('ab_conv_exp_idx').on(t.experimentId, t.variantId),
  unique('ab_conversions_external_order_id_source_unique').on(t.externalOrderId, t.source),
])
```

- [ ] **Step 2: Generate the migration**

```bash
npx drizzle-kit generate
```

Note the output filename — it will be something like `src/db/migrations/0004_<random_name>.sql`.

- [ ] **Step 3: Edit the generated SQL for safe column rename**

Open the generated `.sql` file. Find the block that handles `kiwify_order_id` / `external_order_id`. Drizzle-kit generates a DROP+ADD which loses data. Replace that entire block with the safe version below.

Find and **remove** any lines matching these patterns:
```sql
ALTER TABLE "ab_conversions" DROP COLUMN "kiwify_order_id";
ALTER TABLE "ab_conversions" ADD COLUMN "external_order_id" varchar(255) NOT NULL;
ALTER TABLE "ab_conversions" DROP CONSTRAINT "ab_conversions_kiwify_order_id_unique";
```

**Replace** with this ordered sequence (keeping `-->statement-breakpoint` separators in style with the rest of the file):

```sql
ALTER TABLE "ab_conversions" ADD COLUMN "external_order_id" varchar(255);
--> statement-breakpoint
UPDATE "ab_conversions" SET "external_order_id" = "kiwify_order_id";
--> statement-breakpoint
ALTER TABLE "ab_conversions" ALTER COLUMN "external_order_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD COLUMN "source" varchar(20) DEFAULT 'kiwify' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ab_conversions" DROP CONSTRAINT IF EXISTS "ab_conversions_kiwify_order_id_unique";
--> statement-breakpoint
ALTER TABLE "ab_conversions" ADD CONSTRAINT "ab_conversions_external_order_id_source_unique" UNIQUE("external_order_id","source");
--> statement-breakpoint
ALTER TABLE "ab_conversions" DROP COLUMN "kiwify_order_id";
```

Leave all other generated SQL in the file untouched (the `checkout_type` ADD COLUMN and any snapshot entries are fine as-is).

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. The `Conversion` type auto-updates via `$inferSelect` — no manual type changes needed.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrations/
git commit -m "feat: generalize conversions to externalOrderId+source, add checkoutType to experiments"
```

---

### Task 2: Update Kiwify Webhook to Use New Field Names

**Files:**
- Modify: `src/app/api/webhook/kiwify/route.ts`

**Interfaces:**
- Consumes: `abConversions.externalOrderId`, `abConversions.source` from Task 1
- No API surface changes (same URL, same behavior)

- [ ] **Step 1: Update the insert in `src/app/api/webhook/kiwify/route.ts`**

Find the `db.insert(abConversions).values({...})` block (near the bottom of the file) and update it:

```typescript
// BEFORE:
await db
  .insert(abConversions)
  .values({
    experimentId: experiment.id,
    variantId: variant.id,
    kiwifyOrderId: orderId,
    amount: String(amount),
  })
  .onConflictDoNothing()

// AFTER:
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors about `kiwifyOrderId`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhook/kiwify/route.ts
git commit -m "fix: use externalOrderId+source in Kiwify webhook after schema rename"
```

---

### Task 3: Hotmart Tracker Script

**Files:**
- Create: `public/tracker-hotmart.js`

**Interfaces:**
- Consumes: `?s1=orgSlug:expSlug:label` from the redirector URL (same as tracker.js)
- Produces: injects `xcod=<s1_value>` into all `pay.hotmart.com` links on the page
- Cookie: reads/writes `ab_s1` (same cookie as tracker.js — the two scripts can coexist on different pages)

- [ ] **Step 1: Create `public/tracker-hotmart.js`**

```javascript
(function () {
  'use strict';

  var COOKIE_NAME = 'ab_s1';
  var COOKIE_DAYS = 7;
  var PARAM_NAME = 'xcod';

  function injectXcod(s1) {
    document.querySelectorAll('a[href*="pay.hotmart.com"]').forEach(function (link) {
      try {
        var url = new URL(link.href);
        url.searchParams.set(PARAM_NAME, s1);
        link.href = url.toString();
      } catch (_) {}
    });
  }

  function saveCookie(value) {
    var expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function readCookie() {
    var match = document.cookie.match('(?:^|; )' + COOKIE_NAME + '=([^;]*)');
    return match ? decodeURIComponent(match[1]) : null;
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var s1 = params.get('s1');

    if (s1) {
      saveCookie(s1);
    } else {
      s1 = readCookie();
    }

    if (!s1) return;

    injectXcod(s1);

    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        injectXcod(s1);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
```

- [ ] **Step 2: Confirm file is in place**

```bash
ls public/tracker-hotmart.js
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add public/tracker-hotmart.js
git commit -m "feat: add tracker-hotmart.js — injects xcod into pay.hotmart.com links"
```

---

### Task 4: Hotmart Webhook Handler

**Files:**
- Create: `src/app/api/webhook/hotmart/route.ts`

**Interfaces:**
- Consumes: `abConversions.externalOrderId`, `abConversions.source` from Task 1
- HTTP POST `/api/webhook/hotmart`
- Auth: `X-Hotmart-Webhook-Token` header must equal `process.env.HOTMART_WEBHOOK_TOKEN`
- Event: `PURCHASE_APPROVED`
- Payload shape:
  ```json
  {
    "event": "PURCHASE_APPROVED",
    "data": {
      "purchase": {
        "transaction": "HP12345678901234",
        "price": { "value": 197.0 },
        "tracker_token": "orgSlug:expSlug:LABEL"
      }
    }
  }
  ```

- [ ] **Step 1: Create the webhook handler directory and file**

```bash
mkdir -p src/app/api/webhook/hotmart
```

Create `src/app/api/webhook/hotmart/route.ts` with the full implementation:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abOrganizations, abVariants, abConversions } from '@/db/schema'

function verifyToken(received: string, expected: string): boolean {
  if (!expected) return process.env.NODE_ENV !== 'production'
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhook/hotmart/
git commit -m "feat: add Hotmart webhook handler for PURCHASE_APPROVED events"
```

---

### Task 5: Checkout Type Selector in Experiment Form + APIs

**Files:**
- Modify: `src/components/experiment-form.tsx`
- Modify: `src/app/api/org/[orgSlug]/experiments/route.ts`
- Modify: `src/app/api/org/[orgSlug]/experiments/[id]/route.ts`

**Interfaces:**
- `ExperimentForm` gains prop: `initialCheckoutType?: 'kiwify' | 'hotmart'` (default: `'kiwify'`)
- POST `/api/org/[orgSlug]/experiments` body gains: `checkoutType: 'kiwify' | 'hotmart'`
- PATCH returns 409 `{ error: '...' }` if `checkoutType` differs from stored and conversions exist

- [ ] **Step 1: Add `checkoutType` state to `src/components/experiment-form.tsx`**

In the `Props` interface, add:
```typescript
initialCheckoutType?: 'kiwify' | 'hotmart'
```

In the destructured props parameter default values, add:
```typescript
initialCheckoutType = 'kiwify',
```

After the existing `useState` declarations, add:
```typescript
const [checkoutType, setCheckoutType] = useState<'kiwify' | 'hotmart'>(initialCheckoutType)
```

- [ ] **Step 2: Include `checkoutType` in the submit payload**

In the `handleSubmit` function, change:
```typescript
// BEFORE:
const payload = { name, slug, cookieDays, variants }

// AFTER:
const payload = { name, slug, cookieDays, checkoutType, variants }
```

- [ ] **Step 3: Add the checkout selector UI**

Add the following block **after** the `cookieDays` field and **before** the variants section:

```tsx
<div className="space-y-1 max-w-xs">
  <Label>Checkout</Label>
  <div className="flex gap-4 pt-1">
    {(['kiwify', 'hotmart'] as const).map((opt) => (
      <label key={opt} className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="checkoutType"
          value={opt}
          checked={checkoutType === opt}
          onChange={() => setCheckoutType(opt)}
          disabled={!!experimentId}
        />
        <span className="text-sm capitalize">{opt}</span>
      </label>
    ))}
  </div>
  {!!experimentId && (
    <p className="text-xs text-muted-foreground">O checkout não pode ser alterado após a criação</p>
  )}
</div>
```

- [ ] **Step 4: Update POST route to accept and save `checkoutType`**

In `src/app/api/org/[orgSlug]/experiments/route.ts`, update the body destructuring:

```typescript
// BEFORE:
const { name, slug, cookieDays = 30, variants } = body as {
  name: string
  slug: string
  cookieDays?: number
  variants: { name: string; url: string; weight: number }[]
}

// AFTER:
const { name, slug, cookieDays = 30, checkoutType = 'kiwify', variants } = body as {
  name: string
  slug: string
  cookieDays?: number
  checkoutType?: 'kiwify' | 'hotmart'
  variants: { name: string; url: string; weight: number }[]
}
```

Update the insert to include `checkoutType`:

```typescript
// BEFORE:
const [experiment] = await db.insert(abExperiments).values({
  orgId: org.id,
  name,
  slug,
  cookieDays,
}).returning()

// AFTER:
const [experiment] = await db.insert(abExperiments).values({
  orgId: org.id,
  name,
  slug,
  cookieDays,
  checkoutType,
}).returning()
```

- [ ] **Step 5: Update PATCH route to block `checkoutType` change if conversions exist**

In `src/app/api/org/[orgSlug]/experiments/[id]/route.ts`, add `abConversions` and `count` to imports:

```typescript
// BEFORE:
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'

// AFTER:
import { eq, and, count } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants, abConversions } from '@/db/schema'
```

After the existing ownership check (`if (!existing) return ...`), add the `checkoutType` guard. Insert this block **before** the `if (body.status !== undefined)` check:

```typescript
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
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/experiment-form.tsx src/app/api/org/
git commit -m "feat: add checkout type selector (kiwify/hotmart) to experiment form and APIs"
```

---

### Task 6: Show Correct Tracker Script on Config Page + Update Docs

**Files:**
- Modify: `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`
- Modify: `src/app/org/[orgSlug]/docs/page.tsx`

**Interfaces:**
- Consumes: `experiment.checkoutType` from Task 1 schema
- Consumes: `initialCheckoutType` prop from Task 5

- [ ] **Step 1: Pass `initialCheckoutType` to ExperimentForm in the config page**

In `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`, update the `<ExperimentForm>` usage to add:

```tsx
// Add this prop alongside the existing ones:
initialCheckoutType={experiment.checkoutType as 'kiwify' | 'hotmart'}
```

- [ ] **Step 2: Show the correct tracker script based on `checkoutType`**

In the same file, replace the existing static tracker script block:

```tsx
// BEFORE:
<div className="mb-6">
  <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`<script src="${appUrl}/tracker.js"></script>`}
  </pre>
</div>

// AFTER:
<div className="mb-6">
  <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{experiment.checkoutType === 'hotmart'
  ? `<script src="${appUrl}/tracker-hotmart.js"></script>`
  : `<script src="${appUrl}/tracker.js"></script>`}
  </pre>
</div>
```

- [ ] **Step 3: Update docs page with Hotmart section**

In `src/app/org/[orgSlug]/docs/page.tsx`, add a Hotmart section after the Kiwify tracker section. The full `return` JSX should include this new section between sections `1` and `2` (webhook config):

```tsx
<section className="space-y-3">
  <h2 className="text-base font-semibold">1b · Instalar o tracker Hotmart (se usar Hotmart)</h2>
  <p className="text-muted-foreground">Para experimentos com checkout Hotmart, use este script em vez do tracker.js:</p>
  <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`<script src="${appUrl}/tracker-hotmart.js"></script>`}
  </pre>
  <p className="text-muted-foreground text-xs">O script injeta o parâmetro <code className="bg-muted px-1 rounded">xcod</code> nos links <code className="bg-muted px-1 rounded">pay.hotmart.com</code>. Use apenas um tracker por landing page.</p>
</section>

<section className="space-y-3">
  <h2 className="text-base font-semibold">2b · Configurar webhook na Hotmart</h2>
  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
    <li>Acesse o painel da Hotmart → Ferramentas → Webhooks</li>
    <li>Adicione a URL: <code className="bg-muted px-1 rounded">{appUrl}/api/webhook/hotmart</code></li>
    <li>Evento: <strong>PURCHASE_APPROVED</strong></li>
    <li>Copie o token gerado e adicione como <code className="bg-muted px-1 rounded">HOTMART_WEBHOOK_TOKEN</code> nas variáveis de ambiente</li>
  </ol>
</section>
```

Insert these two new sections after the existing "1 · Instalar o tracker" section and before the existing "2 · Configurar webhook na Kiwify" section.

- [ ] **Step 4: TypeScript check + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/org/
git commit -m "feat: show correct tracker script per checkout type; add Hotmart docs section"
```
