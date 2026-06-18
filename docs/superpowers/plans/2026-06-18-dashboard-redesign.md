# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard visual layer — new sidebar with org avatar and icons, colored status system, expandable experiment cards with lazy stats, unified experiment tabs (Resultados / Configuração / Instalação), and a Settings page for org + webhook info.

**Architecture:** Pure presentation layer change. No API routes touched except one new GET `/stats` endpoint. Server components load data, client components handle interactivity. Existing auth guards, schema, and business logic are untouched.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, shadcn/ui (base-ui), lucide-react@1.20, better-auth, Drizzle ORM.

## Global Constraints

- Next.js 16: `params` is always a `Promise` — always `await params` before destructuring.
- Tailwind v4 CSS-first config: no `tailwind.config.ts`. Add custom tokens to `@theme inline` in `globals.css` for them to be available as Tailwind utility classes.
- `lucide-react@1.20.0` is already installed — do not reinstall.
- Primary color changes from near-black `oklch(0.205 0 0)` to indigo `oklch(0.585 0.233 264.4)`. This affects all `bg-primary`, `text-primary` uses — intended.
- Status colors: active=`#6366f1` (indigo), paused=`#f59e0b` (amber), finished=`#10b981` (emerald).
- No changes to: API routes, schema, auth, tracker.js files, redirector route, stats calculation logic.
- Verify after each task: `npx tsc --noEmit` — must exit 0.
- Build verification at end: `npm run build` — must succeed.

---

### Task 1: Design Tokens + Badge Variants

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/badge.tsx`

**Interfaces:**
- Produces: Tailwind utility classes `bg-primary-subtle`, `text-primary-muted`, badge variants `active` / `paused` / `finished` — used in Tasks 2, 3, 4.

- [ ] **Step 1: Update globals.css — add indigo tokens to `@theme inline`**

Open `src/app/globals.css`. In the `@theme inline { ... }` block, add these lines after the existing `--color-primary-muted` line (or after `--color-primary-foreground: var(--primary-foreground);`):

```css
  --color-primary-subtle: var(--primary-subtle);
  --color-primary-muted: var(--primary-muted);
```

- [ ] **Step 2: Update globals.css — change primary + add tokens to `:root`**

In the `:root { ... }` block, replace the existing `--primary`, `--primary-foreground`, and `--ring` lines and add new tokens. The block should contain these values (keep all other existing lines unchanged):

```css
  --primary: oklch(0.585 0.233 264.4);
  --primary-foreground: oklch(0.985 0 0);
  --ring: oklch(0.585 0.233 264.4);
  --primary-subtle: oklch(0.962 0.018 264.4);
  --primary-muted: oklch(0.855 0.059 264.4);
```

(The old `--primary` value was `oklch(0.205 0 0)` — replace it. The old `--ring` was `oklch(0.708 0 0)` — replace it. `--primary-subtle` and `--primary-muted` are new lines.)

- [ ] **Step 3: Add badge variants to `src/components/ui/badge.tsx`**

In `badge.tsx`, inside the `variants: { variant: { ... } }` object of `badgeVariants`, add three new variants after the existing `link` variant:

```ts
        active:
          "bg-indigo-500 text-white",
        paused:
          "bg-amber-500 text-white",
        finished:
          "bg-emerald-500 text-white",
```

The full `variants` object should now have: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`, `active`, `paused`, `finished`.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui/badge.tsx
git commit -m "feat: add indigo design tokens and status badge variants"
```

---

### Task 2: Sidebar Redesign

**Files:**
- Create: `src/components/sidebar-nav.tsx`
- Modify: `src/app/org/[orgSlug]/layout.tsx`
- Modify: `src/components/sign-out-button.tsx`

**Interfaces:**
- Consumes: `requireOrgMember` from `@/lib/require-org-member`, `Separator` from `@/components/ui/separator`, `Button` from `@/components/ui/button`, icons from `lucide-react`.
- Produces: `SidebarNav` component with `orgSlug: string` prop — used only by layout.

- [ ] **Step 1: Create `src/components/sidebar-nav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    label: 'Experimentos',
    icon: FlaskConical,
    href: (slug: string) => `/org/${slug}`,
    isActive: (path: string, slug: string) =>
      path === `/org/${slug}` || path.startsWith(`/org/${slug}/experiments`),
  },
  {
    label: 'Docs',
    icon: FileText,
    href: (slug: string) => `/org/${slug}/docs`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/docs`),
  },
  {
    label: 'Configurações',
    icon: Settings,
    href: (slug: string) => `/org/${slug}/settings`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/settings`),
  },
]

interface Props {
  orgSlug: string
}

export function SidebarNav({ orgSlug }: Props) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map(({ label, icon: Icon, href, isActive }) => (
        <Link
          key={label}
          href={href(orgSlug)}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            isActive(pathname, orgSlug)
              ? 'bg-primary-subtle text-primary font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Modify `src/components/sign-out-button.tsx`** — replace with icon-only version

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/login')
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground shrink-0"
      onClick={handleSignOut}
      title="Sair"
    >
      <LogOut className="w-4 h-4" />
    </Button>
  )
}
```

- [ ] **Step 3: Replace `src/app/org/[orgSlug]/layout.tsx`** — full rewrite

```tsx
import { redirect } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { requireOrgMember, AuthError } from '@/lib/require-org-member'
import { SidebarNav } from '@/components/sidebar-nav'
import { SignOutButton } from '@/components/sign-out-button'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  let session, org
  try {
    const result = await requireOrgMember(orgSlug)
    session = result.session
    org = result.org
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(e.status === 403 ? '/org' : '/login')
    }
    throw e
  }

  const orgInitials = getInitials(org.name)
  const userDisplay = session.user.name ?? session.user.email ?? 'Usuário'
  const userInitials = getInitials(userDisplay)

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        {/* Org header */}
        <div className="h-14 px-4 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
            {orgInitials}
          </div>
          <span className="text-sm font-semibold truncate">{org.name}</span>
        </div>

        <Separator />

        {/* Nav */}
        <SidebarNav orgSlug={orgSlug} />

        <div className="flex-1" />

        <Separator />

        {/* User footer */}
        <div className="h-14 px-4 flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{userDisplay}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar-nav.tsx src/components/sign-out-button.tsx src/app/org/\[orgSlug\]/layout.tsx
git commit -m "feat: redesign sidebar with org avatar, icons, and user footer"
```

---

### Task 3: Experiment List Cards + Stats API

**Files:**
- Create: `src/app/api/org/[orgSlug]/experiments/[id]/stats/route.ts`
- Create: `src/components/experiment-card.tsx`
- Modify: `src/app/org/[orgSlug]/page.tsx`

**Interfaces:**
- Produces: `GET /api/org/[orgSlug]/experiments/[id]/stats` → `{ visits: number, conversions: number, rate: number }`
- Produces: `ExperimentCard` component with props `{ orgSlug: string, exp: Exp }` where `Exp` is defined in the component file.

- [ ] **Step 1: Create `src/app/api/org/[orgSlug]/experiments/[id]/stats/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq, count, and } from 'drizzle-orm'
import { db } from '@/db'
import { abVisits, abConversions, abExperiments, abOrganizations, abMemberships } from '@/db/schema'
import { auth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberRows = await db
    .select({ org: abOrganizations })
    .from(abMemberships)
    .innerJoin(abOrganizations, eq(abMemberships.orgId, abOrganizations.id))
    .where(and(eq(abMemberships.userId, session.user.id), eq(abOrganizations.slug, orgSlug)))
    .limit(1)

  if (memberRows.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const exp = await db.query.abExperiments.findFirst({
    where: and(eq(abExperiments.id, id), eq(abExperiments.orgId, memberRows[0].org.id)),
  })
  if (!exp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [visitRows, convRows] = await Promise.all([
    db.select({ visits: count() }).from(abVisits).where(eq(abVisits.experimentId, id)),
    db.select({ conversions: count() }).from(abConversions).where(eq(abConversions.experimentId, id)),
  ])

  const visits = Number(visitRows[0]?.visits ?? 0)
  const conversions = Number(convRows[0]?.conversions ?? 0)
  const rate = visits > 0 ? conversions / visits : 0

  return NextResponse.json({ visits, conversions, rate })
}
```

- [ ] **Step 2: Create `src/components/experiment-card.tsx`**

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const STATUS_BORDER_COLOR: Record<string, string> = {
  active: '#6366f1',
  paused: '#f59e0b',
  finished: '#10b981',
}

interface Exp {
  id: string
  name: string
  slug: string
  status: string
  checkoutType: string
  createdAt: Date
  variants: { id: string }[]
  winner?: { label: string } | null
}

interface Props {
  orgSlug: string
  exp: Exp
}

export function ExperimentCard({ orgSlug, exp }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState<{ visits: number; conversions: number; rate: number } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  async function handleToggle() {
    if (!expanded && stats === null) {
      setLoadingStats(true)
      const res = await fetch(`/api/org/${orgSlug}/experiments/${exp.id}/stats`)
      if (res.ok) setStats(await res.json())
      setLoadingStats(false)
    }
    setExpanded(v => !v)
  }

  const borderColor = STATUS_BORDER_COLOR[exp.status] ?? '#e5e7eb'

  return (
    <Card
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
      className="cursor-pointer hover:shadow-sm transition-shadow"
      onClick={handleToggle}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium">{exp.name}</span>
            <Badge variant={exp.status as 'active' | 'paused' | 'finished'}>
              {STATUS_LABEL[exp.status] ?? exp.status}
            </Badge>
            <Badge variant="outline">
              {exp.checkoutType === 'hotmart' ? 'Hotmart' : 'Kiwify'}
            </Badge>
            {exp.winner && (
              <Badge variant="finished">Vencedor: {exp.winner.label}</Badge>
            )}
          </div>
          <div className="text-muted-foreground shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />
            }
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <code className="bg-muted px-1.5 py-0.5 rounded">/r/{orgSlug}/{exp.slug}</code>
          <span>·</span>
          <span>{exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>
            {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            {loadingStats ? (
              <div className="col-span-3 text-center text-sm text-muted-foreground py-2">
                Carregando...
              </div>
            ) : stats ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-bold">{stats.visits.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">visitas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{stats.conversions.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">conversões</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">
                    {stats.visits > 0 ? (stats.rate * 100).toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">taxa</p>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center text-sm text-muted-foreground py-2">
                Sem dados
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ver resultados →
            </Link>
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}?tab=configuracao`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input hover:bg-muted transition-colors"
            >
              Configurar →
            </Link>
          </div>
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Replace `src/app/org/[orgSlug]/page.tsx`**

```tsx
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentCard } from '@/components/experiment-card'

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
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 h-9 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border rounded-lg mb-8">
          <p className="text-sm">Nenhum experimento ativo</p>
          <Link
            href={`/org/${orgSlug}/experiments/new`}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Criar primeiro experimento →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {active.map(exp => (
            <ExperimentCard key={exp.id} orgSlug={orgSlug} exp={exp} />
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Finalizados
          </h2>
          <div className="space-y-2">
            {finished.map(exp => (
              <ExperimentCard key={exp.id} orgSlug={orgSlug} exp={exp} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/org/\[orgSlug\]/experiments/\[id\]/stats/route.ts src/components/experiment-card.tsx src/app/org/\[orgSlug\]/page.tsx
git commit -m "feat: add experiment cards with lazy stats expansion"
```

---

### Task 4: Experiment Tabs (Resultados / Configuração / Instalação)

**Files:**
- Create: `src/components/experiment-tabs.tsx`
- Modify: `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`
- Modify: `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx`

**Interfaces:**
- Consumes from page.tsx: `experiment` object, `variants` with stats, `dailyData`, `orgSlug`, `appUrl`.
- Produces: `ExperimentTabs` with those props — renders the three-tab UI client-side based on `?tab=` search param.

- [ ] **Step 1: Create `src/components/experiment-tabs.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ResultsSummary } from '@/components/results-summary'
import { DailyChart } from '@/components/daily-chart'
import { ExperimentForm } from '@/components/experiment-form'

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

interface Experiment {
  id: string
  name: string
  slug: string
  status: string
  checkoutType: string
  cookieDays: number
  variants: {
    id: string
    name: string
    label: string
    url: string
    weight: number
    color: string
  }[]
}

interface Props {
  orgSlug: string
  experiment: Experiment
  variants: VariantResult[]
  dailyData: Record<string, string | number>[]
  appUrl: string
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
}

const TABS = [
  { key: 'resultados', label: 'Resultados' },
  { key: 'configuracao', label: 'Configuração' },
  { key: 'instalacao', label: 'Instalação' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs border border-input hover:bg-muted transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

export function ExperimentTabs({ orgSlug, experiment, variants, dailyData, appUrl }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = searchParams.get('tab') ?? 'resultados'

  const redirectorUrl = `${appUrl}/r/${orgSlug}/${experiment.slug}`
  const scriptUrl = experiment.checkoutType === 'hotmart'
    ? `${appUrl}/tracker-hotmart.js`
    : `${appUrl}/tracker.js`
  const scriptTag = `<script src="${scriptUrl}"></script>`

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{experiment.name}</h1>
        <Badge variant={experiment.status as 'active' | 'paused' | 'finished'}>
          {STATUS_LABEL[experiment.status] ?? experiment.status}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <Link
              key={tab.key}
              href={`${pathname}?tab=${tab.key}`}
              scroll={false}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'resultados' && (
        <div className="space-y-8">
          <ResultsSummary
            orgSlug={orgSlug}
            experimentId={experiment.id}
            experimentStatus={experiment.status}
            variants={variants}
          />
          {dailyData.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Evolução diária — Taxa de conversão
              </h2>
              <DailyChart data={dailyData} variants={variants} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'configuracao' && (
        <ExperimentForm
          orgSlug={orgSlug}
          experimentId={experiment.id}
          initialName={experiment.name}
          initialSlug={experiment.slug}
          initialCookieDays={experiment.cookieDays}
          initialCheckoutType={experiment.checkoutType as 'kiwify' | 'hotmart'}
          initialVariants={experiment.variants.map(v => ({
            id: v.id,
            name: v.name,
            url: v.url,
            weight: v.weight,
          }))}
        />
      )}

      {activeTab === 'instalacao' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <p className="text-sm font-medium mb-2">URL do Redirector</p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-sm break-all">
              <span className="flex-1">{redirectorUrl}</span>
              <CopyButton text={redirectorUrl} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Script para a landing page</p>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-xs break-all">
              <span className="flex-1">{scriptTag}</span>
              <CopyButton text={scriptTag} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { eq, sql, count, sum, and } from 'drizzle-orm'
import { Suspense } from 'react'
import { db } from '@/db'
import { abExperiments, abVisits, abConversions } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentTabs } from '@/components/experiment-tabs'

export const dynamic = 'force-dynamic'

export default async function ExperimentPage({
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

  const [visitRows, convRows, dailyVisitRows, dailyConvRows] = await Promise.all([
    db
      .select({ variantId: abVisits.variantId, visits: count() })
      .from(abVisits)
      .where(eq(abVisits.experimentId, id))
      .groupBy(abVisits.variantId),
    db
      .select({ variantId: abConversions.variantId, conversions: count(), revenue: sum(abConversions.amount) })
      .from(abConversions)
      .where(eq(abConversions.experimentId, id))
      .groupBy(abConversions.variantId),
    db
      .select({
        date: sql<string>`DATE(${abVisits.createdAt})`,
        variantId: abVisits.variantId,
        visits: count(),
      })
      .from(abVisits)
      .where(eq(abVisits.experimentId, id))
      .groupBy(sql`DATE(${abVisits.createdAt})`, abVisits.variantId)
      .orderBy(sql`DATE(${abVisits.createdAt})`),
    db
      .select({
        date: sql<string>`DATE(${abConversions.createdAt})`,
        variantId: abConversions.variantId,
        conversions: count(),
      })
      .from(abConversions)
      .where(eq(abConversions.experimentId, id))
      .groupBy(sql`DATE(${abConversions.createdAt})`, abConversions.variantId)
      .orderBy(sql`DATE(${abConversions.createdAt})`),
  ])

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

  const allDates = [
    ...new Set([
      ...dailyVisitRows.map(r => r.date),
      ...dailyConvRows.map(r => r.date),
    ]),
  ].sort()

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <Suspense>
      <ExperimentTabs
        orgSlug={orgSlug}
        experiment={{
          id: experiment.id,
          name: experiment.name,
          slug: experiment.slug,
          status: experiment.status,
          checkoutType: experiment.checkoutType,
          cookieDays: experiment.cookieDays,
          variants: experiment.variants,
        }}
        variants={variants}
        dailyData={dailyData}
        appUrl={appUrl}
      />
    </Suspense>
  )
}
```

- [ ] **Step 3: Replace `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx`** — redirect only

```tsx
import { redirect } from 'next/navigation'

export default async function ResultsRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; expSlug: string }>
}) {
  const { orgSlug, expSlug } = await params
  redirect(`/org/${orgSlug}/experiments/${expSlug}?tab=resultados`)
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/experiment-tabs.tsx src/app/org/\[orgSlug\]/experiments/\[expSlug\]/page.tsx src/app/org/\[orgSlug\]/experiments/\[expSlug\]/results/page.tsx
git commit -m "feat: unify experiment pages into tabbed interface"
```

---

### Task 5: Settings Page

**Files:**
- Create: `src/app/org/[orgSlug]/settings/page.tsx`

**Interfaces:**
- Consumes: `requireOrgMember` (returns `{ org, session }`), `process.env.KIWIFY_WEBHOOK_SECRET`, `process.env.HOTMART_WEBHOOK_TOKEN`.
- Produces: settings page at `/org/[orgSlug]/settings` (already linked from sidebar).

- [ ] **Step 1: Create `src/app/org/[orgSlug]/settings/page.tsx`**

```tsx
import { requireOrgMember } from '@/lib/require-org-member'

function maskToken(token: string | undefined): string {
  if (!token) return '(não configurado)'
  if (token.length <= 8) return '•'.repeat(token.length)
  return token.slice(0, 4) + '•'.repeat(token.length - 8) + token.slice(-4)
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const kiwifyToken = process.env.KIWIFY_WEBHOOK_SECRET
  const hotmartToken = process.env.HOTMART_WEBHOOK_TOKEN

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-8">Configurações</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Organização
        </h2>
        <div className="border rounded-lg divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Nome</span>
            <span className="text-sm font-medium">{org.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Slug</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{org.slug}</code>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Webhooks
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Tokens configurados como variáveis de ambiente no Railway. Edição via Railway dashboard.
        </p>
        <div className="border rounded-lg divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Kiwify webhook secret</span>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {maskToken(kiwifyToken)}
            </code>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Hotmart webhook token</span>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {maskToken(hotmartToken)}
            </code>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Final build verification**

```bash
npm run build
```

Expected: exits 0. No build errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/org/\[orgSlug\]/settings/page.tsx
git commit -m "feat: add settings page with org info and webhook token display"
```
