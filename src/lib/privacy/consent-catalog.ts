/** Catálogo de consentimentos e bases legais (versões imutáveis). */

export type ConsentDefinition = {
  key: string;
  version: string;
  title: string;
  legalBasis: "consent" | "contract" | "legitimate_interest" | "legal_obligation";
  purpose: string;
  required: boolean;
  docPath: string;
};

export const CONSENT_CATALOG: ConsentDefinition[] = [
  {
    key: "privacy_policy",
    version: "2026-10-24",
    title: "Política de privacidade",
    legalBasis: "contract",
    purpose: "Operar a conta FinTwin, isolamento por workspace e segurança.",
    required: true,
    docPath: "/docs/PRIVACY_GOVERNANCE.md",
  },
  {
    key: "financial_processing",
    version: "2026-10-24",
    title: "Tratamento de dados financeiros",
    legalBasis: "contract",
    purpose: "Registar movimentos, orçamentos, património e relatórios solicitados pelo titular.",
    required: true,
    docPath: "/docs/PRIVACY_GOVERNANCE.md#tratamentos",
  },
  {
    key: "local_ai_processing",
    version: "2026-10-24",
    title: "IA local (Ollama)",
    legalBasis: "consent",
    purpose: "Enviar metadados limitados ao Ollama local para sugestões, ajuda e narrativas.",
    required: false,
    docPath: "/docs/OLLAMA_PRIVACY.md",
  },
  {
    key: "prompt_storage",
    version: "2026-10-24",
    title: "Guardar prompts de ajuda localmente",
    legalBasis: "consent",
    purpose: "Persistir histórico curto de perguntas de ajuda contextual (desactivável).",
    required: false,
    docPath: "/docs/OLLAMA_PRIVACY.md#retencao-de-prompts",
  },
];

export const ERASURE_POLICY_VERSION = "2026-10-24";

export function catalogByKey(key: string) {
  return CONSENT_CATALOG.filter((c) => c.key === key);
}

export function latestConsentVersion(key: string) {
  const items = catalogByKey(key);
  return items.sort((a, b) => b.version.localeCompare(a.version))[0];
}

export function missingRequiredConsents(accepted: { consentKey: string; version: string }[]) {
  const acceptedSet = new Set(accepted.map((a) => `${a.consentKey}@${a.version}`));
  return CONSENT_CATALOG.filter((c) => c.required).filter(
    (c) => !acceptedSet.has(`${c.key}@${c.version}`),
  );
}
