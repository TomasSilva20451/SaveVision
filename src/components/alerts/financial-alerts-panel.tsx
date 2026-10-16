import Link from "next/link";
import {
  dismissFinancialAlertAction,
  markAllFinancialAlertsSeenAction,
  markFinancialAlertSeenAction,
  syncFinancialAlertsAction,
} from "@/lib/finance/financial-alert-actions";
import type { FinancialAlertView } from "@/server/services/financial-alerts";
import { EmptyState } from "@/components/ui/empty-state";
import { secondaryButtonClassName } from "@/components/ui/form-styles";

const severityLabel: Record<FinancialAlertView["severity"], string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  ATTENTION: "Média",
  INFO: "Informativa",
};

const severityClass: Record<FinancialAlertView["severity"], string> = {
  CRITICAL: "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30",
  HIGH: "border-orange-300 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20",
  ATTENTION: "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20",
  INFO: "border-zinc-200 dark:border-zinc-800",
};

type FinancialAlertsPanelProps = {
  alerts: FinancialAlertView[];
  showResolved?: boolean;
  compact?: boolean;
};

export function FinancialAlertsPanel({
  alerts,
  showResolved = false,
  compact = false,
}: FinancialAlertsPanelProps) {
  const shown = compact ? alerts.slice(0, 5) : alerts;

  if (shown.length === 0) {
    return (
      <EmptyState
        title={showResolved ? "Sem alertas resolvidos" : "Sem alertas ativos"}
        description={
          showResolved
            ? "Quando uma condição financeira deixar de se verificar, o alerta aparece aqui."
            : "Quando o FinTwin detetar situações relevantes, verás os alertas nesta lista."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          <form action={syncFinancialAlertsAction}>
            <button type="submit" className={secondaryButtonClassName}>
              Atualizar alertas
            </button>
          </form>
          <form action={markAllFinancialAlertsSeenAction}>
            <button type="submit" className={secondaryButtonClassName}>
              Marcar todos como vistos
            </button>
          </form>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {shown.map((alert) => {
          const unseen = !alert.seenAt && !alert.dismissedAt;
          return (
            <li
              key={alert.id}
              className={`rounded-xl border p-4 ${severityClass[alert.severity]}`}
              data-testid="financial-alert-item"
              data-alert-severity={alert.severity}
              data-alert-unseen={unseen ? "true" : "false"}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {severityLabel[alert.severity]}
                    {unseen ? " · Novo" : null}
                  </p>
                  <p className="font-medium">{alert.title}</p>
                </div>
                <time className="text-xs text-zinc-500" dateTime={alert.detectedAt.toISOString()}>
                  {alert.detectedAt.toLocaleDateString("pt-PT")}
                </time>
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{alert.description}</p>
              {alert.actionUrl ? (
                <p className="mt-2 text-sm">
                  <Link href={alert.actionUrl} className="underline">
                    Ver detalhe
                  </Link>
                </p>
              ) : null}
              {!compact && alert.status === "ACTIVE" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={markFinancialAlertSeenAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Marcar como visto
                    </button>
                  </form>
                  <form action={dismissFinancialAlertAction}>
                    <input type="hidden" name="alertId" value={alert.id} />
                    <button type="submit" className={secondaryButtonClassName}>
                      Dispensar
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
