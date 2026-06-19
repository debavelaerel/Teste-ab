# Design Spec — Redesign Neutral Ink

**Data:** 2026-06-19  
**Status:** Aprovado  
**Escopo:** Redesign visual completo da plataforma de testes A/B

---

## Decisões aprovadas

- **Direção visual:** Neutral Ink (inspirado em Notion, Linear, Figma)
- **Fontes:** `Outfit` (UI geral) + `DM Mono` (números, slugs, OTP)
- **Login:** fluxo idêntico ao projeto-deisy, adaptado ao design system
- **Nav:** "Eventos" renomeado para "Observabilidade"

---

## Design Tokens

### Cores
```
Background principal:  #FFFFFF
Background sidebar:    #FAFAFA
Background hover:      #F4F4F5
Background muted:      #F4F4F5

Texto primário:        #09090B
Texto secundário:      #3F3F46
Texto muted:           #71717A
Texto placeholder:     #A1A1AA

Borda sutil:           #F0F0F0
Borda padrão:          #E4E4E7
Borda forte:           #D4D4D8

Botão primário bg:     #18181B
Botão primário texto:  #FFFFFF

Status ativo:          #22C55E  (bg: #F0FDF4)
Status pausado:        #F59E0B  (bg: #FFFBEB)
Status finalizado:     #0369A1  (bg: #F0F9FF)
Destrutivo:            #EF4444  (bg: #FEF2F2)

Força senha fraca:     #EF4444
Força senha regular:   #F59E0B
Força senha boa:       #3B82F6
Força senha forte:     #22C55E
```

### Tipografia
```
Font sans:   'Outfit', system-ui, sans-serif
Font mono:   'DM Mono', monospace

Peso 400 — corpo, labels muted
Peso 500 — labels, nav items
Peso 600 — subtítulos, nomes de campos
Peso 700 — headings de página
Peso 800 — logo, headings de hero

Headings: letter-spacing -0.5px
```

### Raios de borda
```
Badges:    20px (pill)
Inputs:    8px
Botões:    8px
Cards:     10px
Card lg:   12px (login card: 18px)
```

### Sombras
```
Card sutil:   0 1px 3px rgba(0,0,0,.04)
Card login:   0 20px 60px rgba(0,0,0,.3)
```

---

## Layout principal (authenticated)

```
┌──────────────────────────────────────────────────┐
│  sidebar (200px, #FAFAFA, borda #EBEBEB)         │  main (flex-1, #FFFFFF, p-8)
│  ┌──────────────────────────────────────────┐    │
│  │  [logo 20px] SplitTest  (Outfit 700)     │    │  <PageContent />
│  ├──────────────────────────────────────────┤    │
│  │  ⚗  Experimentos                         │    │
│  │  ◎  Observabilidade                      │    │
│  │  ☰  Docs                                 │    │
│  │  ◈  Configurações                        │    │
│  ├──────────────────────────────────────────┤    │
│  │  [avatar] Nome · logout                  │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Nav item ativo:** `bg #F4F4F5`, `color #09090B`, `font-weight 600`  
**Nav item inativo:** `color #71717A`, hover `bg #F4F4F5`

---

## Login — fluxo completo (baseado no projeto-deisy)

**Fundo:** `#09090B` (preto zinc), radial gradient sutil  
**Card:** branco, `border-radius 18px`, `padding 32px 28px`, `max-width 480px`  
**Logo no card:** "SplitTest" Outfit 800 + subtítulo "Plataforma de Testes A/B"  
**Botão primário no card:** `#18181B` bg, texto branco — contraste com fundo preto  

### Steps
| # | Tela | Conteúdo |
|---|------|----------|
| 1 | Email | Logo centralizado · campo email · botão "Próximo" |
| 2 | Senha | ← Voltar + logo · "Olá, [Nome]! 👋" · campo senha + toggle show/hide · link "Esqueceu sua senha?" · botão "Entrar" |
| 3 | Esqueci senha | ← Voltar + logo · heading + desc · campo email · botão "Enviar código" |
| 4 | Código OTP | ← Voltar + logo · 6 inputs individuais DM Mono · botão "Verificar" |
| 5 | Nova senha | ← Voltar + logo · campo nova senha + strength bar + hints · campo confirmar · botão "Confirmar" |
| 6 | Sucesso | Ícone check · heading · desc · botão "Fazer login" |

**Animações:** `fadeUp` entrada card, `slideRight`/`slideLeft` entre steps  
**Validação de senha:** barra de progresso colorida + 4 hints com ✓ verde

---

## Componentes UI a atualizar

### globals.css
- Trocar `--font-sans` para Outfit via Google Fonts
- Manter DM Mono como `--font-mono`
- Ajustar tokens de cor para a paleta Neutral Ink acima

### Sidebar (`sidebar-nav.tsx`)
- Item ativo: `bg-zinc-100 text-zinc-900 font-semibold`
- Item inativo: `text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700`

### ExperimentCard (`experiment-card.tsx`)
- Remover `borderLeftWidth/Color` inline
- Card com `border border-zinc-100 rounded-xl`
- Badge status: usar classes de cor conforme tokens

### Botões
- Primary: `bg-zinc-900 text-white hover:bg-zinc-800`
- Secondary: `border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50`

---

## Telas a redesenhar

1. **Login** — fluxo completo multi-step (novo arquivo `login/page.tsx` reimplementado)
2. **Org layout** — sidebar atualizada, "Observabilidade" no nav
3. **Dashboard** — lista de experimentos com cards Neutral Ink
4. **Experimento detalhe** — tabs, configuração
5. **Resultados** — gráficos, summary cards
6. **Observabilidade** — tabela de eventos (era "Eventos")
7. **Configurações** — formulário de org
8. **Novo experimento** — formulário multi-campo
9. **Docs** — página de documentação

---

## O que NÃO muda

- Lógica de negócio, APIs, webhooks
- Schema do banco de dados
- Autenticação (better-auth)
- Rate limiting, redirect engine
- Estrutura de rotas Next.js
