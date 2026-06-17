# A/B Testing Platform — Design Spec
**Data:** 2026-06-17  
**Cliente:** Alexia Duarte  
**Deploy:** Railway (projeto `clever-gratitude`) + Cloudflare  
**Tráfego esperado:** até 5.000 visitantes/dia

---

## 1. Contexto

Plataforma standalone de teste A/B para landing pages, focada em lançamentos. Integra com a Kiwify via webhook `order.paid` para rastreamento automático de conversões (compra aprovada — pix, cartão, boleto). Referência técnica: Google Optimize (redirect test approach).

Será deployada como **novo serviço Next.js** no mesmo projeto Railway do `project-links` (`clever-gratitude`), compartilhando o Postgres existente via tabelas próprias.

---

## 2. Arquitetura

### Serviço
- **App:** Next.js 15 App Router
- **ORM:** Drizzle ORM
- **Banco:** Railway Postgres (mesmo do viciolinks, schemas separados)
- **Auth:** Better Auth (mesmo padrão do viciolinks)
- **UI:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Deploy:** Railway + Cloudflare na frente

### Domínio
`ab.alexiaduarte.com` (a definir com o cliente)

---

## 3. Fluxo Completo

```
1. Visitante acessa /r/[slug]
   ├─ Verifica cookie ab_{slug}
   ├─ Se existe → usa variante salva
   ├─ Se novo → sorteia variante por peso configurado
   ├─ Salva cookie (30 dias, first-party)
   ├─ Registra visita no Postgres (server-side, sem JS)
   └─ HTTP 302 → URL da variante + ?utm_content={slug}:{label}

2. Landing page do cliente carrega
   └─ <script src="/tracker.js" data-exp="{slug}"></script>
      ├─ Lê utm_content da URL atual
      └─ Injeta ?utm_content={slug}:{label} em todos os links pay.kiwify.com.br

3. Visitante compra na Kiwify
   └─ Kiwify captura utm_content no checkout

4. Compra aprovada → webhook order.paid
   └─ POST /api/webhook/kiwify
      ├─ Valida assinatura Kiwify
      ├─ Extrai order.tracker.utm_content
      ├─ Parseia slug + label
      ├─ Busca experiment_id + variant_id
      └─ INSERT em conversions (idempotente via kiwify_order_id)

5. Dashboard atualiza resultados em tempo real
```

---

## 4. Banco de Dados

### `ab_experiments`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| name | varchar | "Destrava OAB" |
| slug | varchar UNIQUE | "destrava-oab" |
| status | enum | active \| paused \| finished |
| cookie_days | int | padrão 30 |
| winner_variant_id | uuid FK nullable | definido ao encerrar |
| created_at | timestamp | |
| finished_at | timestamp nullable | |

### `ab_variants`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| experiment_id | uuid FK | |
| label | varchar | "A", "B", "C" (máx 5) |
| name | varchar | "controle", "teste v2" |
| url | varchar | URL completa da landing page |
| weight | int | peso do tráfego (0–100, soma = 100) |
| color | varchar | cor hex para o dashboard |

### `ab_visits`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| experiment_id | uuid FK | |
| variant_id | uuid FK | |
| visitor_id | varchar | hash do cookie (dedup por visitante único) |
| created_at | timestamp | |

**Deduplicação:** antes de INSERT, verifica `(experiment_id, visitor_id)`. Se já existe, ignora. Conta sessão única por visitante, igual ao Google Optimize.

### `ab_conversions`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| experiment_id | uuid FK | |
| variant_id | uuid FK | |
| visitor_id | varchar nullable | nem sempre rastreável |
| kiwify_order_id | varchar UNIQUE | previne double-count de webhook duplicado |
| amount | decimal(10,2) | valor da compra |
| created_at | timestamp | |

---

## 5. Redirector

**Rota:** `GET /r/[slug]` (Next.js Route Handler)

Lógica server-side:
1. Busca experimento pelo slug no Postgres
2. Se `status !== active` → redireciona para variante A (controle) sem registrar
3. Lê cookie `ab_{slug}`
4. Se cookie existe → usa variante do cookie
5. Se não existe → weighted random sort pelos pesos das variantes
6. Gera `visitor_id` = UUID salvo no cookie (ou lê o existente)
7. INSERT em `ab_visits` — ignora se `(experiment_id, visitor_id)` já existe
8. Set-Cookie: `ab_{slug}={visitor_id}:{label}; Max-Age={cookie_days*86400}; HttpOnly; SameSite=Lax`
9. `Location: {variant.url}?utm_content={slug}:{label}` com status 302

**Performance:** consulta Postgres com índice em `slug`. Com Cloudflare na frente, o cookie impede cache — o redirector sempre roda no servidor, mas é rápido (< 50ms).

---

## 6. tracker.js

Script leve (~1KB minificado) servido como arquivo estático.

```javascript
// Comportamento:
// 1. Lê utm_content da URL atual
// 2. Faz querySelector em todos os links da página
// 3. Filtra links que contenham pay.kiwify.com.br
// 4. Appenda ?utm_content={valor} (ou &utm_content se já tem query string)
// Executa no DOMContentLoaded
```

Instalação no cliente (1 linha):
```html
<script src="https://ab.alexiaduarte.com/tracker.js" data-exp="destrava-oab"></script>
```

---

## 7. Webhook Kiwify

**Rota:** `POST /api/webhook/kiwify`

- Valida `X-Kiwify-Signature` (HMAC-SHA256 com secret configurado)
- Processa apenas `event_type === "order.paid"`
- Extrai `order.tracker.utm_content` → parseia `{slug}:{label}`
- Busca `experiment_id` e `variant_id` no banco
- INSERT em `ab_conversions` com `ON CONFLICT (kiwify_order_id) DO NOTHING`
- Retorna 200 mesmo em falha de parse (evita retry loop da Kiwify)

---

## 8. Dashboard — Rotas

| Rota | Descrição |
|---|---|
| `/` | Lista experimentos: ativos no topo, finalizados abaixo com badge vencedor |
| `/experiments/new` | Formulário: nome, slug, variantes, pesos com sliders |
| `/experiments/[slug]` | Aba Configurar: editar + código gerado do script |
| `/experiments/[slug]/results` | Aba Resultados: métricas, gráfico, tabela |
| `/docs` | Guia rápido (instalar tracker, configurar Kiwify) |

### Aba Resultados mostra:
- Cards por variante: visitas, conversões, taxa de conversão
- Badge de confiança estatística (Z-test de proporções, duas amostras)
- Indicador de vencedor quando confiança ≥ 95%
- Gráfico de evolução diária (taxa por variante, Recharts)
- Tabela de dados diários por variante
- Ações: Pausar | Retomar | Encerrar (declarar vencedor)

### Estatística:
Z-test de duas proporções (mesmo método do Google Optimize):
- `p1 = conversions_A / visits_A`
- `p2 = conversions_B / visits_B`
- `p_pool = (conv_A + conv_B) / (vis_A + vis_B)`
- `Z = (p1 - p2) / sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))`
- Confiança = `(1 - p_value) * 100%`

---

## 9. Autenticação

Better Auth — login único (admin). Sem multi-tenant. Mesma configuração do viciolinks.

---

## 10. Limitações Conhecidas

- Cookies podem ser bloqueados por ~3–5% dos visitantes (ad blockers) — esses usuários podem ver variantes inconsistentes entre visitas
- Mínimo recomendado de 100 visitas por variante para significância estatística
- Máximo de 5 variantes por experimento
- Se o cliente não instalar o tracker.js, as conversões via webhook ainda funcionam **desde que** a landing page já passe o utm_content para o link Kiwify

---

## 10.1 Segurança do tracker.js

O script é servido do **nosso próprio domínio** (`ab.alexiaduarte.com`), não de CDN de terceiro — portanto Subresource Integrity (SRI) não se aplica. O cliente instala um `<script src>` apontando para servidor que controlamos. Garantias de segurança:
- Servir tracker.js com `Content-Security-Policy` restritivo
- HTTPS obrigatório (Cloudflare garante)
- O script não coleta dados pessoais — apenas lê UTM da URL e modifica links Kiwify

---

## 11. Infraestrutura

- **Novo serviço Railway** no projeto `clever-gratitude` (id: `3925ccc5-7a98-4c31-8969-466c97a69ca3`)
- **Banco:** Railway Postgres existente (id: `92ace73b-9435-4c17-8cde-c12df6a2e268`) — novas tabelas prefixadas com `ab_`
- **Cloudflare:** proxy na frente, Cache-Control: no-store no redirector (necessário para o cookie funcionar)
- **Variáveis de ambiente:** DATABASE_URL, BETTER_AUTH_SECRET, KIWIFY_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL
