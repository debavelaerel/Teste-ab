# Deploy & Reliability — Spec

**Sub-projeto:** 3 de 4 — Deploy & Reliability
**Data:** 2026-06-18

---

## Visão Geral

Colocar a plataforma em produção no Railway com observabilidade mínima viável: health check, logging estruturado nos webhooks e monitoramento de uptime via UptimeRobot.

**Escopo:** infraestrutura Railway + health endpoint + webhook logging + UptimeRobot. Sem Sentry, sem métricas, sem tracing distribuído.

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

Railway captura `stdout`/`stderr` e exibe nos logs da service. Usar `console.error` para falhas permite filtrar por prefixo nos logs do Railway dashboard.

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

Logar também os `reason` de descarte (não-trackable, formato inválido, experiment not found) como `console.warn` para rastreabilidade:

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

Nível `error` = falha inesperada (exception). Nível `warn` = payload descartado intencionalmente.

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

## 5. O que NÃO está no escopo

- Sentry ou outro APM
- Métricas (CPU, memória, latência p95)
- Tracing distribuído
- Log aggregation externa (Datadog, Logtail)
- Billing Railway (usuário configura no dashboard)
- Migração de dados de ambiente local para produção (executada via `drizzle-kit push` apontando para `DATABASE_URL` de produção)

---

## 6. Sequência de Setup (fora do código)

1. Criar projeto Railway + adicionar plugin PostgreSQL
2. Conectar repositório GitHub → Railway gera deploy automático
3. Configurar variáveis de ambiente no Railway dashboard
4. Executar migrations: `DATABASE_URL=<prod> npx drizzle-kit push`
5. Criar monitor no UptimeRobot apontando para `/api/health`
6. Testar endpoint `/api/health` manualmente
7. Enviar webhook de teste da Kiwify/Hotmart e verificar logs no Railway

---

## 7. Arquivos Modificados / Criados

| Arquivo | Ação | Descrição |
|---|---|---|
| `src/app/api/health/route.ts` | Criar | Health check com teste de DB |
| `src/app/api/webhook/kiwify/route.ts` | Modificar | try/catch + console.error/warn |
| `src/app/api/webhook/hotmart/route.ts` | Modificar | try/catch + console.error/warn |
