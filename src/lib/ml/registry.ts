export const ML_CAPABILITIES = [
  "transaction-categorization",
  "recurring-pattern-enrichment",
  "financial-assistant-intent",
  "receipt-extraction",
  "report-narrative",
  "contextual-help",
] as const;

export type MlCapability = (typeof ML_CAPABILITIES)[number];

export type MlCapabilityDefinition = {
  capability: MlCapability;
  purpose: string;
  modelFamily: "text" | "vision";
  defaultModel: string;
  modelVersion: string;
  promptKey: string;
  promptVersion: string;
  maxLatencyMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  humanReviewRequired: boolean;
  deterministicFallback: string;
};

export const ML_REGISTRY: Record<MlCapability, MlCapabilityDefinition> = {
  "transaction-categorization": {
    capability: "transaction-categorization",
    purpose: "Sugerir comerciante, categoria e natureza sem criar movimentos.",
    modelFamily: "text",
    defaultModel: "qwen3.5:4b-mlx",
    modelVersion: "local-configured",
    promptKey: "transaction-categorization.pt-PT",
    promptVersion: "2.0.0",
    maxLatencyMs: 45_000,
    maxInputTokens: 2_000,
    maxOutputTokens: 600,
    humanReviewRequired: true,
    deterministicFallback: "Regras confirmadas do workspace; seleção manual quando não existe regra.",
  },
  "recurring-pattern-enrichment": {
    capability: "recurring-pattern-enrichment",
    purpose: "Dar um nome legível a um padrão recorrente já provado estatisticamente.",
    modelFamily: "text",
    defaultModel: "qwen3.5:4b-mlx",
    modelVersion: "local-configured",
    promptKey: "recurring-pattern-enrichment.pt-PT",
    promptVersion: "1.1.0",
    maxLatencyMs: 45_000,
    maxInputTokens: 1_200,
    maxOutputTokens: 300,
    humanReviewRequired: true,
    deterministicFallback: "Nome e evidência produzidos pelo detetor estatístico.",
  },
  "financial-assistant-intent": {
    capability: "financial-assistant-intent",
    purpose: "Interpretar a intenção; os cálculos permanecem em ferramentas do servidor.",
    modelFamily: "text",
    defaultModel: "qwen3.5:4b-mlx",
    modelVersion: "local-configured",
    promptKey: "financial-assistant-intent.pt-PT",
    promptVersion: "1.2.0",
    maxLatencyMs: 30_000,
    maxInputTokens: 1_500,
    maxOutputTokens: 350,
    humanReviewRequired: false,
    deterministicFallback: "Mensagem de esclarecimento e atalhos para ferramentas read-only.",
  },
  "receipt-extraction": {
    capability: "receipt-extraction",
    purpose: "Extrair campos candidatos de um comprovativo sem criar transações.",
    modelFamily: "vision",
    defaultModel: "moondream:latest",
    modelVersion: "local-configured",
    promptKey: "receipt-extraction.pt-PT",
    promptVersion: "1.0.0",
    maxLatencyMs: 60_000,
    maxInputTokens: 3_000,
    maxOutputTokens: 800,
    humanReviewRequired: true,
    deterministicFallback: "Introdução manual dos campos do comprovativo.",
  },
  "report-narrative": {
    capability: "report-narrative",
    purpose: "Resumir factos financeiros previamente calculados.",
    modelFamily: "text",
    defaultModel: "qwen3.5:4b-mlx",
    modelVersion: "local-configured",
    promptKey: "report-narrative.pt-PT",
    promptVersion: "1.0.0",
    maxLatencyMs: 45_000,
    maxInputTokens: 2_500,
    maxOutputTokens: 700,
    humanReviewRequired: false,
    deterministicFallback: "Relatório factual sem narrativa gerada.",
  },
  "contextual-help": {
    capability: "contextual-help",
    purpose: "Explicar a interface e regras públicas da aplicação.",
    modelFamily: "text",
    defaultModel: "qwen2.5-coder:7b",
    modelVersion: "local-configured",
    promptKey: "contextual-help.pt-PT",
    promptVersion: "1.0.0",
    maxLatencyMs: 30_000,
    maxInputTokens: 1_500,
    maxOutputTokens: 500,
    humanReviewRequired: false,
    deterministicFallback: "Ajuda estática e documentação contextual.",
  },
};

export function isMlCapability(value: string): value is MlCapability {
  return ML_CAPABILITIES.includes(value as MlCapability);
}

export const DEFERRED_HIGH_RISK_ML = [
  "fraud-detection",
  "aml",
  "credit-scoring",
  "robo-advice",
] as const;
