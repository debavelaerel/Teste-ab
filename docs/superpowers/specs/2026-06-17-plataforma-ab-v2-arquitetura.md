# Plataforma Teste-AB v2 — Spec de Arquitetura Multi-tenant

**Data:** 2026-06-17
**Sub-projeto:** 1 de 4 — Fundação Multi-tenant

---

## Visão do Produto

Plataforma de teste A/B para landing pages voltada para produtores digitais brasileiros que vendem via Kiwify e Hotmart. Opera via redirect server-side (sem flickering), cookie de variante, tracker.js que injeta parâmetros nos links de checkout, e webhook para rastrear conversões.

**Modelo atual:** ferramenta interna — Lucas gerencia os experimentos de cada cliente.
**Modelo futuro:** SaaS multi-tenant — cada produtor cria conta e gerencia seus próprios experimentos.

A arquitetura desta spec já prepara o terreno para o SaaS sem construir features desnecessárias agora.

---

## Sub-projetos em sequência

| # | Sub-projeto | Status |
|---|---|---|
| 1 | Arquitetura multi-tenant (esta spec) | Em design |
| 2 | Integração Hotmart | Pendente |
| 3 | Deploy & Reliability (Railway, logs, alertas) | Pendente |
| 4 | UX do dashboard | Pendente |

---

## Decisões de produto

- **Clientes ativos agora:** 1 (Alexia Duarte)
- **Quem opera o dashboard:** Lucas (não a Alexia)
- **Checkouts suportados agora:** Kiwify + (Hotmart em sub-projeto 2)
- **Checkouts futuros:** webhook genérico configurável
- **Parâmetro de rastreamento:** `s1` (campo nativo da Kiwify, equivalente ao `xcod` da Hotmart)

---

## 1. Modelo de Dados

### Novas tabelas

```sql
-- Raiz de tudo. Cada cliente = 1 org.
ab_organizations (
  id          uuid PK,
  name        varchar(255) NOT NULL,          -- "Alexia Duarte"
  slug        varchar(100) NOT NULL UNIQUE,   -- "alexia"
  created_at  timestamp DEFAULT now()
)

-- Quem pertence a qual org, com qual papel
ab_memberships (
  id          uuid PK,
  user_id     uuid NOT NULL → user(id) CASCADE,
  org_id      uuid NOT NULL → ab_organizations(id) CASCADE,
  role        enum('admin', 'viewer') NOT NULL DEFAULT 'admin',
  created_at  timestamp DEFAULT now(),
  UNIQUE (user_id, org_id)
)
```

### Tabela existente modificada

```sql
-- Adicionar coluna à tabela já existente
ALTER TABLE ab_experiments
  ADD COLUMN org_id uuid NOT NULL
    REFERENCES ab_organizations(id) ON DELETE CASCADE;

-- Índice para queries filtradas por org
CREATE INDEX ab_exp_org_idx ON ab_experiments(org_id);

-- O slug agora é único por org, não globalmente
ALTER TABLE ab_experiments DROP CONSTRAINT ab_experiments_slug_key;
CREATE UNIQUE INDEX ab_exp_slug_org_unique ON ab_experiments(org_id, slug);
```

### Tabelas sem mudança

`ab_variants`, `ab_visits`, `ab_conversions` — já herdam o isolamento via FK em cascata a partir de `ab_experiments`.

### Seed de migração

A migration usa um UUID fixo e literal para poder referenciar em várias operações:

```sql
-- UUID gerado uma vez e hardcoded na migration
DO $$
DECLARE
  org_id uuid := '11111111-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO ab_organizations (id, name, slug)
    VALUES (org_id, 'Alexia Duarte', 'alexia')
    ON CONFLICT DO NOTHING;

  INSERT INTO ab_memberships (user_id, org_id, role)
    SELECT u.id, org_id, 'admin'
    FROM "user" u
    LIMIT 1
    ON CONFLICT DO NOTHING;

  UPDATE ab_experiments SET org_id = org_id WHERE org_id IS NULL;
END $$;
```

---

## 2. Auth e Sessão

### Fluxo de login
```
Login → verifica memberships do usuário
  ├─ 1 org → redireciona direto para /org/{slug}/
  └─ múltiplas orgs → mostra seletor (futuro SaaS)
```

### Org na URL

O dashboard usa `/org/[orgSlug]/` como prefixo. A org é derivada da URL, não do cookie de sessão.

```
/org/alexia/                         → lista de experimentos
/org/alexia/experiments/new          → criar experimento
/org/alexia/experiments/[expSlug]    → editar experimento
/org/alexia/experiments/[expSlug]/results → resultados
```

**Benefício:** no futuro SaaS, trocar de org é só mudar a URL. Sem logout, sem estado extra.

### Helper de autorização (reutilizado em todas as rotas protegidas)

```typescript
// src/lib/require-org-member.ts
async function requireOrgMember(orgSlug: string, headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) throw new AuthError(401)

  // Join explícito membership ↔ organization para filtrar pelo slug
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

---

## 3. Isolamento nas APIs

Toda rota autenticada segue este padrão de verificação em cadeia:

```
1. Sessão válida?              → senão: 401
2. User tem membership na org? → senão: 403
3. Recurso pertence a essa org? → senão: 404 (não revela existência em outra org)
```

### Rotas do dashboard (todas protegidas)

```
GET  POST  /api/org/[slug]/experiments
GET  PATCH DELETE  /api/org/[slug]/experiments/[id]
GET  /api/org/[slug]/experiments/[id]/results
```

### Rotas públicas (sem mudança)

```
GET   /r/[orgSlug]/[expSlug]      → redirector
POST  /api/webhook/kiwify          → validado por assinatura
POST  /api/webhook/hotmart         → validado por assinatura (sub-projeto 2)
GET   /tracker.js                  → arquivo estático
GET   /login                       → auth
```

---

## 4. Redirector

### Nova URL

```
ANTES:  /r/[expSlug]
DEPOIS: /r/[orgSlug]/[expSlug]
```

Exemplo: `/r/alexia/meu-experimento` (slug definido pelo usuário ao criar o experimento)

O slug do experimento é único **por org** — duas orgs podem usar o mesmo slug sem conflito.

### Cookie

```
ANTES:  ab_{expSlug}={visitorId}:{label}
DEPOIS: ab_{orgSlug}_{expSlug}={visitorId}:{label}
```

### Parâmetro s1

```
ANTES:  ?s1={expSlug}:{label}
DEPOIS: ?s1={orgSlug}:{expSlug}:{label}
```

### Parsing do s1 no webhook

```typescript
// Parsing seguro: orgSlug não contém ":", label também não
const colonFirst = s1.indexOf(':')
const colonLast  = s1.lastIndexOf(':')
const orgSlug  = s1.slice(0, colonFirst)          // "alexia"
const expSlug  = s1.slice(colonFirst + 1, colonLast) // slug escolhido pelo usuário ao criar o experimento
const label    = s1.slice(colonLast + 1).toUpperCase() // "A"
```

Consulta usa `(orgSlug → org.id) + expSlug` para encontrar o experimento, garantindo isolamento de org mesmo no webhook público.

---

## 5. proxy.ts (auth guard)

```typescript
export function proxy(request: NextRequest) {
  const session = getSessionCookie(request)
  const { pathname } = request.nextUrl

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/r/') ||          // redirector público
    pathname.startsWith('/api/webhook/') || // webhooks públicos
    pathname === '/tracker.js'

  if (!isPublic && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/org', request.url)) // vai para seletor/redirect
  }

  return NextResponse.next()
}
```

---

## 6. Resumo das mudanças no código

| Arquivo | O que muda |
|---|---|
| `src/db/schema.ts` | + `abOrganizations`, + `abMemberships`, + `org_id` em `abExperiments`, slug único por org |
| `src/db/migrations/` | Nova migration com ALTER TABLE + seed da org Alexia |
| `src/lib/require-org-member.ts` | Novo helper de autorização |
| `src/app/r/[orgSlug]/[expSlug]/route.ts` | Novo path, cookie e s1 com orgSlug |
| `src/app/api/org/[slug]/experiments/` | Rotas movidas para novo prefixo |
| `src/app/org/[slug]/` | Dashboard movido para novo prefixo |
| `src/app/api/webhook/kiwify/route.ts` | Parsing do s1 atualizado (3 partes) |
| `src/proxy.ts` | `/api/webhook/` adicionado como rota pública |

### O que NÃO muda

- `public/tracker.js` — só lê e injeta `s1`, agnóstico ao formato
- Lógica de Z-test (`src/lib/stats.ts`)
- Componentes Recharts do dashboard de resultados
- Better Auth e tabelas de sessão

---

## 7. Limitações e regras de negócio

- Máximo de 5 variantes por experimento (label A–E)
- Pesos das variantes devem somar 100
- Cookie de variante: 1–90 dias configurável por experimento (padrão 30)
- Deduplicação de visitas: `UNIQUE (experiment_id, visitor_id)` — conta sessão única por visitante
- Deduplicação de conversão: `UNIQUE (kiwify_order_id)` — idempotente a retries do webhook
- Webhook sempre retorna 200, mesmo em erros de parse (evita retry storm)
- Redirector usa `Cache-Control: no-store` — Cloudflare não cacheia o redirect (cookie precisa ser setado no servidor)

---

## 8. O que esta spec NÃO cobre (sub-projetos futuros)

- Integração Hotmart (sub-projeto 2)
- Railway deploy, variáveis de ambiente, domínio customizado (sub-projeto 3)
- Logs, alertas, tratamento de erro robusto (sub-projeto 3)
- UX do dashboard (telas, fluxos, design visual) (sub-projeto 4)
- Billing, planos, auto-cadastro de clientes (SaaS futuro)
