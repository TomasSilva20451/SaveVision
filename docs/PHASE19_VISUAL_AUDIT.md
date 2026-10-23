# Auditoria visual — preparação Fase 19+ (UX)

Data: 2026-10-17. Ambiente: `fintwin_demo_ui` + `pnpm dev:demo` em http://localhost:3000.

**Referências mockup:** `docs/design-references/*.jpg` (11 páginas). Comparação operacional: screenshots reais em `docs/visual-audit/` vs referências; convenções em `AppShell` e `src/components/ui/`.

## Resumo executivo

| Área | Estado |
|------|--------|
| Hydration (tema) | Corrigido — ver secção técnica |
| Base demo limpa | `fintwin_demo_ui` criada; principal `fintwin` intacta |
| E2E | Playwright usa `fintwin_e2e` por omissão |
| Funcionalidade | Operacional nas 11 rotas auditadas |
| Alinhamento mockup | Parcial — layout funcional, visual ainda «Fase 14» |

## Screenshots (produto real)

Desktop (1280×): `docs/visual-audit/{rota}-desktop.png` para dashboard, contas, transacoes, orcamentos, despesas-recorrentes, receitas, patrimonio, previsoes, analises, alertas, simulacoes.

Mobile (iPhone 13): `docs/visual-audit/dashboard-mobile.png`, `simulacoes-mobile.png`.

Regenerar: `pnpm dev:demo` + `pnpm audit:screenshots`.

---

## Por página

Legenda prioridade: **P0** bloqueia avaliação; **P1** importante para paridade mockup; **P2** polish.

### `/dashboard`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — KPIs, alertas, insights, gráficos Recharts |
| Funcional | Sim — dados reais do workspace |
| vs mockup | Provável gap: hierarquia visual, cards mais densos, tipografia display |
| Problemas | Secção longa; KPIs em grelha simples; alertas E2E ausentes na demo |
| Melhorias | P1 — cartões KPI unificados, spacing 8pt, destaque saldo disponível |
| UX | Loading via Suspense em sub-rotas; nav desktop OK; mobile via `MobileNav` |

### `/contas`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — listagem e saldos |
| vs mockup | P1 — ícones de instituição, badges de tipo, empty state mais rico |
| Melhorias | P2 — agrupar por tipo (ordem/poupança) |

### `/transacoes`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — tabela/filtros básicos |
| vs mockup | P1 — densidade tabular, filtros de período visíveis no header |
| Melhorias | P1 — sticky header tabela; P2 — cores sinal INCOME/EXPENSE |

### `/orcamentos`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — limites e progresso |
| vs mockup | P1 — barras de progresso mais visuais (mockup) |
| Melhorias | P1 — card por categoria com % e cor semântica |

### `/despesas-recorrentes`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — CRUD, ocorrências |
| vs mockup | P1 — timeline/calendário de vencimentos |
| Melhorias | P2 — badge estado (EXPECTED/PAID) mais contrastado |

### `/receitas`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — familiar/e-commerce/ténis |
| vs mockup | P1 — separação visual por fluxo |
| Melhorias | P2 — tabs ou secções colapsáveis |

### `/patrimonio`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — activos/passivos |
| vs mockup | P1 — resumo património líquido hero |
| Melhorias | P1 — gráfico composição activo/passivo |

### `/previsoes`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — tesouraria 30d |
| vs mockup | P1 — gráfico linha saldo projectado |
| Melhorias | P1 — legenda mín/máx; P2 — export CSV contextual |

### `/analises`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — insights determinísticos |
| vs mockup | P1 — cards insight com iconografia |
| Melhorias | P2 — filtros de mês explícitos no header |

### `/alertas`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — lista, visto, sync explícito |
| vs mockup | P1 — severidade mais visual (chips) |
| Melhorias | P0→resolvido — botão «Atualizar alertas» visível mesmo sem alertas |
| UX | Sync não automático (by design) |

### `/simulacoes`

| Campo | Detalhe |
|-------|---------|
| Estado | Operacional — tabs, BASE, A/B, formulários |
| vs mockup | P1 — sem gráficos dedicados; mockup pode mostrar charts ilustrativos |
| Melhorias | P1 — gráfico evolução poupança; P2 — persistência cenários (adiada Fase 19) |
| Funcional | Poupança 6800 € validada; automóvel exige taxa; amortização read-only |

---

## Checklist UX (global)

| Item | Estado | Notas |
|------|--------|-------|
| Nav desktop | OK | Sidebar 240px, `MainNav` |
| Nav mobile | OK | `MobileNav` hamburger |
| Workspace switcher | OK | Pessoal + conjunto |
| Filtros período | Parcial | Nem todas as páginas |
| Loading | OK | Suspense «A carregar…» |
| Erros / flash | OK | `FlashBanner` |
| Formulários | OK | Simulações editáveis |
| Gráficos responsivos | Parcial | Recharts no dashboard; simulações sem chart |
| Contraste | OK | zinc + dark mode |
| Teclado | Parcial | focus-visible nos botões; auditoria completa pendente |
| Consistência | Parcial | mockups pedem passo visual único |

---

## Tarefas técnicas concluídas nesta preparação

### Hydration

- **Causa:** `ThemeScript` alterava a classe `dark` em `<html>` antes da hidratação; `ThemeToggle` lia `document` no `useState` inicial.
- **Correção:** `ThemeBootstrap` (`useLayoutEffect` após hidratação) + cookie `fintwin_theme` + `ThemeToggleSlot` (server) para estado do botão. Removido `theme-script.tsx`.
- **Nota:** ferramentas de automação (atributos `data-cursor-ref`) podem ainda reportar mismatch no overlay de dev — não é o produto.

### Bases de dados

| Base | Uso |
|------|-----|
| `fintwin` | Principal — **intacta**, sem DROP/TRUNCATE |
| `fintwin_demo_ui` | Demo visual — seed idempotente |
| `fintwin_e2e` | Playwright porta 3010 |

Comandos: `pnpm db:demo-ui`, `pnpm db:e2e`, `pnpm dev:demo`.

**Importante:** ao mudar de base, fazer **logout/login** (IDs de sessão diferem).

---

## Testes (validação desta entrega)

| Comando | Resultado |
|---------|-----------|
| `pnpm lint` | OK |
| `pnpm typecheck` | OK |
| `pnpm build` | OK |
| `pnpm test` | 165 OK (integração baseline salta em `fintwin` principal) |
| `pnpm test:e2e:strict` | 67/69 OK antes do fix alertas; após rebuild + fix painel, E16/E11 OK |

Recomendado reexecutar portão completo após pull: `pnpm gate && CI=1 pnpm test:e2e:strict`.

---

## Melhorias recomendadas (próxima onda — só UX)

1. **P1** Design system: tokens spacing/radius/sombra alinhados aos mockups (10 páginas).
2. **P1** Dashboard hero + KPI grid como referência visual.
3. **P1** Simulações: gráfico opcional alimentado pelo motor (sem valores fixos).
4. **P2** Filtro civil month partilhado no header das páginas financeiras.
5. **P2** Revisão mobile em todas as tabelas (scroll horizontal + labels).

**Fase 20 em espera** até aprovação visual. **Sem push** nesta entrega.
