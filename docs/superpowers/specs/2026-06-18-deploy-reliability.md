# Deploy & Reliability — Spec

**Sub-projeto:** 3 de 4 — Deploy & Reliability
**Data:** 2026-06-18

---

## Visão Geral

Colocar a plataforma em produção no Railway com observabilidade completa: health check, logging estruturado nos webhooks, monitoramento de uptime via UptimeRobot e rastreamento de erros + performance via Sentry.

**Escopo:** infraestrutura Railway + health endpoint + webhook logging + UptimeRobot + Sentry.

---

## 1. Infraestrutura Railway

### Services

Dois recursos no mesmo projeto Railway:

| Resource | Tipo | Config |
|---|---|---|
| `teste-ab` | Service (Next.js) | Nixpacks, start `npm start` |
| `teste-ab-db` | Plugin PostgreSQL | Railway injeta `DATABASE_URL` |

### Variáveis de ambiente na service `teste-ab`

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Referência Railway para o plugin Postgres |
| `BETTER_AUTH_SECRET` | String aleatória ≥ 32 chars |
| `NEXT_PUBLIC_APP_URL` | URL pública do app (ex: `https://teste-ab.up.railway.app`) |
| `KIWIFY_WEBHOOK_SECRET` | Token do painel Kiwify |
| `HOTMART_WEBHOOK_TOKEN` | Token do painel Hotmart |
| `SENTRY_DSN` | DSN do projeto Sentry (ex: `https://xxx@oN.ingest.sentry.io/yyy`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Mesmo valor — exposto para o client bundle |
| `SENTRY_ORG` | Slug da org no Sentry (usado no build para source maps) |
| `SENTRY_PROJECT` | Nome do projeto no Sentry |
| `SENTRY_AUTH_TOKEN` | Token de acesso para upload de source maps |
| `NODE_ENV` | `production` |

### Deploy automático

Push para `main` dispara deploy. Railway observa o repositório GitHub diretamente — sem CI/CD extra.

### Domínio

Railway gera `*.up.railway.app` automaticamente. Domínio customizado é opcional: adicionar CNAME no DNS e Railway emite TLS. Não é tarefa de código — feito pelo dashboard Railway.

---

## 2. Health Check (`/api/health`)

### Rota

`GET /api/health`

### Comportamento

1. Executa `SELECT 1` no banco via Drizzle para verificar conectividade
2. Retorna `200 { ok: true, db: true }` se o banco responder
3. Retorna `500 { ok: false, db: false, error: string }` se o banco falhar

### Arquivo

`src/app/api/health/route.ts` — novo arquivo, ~20 linhas.

### Por que

- Railway usa para health checks internos
- UptimeRobot pinga este endpoint para alertas de uptime
- Detecta falha de DB (não só falha de processo)

---

## 3. Webhook Logging Estruturado

### Princípio

Railway captura `stdout`/`stderr` e exibe nos logs da service. Usar `console.error` para falhas permite filtrar por prefixo nos logs do Railway dashboard. Sentry captura automaticamente as exceções lançadas.

### Kiwify (`src/app/api/webhook/kiwify/route.ts`)

Envolver o bloco de negócio principal em `try/catch`:

```typescript
try {
  // lógica existente: parse s1, query DB, insert conversão
} catch (err) {
  console.error('[webhook:kiwify]', {
    orderId,
    s1,
    error: err instanceof Error ? err.message : String(err),
  })
  return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
}
```

Logar também os `reason` de descarte como `console.warn`:

```typescript
console.warn('[webhook:kiwify] skipped', { reason: 'not trackable', orderId })
```

### Hotmart (`src/app/api/webhook/hotmart/route.ts`)

Mesma estrutura com prefixo `[webhook:hotmart]` e campos `{ transactionId, trackerToken }`.

### Convenção de prefixos

| Prefixo | Quando usar |
|---|---|
| `[webhook:kiwify]` | Handler Kiwify |
| `[webhook:hotmart]` | Handler Hotmart |

Nível `error` = falha inesperada (exception, capturada também pelo Sentry). Nível `warn` = payload descartado intencionalmente.

---

## 4. Uptime Monitoring (UptimeRobot)

### Configuração

- **Serviço:** UptimeRobot (plano gratuito)
- **Tipo:** HTTP monitor
- **URL monitorada:** `https://<domínio>/api/health`
- **Intervalo:** 5 minutos
- **Critério de alerta:** 2 checks consecutivos com resposta não-200
- **Canal de alerta:** e-mail para `lucasdebavelaerels@gmail.com`

### Setup

Feito pelo dashboard UptimeRobot — sem código. Requer apenas que `/api/health` esteja deployed e acessível.

---

## 5. Sentry — Rastreamento de Erros + Performance

### SDK

`@sentry/nextjs` — integração oficial para Next.js App Router.

### Arquivos criados pelo wizard (ou manualmente)

| Arquivo | Descrição |
|---|---|
| `src/instrumentation.ts` | Entry point de instrumentação Next.js — inicializa Sentry no server |
| `sentry.client.config.ts` | Config do SDK no browser |
| `sentry.server.config.ts` | Config do SDK no server (Node.js) |
| `sentry.edge.config.ts` | Config do SDK no edge runtime |

### Configuração base (`sentry.server.config.ts` e equivalentes)

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,       // 100% das transações em produção (ajustar se volume crescer)
  environment: process.env.NODE_ENV ?? 'development',
  enabled: process.env.NODE_ENV === 'production',
})
```

### `src/instrumentation.ts`

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
```

### `next.config.ts` — wrapper Sentry

O `next.config.ts` é envolvido com `withSentryConfig` para habilitar upload de source maps no build:

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

### O que o Sentry captura automaticamente

- Exceções não tratadas em Server Components, API Routes e Client Components
- Performance de rotas de API (latência, p50/p95)
- Web Vitals (LCP, CLS, FID) no client
- Stack traces com source maps (arquivos `.ts`/`.tsx` originais)

### Alertas no Sentry dashboard

Configurar via dashboard (sem código):
- **Alerta de novo erro:** notifica por e-mail na primeira ocorrência de cada erro único
- **Alerta de volume:** notifica se um erro ocorre > 10 vezes em 1 hora

---

## 6. O que NÃO está no escopo

- Métricas de infraestrutura (CPU, memória Railway)
- Log aggregation externa (Datadog, Logtail)
- Tracing distribuído entre services
- Billing Railway
- Migração de dados locais para produção (feita via `drizzle-kit push` com `DATABASE_URL` de produção)

---

## 7. Sequência de Setup (fora do código)

1. Criar conta Sentry → criar projeto Next.js → copiar DSN
2. Criar projeto Railway + adicionar plugin PostgreSQL
3. Conectar repositório GitHub ao Railway
4. Configurar todas as variáveis de ambiente no Railway dashboard
5. Executar migrations: `DATABASE_URL=<prod> npx drizzle-kit push`
6. Fazer push para `main` → Railway builda e deploya
7. Testar `/api/health` manualmente
8. Criar monitor no UptimeRobot apontando para `/api/health`
9. Disparar erro de teste → verificar no Sentry dashboard
10. Enviar webhook de teste da Kiwify/Hotmart → verificar logs no Railway

---

## 8. Arquivos Modificados / Criados

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/app/api/health/route.ts` | Criar | Health check com teste de DB |
| `src/app/api/webhook/kiwify/route.ts` | Modificar | try/catch + console.error/warn |
| `src/app/api/webhook/hotmart/route.ts` | Modificar | try/catch + console.error/warn |
| `src/instrumentation.ts` | Criar | Inicialização Sentry no Next.js |
| `sentry.client.config.ts` | Criar | Config Sentry browser |
| `sentry.server.config.ts` | Criar | Config Sentry server |
| `sentry.edge.config.ts` | Criar | Config Sentry edge |
| `next.config.ts` | Modificar | Wrap com `withSentryConfig` |
