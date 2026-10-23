import { z } from "zod";

export const alertSeverityGuidePt: Record<string, string> = {
  CRITICAL:
    "Ação imediata: o motor classificou este alerta como crítico (risco grave à tesouraria ou cumprimento).",
  HIGH: "Prioridade alta: convém resolver em breve; o motor não altera esta classificação.",
  ATTENTION: "Atenção: situação relevante a acompanhar; não é necessariamente urgente hoje.",
  INFO: "Informativo: útil para monitorização; o motor não exige ação imediata só por esta prioridade.",
};

export const insightSeverityGuidePt: Record<string, string> = {
  WARNING: "Aviso: padrão ou desvio que merece revisão.",
  ATTENTION: "Atenção: tendência ou concentração a considerar.",
  POSITIVE: "Positivo: evolução favorável face às regras do FinTwin.",
  INFORMATION: "Informação: contexto adicional calculado deterministicamente.",
};

export type ExplanationMovement = {
  date: string;
  description: string;
  amount: string;
};

export type StructuredExplanationPayload = {
  kind: "alert" | "insight";
  subjectType: string;
  severity: string;
  severityGuide: string;
  title: string;
  officialSummary: string;
  evidenceLines: string[];
  topMovements: ExplanationMovement[];
  comparisonNote: string | null;
  availableUserActions: string[];
  engineActionLabel: string | null;
  dataIncomplete: boolean;
};

export const naturalLanguageExplanationSchema = z
  .object({
    factualExplanation: z.string().trim().min(1).max(480),
    impactHighlight: z.string().trim().min(1).max(240),
    severityExplanation: z.string().trim().min(1).max(220),
    optionalSuggestion: z.string().trim().max(220).nullable(),
    availableActionsSummary: z.string().trim().min(1).max(220),
  })
  .strict();

export type NaturalLanguageExplanation = z.infer<typeof naturalLanguageExplanationSchema>;

export function buildDeterministicExplanation(
  payload: StructuredExplanationPayload,
): NaturalLanguageExplanation {
  const evidence = payload.evidenceLines.slice(0, 4).join(" ");
  const movements =
    payload.topMovements.length > 0
      ? ` Os movimentos com maior impacto incluem «${payload.topMovements[0]!.description}» (${payload.topMovements[0]!.amount} €).`
      : "";

  return {
    factualExplanation: `${payload.officialSummary} ${evidence}${movements}`.trim(),
    impactHighlight: payload.comparisonNote ?? "Comparação limitada aos dados disponíveis neste workspace.",
    severityExplanation: payload.severityGuide,
    optionalSuggestion: null,
    availableActionsSummary: payload.availableUserActions.join("; ") || "Consulta a página ligada ao alerta.",
  };
}

export function evidenceRecordToLines(evidence: unknown): string[] {
  if (!evidence || typeof evidence !== "object") return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(evidence as Record<string, unknown>)) {
    if (value == null || key === "evidenceLines") continue;
    if (Array.isArray(value)) continue;
    lines.push(`${key}: ${String(value)}`);
  }
  const nested = (evidence as { evidenceLines?: unknown }).evidenceLines;
  if (Array.isArray(nested)) {
    for (const line of nested) {
      if (typeof line === "string") lines.push(line);
    }
  }
  return lines.slice(0, 12);
}
