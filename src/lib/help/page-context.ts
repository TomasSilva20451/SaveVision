export type PageHelpContext = {
  routeKey: string;
  title: string;
  intro: string;
};

const ROUTE_CONTEXT: Record<string, Omit<PageHelpContext, "routeKey">> = {
  "/dashboard": {
    title: "Dashboard",
    intro:
      "Vês KPIs do workspace selecionado, evolução recente e atalhos. Os valores vêm da base de dados; não são simulações.",
  },
  "/contas": {
    title: "Contas",
    intro:
      "Geres contas financeiras do workspace. Podes arquivar uma conta quando não tiver dependências ativas; o histórico mantém-se.",
  },
  "/transacoes": {
    title: "Transações",
    intro: "Lista e filtra movimentos. Transferências aparecem como pares; receitas e despesas excluem transferências nos totais.",
  },
  "/orcamentos": {
    title: "Orçamentos",
    intro: "Defines limites por categoria e acompanhas a execução no mês civil (Europe/Lisbon).",
  },
  "/despesas-recorrentes": {
    title: "Despesas recorrentes",
    intro:
      "Crias recorrências, registas pagamentos, adias ocorrências ou anulas um pagamento recente (reverte só o movimento ligado e repõe a ocorrência pendente).",
  },
  "/receitas": {
    title: "Receitas",
    intro: "Registas séries de receita, confirmas ocorrências esperadas e acompanhas o estado RECEIVED/EXPECTED.",
  },
  "/despesas": {
    title: "Despesas",
    intro:
      "Registas despesas, analisas o mês e podes digitalizar recibos (confirmação manual antes de gravar).",
  },
  "/patrimonio": {
    title: "Património",
    intro: "Ativos, passivos e património líquido manual. Passivos podem ligar-se a recorrências para a previsão.",
  },
  "/previsoes": {
    title: "Previsões",
    intro:
      "Projeção de tesouraria com dados conhecidos (recorrências EXPECTED, passivos, orçamentos). Não grava cenários hipotéticos.",
  },
  "/simulacoes": {
    title: "Simulações",
    intro:
      "Laboratório read-only: compara decisões hipotéticas (poupança, amortização, etc.) sem criar transações. Diferente das previsões, que usam apenas dados reais.",
  },
  "/analises": {
    title: "Análises",
    intro: "Gráficos e comparações de receitas e despesas por período no workspace atual.",
  },
  "/alertas": {
    title: "Alertas",
    intro:
      "Centro de alertas financeiros persistentes. Podes marcar como visto, filtrar e pedir explicação (texto gerado localmente a partir dos factos do alerta).",
  },
  "/planeamento": {
    title: "Planeamento",
    intro: "Objetivos, fundo de emergência, score explicável e sugestões (ex.: cash sweep) sem execução automática.",
  },
  "/conta-conjunta": {
    title: "Conta conjunta",
    intro:
      "Crias ou ages num workspace JOINT por convite. Membros ativos partilham dados do conjunto; não abrem workspaces pessoais uns dos outros.",
  },
  "/relatorios": {
    title: "Relatórios",
    intro:
      "Exporta PDF/CSV no intervalo escolhido e guarda documentos privados. O resumo narrativo mensal usa totais calculados no servidor.",
  },
  "/investimentos": {
    title: "Investimentos",
    intro: "Posições manuais e P/L com preços introduzidos por ti. Sem trading automático.",
  },
  "/assistente": {
    title: "Assistente financeiro",
    intro:
      "Perguntas sobre os teus dados (somente leitura). Para ajuda sobre botões e fluxos da app, usa o botão Ajuda contextual.",
  },
  "/perfil": {
    title: "Conta e perfil",
    intro: "Nome, contactos, palavra-passe e URL da fotografia de perfil (HTTPS).",
  },
  "/perfil/ia": {
    title: "IA local",
    intro: "Ativa ou desativa modelos locais, escolhe modelos Ollama e testa a ligação. Processamento apenas no teu computador por omissão.",
  },
  "/inicio": {
    title: "Início",
    intro: "Entrada rápida com ações e resumo do workspace selecionado.",
  },
};

export function resolvePageHelpContext(pathname: string): PageHelpContext {
  const normalized = pathname.split("?")[0]?.replace(/\/$/, "") || "/";
  const exact = ROUTE_CONTEXT[normalized];
  if (exact) return { routeKey: normalized, ...exact };

  if (normalized.startsWith("/contas/")) {
    return {
      routeKey: "/contas",
      title: "Detalhe de conta",
      intro: "Movimentos e saldo de uma conta. Arquivar a conta faz-se na lista de contas, com as mesmas regras de bloqueio.",
    };
  }

  return {
    routeKey: normalized,
    title: "FinTwin",
    intro: "Usa o menu lateral para navegar. A ajuda responde com base na documentação funcional da aplicação.",
  };
}
