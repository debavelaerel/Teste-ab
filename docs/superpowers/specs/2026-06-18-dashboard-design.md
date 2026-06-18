# Dashboard Design Spec

**Sub-projeto:** 4 de 4 — UX do Dashboard

**Abordagem:** Full Redesign (B) — redesign completo com nova sidebar, cards ricos, tabs por experimento e página de configurações.

---

## Visão Geral

Reformular o visual e a estrutura de navegação do dashboard mantendo toda a lógica de negócio intacta. Nenhuma mudança em rotas de API, schema ou autenticação — apenas camada de apresentação.

---

## 1. Sistema de Design

### Fonte
- **Sans:** Geist Sans (mantém `--font-geist-sans`)
- **Mono:** Geist Mono (mantém `--font-geist-mono`)

### Paleta

Adicionar ao `:root` em `globals.css`:

```css
--indigo-50:  oklch(0.962 0.018 264.4);
--indigo-200: oklch(0.855 0.059 264.4);
--indigo-500: oklch(0.585 0.233 264.4);
--indigo-600: oklch(0.511 0.262 264.4);

--amber-500:  oklch(0.769 0.188 70.1);
--emerald-500:oklch(0.696 0.170 162.5);
```

Mapear como semânticas:
```css
--primary:         var(--indigo-500);
--primary-hover:   var(--indigo-600);
--primary-subtle:  var(--indigo-50);
--primary-muted:   var(--indigo-200);
```

Status tokens (usados em badge e borda de card):
```
ativo      → --indigo-500   (#6366f1)
pausado    → --amber-500    (#f59e0b)
finalizado → --emerald-500  (#10b981)
```

### Ícones
- **Biblioteca:** `lucide-react` (já compatível com shadcn/ui)
- Usar nos itens de navegação do sidebar, nos botões de ação e nos status badges.

### Border radius
Mantém `--radius: 0.625rem`.

---

## 2. Sidebar

**Largura:** `w-64` (antes `w-56`).

**Estrutura:**
```
┌──────────────────────────────────┐
│  [AB]  Alexia Duarte             │  ← Avatar de iniciais + nome do org
│                                  │
│  ⚗  Experimentos                 │  ← ícone FlaskConical
│  📄 Docs                         │  ← ícone FileText
│  ⚙  Configurações                │  ← ícone Settings
│                                  │
│  ─────────────────────────────── │
│  [L]  Lucas          [LogOut]    │  ← iniciais + nome + botão sair
└──────────────────────────────────┘
```

**Avatar de org:** círculo 32px com cor indigo-500 e iniciais do `org.name` (ex: "AD" para "Alexia Duarte"). Gerado via CSS — sem imagens.

**Item ativo:** `bg-primary-subtle` + `text-primary` + `font-medium`. Item inativo: `hover:bg-accent`.

**Usuário no rodapé:** avatar 28px cinza + `session.user.name` truncado + botão `LogOut` icon-only com tooltip "Sair".

---

## 3. Lista de Experimentos (`/org/[orgSlug]`)

Cards com borda esquerda colorida por status + mini-stats expansíveis ao clicar.

### Card fechado
```
┌─────────────────────────────────────────────────────┐
│▌ Landing Hero A/B        ● Ativo    Kiwify    ›     │
│  /r/alexia/hero-ab  ·  2 variantes  ·  10 jun       │
└─────────────────────────────────────────────────────┘
```
- Borda esquerda 3px: cor do status
- Badge de status: colorido (indigo/amber/emerald)
- Badge de checkout: `Kiwify` ou `Hotmart` — `outline` neutro
- Seta `›` à direita indica expansível

### Card expandido (toggle ao clicar no card, não navega)
```
┌─────────────────────────────────────────────────────┐
│▌ Landing Hero A/B        ● Ativo    Kiwify    ∧     │
│  /r/alexia/hero-ab  ·  2 variantes  ·  10 jun       │
│  ─────────────────────────────────────────────────  │
│  ┌──────────┬──────────┬──────────┐                 │
│  │  1.240   │   87     │  7,0%    │                 │
│  │ visitas  │ conv.    │ taxa     │                 │
│  └──────────┴──────────┴──────────┘                 │
│                                                     │
│  [Ver resultados →]        [Configurar →]           │
└─────────────────────────────────────────────────────┘
```
Stats carregados client-side com `fetch` ao expandir (lazy — não bloqueiam o carregamento da lista).

### Seção "Finalizados"
Mantém separação visual atual (título uppercase + lista). Cards finalizados mostram vencedor no badge.

---

## 4. Experimento — Tabs (`/org/[orgSlug]/experiments/[expSlug]`)

Unifica as três "telas" atuais (config page + results page + script display) em uma única rota com tabs client-side.

**Rota:** `/org/[orgSlug]/experiments/[expSlug]` — única rota, tabs controladas por `?tab=` search param.

**Tabs:**
```
Landing Hero A/B   ● Ativo
──────────────────────────────────────────
[ Resultados ]  [ Configuração ]  [ Instalação ]
     ↑ default
```

- **Resultados** (default): conteúdo atual de `results/page.tsx` — metric cards + variant cards + chart
- **Configuração**: conteúdo atual de `experiments/[expSlug]/page.tsx` — ExperimentForm
- **Instalação**: redirector URL + script tag — hoje enterrado no meio da tela de configuração

A rota `/org/[orgSlug]/experiments/[expSlug]/results` passa a redirecionar para `/org/[orgSlug]/experiments/[expSlug]?tab=results`.

---

## 5. Tab Instalação

Conteúdo movido da tela de configuração:

```
URL do Redirector
┌────────────────────────────────────────────┐
│ https://app.../r/alexia/hero-ab  [Copiar]  │
└────────────────────────────────────────────┘

Script para a landing page
┌────────────────────────────────────────────┐
│ <script src=".../tracker.js"></script>     │  [Copiar]
└────────────────────────────────────────────┘
```

Botão "Copiar" para cada campo (usa `navigator.clipboard.writeText`).

---

## 6. Configurações (`/org/[orgSlug]/settings`)

Nova rota. Link "Configurações" no sidebar aponta para ela.

```
Configurações — Alexia Duarte

Organização
  Nome:  Alexia Duarte
  Slug:  alexia

Webhooks
  Kiwify token    [••••••••••] [Mostrar] [Copiar]
  Hotmart token   [••••••••••] [Mostrar] [Copiar]
  (lidos de KIWIFY_WEBHOOK_SECRET e HOTMART_WEBHOOK_TOKEN nas env vars)
  (somente leitura — edição via Railway)
```

Tokens: mascarados por padrão, botão "Mostrar" alterna visibilidade, botão "Copiar".

**Nota de implementação:** os tokens são variáveis de ambiente — a página server-side os lê com `process.env` e os passa como props. Nunca expostos em chamadas de API client-side.

---

## 7. Componentes Novos / Modificados

| Componente | Ação | Descrição |
|---|---|---|
| `src/app/org/[orgSlug]/layout.tsx` | Modificar | Nova sidebar com avatar, ícones, rodapé de usuário |
| `src/app/org/[orgSlug]/page.tsx` | Modificar | Cards com borda colorida + expansão client-side |
| `src/components/experiment-card.tsx` | Criar | Card expansível com lazy stats |
| `src/app/org/[orgSlug]/experiments/[expSlug]/page.tsx` | Modificar | Tabs + absorve conteúdo de results |
| `src/components/experiment-tabs.tsx` | Criar | Tabs client-side com ?tab= param |
| `src/app/org/[orgSlug]/experiments/[expSlug]/results/page.tsx` | Modificar | Redirect → tab=results |
| `src/app/org/[orgSlug]/settings/page.tsx` | Criar | Página de configurações do org |
| `src/app/globals.css` | Modificar | Novos tokens de cor (indigo, amber, emerald) |
| `src/components/ui/badge.tsx` | Modificar | Variantes de cor para status (indigo, amber, emerald) |

---

## 8. O que NÃO muda

- Rotas de API (`/api/org/...`, `/api/webhook/...`)
- Schema do banco de dados
- Lógica de autenticação (`requireOrgMember`)
- `tracker.js` e `tracker-hotmart.js`
- Lógica de stats (`calcConfidence`, `fmtPct`)
- Rota de redirector (`/r/[orgSlug]/[expSlug]`)

---

## 9. Decisões de Produto

- **Tokens de webhook:** somente leitura no dashboard — sem formulário de edição (edição permanece via Railway). Motivo: editar tokens no dashboard exigiria armazenamento no banco, o que muda o modelo de segurança desnecessariamente agora.
- **Avatar de org:** gerado via CSS (iniciais), sem upload de imagem — YAGNI.
- **Expansão de card:** toggle client-side sem rota dedicada — mantém URL limpa e evita navegação desnecessária.
- **Tab default:** Resultados — é o que Lucas mais acessa no dia a dia.
