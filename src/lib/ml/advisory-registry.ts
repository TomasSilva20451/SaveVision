/**
 * Capacidades determinísticas / estatísticas (sem LLM) cobertas pelo eval gate e pela política de produto.
 * Nunca escrevem movimentos; revisão humana onde indicado.
 */
export const ML_ADVISORY_CAPABILITIES = [
  "merchant-normalization",
  "expense-anomaly-v2",
  "probabilistic-forecast",
  "liquidity-risk",
  "savings-recommendation",
  "reconciliation-copilot",
  "document-intelligence-readonly",
  "corporate-assistant-readonly",
] as const;

export type MlAdvisoryCapability = (typeof ML_ADVISORY_CAPABILITIES)[number];

export type MlAdvisoryDefinition = {
  capability: MlAdvisoryCapability;
  purpose: string;
  /** Ordem sugerida no roadmap §11 (1 = primeiro). */
  roadmapOrder: number;
  humanReviewRequired: boolean;
  writesFinancialData: false;
  usesLlm: false;
};

export const ML_ADVISORY_REGISTRY: Record<MlAdvisoryCapability, MlAdvisoryDefinition> = {
  "merchant-normalization": {
    capability: "merchant-normalization",
    purpose: "Normalizar rótulos de comerciante para regras e categorização.",
    roadmapOrder: 1,
    humanReviewRequired: true,
    writesFinancialData: false,
    usesLlm: false,
  },
  "expense-anomaly-v2": {
    capability: "expense-anomaly-v2",
    purpose: "Anomalias comportamentais explicáveis (R1/R2/R3); não implica fraude.",
    roadmapOrder: 2,
    humanReviewRequired: false,
    writesFinancialData: false,
    usesLlm: false,
  },
  "probabilistic-forecast": {
    capability: "probabilistic-forecast",
    purpose: "Bandas P10/P50/P90 sobre fluxos mensais observados.",
    roadmapOrder: 3,
    humanReviewRequired: false,
    writesFinancialData: false,
    usesLlm: false,
  },
  "liquidity-risk": {
    capability: "liquidity-risk",
    purpose: "Classificação LOW/MEDIUM/HIGH a partir do P10 e saídas conhecidas.",
    roadmapOrder: 4,
    humanReviewRequired: false,
    writesFinancialData: false,
    usesLlm: false,
  },
  "document-intelligence-readonly": {
    capability: "document-intelligence-readonly",
    purpose: "Extração candidata de comprovativos; confirmação humana para despesa.",
    roadmapOrder: 5,
    humanReviewRequired: true,
    writesFinancialData: false,
    usesLlm: false,
  },
  "savings-recommendation": {
    capability: "savings-recommendation",
    purpose: "Montante mensal sugerido com razões; sem transferências automáticas.",
    roadmapOrder: 6,
    humanReviewRequired: true,
    writesFinancialData: false,
    usesLlm: false,
  },
  "reconciliation-copilot": {
    capability: "reconciliation-copilot",
    purpose: "Ordenar candidatos de reconciliação com evidência; confirmação manual.",
    roadmapOrder: 7,
    humanReviewRequired: true,
    writesFinancialData: false,
    usesLlm: false,
  },
  "corporate-assistant-readonly": {
    capability: "corporate-assistant-readonly",
    purpose: "Assistente empresarial: intenção ML + ferramentas read-only no servidor.",
    roadmapOrder: 8,
    humanReviewRequired: false,
    writesFinancialData: false,
    usesLlm: false,
  },
};
