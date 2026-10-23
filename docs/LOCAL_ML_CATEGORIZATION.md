# Categorização local de transações

## Objetivo

O FinTwin usa opcionalmente o modelo local `qwen3.5:4b-mlx`, servido pelo Ollama, para sugerir metadados antes de uma transação ser guardada. A decisão financeira continua sempre nas mãos do utilizador.

## Fluxo

1. O utilizador escolhe despesa ou receita e preenche descrição e montante.
2. Após uma pausa curta, o FinTwin pede uma sugestão ao servidor.
3. O servidor autentica o utilizador, confirma acesso de edição ao workspace e carrega as categorias desse workspace.
4. Uma regra anteriormente confirmada é aplicada primeiro; caso contrário, o adaptador chama o Ollama local.
5. A resposta é validada e a categoria é resolvida novamente contra a lista da base de dados.
6. A UI apresenta a sugestão. O tipo não muda automaticamente e a transação só é criada quando o utilizador submete o formulário.
7. Se a categoria sugerida for aceite ou corrigida, a associação é guardada no workspace para futuras descrições semelhantes.

## Dados enviados ao Ollama

- descrição, limitada a 240 caracteres;
- montante decimal normalizado e absoluto;
- direção escolhida no formulário (`INCOME` ou `EXPENSE`);
- nomes e naturezas das categorias disponíveis;
- no máximo oito exemplos já confirmados no mesmo workspace.

Não são enviados IDs, utilizadores, contas bancárias, instituições, saldos, movimentos completos ou credenciais. O adaptador não tem acesso à base de dados.

## Validação e segurança

- Resposta limitada por JSON Schema e novamente validada com Zod.
- Uma categoria fora da lista fornecida é rejeitada.
- O modelo não cria nem atualiza movimentos.
- O endpoint Ollama tem timeout de 45 segundos; indisponibilidade mantém o formulário manual utilizável.
- Apenas `localhost`, `127.0.0.1` e `::1` são aceites por omissão. `OLLAMA_ALLOW_REMOTE=1` exige uma decisão consciente porque altera a garantia de processamento local.
- A descrição é tratada como texto não confiável; o prompt proíbe seguir instruções contidas nela.

## Configuração

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TRANSACTION_MODEL=qwen3.5:4b-mlx
```

Instalação do modelo:

```bash
ollama pull qwen3.5:4b-mlx
```

## Normalização de comerciante

`normalizeMerchant` em `src/lib/finance/merchant-normalization.ts` produz `displayLabel` (UI) e `searchPattern` (regras, matching de recibos). Remove ruído bancário (MB, TPA, etc.) e números de loja.

## Aprendizagem sem fine-tuning

As regras guardam um padrão normalizado do comerciante, a categoria confirmada, a natureza e contadores de aplicação/correção. O isolamento é por `workspaceId`; uma correção num workspace pessoal ou conjunto não afeta qualquer outro. Esta memória pode ser eliminada no futuro por uma área de gestão dedicada, sem alterar o modelo Ollama.

## Revisão em lote (Fase 20.2)

Em `/transacoes?review=1`, a fila **Sugestões pendentes** calcula até 20 propostas de cada vez (regra + Ollama). Aceitar actualiza a transacção e reforça a regra; rejeitar impõe cooldown de 30 dias. Nada é aplicado sem acção explícita.
