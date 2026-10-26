import { db } from "@/lib/db";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Funcionalidades advisory (P10/P90, liquidez, etc.) exigem eval ML recente em ambientes expostos. */
export async function isAdvisoryReleaseAllowed(): Promise<{ allowed: boolean; reason?: string }> {
  const env = process.env.FINTWIN_ENV ?? "development";
  if (env === "development" || env === "e2e" || env === "demo" || env === "test") {
    return { allowed: true };
  }
  if (process.env.FINTWIN_ML_EVAL_GATE === "0") {
    return { allowed: false, reason: "EVAL_GATE_DISABLED_BY_ENV" };
  }

  try {
    const latest = await db.mlEvaluationRun.findFirst({
      where: { status: "PASSED" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true, releaseRef: true },
    });
    if (!latest?.finishedAt) return { allowed: false, reason: "NO_PASSED_EVAL" };
    if (Date.now() - latest.finishedAt.getTime() > MAX_AGE_MS) {
      return { allowed: false, reason: "EVAL_STALE" };
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "EVAL_STORE_UNAVAILABLE" };
  }
}

/** @deprecated Use isAdvisoryReleaseAllowed */
export const isProbabilisticForecastReleaseAllowed = isAdvisoryReleaseAllowed;
