# A/B Testing Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js A/B testing platform with server-side redirect-based variant assignment, visit tracking, and automatic Kiwify purchase conversion attribution via webhook.

**Architecture:** New Next.js 15 App Router service deployed on Railway, sharing the existing Railway Postgres from the `clever-gratitude` project (tables prefixed `ab_`). The redirector assigns variants server-side and sets first-party cookies; tracker.js injects UTM into Kiwify checkout links; `order.paid` webhooks close the conversion loop automatically.

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM, postgres.js, Better Auth, Tailwind CSS, shadcn/ui, Recharts, Railway Postgres, Railway + Cloudflare.

## Global Constraints

- All database tables must be prefixed with `ab_` to avoid collision with viciolinks tables in the same Postgres instance
- `DATABASE_URL` points to the existing Railway Postgres (value in `.env.local` — do not commit)
- Cookie name format: `ab_{slug}`, value format: `{visitorId}:{variantLabel}`
- UTM carrier: `utm_content`, value format: `{slug}:{variantLabel}` (e.g. `destrava-oab:a`)
- Maximum 5 variants per experiment; variant labels are uppercase A–E
- Visit deduplication: one row per `(experiment_id, visitor_id)` — ignore if exists
- Conversion idempotency: `kiwify_order_id` is UNIQUE — use `ON CONFLICT DO NOTHING`
- Auth: Better Auth with email+password, single admin account, shares Postgres with viciolinks
- Node.js 20+ required (Railway default)

---

## File Map

```
/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx              # Auth shell (centered, no sidebar)
│   │   │   └── login/page.tsx          # Login form
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Dashboard shell with sidebar
│   │   │   ├── page.tsx                # Experiments list (home)
│   │   │   ├── experiments/
│   │   │   │   ├── new/page.tsx        # Create experiment
│   │   │   │   └── [slug]/
│   │   │   │       ├── page.tsx        # Config tab (edit)
│   │   │   │       └── results/page.tsx# Results tab
│   │   │   └── docs/page.tsx           # Quick guide
│   │   ├── r/[slug]/route.ts           # Redirector (GET /r/:slug)
│   │   └── api/
│   │       ├── auth/[...all]/route.ts  # Better Auth handler
│   │       └── webhook/kiwify/route.ts # Kiwify order.paid webhook
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema (ab_ tables + relations)
│   │   └── index.ts                    # DB connection (postgres.js + drizzle)
│   ├── lib/
│   │   ├── auth.ts                     # Better Auth server config
│   │   ├── auth-client.ts              # Better Auth browser client
│   │   └── stats.ts                    # Z-test, confidence calculation
│   ├── components/
│   │   ├── experiment-form.tsx         # Create/edit form (variants + weights)
│   │   ├── results-summary.tsx         # Variant cards + confidence badge
│   │   └── daily-chart.tsx             # Recharts line chart
│   └── middleware.ts                   # Protect /dashboard routes
├── public/
│   └── tracker.js                      # Static UTM injector (~1 KB)
├── drizzle.config.ts
├── .env.example
└── next.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.env.local`, `.gitignore`

**Interfaces:**
- Produces: running dev server at `http://localhost:3000`

- [ ] **Step 1: Init Next.js 15 project**

```bash
cd /Users/lucasdebavelaere/code/teste-ab
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

When prompted, answer: No to `use Turbopack`, Yes to all others defaults.

- [ ] **Step 2: Install dependencies**

```bash
npm install drizzle-orm postgres better-auth recharts
npm install -D drizzle-kit @types/node
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: Default style, Default base color (Neutral), yes to CSS variables.

Then add components used throughout the app:
```bash
npx shadcn@latest add button input label card badge separator tabs select slider
```

- [ ] **Step 4: Create `.env.example`**

```bash
# .env.example
DATABASE_URL=postgresql://user:pass@host:5432/railway
BETTER_AUTH_SECRET=change-me-to-random-64-chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
KIWIFY_WEBHOOK_SECRET=from-kiwify-dashboard
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me
```

- [ ] **Step 5: Create `.env.local`** with the real values (never commit this file)

```bash
DATABASE_URL=<railway-postgres-url>
BETTER_AUTH_SECRET=<64-char-random-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
KIWIFY_WEBHOOK_SECRET=
BOOTSTRAP_ADMIN_EMAIL=<admin-email>
BOOTSTRAP_ADMIN_PASSWORD=<admin-password>
```

> Note: `DATABASE_URL` with `.railway.internal` hostname only works inside Railway. For local dev, use a tunnel or Supabase Postgres. Update `NEXT_PUBLIC_APP_URL` with the real domain once deployed.

- [ ] **Step 6: Update `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Needed for better-auth
  serverExternalPackages: ['better-auth'],
}

export default nextConfig
```

- [ ] **Step 7: Init git and commit scaffold**

```bash
git init
echo ".env.local" >> .gitignore
git add -A
git commit -m "chore: scaffold Next.js 15 project"
```

---

## Task 2: Database Schema + Migrations

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`

**Interfaces:**
- Produces: `db` (Drizzle client), `abExperiments`, `abVariants`, `abVisits`, `abConversions` (table references and inferred types)
- Produces: `type Experiment`, `type Variant` inferred from schema

- [ ] **Step 1: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 2: Create `src/db/schema.ts`**

```typescript
import {
  pgTable, pgEnum, uuid, varchar, integer,
  decimal, timestamp, unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const experimentStatusEnum = pgEnum('ab_experiment_status', [
  'active', 'paused', 'finished',
])

export const abExperiments = pgTable('ab_experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: experimentStatusEnum('status').default('active').notNull(),
  cookieDays: integer('cookie_days').default(30).notNull(),
  winnerVariantId: uuid('winner_variant_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
})

export const abVariants = pgTable('ab_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 5 }).notNull(),   // A, B, C, D, E
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  weight: integer('weight').notNull(),                 // 0–100, sum per experiment = 100
  color: varchar('color', { length: 7 }).notNull(),   // #hex
})

export const abVisits = pgTable('ab_visits', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => abVariants.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('ab_visits_exp_visitor_unique').on(t.experimentId, t.visitorId),
])

export const abConversions = pgTable('ab_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id')
    .notNull()
    .references(() => abExperiments.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => abVariants.id, { onDelete: 'cascade' }),
  visitorId: varchar('visitor_id', { length: 255 }),
  kiwifyOrderId: varchar('kiwify_order_id', { length: 255 }).notNull().unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Relations
export const experimentsRelations = relations(abExperiments, ({ many, one }) => ({
  variants: many(abVariants),
  winner: one(abVariants, {
    fields: [abExperiments.winnerVariantId],
    references: [abVariants.id],
    relationName: 'winner',
  }),
}))

export const variantsRelations = relations(abVariants, ({ one, many }) => ({
  experiment: one(abExperiments, {
    fields: [abVariants.experimentId],
    references: [abExperiments.id],
  }),
  visits: many(abVisits),
  conversions: many(abConversions),
}))

export const visitsRelations = relations(abVisits, ({ one }) => ({
  experiment: one(abExperiments, { fields: [abVisits.experimentId], references: [abExperiments.id] }),
  variant: one(abVariants, { fields: [abVisits.variantId], references: [abVariants.id] }),
}))

export const conversionsRelations = relations(abConversions, ({ one }) => ({
  experiment: one(abExperiments, { fields: [abConversions.experimentId], references: [abExperiments.id] }),
  variant: one(abVariants, { fields: [abConversions.variantId], references: [abVariants.id] }),
}))

export type Experiment = typeof abExperiments.$inferSelect
export type Variant = typeof abVariants.$inferSelect
export type Visit = typeof abVisits.$inferSelect
export type Conversion = typeof abConversions.$inferSelect
```

- [ ] **Step 3: Create `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
})

export const db = drizzle(client, { schema })
```

- [ ] **Step 4: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: `src/db/migrations/0000_*.sql` created, tables created in Postgres.

- [ ] **Step 5: Verify tables exist**

```bash
npx drizzle-kit studio
```

Open `https://local.drizzle.studio` and confirm `ab_experiments`, `ab_variants`, `ab_visits`, `ab_conversions` appear. Close studio when done.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema and migrations for ab_ tables"
```

---

## Task 3: Auth (Better Auth + Login Page + Middleware)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/middleware.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Produces: `auth` (server), `authClient` (browser), protected `/` and `/experiments/*` routes

- [ ] **Step 1: Create `src/lib/auth.ts`**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
})
```

- [ ] **Step 2: Create `src/lib/auth-client.ts`**

```typescript
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})
```

- [ ] **Step 3: Create `src/app/api/auth/[...all]/route.ts`**

```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 4: Run Better Auth migrations**

Better Auth auto-creates its tables (`user`, `session`, `account`, `verification`) via the adapter when the app first starts. Run the dev server briefly to trigger this:

```bash
npm run dev
```

Visit `http://localhost:3000/api/auth/sign-in/email` in a browser — if it returns JSON (not 500), tables were created. Stop the server with Ctrl+C.

- [ ] **Step 5: Bootstrap admin user**

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<BOOTSTRAP_ADMIN_EMAIL>",
    "password": "<BOOTSTRAP_ADMIN_PASSWORD>",
    "name": "Administrador"
  }'
```

Expected: `{"user": {...}, "session": {...}}` — 201 or 200.

- [ ] **Step 6: Create `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function middleware(request: NextRequest) {
  const session = getSessionCookie(request)
  const { pathname } = request.nextUrl

  // Public routes: /login, /r/*, /api/*, /tracker.js
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/api/') ||
    pathname === '/tracker.js'

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 7: Create `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Create `src/app/(auth)/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await authClient.signIn.email({ email, password })
    if (err) {
      setError('Email ou senha inválidos')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 9: Test login flow**

Start dev server: `npm run dev`
- Visit `http://localhost:3000` → should redirect to `/login`
- Log in with `$BOOTSTRAP_ADMIN_EMAIL` / `$BOOTSTRAP_ADMIN_PASSWORD` from `.env.local`
- Should redirect to `/` (blank page for now, that's fine)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add Better Auth login with middleware protection"
```

---

## Task 4: Redirector (`/r/[slug]`)

**Files:**
- Create: `src/app/r/[slug]/route.ts`

**Interfaces:**
- Consumes: `db`, `abExperiments`, `abVariants`, `abVisits` from `@/db/schema`
- Produces: HTTP 302 redirect with Set-Cookie and destination URL containing `utm_content`

- [ ] **Step 1: Create `src/app/r/[slug]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { abExperiments, abVariants, abVisits } from '@/db/schema'

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
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })

  // Fallback: redirect home if experiment not found
  if (!experiment || experiment.variants.length === 0) {
    return NextResponse.redirect(new URL('/', request.url), { status: 302 })
  }

  const cookieName = `ab_${slug}`
  const existingCookie = request.cookies.get(cookieName)?.value

  let visitorId: string
  let variantLabel: string

  if (existingCookie && existingCookie.includes(':')) {
    const colonIdx = existingCookie.indexOf(':')
    visitorId = existingCookie.slice(0, colonIdx)
    variantLabel = existingCookie.slice(colonIdx + 1)
  } else {
    visitorId = randomUUID()
    variantLabel = experiment.status === 'active'
      ? weightedRandom(experiment.variants)
      : experiment.variants[0].label
  }

  const variant =
    experiment.variants.find(v => v.label === variantLabel) ??
    experiment.variants[0]

  // Register visit server-side (deduped — unique constraint on experiment+visitor)
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

  // Build destination URL
  const destUrl = new URL(variant.url)
  destUrl.searchParams.set('utm_content', `${slug}:${variant.label.toLowerCase()}`)

  const response = NextResponse.redirect(destUrl.toString(), { status: 302 })

  response.cookies.set(cookieName, `${visitorId}:${variant.label}`, {
    maxAge: experiment.cookieDays * 86400,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  // Prevent Cloudflare from caching redirects (cookie must always be evaluated)
  response.headers.set('Cache-Control', 'no-store, no-cache')

  return response
}
```

- [ ] **Step 2: Create a test experiment in the database**

```bash
# With psql or drizzle studio, insert a test experiment:
# Or use this curl after adding a simple seed route (skip to step 3 if using studio)
```

Using Drizzle Studio (`npx drizzle-kit studio`), insert:

**ab_experiments:**
```
id: (auto)  name: "Teste Dev"  slug: "teste-dev"  status: active  cookie_days: 30
```

**ab_variants (2 rows):**
```
experimentId: (above id)  label: A  name: controle  url: https://example.com/?v=a  weight: 50  color: #8b5cf6
experimentId: (above id)  label: B  name: teste     url: https://example.com/?v=b  weight: 50  color: #f59e0b
```

- [ ] **Step 3: Test the redirector**

Start dev server: `npm run dev`

```bash
curl -v http://localhost:3000/r/teste-dev
```

Expected:
- Status: 302
- `Location:` header pointing to `https://example.com/?v=a&utm_content=teste-dev:a` (or b)
- `Set-Cookie: ab_teste-dev=<uuid>:A; ...`

```bash
# Second request with the cookie should return same variant
curl -v -H "Cookie: ab_teste-dev=<uuid-from-above>:A" http://localhost:3000/r/teste-dev
```

Expected: always redirects to variant A.

- [ ] **Step 4: Verify visit was recorded**

In Drizzle Studio, check `ab_visits` — should have 1 row. Run the first curl again and confirm row count stays at 1 (dedup working).

- [ ] **Step 5: Commit**

```bash
git add src/app/r/
git commit -m "feat: add server-side redirector with weighted variant assignment and visit deduplication"
```

---

## Task 5: tracker.js

**Files:**
- Create: `public/tracker.js`

**Interfaces:**
- Produces: static file at `/tracker.js` that reads `utm_content` from URL and injects it into Kiwify checkout links

- [ ] **Step 1: Create `public/tracker.js`**

```javascript
(function () {
  'use strict';

  function injectUtm(utmContent) {
    var selectors = [
      'a[href*="pay.kiwify.com.br"]',
      'a[href*="checkout.kiwify.com.br"]',
    ].join(',');

    document.querySelectorAll(selectors).forEach(function (link) {
      try {
        var url = new URL(link.href);
        url.searchParams.set('utm_content', utmContent);
        link.href = url.toString();
      } catch (_) {}
    });
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var utmContent = params.get('utm_content');
    if (!utmContent) return;

    // Inject into existing links
    injectUtm(utmContent);

    // Watch for dynamically added links (e.g. popups, modals)
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        injectUtm(utmContent);
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

- [ ] **Step 2: Test tracker.js in a browser**

Create a temporary HTML file to test:

```html
<!-- /tmp/test-tracker.html -->
<!DOCTYPE html>
<html>
<head><title>Tracker Test</title></head>
<body>
  <a href="https://pay.kiwify.com.br/produto-teste" id="buy-link">Comprar</a>
  <script src="http://localhost:3000/tracker.js"></script>
</body>
</html>
```

Open `file:///tmp/test-tracker.html?utm_content=teste-dev:a` in browser.
Inspect the `#buy-link` href — it should now contain `?utm_content=teste-dev%3Aa`.

- [ ] **Step 3: Commit**

```bash
git add public/tracker.js
git commit -m "feat: add tracker.js for Kiwify UTM injection"
```

---

## Task 6: Kiwify Webhook Handler

**Files:**
- Create: `src/app/api/webhook/kiwify/route.ts`

**Interfaces:**
- Consumes: `db`, `abExperiments`, `abVariants`, `abConversions` from `@/db/schema`
- Produces: idempotent conversion insert on `POST /api/webhook/kiwify`

- [ ] **Step 1: Create `src/app/api/webhook/kiwify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abVariants, abConversions } from '@/db/schema'

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return true // Skip validation if no secret configured
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only process paid orders
  if (payload['event'] !== 'order.paid') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const order = payload['order'] as Record<string, unknown> | undefined
  const orderId = order?.['id'] as string | undefined
  const tracker = order?.['tracker'] as Record<string, unknown> | undefined
  const utmContent = tracker?.['utm_content'] as string | undefined
  const amount = (order?.['product'] as Record<string, unknown>)?.['price'] ?? '0'

  // Always return 200 to prevent Kiwify retry storms
  if (!orderId || !utmContent || !utmContent.includes(':')) {
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  const colonIdx = utmContent.lastIndexOf(':')
  const slug = utmContent.slice(0, colonIdx)
  const label = utmContent.slice(colonIdx + 1).toUpperCase()

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
```

- [ ] **Step 2: Test webhook with curl**

```bash
# Simulate a Kiwify order.paid event
curl -X POST http://localhost:3000/api/webhook/kiwify \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.paid",
    "order": {
      "id": "test-order-001",
      "product": { "price": "97.00" },
      "tracker": {
        "utm_content": "teste-dev:a"
      }
    }
  }'
```

Expected: `{"ok":true}`

- [ ] **Step 3: Verify conversion was recorded**

Check `ab_conversions` in Drizzle Studio — should have 1 row with `kiwify_order_id = "test-order-001"`.

Send the same curl again — row count should still be 1 (idempotency working).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhook/
git commit -m "feat: add Kiwify webhook handler with idempotent conversion tracking"
```

---

## Task 7: Dashboard Shell + Experiments List

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `auth` (server session), `db` with experiments + variants
- Produces: authenticated dashboard home listing all experiments

- [ ] **Step 1: Create `src/app/(dashboard)/layout.tsx`**

```typescript
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col gap-1 p-4 shrink-0">
        <div className="mb-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            A/B Testing
          </span>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Experimentos
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Docs
          </Link>
        </nav>
        <Separator className="my-2" />
        <form action="/api/auth/sign-out" method="POST">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
            Sair
          </Button>
        </form>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/page.tsx`**

```typescript
import Link from 'next/link'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { eq, desc } from 'drizzle-orm'

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

export default async function ExperimentsPage() {
  const experiments = await db.query.abExperiments.findMany({
    orderBy: [desc(abExperiments.createdAt)],
    with: { variants: true, winner: true },
  })

  const active = experiments.filter(e => e.status !== 'finished')
  const finished = experiments.filter(e => e.status === 'finished')

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Experimentos</h1>
        <Button asChild>
          <Link href="/experiments/new">+ Novo experimento</Link>
        </Button>
      </div>

      {/* Active */}
      {active.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground mb-8">
          <p className="text-sm">Nenhum experimento ativo</p>
        </Card>
      ) : (
        <div className="space-y-2 mb-8">
          {active.map(exp => (
            <Card key={exp.id} className="p-4">
              <Link href={`/experiments/${exp.slug}`} className="flex items-center justify-between hover:opacity-80">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{exp.name}</span>
                  <Badge variant={STATUS_VARIANT[exp.status]}>
                    {STATUS_LABEL[exp.status]}
                  </Badge>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{exp.slug}</code>
                </div>
                <span className="text-muted-foreground text-xs">
                  {exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}
                </span>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Finalizados
          </h2>
          <div className="space-y-2">
            {finished.map(exp => (
              <Card key={exp.id} className="p-4">
                <Link href={`/experiments/${exp.slug}/results`} className="flex items-center justify-between hover:opacity-80">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{exp.name}</span>
                    {exp.winner && (
                      <Badge variant="secondary">Vencedor: {exp.winner.label}</Badge>
                    )}
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/r/{exp.slug}</code>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {exp.variants.length} variantes · {exp.finishedAt?.toLocaleDateString('pt-BR')}
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

- [ ] **Step 3: Test dashboard home**

`npm run dev` → visit `http://localhost:3000` after login.
Should show "Nenhum experimento ativo" card (or the "Teste Dev" if still in DB).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/
git commit -m "feat: add dashboard layout and experiments list page"
```

---

## Task 8: Create / Edit Experiment

**Files:**
- Create: `src/components/experiment-form.tsx`
- Create: `src/app/(dashboard)/experiments/new/page.tsx`
- Create: `src/app/(dashboard)/experiments/[slug]/page.tsx`
- Create: `src/app/api/experiments/route.ts` (POST create)
- Create: `src/app/api/experiments/[id]/route.ts` (PATCH update, DELETE)

**Interfaces:**
- Consumes: `db`, `abExperiments`, `abVariants`
- Produces: `POST /api/experiments` → creates experiment + variants; `PATCH /api/experiments/:id` → updates; form component usable in both new and edit pages

- [ ] **Step 1: Create `src/app/api/experiments/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { abExperiments, abVariants } from '@/db/schema'

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
const LABELS = ['A', 'B', 'C', 'D', 'E']

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

- [ ] **Step 2: Create `src/app/api/experiments/[id]/route.ts`**

```typescript
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

  if (name || cookieDays) {
    await db.update(abExperiments)
      .set({ ...(name && { name }), ...(cookieDays && { cookieDays }) })
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
```

- [ ] **Step 3: Create `src/components/experiment-form.tsx`**

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
  experimentId?: string
  initialName?: string
  initialSlug?: string
  initialCookieDays?: number
  initialVariants?: VariantRow[]
}

export function ExperimentForm({
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
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function updateVariant(i: number, field: keyof VariantRow, value: string | number) {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    if (variants.length >= 5) return
    const remaining = Math.max(0, 100 - totalWeight)
    setVariants(prev => [...prev, { name: `Teste ${String.fromCharCode(65 + prev.length)}`, url: '', weight: remaining }])
  }

  function removeVariant(i: number) {
    if (variants.length <= 2) return
    setVariants(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalWeight !== 100) { setError('A soma dos pesos deve ser 100'); return }
    setLoading(true)
    setError('')

    const payload = { name, slug, cookieDays, variants }
    const res = experimentId
      ? await fetch(`/api/experiments/${experimentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Erro desconhecido'); return }
    router.push(experimentId ? `/experiments/${slug}` : `/experiments/${data.slug}`)
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
            placeholder="Destrava OAB"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Slug (URL)</Label>
          <Input
            value={slug}
            onChange={e => setSlug(autoSlug(e.target.value))}
            placeholder="destrava-oab"
            required
            disabled={!!experimentId}
          />
          {slug && <p className="text-xs text-muted-foreground">/r/{slug}</p>}
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

      {/* Variants */}
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)}>
                    ✕
                  </Button>
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

- [ ] **Step 4: Create `src/app/(dashboard)/experiments/new/page.tsx`**

```typescript
import { ExperimentForm } from '@/components/experiment-form'

export default function NewExperimentPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Novo experimento</h1>
      <ExperimentForm />
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/(dashboard)/experiments/[slug]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { ExperimentForm } from '@/components/experiment-form'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function ExperimentConfigPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })

  if (!experiment) notFound()

  const redirectorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{experiment.name}</h1>
        <Badge>{experiment.status}</Badge>
        <Link href={`/experiments/${slug}/results`} className="ml-auto text-sm text-muted-foreground hover:underline">
          Ver resultados →
        </Link>
      </div>

      {/* Redirector URL */}
      <div className="mb-6 p-3 rounded-md bg-muted text-sm font-mono">
        {redirectorUrl}
      </div>

      {/* Tracker script */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Script para instalar na landing page:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
{`<script src="${appUrl}/tracker.js" data-exp="${slug}"></script>`}
        </pre>
      </div>

      <ExperimentForm
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

- [ ] **Step 6: Test create experiment**

`npm run dev` → go to `http://localhost:3000/experiments/new`
- Fill in name "Meu Teste", observe slug auto-fill
- Set 2 variants with weights 60/40 → should show "Soma: 100%" in green
- Submit → should redirect to `/experiments/meu-teste`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/experiments/ src/components/experiment-form.tsx src/app/api/experiments/
git commit -m "feat: add experiment create/edit form with variant editor"
```

---

## Task 9: Results Page + Statistical Analysis

**Files:**
- Create: `src/lib/stats.ts`
- Create: `src/components/results-summary.tsx`
- Create: `src/components/daily-chart.tsx`
- Create: `src/app/(dashboard)/experiments/[slug]/results/page.tsx`
- Create: `src/app/api/experiments/[id]/results/route.ts`

**Interfaces:**
- Consumes: `abVisits`, `abConversions` grouped by `variant_id` and by `DATE(created_at)`
- Produces: results page with confidence badge, daily Recharts chart, per-variant table; API route returning `{ variants, dailyData }`

- [ ] **Step 1: Create `src/lib/stats.ts`**

```typescript
// Abramowitz & Stegun normal CDF approximation (error < 7.5e-8)
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))))
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const cdf = z >= 0 ? 1 - pdf * poly : pdf * poly
  return cdf
}

/**
 * Two-proportion Z-test.
 * Returns confidence as a value between 0 and 1, or null if not enough data.
 * control: the baseline (variant A)
 * test: the variant being compared
 */
export function calcConfidence(
  controlVisits: number,
  controlConversions: number,
  testVisits: number,
  testConversions: number,
): number | null {
  if (controlVisits < 30 || testVisits < 30) return null
  if (controlConversions === 0 && testConversions === 0) return null

  const p1 = controlConversions / controlVisits
  const p2 = testConversions / testVisits
  const pPool =
    (controlConversions + testConversions) / (controlVisits + testVisits)
  const se = Math.sqrt(
    pPool * (1 - pPool) * (1 / controlVisits + 1 / testVisits),
  )
  if (se === 0) return null

  const z = Math.abs((p2 - p1) / se)
  // Two-tailed p-value → confidence
  const confidence = 2 * normalCDF(z) - 1
  return Math.max(0, Math.min(1, confidence))
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + '%'
}
```

- [ ] **Step 2: Create `src/app/api/experiments/[id]/results/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql, count, sum } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments, abVariants, abVisits, abConversions } from '@/db/schema'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.id, id),
    with: { variants: true, winner: true },
  })
  if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Aggregate visits per variant
  const visitRows = await db
    .select({ variantId: abVisits.variantId, visits: count() })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(abVisits.variantId)

  // Aggregate conversions per variant
  const convRows = await db
    .select({
      variantId: abConversions.variantId,
      conversions: count(),
      revenue: sum(abConversions.amount),
    })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(abConversions.variantId)

  // Daily visits per variant
  const dailyVisitRows = await db
    .select({
      date: sql<string>`DATE(${abVisits.createdAt})`,
      variantId: abVisits.variantId,
      visits: count(),
    })
    .from(abVisits)
    .where(eq(abVisits.experimentId, id))
    .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
    .orderBy(sql`DATE(${abVisits.createdAt})`)

  // Daily conversions per variant
  const dailyConvRows = await db
    .select({
      date: sql<string>`DATE(${abConversions.createdAt})`,
      variantId: abConversions.variantId,
      conversions: count(),
    })
    .from(abConversions)
    .where(eq(abConversions.experimentId, id))
    .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
    .orderBy(sql`DATE(${abConversions.createdAt})`)

  // Merge into variant stats
  const variants = experiment.variants.map(v => {
    const vr = visitRows.find(r => r.variantId === v.id)
    const cr = convRows.find(r => r.variantId === v.id)
    const visits = Number(vr?.visits ?? 0)
    const conversions = Number(cr?.conversions ?? 0)
    return {
      id: v.id,
      label: v.label,
      name: v.name,
      color: v.color,
      visits,
      conversions,
      rate: visits > 0 ? conversions / visits : 0,
      revenue: cr?.revenue ?? '0',
    }
  })

  // Build daily chart data: array of { date, [variantLabel]: rate }
  const allDates = [...new Set([
    ...dailyVisitRows.map(r => r.date),
    ...dailyConvRows.map(r => r.date),
  ])].sort()

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

  return NextResponse.json({
    experiment: {
      id: experiment.id,
      name: experiment.name,
      slug: experiment.slug,
      status: experiment.status,
      winnerId: experiment.winnerVariantId,
    },
    variants,
    dailyData,
  })
}
```

- [ ] **Step 3: Create `src/components/results-summary.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { calcConfidence, fmtPct } from '@/lib/stats'

interface VariantResult {
  id: string
  label: string
  name: string
  color: string
  visits: number
  conversions: number
  rate: number
  revenue: string
}

interface Props {
  experimentId: string
  experimentStatus: string
  variants: VariantResult[]
}

export function ResultsSummary({ experimentId, experimentStatus, variants }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const control = variants[0]

  async function updateStatus(status: string, winnerVariantId?: string) {
    setLoading(status)
    await fetch(`/api/experiments/${experimentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, winnerVariantId }),
    })
    setLoading(null)
    router.refresh()
  }

  async function declareWinner(variantId: string) {
    await updateStatus('finished', variantId)
  }

  const totalVisits = variants.reduce((s, v) => s + v.visits, 0)
  const totalConversions = variants.reduce((s, v) => s + v.conversions, 0)
  const globalRate = totalVisits > 0 ? totalConversions / totalVisits : 0

  return (
    <div className="space-y-6">
      {/* Global summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{totalVisits.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">Visitas totais</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{totalConversions.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground mt-1">Conversões totais</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{fmtPct(globalRate)}</p>
          <p className="text-xs text-muted-foreground mt-1">Taxa global</p>
        </Card>
      </div>

      {/* Per-variant cards */}
      <div className="grid gap-3">
        {variants.map((v, i) => {
          const confidence = i === 0
            ? null
            : calcConfidence(control.visits, control.conversions, v.visits, v.conversions)
          const isSignificant = confidence !== null && confidence >= 0.95
          const isBetter = v.rate > control.rate

          return (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: v.color }}
                  />
                  <div>
                    <p className="font-medium">
                      {v.label} — {v.name}
                      {i === 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">(controle)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.visits} visitas · {v.conversions} conversões
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-xl font-bold">{fmtPct(v.rate)}</p>
                  {confidence !== null && (
                    <Badge variant={isSignificant ? 'default' : 'secondary'}>
                      {Math.round(confidence * 100)}% confiança
                      {isSignificant && (isBetter ? ' 🏆' : '')}
                    </Badge>
                  )}
                  {confidence === null && i > 0 && (
                    <span className="text-xs text-muted-foreground">dados insuficientes</span>
                  )}
                </div>
              </div>
              {experimentStatus === 'active' && isSignificant && (
                <div className="mt-3 pt-3 border-t flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => declareWinner(v.id)}
                    disabled={loading === 'finished'}
                  >
                    Declarar {v.label} vencedor e encerrar
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Status actions */}
      {experimentStatus !== 'finished' && (
        <div className="flex gap-2">
          {experimentStatus === 'active' && (
            <Button variant="outline" onClick={() => updateStatus('paused')} disabled={!!loading}>
              Pausar
            </Button>
          )}
          {experimentStatus === 'paused' && (
            <Button variant="outline" onClick={() => updateStatus('active')} disabled={!!loading}>
              Retomar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/daily-chart.tsx`**

```typescript
'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  data: Record<string, string | number>[]
  variants: { label: string; color: string }[]
}

function formatRate(value: unknown) {
  if (typeof value !== 'number') return ''
  return (value * 100).toFixed(1) + '%'
}

export function DailyChart({ data, variants }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Sem dados ainda
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => (v * 100).toFixed(0) + '%'} tick={{ fontSize: 11 }} />
        <Tooltip formatter={formatRate} />
        <Legend />
        {variants.map(v => (
          <Line
            key={v.label}
            type="monotone"
            dataKey={v.label}
            stroke={v.color}
            strokeWidth={2}
            dot={false}
            name={`Variante ${v.label}`}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Create `src/app/(dashboard)/experiments/[slug]/results/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { ResultsSummary } from '@/components/results-summary'
import { DailyChart } from '@/components/daily-chart'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const experiment = await db.query.abExperiments.findFirst({
    where: eq(abExperiments.slug, slug),
    with: { variants: true },
  })
  if (!experiment) notFound()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/experiments/${experiment.id}/results`,
    { cache: 'no-store' },
  )
  const data = await res.json()

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{experiment.name}</h1>
          <Link href={`/experiments/${slug}`} className="text-sm text-muted-foreground hover:underline">
            ← Configurar
          </Link>
        </div>
      </div>

      <ResultsSummary
        experimentId={experiment.id}
        experimentStatus={data.experiment.status}
        variants={data.variants}
      />

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Evolução diária — Taxa de conversão
        </h2>
        <DailyChart data={data.dailyData} variants={data.variants} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Test results page end-to-end**

Using Drizzle Studio, insert some test visits and conversions for the "Teste Dev" experiment, then visit `http://localhost:3000/experiments/teste-dev/results`.

Verify:
- Cards show correct visit/conversion counts
- Rate calculation is correct
- Chart renders without errors
- With < 30 visits, confidence shows "dados insuficientes"

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats.ts src/components/ src/app/\(dashboard\)/experiments/ src/app/api/experiments/
git commit -m "feat: add results page with Z-test confidence and daily conversion chart"
```

---

## Task 10: Docs Page + Deploy Config

**Files:**
- Create: `src/app/(dashboard)/docs/page.tsx`
- Create: `nixpacks.toml` (Railway build config)
- Update: `.env.example` (final)

**Interfaces:**
- Produces: docs page with copy-paste instructions; Railway-ready build

- [ ] **Step 1: Create `src/app/(dashboard)/docs/page.tsx`**

```typescript
export default function DocsPage() {
  return (
    <div className="max-w-2xl space-y-8 text-sm">
      <h1 className="text-2xl font-semibold">Guia rápido</h1>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Como funciona o redirecionamento</h2>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Visitante acessa a URL do redirecionador <code className="bg-muted px-1 rounded">/r/SLUG</code></li>
          <li>Se já visitou antes, mantém a mesma variante (cookie de 30 dias)</li>
          <li>Se novo: variante sorteada conforme o split configurado</li>
          <li>Redirecionado para a URL da variante com <code className="bg-muted px-1 rounded">?utm_content=SLUG:VARIANTE</code></li>
          <li>O tracker.js injeta esse UTM nos links da Kiwify</li>
          <li>Na compra aprovada, o webhook registra a conversão automaticamente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1 · Instalar o tracker na landing page</h2>
        <p className="text-muted-foreground">Cole antes do fechamento do <code className="bg-muted px-1 rounded">&lt;/body&gt;</code>:</p>
        <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`<script src="${process.env.NEXT_PUBLIC_APP_URL}/tracker.js"></script>`}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">2 · Configurar webhook na Kiwify</h2>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Acesse o painel da Kiwify → Configurações → Webhooks</li>
          <li>
            Adicione a URL: <code className="bg-muted px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/webhook/kiwify</code>
          </li>
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

- [ ] **Step 2: Create `nixpacks.toml`** (Railway build config)

```toml
[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

- [ ] **Step 3: Update `next.config.ts`** to add output standalone for smaller Docker image

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-auth'],
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 4: Final build test**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: add docs page and Railway deploy config"
```

---

## Post-Implementation: Railway Deploy

After all tasks are complete:

1. Create new service in Railway project `clever-gratitude`:
   - Connect GitHub repo or push via Railway CLI
   - Service name: `ab-testing`

2. Set environment variables in Railway:
   ```
   DATABASE_URL=<from Railway project postgres service>
   BETTER_AUTH_SECRET=<same as viciolinks>
   KIWIFY_WEBHOOK_SECRET=<from Kiwify dashboard>
   NEXT_PUBLIC_APP_URL=https://ab.alexiaduarte.com
   BOOTSTRAP_ADMIN_EMAIL=<admin email>
   BOOTSTRAP_ADMIN_PASSWORD=<admin password>
   ```

3. Add custom domain `ab.alexiaduarte.com` (or client's preferred domain) via Railway → point Cloudflare CNAME to Railway domain.

4. Run DB migration once in production:
   ```bash
   railway run npx drizzle-kit migrate
   ```

5. Bootstrap admin user via production URL (same curl command from Task 3, Step 5 but with production URL).
