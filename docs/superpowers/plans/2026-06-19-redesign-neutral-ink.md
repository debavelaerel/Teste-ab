# Redesign Neutral Ink — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o design system Neutral Ink em toda a plataforma — tipografia Outfit + DM Mono, paleta zinc/branco, login multi-step estilo projeto-deisy, e rename "Eventos" → "Observabilidade".

**Architecture:** Alterações puramente visuais — tokens CSS, componentes UI, e reimplementação da página de login com fluxo multi-step. Zero mudanças em lógica de negócio, APIs, banco de dados ou autenticação.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn/ui (base-ui), better-auth, Outfit + DM Mono (Google Fonts via `next/font/google`)

## Global Constraints

- Fontes: `Outfit` (sans) e `DM_Mono` (mono) via `next/font/google` — NUNCA via `<link>` HTML
- Paleta primária: `#18181B` (zinc-900) para botões/ações, `#09090B` (zinc-950) para textos
- Zero mudanças em: lógica de negócio, queries DB, autenticação, APIs, redirector
- Commits frequentes após cada arquivo ou grupo pequeno
- Build deve passar sem erros TypeScript: `npm run build`
- Dev server para verificação visual: `npm run dev` → `http://localhost:3000`

---

### Task 1: Fonts + Design Tokens

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: variáveis CSS `--font-geist-sans` (Outfit), `--font-geist-mono` (DM Mono), e todos os tokens de cor Neutral Ink

- [ ] **Step 1: Atualizar layout.tsx — trocar fontes**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "SplitTest",
  description: "Plataforma de testes A/B para produtores digitais — compare variantes de página e tome decisões baseadas em dados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${outfit.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Atualizar globals.css — tokens Neutral Ink**

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-geist-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-primary-subtle: var(--primary-subtle);
  --color-primary-muted: var(--primary-muted);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  /* Base */
  --background: oklch(1 0 0);
  --foreground: oklch(0.09 0 0);

  /* Card */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.09 0 0);

  /* Popover */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.09 0 0);

  /* Primary — zinc-900 (#18181B) */
  --primary: oklch(0.145 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --primary-subtle: oklch(0.97 0 0);
  --primary-muted: oklch(0.922 0 0);

  /* Secondary */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.145 0 0);

  /* Muted */
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  /* Accent */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.145 0 0);

  /* Destructive */
  --destructive: oklch(0.577 0.245 27.325);

  /* Borders + Ring */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.145 0 0);

  /* Charts */
  --chart-1: oklch(0.52 0.165 264.4);
  --chart-2: oklch(0.72 0.19 142);
  --chart-3: oklch(0.75 0.18 55);
  --chart-4: oklch(0.65 0.22 20);
  --chart-5: oklch(0.6 0.18 300);

  /* Radius */
  --radius: 0.625rem;

  /* Sidebar */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.09 0 0);
  --sidebar-primary: oklch(0.145 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.145 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 3: Verificar build**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -20
```

Expected: build completes, zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "$(cat <<'EOF'
feat: Neutral Ink — Outfit + DM Mono fonts and design tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: UI Primitives

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/input.tsx`

**Interfaces:**
- Consumes: `--primary` token do Task 1 (agora zinc-900)
- Produces: `Button`, `Badge`, `Input` com visual Neutral Ink

- [ ] **Step 1: Atualizar button.tsx**

O variant `default` já usa `bg-primary` que agora é zinc-900 — correto. Apenas garantir que hover fica consistente:

```tsx
// src/components/ui/button.tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

- [ ] **Step 2: Atualizar badge.tsx — status com cores sutis Neutral Ink**

```tsx
// src/components/ui/badge.tsx
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20",
        outline: "border-border text-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        paused: "bg-amber-50 text-amber-700 border border-amber-200",
        finished: "bg-zinc-100 text-zinc-600 border border-zinc-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
```

- [ ] **Step 3: Atualizar input.tsx — altura h-9 e font Outfit**

```tsx
// src/components/ui/input.tsx
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-sm font-sans transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 4: Build check**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/input.tsx
git commit -m "$(cat <<'EOF'
feat: Neutral Ink — update UI primitives (button, badge, input)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Auth Layout + Login Multi-Step

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `authClient.signIn.email`, `authClient.forgetPassword` de `@/lib/auth-client`
- Produces: login page com 5 steps — email → senha → (opcional) esqueci → link-enviado → success

- [ ] **Step 1: Reescrever auth layout — fundo preto, card centralizado**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: 'radial-gradient(ellipse at 35% 30%, #1c1c1e 0%, #111 40%, #09090b 100%)',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Reescrever login/page.tsx — fluxo multi-step**

```tsx
// src/app/(auth)/login/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Check } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

/* ── Helpers ── */
function calcStrength(pwd: string) {
  const checks = {
    length:  pwd.length >= 6,
    upper:   /[A-Z]/.test(pwd),
    number:  /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  }
  return { checks, score: Object.values(checks).filter(Boolean).length }
}

const STRENGTH_LABELS = ['', 'Fraca', 'Regular', 'Boa', 'Forte']
const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

/* ── Sub-components ── */
function Logo({ center = false }: { center?: boolean }) {
  return (
    <div style={{ textAlign: center ? 'center' : 'left' }}>
      <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 22, fontWeight: 800, color: '#09090b', letterSpacing: '-0.05em', lineHeight: 1 }}>
        SplitTest
      </p>
      <p style={{ fontSize: 11, fontWeight: 500, color: '#a1a1aa', letterSpacing: '0.03em', marginTop: 3 }}>
        Plataforma de Testes A/B
      </p>
    </div>
  )
}

function Card({ children, animDir = 'right' }: { children: React.ReactNode; animDir?: 'right' | 'left' | 'up' }) {
  const anims = {
    right: 'translateX(-12px)',
    left:  'translateX(12px)',
    up:    'translateY(14px)',
  }
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        animation: 'authCardIn 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <style>{`
        @keyframes authCardIn {
          from { opacity: 0; transform: ${anims[animDir]}; }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      {children}
    </div>
  )
}

function AuthInput({
  label, type = 'text', value, onChange, onKeyDown, icon: Icon, placeholder, autoFocus, error, rightSlot,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  placeholder?: string
  autoFocus?: boolean
  error?: string
  rightSlot?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#3f3f46', letterSpacing: '0.01em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            width: '100%',
            height: 40,
            border: `1.5px solid ${error ? '#ef4444' : focused ? '#18181b' : '#e4e4e7'}`,
            borderRadius: 8,
            padding: rightSlot || Icon ? '0 44px 0 14px' : '0 14px',
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 14,
            color: '#09090b',
            background: focused ? '#fafafa' : '#fff',
            boxShadow: focused ? '0 0 0 3px rgba(24,24,27,0.07)' : error ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
            outline: 'none',
            transition: 'all 0.15s',
          }}
        />
        {Icon && !rightSlot && (
          <Icon size={16} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: focused ? '#18181b' : '#d4d4d8', transition: 'color 0.15s', pointerEvents: 'none' }} />
        )}
        {rightSlot}
      </div>
      {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
    </div>
  )
}

function AuthBtn({ children, onClick, loading, type = 'button', disabled }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        height: 42,
        background: disabled || loading ? '#d4d4d8' : '#18181b',
        color: disabled || loading ? '#a1a1aa' : '#fff',
        border: 'none',
        borderRadius: 8,
        fontFamily: 'var(--font-geist-sans)',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading
        ? <span style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        : children}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
      onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
    >
      <ArrowLeft size={14} /> Voltar
    </button>
  )
}

/* ── Steps ── */
function StepEmail({ onNext }: { onNext: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function handleNext() {
    if (!email.trim()) { setError('Informe seu e-mail'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('E-mail inválido'); return }
    onNext(email.trim())
  }

  return (
    <Card animDir="right">
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Logo center />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthInput
          label="E-MAIL"
          type="email"
          value={email}
          onChange={v => { setEmail(v); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleNext()}
          icon={Mail}
          placeholder="seu@email.com"
          autoFocus
          error={error}
        />
        <AuthBtn onClick={handleNext} disabled={!email.trim()}>
          Próximo
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepPassword({ email, onBack, onForgot }: { email: string; onBack: () => void; onForgot: () => void }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!password) { setError('Informe sua senha'); return }
    setLoading(true); setError('')
    const { error: err } = await authClient.signIn.email({ email, password })
    if (err) {
      setError('E-mail ou senha inválidos')
      setLoading(false)
    } else {
      router.push('/org')
    }
  }

  const name = email.split('@')[0]
  const displayName = name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <Card animDir="right">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <BackLink onClick={onBack} />
        <Logo />
      </div>
      <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 20, fontWeight: 700, color: '#09090b', marginBottom: 24, letterSpacing: '-0.3px' }}>
        Olá, {displayName}! 👋
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <AuthInput
            label="SENHA"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={v => { setPassword(v); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
            error={error}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8', display: 'flex', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#18181b')}
                onMouseLeave={e => (e.currentTarget.style.color = '#d4d4d8')}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <button
            onClick={onForgot}
            style={{ fontSize: 12, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
            onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
          >
            Esqueceu sua senha?
          </button>
        </div>
        <AuthBtn onClick={handleLogin} loading={loading} disabled={!password}>
          Entrar
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepForgot({ email: initialEmail, onBack, onSent }: { email: string; onBack: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!email.trim()) { setError('Informe seu e-mail'); return }
    setLoading(true); setError('')
    await authClient.forgetPassword({
      email: email.trim(),
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    onSent(email.trim())
  }

  return (
    <Card animDir="left">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <BackLink onClick={onBack} />
        <Logo />
      </div>
      <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 18, fontWeight: 700, color: '#09090b', marginBottom: 6, letterSpacing: '-0.3px' }}>
        Recuperar senha
      </h2>
      <p style={{ fontSize: 13, color: '#71717a', marginBottom: 24, lineHeight: 1.5 }}>
        Enviaremos um link de redefinição para seu e-mail.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthInput
          label="E-MAIL"
          type="email"
          value={email}
          onChange={v => { setEmail(v); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          icon={Mail}
          placeholder="seu@email.com"
          autoFocus
          error={error}
        />
        <AuthBtn onClick={handleSend} loading={loading} disabled={!email.trim()}>
          Enviar link
        </AuthBtn>
      </div>
    </Card>
  )
}

function StepLinkSent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <Card animDir="up">
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div style={{ width: 56, height: 56, background: '#18181b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={22} color="#fff" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-geist-sans)', fontSize: 20, fontWeight: 700, color: '#09090b', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Link enviado!
        </h2>
        <p style={{ fontSize: 13, color: '#71717a', marginBottom: 28, lineHeight: 1.6 }}>
          Verifique sua caixa de entrada em<br />
          <strong style={{ color: '#09090b' }}>{email}</strong>
        </p>
        <button
          onClick={onBack}
          style={{ fontSize: 13, fontWeight: 500, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#09090b')}
          onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
        >
          <ArrowLeft size={14} /> Voltar ao login
        </button>
      </div>
    </Card>
  )
}

/* ── Page ── */
type Step = 'email' | 'password' | 'forgot' | 'link-sent'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')

  return (
    <>
      {step === 'email' && (
        <StepEmail
          onNext={e => { setEmail(e); setStep('password') }}
        />
      )}
      {step === 'password' && (
        <StepPassword
          email={email}
          onBack={() => setStep('email')}
          onForgot={() => setStep('forgot')}
        />
      )}
      {step === 'forgot' && (
        <StepForgot
          email={email}
          onBack={() => setStep('password')}
          onSent={e => { setEmail(e); setStep('link-sent') }}
        />
      )}
      {step === 'link-sent' && (
        <StepLinkSent
          email={email}
          onBack={() => setStep('email')}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Build + verificar visualmente**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -10
```

Expected: zero TypeScript errors. Depois iniciar `npm run dev` e acessar `http://localhost:3000/login` para checar visualmente os 4 steps (email → próximo → senha → esqueci senha → link enviado).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/layout.tsx src/app/\(auth\)/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: multi-step login — zinc bg, Outfit font, 4-step flow

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sidebar + Org Layout

**Files:**
- Modify: `src/components/sidebar-nav.tsx`
- Modify: `src/app/org/[orgSlug]/layout.tsx`

**Interfaces:**
- Consumes: tokens do Task 1
- Produces: sidebar com "Observabilidade", estilo Neutral Ink

- [ ] **Step 1: Atualizar sidebar-nav.tsx — rename + estilos**

```tsx
// src/components/sidebar-nav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, FileText, Settings, Activity } from 'lucide-react'
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
    label: 'Observabilidade',
    icon: Activity,
    href: (slug: string) => `/org/${slug}/events`,
    isActive: (path: string, slug: string) => path.startsWith(`/org/${slug}/events`),
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
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV_ITEMS.map(({ label, icon: Icon, href, isActive }) => (
        <Link
          key={label}
          href={href(orgSlug)}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            isActive(pathname, orgSlug)
              ? 'bg-zinc-100 text-zinc-900 font-semibold'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
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

- [ ] **Step 2: Atualizar org layout — sidebar Neutral Ink**

```tsx
// src/app/org/[orgSlug]/layout.tsx
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
      redirect(e.status === 403 ? '/org' : '/login?_=1')
    }
    throw e
  }

  const orgInitials = getInitials(org.name)
  const userDisplay = session.user.name ?? session.user.email ?? 'Usuário'
  const userInitials = getInitials(userDisplay)

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 border-r border-zinc-100 bg-zinc-50 flex flex-col shrink-0">
        {/* Org header */}
        <div className="h-14 px-4 flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0 font-mono">
            {orgInitials}
          </div>
          <span className="text-sm font-semibold text-zinc-900 truncate">{org.name}</span>
        </div>

        <Separator className="bg-zinc-100" />

        {/* Nav */}
        <SidebarNav orgSlug={orgSlug} />

        <div className="flex-1" />

        <Separator className="bg-zinc-100" />

        {/* User footer */}
        <div className="h-14 px-4 flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-600 text-xs font-semibold flex items-center justify-center shrink-0">
            {userInitials}
          </div>
          <span className="text-xs text-zinc-500 truncate flex-1">{userDisplay}</span>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar-nav.tsx src/app/org/\[orgSlug\]/layout.tsx
git commit -m "$(cat <<'EOF'
feat: Neutral Ink sidebar — rename Eventos→Observabilidade, zinc styles

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Experiment Card + Dashboard

**Files:**
- Modify: `src/components/experiment-card.tsx`
- Modify: `src/app/org/[orgSlug]/page.tsx`

**Interfaces:**
- Consumes: `Badge` variants do Task 2 (active, paused, finished)
- Produces: cards limpos sem border inline, dashboard Neutral Ink

- [ ] **Step 1: Reescrever experiment-card.tsx — remover styles inline**

```tsx
// src/components/experiment-card.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  finished: 'Finalizado',
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
  const [fetchError, setFetchError] = useState(false)

  async function handleToggle() {
    if (!expanded && stats === null && !loadingStats) {
      setLoadingStats(true)
      try {
        const res = await fetch(`/api/org/${orgSlug}/experiments/${exp.id}/stats`)
        if (res.ok) setStats(await res.json())
        else setFetchError(true)
      } catch {
        setFetchError(true)
      } finally {
        setLoadingStats(false)
      }
    }
    setExpanded(v => !v)
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-100 bg-white cursor-pointer transition-shadow hover:shadow-sm',
        expanded && 'shadow-sm'
      )}
      onClick={handleToggle}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-zinc-900 text-sm">{exp.name}</span>
            <Badge variant={exp.status as 'active' | 'paused' | 'finished'}>
              {STATUS_LABEL[exp.status] ?? exp.status}
            </Badge>
            <Badge variant="outline" className="text-zinc-500">
              {exp.checkoutType === 'hotmart' ? 'Hotmart' : 'Kiwify'}
            </Badge>
            {exp.winner && (
              <Badge variant="finished">Vencedor: {exp.winner.label}</Badge>
            )}
          </div>
          <div className="text-zinc-400 shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
          <code className="font-mono bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded text-zinc-500">
            /r/{orgSlug}/{exp.slug}
          </code>
          <span>·</span>
          <span>{exp.variants.length} variante{exp.variants.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>
            {new Date(exp.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-100" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            {loadingStats ? (
              <div className="col-span-3 text-center text-sm text-zinc-400 py-2">Carregando...</div>
            ) : fetchError ? (
              <div className="col-span-3 text-center text-sm text-red-500 py-2">Erro ao carregar dados</div>
            ) : stats ? (
              <>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">{stats.visits.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">visitas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">{stats.conversions.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">conversões</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-zinc-900 font-mono">
                    {stats.visits > 0 ? (stats.rate * 100).toFixed(1) + '%' : '—'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">taxa</p>
                </div>
              </>
            ) : (
              <div className="col-span-3 text-center text-sm text-zinc-400 py-2">Sem dados</div>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}`}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-8 px-3 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              Ver resultados →
            </Link>
            <Link
              href={`/org/${orgSlug}/experiments/${exp.slug}?tab=configuracao`}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-8 px-3 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Configurar →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Atualizar dashboard page.tsx**

```tsx
// src/app/org/[orgSlug]/page.tsx
import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/db'
import { abExperiments } from '@/db/schema'
import { requireOrgMember } from '@/lib/require-org-member'
import { ExperimentCard } from '@/components/experiment-card'
import { FlaskConical } from 'lucide-react'

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
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Experimentos</h1>
        <Link
          href={`/org/${orgSlug}/experiments/new`}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 h-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          + Novo experimento
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-xl mb-8 bg-zinc-50/50">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
            <FlaskConical className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="font-semibold text-zinc-900 text-sm">Nenhum experimento ativo</p>
          <p className="text-sm text-zinc-400 mt-1 mb-5 max-w-xs">
            Crie seu primeiro teste A/B e compare variantes com dados reais.
          </p>
          <Link
            href={`/org/${orgSlug}/experiments/new`}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 h-8 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            + Criar primeiro experimento
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
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Finalizados
          </p>
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

- [ ] **Step 3: Build check**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/experiment-card.tsx src/app/org/\[orgSlug\]/page.tsx
git commit -m "$(cat <<'EOF'
feat: Neutral Ink — experiment card and dashboard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Experiment Detail — Tabs, Results, Chart

**Files:**
- Modify: `src/components/experiment-tabs.tsx`
- Modify: `src/components/results-summary.tsx`
- Modify: `src/components/daily-chart.tsx`

**Interfaces:**
- Consumes: `Badge` variants do Task 2, `Button` do Task 2, `Card` existente
- Produces: tela de detalhe do experimento com visual Neutral Ink

- [ ] **Step 1: Atualizar experiment-tabs.tsx — tabs e header**

No arquivo `src/components/experiment-tabs.tsx`, localizar e substituir:

1. O header do experimento (linhas com `flex items-center gap-3 mb-6`):
```tsx
{/* Header */}
<div className="flex items-center gap-3 mb-6">
  <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{experiment.name}</h1>
  <Badge variant={experiment.status as 'active' | 'paused' | 'finished'}>
    {STATUS_LABEL[experiment.status] ?? experiment.status}
  </Badge>
</div>
```

2. Os tabs (linhas com `border-b mb-6`):
```tsx
{/* Tabs */}
<div className="border-b border-zinc-100 mb-6">
  <div className="flex gap-0">
    {TABS.map(tab => (
      <Link
        key={tab.key}
        href={`${pathname}?tab=${tab.key}`}
        scroll={false}
        className={cn(
          'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === tab.key
            ? 'border-zinc-900 text-zinc-900'
            : 'border-transparent text-zinc-400 hover:text-zinc-700 hover:border-zinc-300'
        )}
      >
        {tab.label}
      </Link>
    ))}
  </div>
</div>
```

3. O bloco de instalação (`activeTab === 'instalacao'`), atualizar os blocos de código:
```tsx
{activeTab === 'instalacao' && (
  <div className="space-y-6 max-w-2xl">
    <div>
      <p className="text-sm font-semibold text-zinc-900 mb-2">URL do Redirector</p>
      <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 border border-zinc-100 font-mono text-sm break-all">
        <span className="flex-1 text-zinc-700">{redirectorUrl}</span>
        <CopyButton text={redirectorUrl} />
      </div>
    </div>
    <div>
      <p className="text-sm font-semibold text-zinc-900 mb-2">Script para a landing page</p>
      <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 border border-zinc-100 font-mono text-xs break-all">
        <span className="flex-1 text-zinc-700">{scriptTag}</span>
        <CopyButton text={scriptTag} />
      </div>
    </div>
  </div>
)}
```

4. O `CopyButton`, atualizar classes:
```tsx
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
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-xs border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}
```

- [ ] **Step 2: Atualizar results-summary.tsx — cards Neutral Ink**

No arquivo `src/components/results-summary.tsx`, substituir os stat cards do topo:
```tsx
{/* Global summary */}
<div className="grid grid-cols-3 gap-4">
  <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
    <p className="text-2xl font-bold text-zinc-900 font-mono">{totalVisits.toLocaleString('pt-BR')}</p>
    <p className="text-xs text-zinc-400 mt-1">Visitas totais</p>
  </div>
  <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
    <p className="text-2xl font-bold text-zinc-900 font-mono">{totalConversions.toLocaleString('pt-BR')}</p>
    <p className="text-xs text-zinc-400 mt-1">Conversões totais</p>
  </div>
  <div className="rounded-xl border border-zinc-100 bg-white p-4 text-center">
    <p className="text-2xl font-bold text-zinc-900 font-mono">{fmtPct(globalRate)}</p>
    <p className="text-xs text-zinc-400 mt-1">Taxa global</p>
  </div>
</div>
```

Substituir os per-variant cards:
```tsx
<div className="grid gap-3">
  {variants.map((v, i) => {
    const confidence = i === 0
      ? null
      : calcConfidence(control.visits, control.conversions, v.visits, v.conversions)
    const isSignificant = confidence !== null && confidence >= 0.95
    const isBetter = v.rate > control.rate

    return (
      <div key={v.id} className="rounded-xl border border-zinc-100 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: v.color }} />
            <div>
              <p className="font-semibold text-zinc-900 text-sm">
                {v.label} — {v.name}
                {i === 0 && <span className="ml-2 text-xs text-zinc-400 font-normal">(controle)</span>}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {v.visits} visitas · {v.conversions} conversões
              </p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <p className="text-xl font-bold text-zinc-900 font-mono">{fmtPct(v.rate)}</p>
            {confidence !== null && (
              <Badge variant={isSignificant && isBetter ? 'active' : 'outline'}>
                {isSignificant && isBetter ? '↑ ' : ''}{Math.round(confidence * 100)}% confiança
              </Badge>
            )}
            {confidence === null && i > 0 && (
              <span className="text-xs text-zinc-400">dados insuficientes</span>
            )}
          </div>
        </div>
        {experimentStatus === 'active' && isSignificant && (
          <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-end">
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
      </div>
    )
  })}
</div>
```

Também substituir o "Evolução diária" heading em `experiment-tabs.tsx`:
```tsx
<h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
  Evolução diária — Taxa de conversão
</h2>
```

- [ ] **Step 3: Atualizar daily-chart.tsx — cores neutras no grid**

```tsx
// src/components/daily-chart.tsx
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
  return (value * 100).toFixed(2) + '%'
}

export function DailyChart({ data, variants }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">
        Sem dados ainda
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa', fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => (v * 100).toFixed(0) + '%'} tick={{ fontSize: 11, fill: '#a1a1aa', fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={formatRate}
          contentStyle={{ borderRadius: 8, border: '1px solid #f0f0f0', boxShadow: '0 4px 12px rgba(0,0,0,.06)', fontFamily: 'var(--font-geist-sans)', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-geist-sans)' }} />
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

- [ ] **Step 4: Build check**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/experiment-tabs.tsx src/components/results-summary.tsx src/components/daily-chart.tsx
git commit -m "$(cat <<'EOF'
feat: Neutral Ink — experiment detail, results, chart

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Páginas Restantes

**Files:**
- Modify: `src/app/org/[orgSlug]/events/page.tsx`
- Modify: `src/app/org/[orgSlug]/settings/page.tsx`
- Modify: `src/app/org/[orgSlug]/docs/page.tsx`
- Modify: `src/app/org/[orgSlug]/experiments/new/page.tsx`
- Modify: `src/components/experiment-form.tsx`

**Interfaces:**
- Consumes: tokens, `Button`, `Input`, `Label` do sistema
- Produces: todas as páginas restantes com visual Neutral Ink

- [ ] **Step 1: Atualizar events/page.tsx — heading + estilos**

Substituir o heading principal:
```tsx
<h1 className="text-xl font-bold text-zinc-900 tracking-tight">Observabilidade</h1>
<p className="text-sm text-zinc-400 mt-0.5">
  Últimos 100 acessos e conversões · atualiza a cada 15s
</p>
```

Substituir o botão de refresh:
```tsx
<button
  onClick={fetchEvents}
  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
>
  <RefreshCw className="w-4 h-4" />
  {lastRefresh.toLocaleTimeString('pt-BR')}
</button>
```

Substituir os stat cards:
```tsx
<div className="grid grid-cols-3 gap-3 mb-5">
  <div className="rounded-xl border border-zinc-100 bg-white p-3">
    <p className="text-xs text-zinc-400">Total de acessos</p>
    <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{sessions.length}</p>
  </div>
  <div className="rounded-xl border border-zinc-100 bg-white p-3">
    <p className="text-xs text-zinc-400">Visitantes novos</p>
    <p className="text-2xl font-bold text-zinc-900 font-mono mt-0.5">{newVisitors}</p>
  </div>
  <div className="rounded-xl border border-zinc-100 bg-white p-3">
    <p className="text-xs text-zinc-400">Retornos</p>
    <p className="text-2xl font-bold text-zinc-400 font-mono mt-0.5">{returning}</p>
  </div>
</div>
```

Substituir os tabs:
```tsx
<div className="flex gap-1 mb-4 bg-zinc-50 border border-zinc-100 p-1 rounded-lg w-fit">
  {(['all', 'sessions', 'conversions'] as Tab[]).map(t => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        tab === t
          ? 'bg-white text-zinc-900 shadow-sm font-medium border border-zinc-100'
          : 'text-zinc-400 hover:text-zinc-700'
      }`}
    >
      {t === 'all' ? 'Todos' : t === 'sessions' ? `Acessos (${sessions.length})` : `Conversões (${conversions.length})`}
    </button>
  ))}
</div>
```

Substituir os event rows de sessão:
```tsx
<div key={`s-${s.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-100 bg-white hover:bg-zinc-50 transition-colors">
  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isNew ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
    {isNew
      ? <Activity className="w-3.5 h-3.5 text-white" />
      : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-zinc-900">{s.experiment}</span>
      <code className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-mono">{s.variant}</code>
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isNew ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-50 text-zinc-400'}`}>
        {isNew ? 'novo' : 'retorno'}
      </span>
    </div>
    <p className="text-xs text-zinc-400 mt-0.5 truncate font-mono">{s.visitorId.slice(0, 8)}…</p>
  </div>
  <span className="text-xs text-zinc-400 shrink-0">{timeAgo(s.createdAt)}</span>
</div>
```

Substituir os event rows de conversão:
```tsx
<div key={`c-${c.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 transition-colors">
  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
    <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-zinc-900">{c.experiment}</span>
      <code className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-mono">{c.variant}</code>
      <span className="text-xs text-emerald-600 font-medium">conversão</span>
      {c.amount && Number(c.amount) > 0 && (
        <span className="text-xs text-emerald-700 font-medium font-mono">R$ {Number(c.amount).toFixed(2)}</span>
      )}
    </div>
    <p className="text-xs text-zinc-400 mt-0.5 truncate font-mono">{c.source} · {c.orderId}</p>
  </div>
  <span className="text-xs text-zinc-400 shrink-0">{timeAgo(c.createdAt)}</span>
</div>
```

Substituir o empty state:
```tsx
<div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
  <Activity className="w-8 h-8 text-zinc-300 mb-3" />
  <p className="text-sm text-zinc-400">Nenhum evento ainda</p>
</div>
```

- [ ] **Step 2: Atualizar settings/page.tsx**

```tsx
// src/app/org/[orgSlug]/settings/page.tsx
import { requireOrgMember } from '@/lib/require-org-member'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const { org } = await requireOrgMember(orgSlug)

  const kiwifySet = !!process.env.KIWIFY_WEBHOOK_SECRET
  const hotmartSet = !!process.env.HOTMART_WEBHOOK_TOKEN

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-8">Configurações</h1>

      <section className="mb-8">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Organização
        </h2>
        <div className="border border-zinc-100 rounded-xl divide-y divide-zinc-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Nome</span>
            <span className="text-sm font-semibold text-zinc-900">{org.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Slug</span>
            <code className="text-xs bg-zinc-50 border border-zinc-100 px-2 py-1 rounded font-mono text-zinc-600">{org.slug}</code>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
          Webhooks
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Tokens configurados como variáveis de ambiente no Railway.
        </p>
        <div className="border border-zinc-100 rounded-xl divide-y divide-zinc-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Kiwify webhook secret</span>
            <span className={`text-xs font-semibold ${kiwifySet ? 'text-emerald-600' : 'text-zinc-400'}`}>
              {kiwifySet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-zinc-500">Hotmart webhook token</span>
            <span className={`text-xs font-semibold ${hotmartSet ? 'text-emerald-600' : 'text-zinc-400'}`}>
              {hotmartSet ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar docs/page.tsx — heading + estilos de código**

Substituir o heading e as seções:
```tsx
// src/app/org/[orgSlug]/docs/page.tsx
export default async function DocsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const appUrl = process.env.REDIRECT_DOMAIN
    ? `https://${process.env.REDIRECT_DOMAIN}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? '')

  return (
    <div className="max-w-2xl space-y-8 text-sm">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Guia rápido</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Como funciona o redirecionamento</h2>
        <ol className="list-decimal list-inside space-y-1 text-zinc-500">
          <li>Visitante acessa a URL do redirecionador <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">/r/{orgSlug}/SEU-SLUG</code></li>
          <li>Se já visitou antes, mantém a mesma variante (cookie pelo período configurado)</li>
          <li>Se novo: variante sorteada conforme o split configurado</li>
          <li>Redirecionado para a URL da variante com <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">?s1=SEU-SLUG:VARIANTE</code></li>
          <li>O tracker.js injeta esse parâmetro nos links da Kiwify</li>
          <li>Na compra aprovada, o webhook registra a conversão automaticamente</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">1 · Instalar o tracker na landing page</h2>
        <p className="text-zinc-500">Cole antes do fechamento do <code className="bg-zinc-100 border border-zinc-200 px-1 rounded font-mono text-xs">&lt;/body&gt;</code>:</p>
        <pre className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-zinc-700">
{`<script src="${appUrl}/tracker.js"></script>`}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">1b · Instalar o tracker Hotmart</h2>
        <p className="text-zinc-500">Para experimentos com checkout Hotmart:</p>
        <pre className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-zinc-700">
{`<script src="${appUrl}/tracker-hotmart.js"></script>`}
        </pre>
        <p className="text-zinc-400 text-xs">O script injeta o parâmetro <code className="bg-zinc-100 px-1 rounded font-mono">xcod</code> nos links <code className="bg-zinc-100 px-1 rounded font-mono">pay.hotmart.com</code>. Use apenas um tracker por landing page.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">2 · Configurar webhook na Kiwify</h2>
        <ol className="list-decimal list-inside space-y-2 text-zinc-500">
          <li>Acesse Kiwify → Configurações → Webhooks</li>
          <li>Adicione a URL: <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">{appUrl}/api/webhook/kiwify</code></li>
          <li>Evento: <strong className="text-zinc-700">order.paid</strong></li>
          <li>Copie o token e adicione como <code className="bg-zinc-100 px-1 rounded font-mono text-xs">KIWIFY_WEBHOOK_SECRET</code> no Railway</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">2b · Configurar webhook na Hotmart</h2>
        <ol className="list-decimal list-inside space-y-2 text-zinc-500">
          <li>Acesse Hotmart → Ferramentas → Webhooks</li>
          <li>Adicione a URL: <code className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-700">{appUrl}/api/webhook/hotmart</code></li>
          <li>Evento: <strong className="text-zinc-700">PURCHASE_APPROVED</strong></li>
          <li>Copie o token e adicione como <code className="bg-zinc-100 px-1 rounded font-mono text-xs">HOTMART_WEBHOOK_TOKEN</code> no Railway</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">3 · Pré-requisitos para significância estatística</h2>
        <ul className="list-disc list-inside space-y-1 text-zinc-500">
          <li>Mínimo de 100 visitas por variante antes de analisar</li>
          <li>Confiança ≥ 95% para declarar vencedor com segurança</li>
          <li>Máximo de 5 variantes por experimento</li>
          <li>Cookies bloqueados por ~3-5% dos usuários com ad blockers</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Ações disponíveis</h2>
        <dl className="space-y-2 text-zinc-500">
          <div><dt className="font-semibold text-zinc-900 inline">Pausar</dt> — suspende o sorteio de variantes e coleta de dados</div>
          <div><dt className="font-semibold text-zinc-900 inline">Retomar</dt> — reativa após pausa</div>
          <div><dt className="font-semibold text-zinc-900 inline">Encerrar</dt> — declara vencedor e finaliza o experimento</div>
        </dl>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Atualizar new/page.tsx — heading**

```tsx
// src/app/org/[orgSlug]/experiments/new/page.tsx
import { ExperimentForm } from '@/components/experiment-form'

export default async function NewExperimentPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-zinc-900 tracking-tight mb-6">Novo experimento</h1>
      <ExperimentForm orgSlug={orgSlug} />
    </div>
  )
}
```

- [ ] **Step 5: Atualizar experiment-form.tsx — estilos do formulário**

No arquivo `src/components/experiment-form.tsx`, substituir a seção de `return` do componente (o JSX). Localizar a `div` raiz com `className="space-y-6 max-w-2xl"` e substitua todo o JSX retornado por:

```tsx
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Nome</Label>
        <Input
          id="name"
          value={name}
          onChange={e => {
            setName(e.target.value)
            if (!experimentId) setSlug(autoSlug(e.target.value))
          }}
          placeholder="Ex: Checkout Principal"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={e => setSlug(autoSlug(e.target.value))}
          placeholder="checkout-principal"
          required
          className="font-mono"
        />
        <p className="text-xs text-zinc-400">Usado na URL: <code className="font-mono bg-zinc-100 px-1 rounded">/r/{orgSlug}/{slug || 'slug'}</code></p>
      </div>

      {/* Checkout type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Plataforma</Label>
        <div className="flex gap-2">
          {(['kiwify', 'hotmart'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setCheckoutType(type)}
              className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                checkoutType === type
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {type === 'kiwify' ? 'Kiwify' : 'Hotmart'}
            </button>
          ))}
        </div>
      </div>

      {/* Cookie days */}
      <div className="space-y-1.5">
        <Label htmlFor="cookieDays" className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Período do cookie (dias)</Label>
        <Input
          id="cookieDays"
          type="number"
          min={1}
          max={365}
          value={cookieDays}
          onChange={e => setCookieDays(Number(e.target.value))}
          className="w-32 font-mono"
        />
      </div>

      {/* Variants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Variantes</Label>
          <span className={`text-xs font-mono font-semibold ${totalWeight === 100 ? 'text-emerald-600' : 'text-red-500'}`}>
            {totalWeight}/100
          </span>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="flex items-center gap-2 p-3 rounded-xl border border-zinc-100 bg-zinc-50">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={v.name}
                  onChange={e => updateVariant(i, 'name', e.target.value)}
                  placeholder={`Variante ${i + 1}`}
                />
                <Input
                  value={v.url}
                  onChange={e => updateVariant(i, 'url', e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <Input
                type="number"
                min={1}
                max={99}
                value={v.weight}
                onChange={e => updateVariant(i, 'weight', Number(e.target.value))}
                className="w-16 text-center font-mono"
              />
              <span className="text-xs text-zinc-400">%</span>
              {variants.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="text-zinc-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {variants.length < 5 && (
          <button
            type="button"
            onClick={addVariant}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            + Adicionar variante
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || totalWeight !== 100}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 h-9 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Salvando...' : experimentId ? 'Salvar alterações' : 'Criar experimento'}
      </button>
    </form>
  )
```

- [ ] **Step 6: Build final + verificação visual completa**

```bash
cd /Users/lucasdebavelaere/code/teste-ab && npm run build 2>&1 | tail -20
```

Expected: zero erros. Depois:
```bash
npm run dev
```
Verificar visualmente:
- `http://localhost:3000/login` — fluxo multi-step funcionando
- Login → entrar → sidebar com "Observabilidade"
- Lista de experimentos → cards limpos
- Detalhe de experimento → tabs, resultados, gráfico
- Observabilidade, Settings, Docs

- [ ] **Step 7: Commit final**

```bash
git add src/app/org/\[orgSlug\]/events/page.tsx \
        src/app/org/\[orgSlug\]/settings/page.tsx \
        src/app/org/\[orgSlug\]/docs/page.tsx \
        src/app/org/\[orgSlug\]/experiments/new/page.tsx \
        src/components/experiment-form.tsx
git commit -m "$(cat <<'EOF'
feat: Neutral Ink — observabilidade, settings, docs, form

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
