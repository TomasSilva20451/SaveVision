export type DriftWindow = {
  sampleCount: number;
  coverage: number;
  meanConfidence: number | null;
  correctionRate: number | null;
};

export type DriftAssessment = {
  status: "INSUFFICIENT_DATA" | "STABLE" | "WATCH" | "DRIFT";
  score: number | null;
  reasons: string[];
};

export function assessMlDrift(current: DriftWindow, baseline: DriftWindow): DriftAssessment {
  if (current.sampleCount < 20 || baseline.sampleCount < 20) {
    return { status: "INSUFFICIENT_DATA", score: null, reasons: ["São necessárias pelo menos 20 amostras em cada janela."] };
  }
  const coverageDrop = Math.max(0, baseline.coverage - current.coverage);
  const confidenceDrop = current.meanConfidence === null || baseline.meanConfidence === null
    ? 0
    : Math.max(0, baseline.meanConfidence - current.meanConfidence);
  const correctionIncrease = current.correctionRate === null || baseline.correctionRate === null
    ? 0
    : Math.max(0, current.correctionRate - baseline.correctionRate);
  const score = Math.min(1, coverageDrop * 0.45 + confidenceDrop * 0.3 + correctionIncrease * 0.25);
  const reasons: string[] = [];
  if (coverageDrop >= 0.1) reasons.push(`Cobertura desceu ${Math.round(coverageDrop * 100)} p.p.`);
  if (confidenceDrop >= 0.1) reasons.push(`Confiança média desceu ${Math.round(confidenceDrop * 100)} p.p.`);
  if (correctionIncrease >= 0.1) reasons.push(`Correções aumentaram ${Math.round(correctionIncrease * 100)} p.p.`);
  const status = score >= 0.15 ? "DRIFT" : score >= 0.07 ? "WATCH" : "STABLE";
  return { status, score, reasons: reasons.length ? reasons : ["Sem alteração material nas métricas monitorizadas."] };
}
