# Regras financeiras

Estas regras ficam fechadas antes de existirem movimentos. Os testes do motor, a partir da Fase 4, têm de as cumprir.

## Dinheiro

- Cálculos usam `Decimal`, com arredondamento half-up.
- A apresentação em euros usa duas casas.
- A persistência usará quatro casas.
- `formatEUR` só converte para `number` depois de quantizar a cêntimos, e recusa montantes fora de `Number.MAX_SAFE_INTEGER`.

## Datas

- Um movimento tem um instante.
- O mês, o dia e os intervalos do dashboard usam a data civil em `Europe/Lisbon`.
- A hora de verão começa no último domingo de março e termina no último domingo de outubro. Um instante como `2026-03-31T23:30:00.000Z` já é 1 de abril em Lisboa.

## Movimentos

Quando o livro existir:

- Receita é um influxo externo.
- Despesa é uma saída económica real.
- Transferência entre contas do mesmo workspace não é receita nem despesa e não altera o património.
- Rendimento esperado não entra no saldo enquanto não for confirmado como recebido.

### Sugestões locais de categorização (Fase 20)

- A sugestão do Ollama é metadado de apoio, nunca uma escrita financeira autónoma.
- O tipo selecionado no formulário e a submissão explícita do utilizador continuam autoritativos.
- O modelo só pode selecionar nomes de categorias fornecidos pelo servidor; o servidor volta a resolver o respetivo ID dentro do mesmo workspace.
- Aceitações e correções alimentam regras isoladas por workspace, sem fine-tuning e sem alterar transações anteriores.

## Isolamento

Um registo só é visível a quem tem membership no `workspaceId` desse registo. O workspace conjunto é um terceiro espaço, não a união das contas pessoais.

## Orçamentos (Fase 15)

- Um orçamento mensal é **planeamento**: não cria transações nem altera saldos.
- Despesas realizadas para comparação: `EXPENSE` + `COMPLETED`, excluindo `TRANSFER`.
- Percentagem de utilização: `gasto / limite` quando o limite é positivo; sem limite não se inventa percentagem infinita.
- Disponível = limite − gasto (pode ser negativo; o excesso reporta-se à parte).

## Património líquido (Fase 15)

- **Ativos:** saldos de contas incluídas no património (`isIncludedInNetWorth`) + posições de investimento manuais (preço introduzido pelo utilizador).
- **Passivos:** responsabilidades registadas (`FinancialLiability.outstandingBalance`).
- Património líquido = ativos − passivos manuais (posições somam-se ao património das contas; evitar contar a mesma posição duas vezes se estiver ligada a uma conta já incluída).
- Objetivos de poupança **não** são ativos automáticos; só refletem contribuições registadas.
- Transferências internas não alteram o património agregado.

## Passivos e prestações (Fase 15)

- Condições bancárias são **manuais**; não há integração real.
- Num pagamento de prestação distinguir:
  - **Capital amortizado:** reduz caixa e reduz `outstandingBalance` na mesma quantia; impacto nulo no património líquido (antes de juros).
  - **Juros e encargos:** podem ser registados como despesa separada em `/despesas`, conforme decisão do utilizador.
- Registar pagamento na ficha do passivo **não** cria automaticamente movimento bancário (evita dupla contabilização); o utilizador regista caixa e despesa quando aplicável.

### Pagamento com movimento bancário (`WITH_BANK`)

Numa prestação de 500 € com 450 € capital, 40 € juros e 10 € encargos:

- **Saída de caixa total:** 500 € (450 € via `ADJUSTMENT` + 50 € via `EXPENSE`).
- **Despesa económica (KPIs de despesas):** 50 € — o capital **não** entra em `calculateExpenses`.
- **Património líquido:** reduz 50 € (juros + encargos); amortização de capital reduz caixa e passivo na mesma medida (impacto líquido nulo no PL antes de juros).
- **Resultado económico (`calculateCashFlow`):** receitas realizadas − despesas `EXPENSE`; amortização via `ADJUSTMENT` **não** entra aqui.
- **Movimento de caixa (`calculateNetCashMovement`):** soma algébrica de `INCOME`, `EXPENSE` e `ADJUSTMENT` concluídos (saída total de caixa inclui capital).

### Despesas recorrentes (Fase 17a)

- Ocorrências `EXPECTED` / `POSTPONED` **não** alteram saldo nem KPIs de despesas realizadas.
- Confirmação cria uma única transação `EXPENSE` `COMPLETED` (valor efetivo pode diferir do previsto).
- Ver `docs/RECURRING_EXPENSES.md`.

## Planeamento de longo prazo (Fase 15)

- Contribuição mensal necessária = (alvo − acumulado) / meses restantes, com `Decimal`.
- Cenários CONSERVADOR / BASE / OTIMISTA usam fatores configuráveis no servidor; são projeções, não garantias.

## Previsões de tesouraria (Fase 17b / 17b.1)

- **Designação na UI:** «Projeção com movimentos conhecidos» — não é garantia de saldo futuro.
- **Determinístico:** saldo projetado = saldo real + entradas conhecidas − saídas conhecidas no horizonte. Sem machine learning.
- **Fontes incluídas:** receitas `EXPECTED`; despesas recorrentes `EXPECTED`/`POSTPONED`; prestações mensais de passivos com `monthlyPayment` registado (saída de caixa = montante mensal; capital/juros futuros não são inferidos).
- **Fontes excluídas:** estados finais (`PAID`, `SKIPPED`, `RECEIVED`, …); passivos sem prestação mensal; calendário de juros não persistido.
- **Deduplicação:** chave `source:id` por evento. Recorrência com `linkedLiabilityId` activa suprime prestações do passivo na projeção (fonte autoritativa: ocorrências da recorrência). Não deduplicar só por valor/data/descrição.
- **Vencimento passivo:** sem `paymentDueDayOfMonth` não se projectam datas de caixa do passivo (configurável em `/patrimonio`; dias 29–31 clamp ao último dia do mês).
- **UI 17c.1:** associação em `/despesas-recorrentes`; uma recorrência ACTIVE por passivo; confirmação bancária continua independente da associação.
- **Não altera saldos:** nunca cria `Transaction`.
- **Horizontes:** 7–365 dias civis (`Europe/Lisbon`).
- **Transferências:** líquidas no saldo agregado; não são eventos de forecast.
- **Exemplo:** 1500 € + 500 € − 45 € − 70 € ⇒ 1885 € projetados; saldo real permanece 1500 € até movimentos efetivos.

## Receitas especiais (Fase 5)

- **Esperado vs recebido:** ocorrências `EXPECTED` e transações `INCOME` com estado `EXPECTED` não entram no saldo. Confirmar receção cria uma transação `COMPLETED` ligada à ocorrência; repetir a confirmação é idempotente.
- **E-commerce:** o movimento bancário registado é a **receita líquida** (`netProceeds`). Custos de marketplace, portes e COGS são deduzidos no cálculo, não como despesas separadas, salvo registo manual adicional pelo utilizador. A **reserva fiscal de planeamento** é informativa e não substitui imposto legal.
- **Ténis:** o movimento registado é o **prémio líquido** após custos do torneio. Se os mesmos custos forem também lançados como despesas, os indicadores agregados podem contar duas vezes; evita duplicar.

## Simulações (Fase 19)

- **Hipótese vs realidade:** `/simulacoes` nunca cria `Transaction`, `LiabilityPayment`, orçamentos nem altera passivos.
- **BASE:** saldos e meses observados vêm da BD autorizada; parâmetros hipotéticos são explícitos.
- **Tesouraria simulada:** reutiliza eventos do forecast 17b; alterações extra são uma camada sobreposta (`financial-simulation-forecast.ts`).
- **Taxas e prazos:** só entram se o utilizador (ou o passivo registado) os fornecer; não há taxas inventadas.
