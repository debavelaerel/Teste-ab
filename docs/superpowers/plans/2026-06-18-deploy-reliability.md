# Deploy & Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar a plataforma em produção no Railway com Sentry (erros + performance), health check e webhook logging estruturado.

**Architecture:** Três tarefas independentes de código — Sentry setup, health endpoint e webhook logging — seguidas de setup manual no Railway, UptimeRobot e Sentry dashboard. O código é verificado com `npx tsc --noEmit` + `npm run build` (sem framework de testes).

**Tech Stack:** Next.js 16 App Router, `@sentry/nextjs`, Drizzle ORM, Railway (Nixpacks), UptimeRobot

## Global Constraints

- Next.js 16: `params` é sempre `Promise<{...}>` — sempre `await params`
- Sem framework de testes — verificar com `npx tsc --noEmit` e `npm run build`
- Nunca commitar `.env*`
- Nomes de tabelas prefixados com `ab_`
- `NODE_ENV` vale `production` em Railway
- `@sentry/nextjs` deve ser instalado antes de qualquer import
- `src/instrumentation.ts` fica dentro de `src/` (projeto usa diretório `src/`)
- `sentry.server.config.ts` e `sentry.client.config.ts` ficam na raiz do projeto (ao lado de `package.json`)
- `withSentryConfig` deve preservar `output: 'standalone'` e `serverExternalPackages: ['better-auth']`

---

### Task 1: Sentry Setup

**Files:**
- Create: `sentry.server.config.ts`
- Create: `sentry.client.config.ts`
- Create: `src/instrumentation.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores
- Produces:
  - `sentry.server.config.ts` — chama `Sentry.init()` para o runtime Node.js
  - `sentry.client.config.ts` — chama `Sentry.init()` para o browser
  - `src/instrumentation.ts` — exports `register` e `onRequestError` usados pelo Next.js
  - `next.config.ts` — exporta `withSentryConfig(nextConfig, sentryOptions)`

- [ ] **Step 1: Instalar `@sentry/nextjs`**

```bash
npm install @sentry/nextjs
```

Esperado: sem erros, `@sentry/nextjs` aparece em `package.json` → `dependencies`.

- [ ] **Step 2: Criar `sentry.server.config.ts`**

Na raiz do projeto (ao lado de `package.json`):

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',
})
```

- [ ] **Step 3: Criar `sentry.client.config.ts`**

Na raiz do projeto:

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',
})
```

- [ ] **Step 4: Criar `src/instrumentation.ts`**

Dentro de `src/` (Next.js com diretório `src/` lê este arquivo automaticamente):

```typescript
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
}

export const onRequestError = Sentry.captureRequestError
```

`onRequestError` é necessário para capturar erros de rotas de API que fazem `try/catch` e retornam 500 — sem ele o Sentry só captura exceções não tratadas.

- [ ] **Step 5: Modificar `next.config.ts`**

Conteúdo atual de `next.config.ts`:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-auth'],
  output: 'standalone',
}

export default nextConfig
```

Substituir por:

```typescript
import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-auth'],
  output: 'standalone',
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7: Verificar build**

```bash
npm run build
```

Esperado: build completa sem erros. Avisos de Sentry sobre DSN ausente são normais em ambiente local (sem `SENTRY_DSN` no `.env.local`).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json sentry.server.config.ts sentry.client.config.ts src/instrumentation.ts next.config.ts
git commit -m "feat: add Sentry error tracking and performance monitoring"
```

---

### Task 2: Health Check Endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

**Interfaces:**
- Consumes: `db` de `@/db`, `sql` de `drizzle-orm`
- Produces:
  - `GET /api/health` → `200 { ok: true, db: true }` ou `500 { ok: false, db: false, error: string }`

- [ ] **Step 1: Criar `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: true })
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: `src/app/api/health/route.ts` aparece na saída do build como rota compilada.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add /api/health endpoint with DB connectivity check"
```

---

### Task 3: Webhook Structured Logging

**Files:**
- Modify: `src/app/api/webhook/kiwify/route.ts`
- Modify: `src/app/api/webhook/hotmart/route.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores
- Produces: handlers com `console.warn` nos caminhos de descarte e `console.error` + status 500 em exceções inesperadas

- [ ] **Step 1: Modificar `src/app/api/webhook/kiwify/route.ts`**

Localizar a seção de skip paths e DB block. O arquivo atual (`src/app/api/webhook/kiwify/route.ts`) tem retornos com `reason` mas sem logging. Substituir o arquivo completo por:

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
    console.warn('[webhook:kiwify] skipped', { reason: 'invalid json' })
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
    console.warn('[webhook:kiwify] skipped', { reason: 'not trackable', orderId })
    return NextResponse.json({ ok: true, reason: 'not trackable' })
  }

  const colonFirst = s1.indexOf(':')
  const colonLast = s1.lastIndexOf(':')

  if (colonFirst === -1 || colonFirst === colonLast) {
    console.warn('[webhook:kiwify] skipped', { reason: 'invalid s1 format', s1 })
    return NextResponse.json({ ok: true, reason: 'invalid s1 format' })
  }

  const orgSlug = s1.slice(0, colonFirst)
  const expSlug = s1.slice(colonFirst + 1, colonLast)
  const label = s1.slice(colonLast + 1).toUpperCase()

  if (!orgSlug || !expSlug || !label) {
    console.warn('[webhook:kiwify] skipped', { reason: 'empty s1 parts', s1 })
    return NextResponse.json({ ok: true, reason: 'empty s1 parts' })
  }

  try {
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
      console.warn('[webhook:kiwify] skipped', { reason: 'experiment not found', orgSlug, expSlug, label })
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
```

- [ ] **Step 2: Modificar `src/app/api/webhook/hotmart/route.ts`**

Substituir o arquivo completo por:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '@/db'
import { abExperiments, abOrganizations, abVariants, abConversions } from '@/db/schema'

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

  const colonFirst = trackerToken.indexOf(':')
  const colonLast = trackerToken.lastIndexOf(':')

  if (colonFirst === -1 || colonFirst === colonLast) {
    console.warn('[webhook:hotmart] skipped', { reason: 'invalid tracker_token format', trackerToken })
    return NextResponse.json({ ok: true, reason: 'invalid tracker_token format' })
  }

  const orgSlug = trackerToken.slice(0, colonFirst)
  const expSlug = trackerToken.slice(colonFirst + 1, colonLast)
  const label = trackerToken.slice(colonLast + 1).toUpperCase()

  if (!orgSlug || !expSlug || !label) {
    console.warn('[webhook:hotmart] skipped', { reason: 'empty tracker_token parts', trackerToken })
    return NextResponse.json({ ok: true, reason: 'empty tracker_token parts' })
  }

  try {
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
      console.warn('[webhook:hotmart] skipped', { reason: 'experiment not found', orgSlug, expSlug, label })
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
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: build completa sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhook/kiwify/route.ts src/app/api/webhook/hotmart/route.ts
git commit -m "feat: add structured logging to webhook handlers"
```

---

## Setup Manual (fora do código — executar após as 3 tarefas acima)

Estes passos são feitos nos dashboards externos. Não geram commits.

### Railway

1. Criar conta em [railway.app](https://railway.app) se ainda não existir
2. Novo projeto → **Deploy from GitHub repo** → selecionar `teste-ab`
3. Adicionar plugin: **+ New** → **Database** → **Add PostgreSQL**
4. Na service `teste-ab`, aba **Variables**, adicionar:
   - `BETTER_AUTH_SECRET` → gerar com `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_URL` → copiar da aba **Settings → Domains** após o deploy inicial
   - `KIWIFY_WEBHOOK_SECRET` → valor do painel Kiwify
   - `HOTMART_WEBHOOK_TOKEN` → valor do painel Hotmart
   - `SENTRY_DSN` → DSN do projeto Sentry (Seção Sentry abaixo)
   - `NEXT_PUBLIC_SENTRY_DSN` → mesmo valor que `SENTRY_DSN`
   - `SENTRY_ORG` → slug da org no Sentry
   - `SENTRY_PROJECT` → nome do projeto no Sentry
   - `SENTRY_AUTH_TOKEN` → token gerado em **Sentry → Settings → Auth Tokens**
5. Executar migrations em produção (requer `DATABASE_URL` da Railway — copiar de **Variables** na service do banco):
   ```bash
   DATABASE_URL="postgresql://..." npx drizzle-kit push
   ```
6. Push para `main` → Railway builda e deploya automaticamente
7. Testar health check: `curl https://<domínio>/api/health` → deve retornar `{"ok":true,"db":true}`

### Sentry

1. Criar conta em [sentry.io](https://sentry.io)
2. Novo projeto → **Next.js** → copiar DSN
3. Gerar auth token: **Settings → Auth Tokens → Create New Token** (escopo: `project:releases`, `org:read`)
4. Após o primeiro deploy com Sentry configurado:
   - **Alerts → Create Alert → Issue Alert**: "A new issue is created" → e-mail `lucasdebavelaerels@gmail.com`
   - **Alerts → Create Alert → Issue Alert**: "An issue is seen more than 10 times in 1 hour" → e-mail `lucasdebavelaerels@gmail.com`
5. Verificar integração: disparar erro de teste acessando uma URL inválida e confirmar que aparece no Sentry dashboard

### UptimeRobot

1. Criar conta gratuita em [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor**:
   - Type: **HTTP(s)**
   - Friendly Name: `teste-ab health`
   - URL: `https://<domínio>/api/health`
   - Monitoring Interval: **5 minutes**
3. **Alert Contacts**: adicionar e-mail `lucasdebavelaerels@gmail.com`
4. Confirmar que o primeiro check retorna verde
