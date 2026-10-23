export type HelpChunk = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  routes?: string[];
  source: string;
};

/** Coleção curada — não inclui segredos, credenciais nem código executável. */
export const HELP_CORPUS: HelpChunk[] = [
  {
    id: "joint-create",
    title: "Criar conta conjunta",
    body:
      "Em Conta conjunta (/conta-conjunta), um membro com permissão de gestão pode criar um workspace JOINT e enviar convites por email. O convidado aceita no mesmo ecrã. Só memberships ACTIVE acedem ao espaço. O workspace conjunto não expõe workspaces pessoais de outros utilizadores.",
    tags: ["conta", "conjunta", "convite", "joint", "workspace"],
    routes: ["/conta-conjunta"],
    source: "docs/ROADMAP.md",
  },
  {
    id: "recurring-void-payment",
    title: "Anular pagamento de despesa recorrente",
    body:
      "Em Despesas recorrentes, no histórico recente, podes anular um pagamento confirmado. A operação faz soft-delete apenas da transação criada por essa confirmação, limpa a ligação idempotente e repõe a ocorrência como EXPECTED ou POSTPONED. O saldo da conta debitada é reposto.",
    tags: ["recorrente", "anular", "pagamento", "reverter", "ocorrência"],
    routes: ["/despesas-recorrentes"],
    source: "docs/RECURRING_EXPENSES.md",
  },
  {
    id: "account-delete-block",
    title: "Porque não consigo eliminar uma conta",
    body:
      "Arquivar/eliminar uma conta em Contas está bloqueado enquanto existirem receitas ativas, despesas recorrentes, objetivos ou investimentos associados à conta. Remove ou reassigna essas ligações primeiro. Arquivar preserva movimentos históricos para auditoria.",
    tags: ["conta", "eliminar", "arquivar", "bloqueio"],
    routes: ["/contas"],
    source: "docs/PROGRESS.md",
  },
  {
    id: "forecast-vs-simulation",
    title: "Previsão vs simulação",
    body:
      "Previsões (/previsoes): tesouraria provável com ocorrências e passivos conhecidos; lê dados reais; não grava cenários hipotéticos. Simulações (/simulacoes): compara decisões hipotéticas (poupança, amortização, rendimentos) em modo read-only; nunca cria transações.",
    tags: ["previsão", "simulação", "forecast", "cenário", "diferença"],
    routes: ["/previsoes", "/simulacoes"],
    source: "docs/FINANCIAL_SIMULATIONS.md",
  },
  {
    id: "export-report",
    title: "Exportar relatório PDF ou CSV",
    body:
      "Em Relatórios (/relatorios), escolhe as datas De/Até e usa Exportar CSV ou Exportar PDF. O servidor usa o mesmo intervalo e os mesmos totais nos dois formatos. Ficheiros gerados podem ser guardados no arquivo privado do workspace.",
    tags: ["relatório", "pdf", "csv", "exportar", "documento"],
    routes: ["/relatorios"],
    source: "docs/ROADMAP.md",
  },
  {
    id: "profile-avatar",
    title: "Fotografia de perfil",
    body:
      "Em Conta e perfil (/perfil), campo «Endereço da imagem»: indica um URL HTTPS directo para um ficheiro de imagem (jpg, png, webp). URLs de páginas (ex.: Instagram) não funcionam. Se deixares vazio, aparecem as iniciais do nome.",
    tags: ["perfil", "fotografia", "avatar", "imagem"],
    routes: ["/perfil"],
    source: "UI /perfil",
  },
  {
    id: "workspace-switch",
    title: "Trocar de workspace",
    body:
      "No rodapé da barra lateral escolhes o workspace pessoal ou conjunto. O cookie fintwin_workspace guarda a selecção. Dados financeiros são sempre filtrados pelo workspace activo.",
    tags: ["workspace", "pessoal", "conjunta", "trocar"],
    source: "AGENTS.md",
  },
  {
    id: "transfer-rules",
    title: "Transferências entre contas",
    body:
      "Transferências geram dois movimentos TRANSFER com sinais opostos. Totais de receita e despesa ignoram TRANSFER para não duplicar fluxo.",
    tags: ["transferência", "movimento", "conta"],
    routes: ["/transacoes", "/contas"],
    source: "docs/FINANCIAL_RULES.md",
  },
  {
    id: "budget-month",
    title: "Orçamentos e mês civil",
    body:
      "Orçamentos medem execução no mês civil em Europe/Lisbon. Exceder o limite marca a linha como excedida; valores usam Decimal, nunca somas float.",
    tags: ["orçamento", "limite", "categoria", "mês"],
    routes: ["/orcamentos"],
    source: "docs/FINANCIAL_RULES.md",
  },
  {
    id: "alerts-explain",
    title: "Explicar um alerta",
    body:
      "Nos alertas, o botão Explicar gera texto local a partir dos factos do alerta (totais, datas, regras). Não altera o alerta nem cria movimentos.",
    tags: ["alerta", "explicar", "ollama"],
    routes: ["/alertas"],
    source: "docs/FINANCIAL_ALERTS.md",
  },
  {
    id: "recurring-liability-link",
    title: "Recorrência ligada a passivo",
    body:
      "linkedLiabilityId evita dupla contagem na previsão. Confirmar pagamento na recorrência e pagar passivo com movimento bancário são fluxos separados; usa o aviso/checkbox quando há risco de duplicar.",
    tags: ["passivo", "recorrência", "duplicar", "previsão"],
    routes: ["/despesas-recorrentes", "/patrimonio", "/previsoes"],
    source: "docs/LIABILITY_RECURRING_INTEGRATION.md",
  },
  {
    id: "receipt-scan",
    title: "Digitalizar recibo",
    body:
      "Em Despesas, Digitalizar recibo envia a imagem para extração local (Ollama visão). Revê sempre os campos antes de confirmar; podes corrigir total, data e categoria.",
    tags: ["recibo", "digitalizar", "ocr", "moondream", "despesa"],
    routes: ["/despesas"],
    source: "docs/RECEIPT_SCAN.md",
  },
  {
    id: "assistant-vs-help",
    title: "Assistente vs ajuda contextual",
    body:
      "Assistente financeiro (/assistente): responde com os teus números (somente leitura). Ajuda contextual (botão ?): explica funcionalidades, menus e regras da app sem aceder à base de dados.",
    tags: ["assistente", "ajuda", "diferença"],
    routes: ["/assistente"],
    source: "docs/FINANCIAL_ASSISTANT.md",
  },
  {
    id: "monthly-narrative",
    title: "Resumo narrativo mensal",
    body:
      "Em Relatórios, secção Resumo narrativo do mês: o servidor calcula totais e envia só um JSON resumido ao modelo local. Podes regenerar; factos ficam guardados para auditoria.",
    tags: ["relatório", "narrativo", "gemma", "mês"],
    routes: ["/relatorios"],
    source: "docs/MONTHLY_REPORT_NARRATIVE.md",
  },
  {
    id: "error-ollama-local",
    title: "Erro: Ollama só local",
    body:
      "Por omissão o FinTwin só contacta Ollama em 127.0.0.1/localhost. Para outro host define OLLAMA_ALLOW_REMOTE=1 no servidor (não recomendado em produção exposta).",
    tags: ["ollama", "erro", "ligação", "local"],
    routes: ["/perfil/ia"],
    source: "docs/SECURITY.md",
  },
  {
    id: "categorization-rules",
    title: "Regras de categorização",
    body:
      "Transações podem ser categorizadas manualmente ou por regras aprendidas no workspace. A IA de categorização sugere; a confirmação fica no registo.",
    tags: ["categoria", "transação", "regra"],
    routes: ["/transacoes"],
    source: "docs/LOCAL_ML_CATEGORIZATION.md",
  },
  {
    id: "simulation-no-write",
    title: "Simulações não gravam dados",
    body:
      "Qualquer resultado em /simulacoes é hipotético. Para registar movimentos reais usa Transações, Despesas, Receitas ou Despesas recorrentes.",
    tags: ["simulação", "gravar", "transação"],
    routes: ["/simulacoes"],
    source: "docs/FINANCIAL_SIMULATIONS.md",
  },
  {
    id: "documents-private",
    title: "Documentos privados",
    body:
      "Ficheiros em Relatórios › Arquivo privado são por workspace. Download exige sessão autenticada em /api/documents/[id].",
    tags: ["documento", "download", "privado"],
    routes: ["/relatorios"],
    source: "docs/ROADMAP.md",
  },
];
