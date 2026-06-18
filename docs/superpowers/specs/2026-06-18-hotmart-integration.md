# Sub-projeto 2: Integração Hotmart

**Data:** 2026-06-18
**Sub-projeto:** 2 de 4 — Integração Hotmart

---

## Visão geral

Adiciona suporte à Hotmart como segundo checkout, paralelo ao Kiwify existente. Cada experimento declara um checkout fixo (`kiwify` ou `hotmart`). O tracker correto é exibido na página de configuração do experimento. O webhook da Hotmart registra conversões usando o campo `xcod`.

---

## Decisões

- **Um checkout por experimento** — não mistura dados de providers diferentes no mesmo experimento
- **Mudança de checkout bloqueada** se o experimento já tiver conversões registradas (integridade dos dados históricos)
- **Trackers separados** — `tracker.js` (Kiwify, injeta `s1`) e `tracker-hotmart.js` (Hotmart, injeta `xcod`) para evitar erros de injeção de parâmetro errado

---

## Modelo de dados

### `ab_experiments` — novo campo

```sql
ALTER TABLE "ab_experiments"
  ADD COLUMN "checkout_type" varchar(20) NOT NULL DEFAULT 'kiwify';
```

Todos os experimentos existentes ficam como `'kiwify'` automaticamente.

### `ab_conversions` — generalização do campo de idempotência

```sql
-- Renomear coluna
ALTER TABLE "ab_conversions"
  RENAME COLUMN "kiwify_order_id" TO "external_order_id";

-- Adicionar campo source
ALTER TABLE "ab_conversions"
  ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'kiwify';

-- Remover unique constraint existente e criar composite
ALTER TABLE "ab_conversions" DROP CONSTRAINT "ab_conversions_kiwify_order_id_key";
ALTER TABLE "ab_conversions"
  ADD CONSTRAINT "ab_conversions_external_order_id_source_unique"
  UNIQUE ("external_order_id", "source");
```

A constraint composite garante idempotência por provider: o mesmo `transactionId` pode coexistir em `kiwify` e `hotmart` sem conflito.

### Drizzle schema

```typescript
// ab_experiments — novo campo
checkoutType: varchar('checkout_type', { length: 20 }).notNull().default('kiwify'),

// ab_conversions — campos atualizados
externalOrderId: varchar('external_order_id', { length: 255 }).notNull(),
source: varchar('source', { length: 20 }).notNull().default('kiwify'),
// unique constraint: (externalOrderId, source)
```

---

## Novo arquivo: `public/tracker-hotmart.js`

Idêntico ao `tracker.js` mas:
- Injeta `xcod` (não `s1`) nos links
- Selectors: `a[href*="pay.hotmart.com"]`
- Cookie name: `ab_s1` (mesmo — guarda o valor do rastreamento independente do provider)

```js
// Diferenças em relação ao tracker.js:
var PARAM_NAME = 'xcod';   // era 's1'
var SELECTORS = 'a[href*="pay.hotmart.com"]';  // era kiwify domains
```

---

## Novo arquivo: `src/app/api/webhook/hotmart/route.ts`

### Verificação de assinatura

Hotmart envia `X-Hotmart-Webhook-Token` com um token fixo configurado no painel. Verificação via `timingSafeEqual`.

Variável de ambiente nova: `HOTMART_WEBHOOK_TOKEN`

### Evento

Escuta `PURCHASE_APPROVED`. Payload relevante:

```json
{
  "event": "PURCHASE_APPROVED",
  "data": {
    "purchase": {
      "transaction": "HP12345678901234",
      "price": { "value": 197.0 },
      "tracker_token": "alexia:exp-slug:A"
    }
  }
}
```

- Idempotência: `data.purchase.transaction`
- Rastreamento: `data.purchase.tracker_token` (equivalente ao `s1` da Kiwify)
- Valor: `data.purchase.price.value`

### Parsing do tracker_token

Mesmo formato `orgSlug:expSlug:label` (3 partes, mesma lógica de parsing do webhook Kiwify).

### Registro

```typescript
await db.insert(abConversions).values({
  experimentId: experiment.id,
  variantId: variant.id,
  externalOrderId: transactionId,
  source: 'hotmart',
  amount: String(price),
}).onConflictDoNothing()
```

---

## Arquivos modificados

### `src/db/schema.ts`
- `abExperiments`: add `checkoutType`
- `abConversions`: rename `kiwifyOrderId` → `externalOrderId`, add `source`, atualizar unique constraint

### `src/app/api/webhook/kiwify/route.ts`
- Trocar `kiwifyOrderId` → `externalOrderId` no insert
- Adicionar `source: 'kiwify'` no insert

### `src/components/experiment-form.tsx`
- Adicionar seletor "Checkout" (Kiwify / Hotmart) no formulário de criação
- No modo edição: se já houver conversões, exibir o campo como read-only com tooltip explicando o bloqueio

### `src/app/api/org/[orgSlug]/experiments/route.ts` (POST)
- Aceitar e salvar `checkoutType` no body

### `src/app/api/org/[orgSlug]/experiments/[id]/route.ts` (PATCH)
- Bloquear mudança de `checkoutType` se `COUNT(ab_conversions WHERE experimentId = id) > 0`
- Retornar 409 com mensagem explicativa

### `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx`
- Mostrar script correto conforme `checkoutType`:
  - Kiwify: `<script src="${appUrl}/tracker.js"></script>`
  - Hotmart: `<script src="${appUrl}/tracker-hotmart.js"></script>`

### `src/app/org/[orgSlug]/docs/page.tsx`
- Expandir seção de instalação com instruções para os dois trackers

---

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `HOTMART_WEBHOOK_TOKEN` | Token fixo configurado no painel da Hotmart |

---

## Constraints globais

- Tabelas prefixadas `ab_`
- Sem framework de testes — verificar com `npx tsc --noEmit` e `npm run build`
- Nunca commitar `.env*`
- Next.js 16: `params` é sempre `Promise<{...}>`, sempre `await params`
- Migration deve ser segura para dados existentes (todos os experimentos ficam `checkoutType = 'kiwify'`, todas as conversões ficam `source = 'kiwify'`)
