import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { canBackoffice, type PlatformRole } from "@/lib/platform/backoffice-policy";
import { retryPlatformJobAction } from "@/lib/platform/backoffice-actions";
import { updateMlFeatureControlAction } from "@/lib/ml/governance-actions";
import { ML_ADVISORY_CAPABILITIES, ML_ADVISORY_REGISTRY } from "@/lib/ml/advisory-registry";
import { DEFERRED_HIGH_RISK_ML, ML_CAPABILITIES, ML_REGISTRY } from "@/lib/ml/registry";
import { db } from "@/lib/db";
import { listPlatformJobs } from "@/server/services/platform-jobs";
import { getMlGovernanceOverview } from "@/server/services/ml-governance";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function BackofficeContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const [roleRow, workspaceContext, jobs, ml] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { systemRole: true } }),
    resolveWorkspaceContext(user.id),
    listPlatformJobs(),
    getMlGovernanceOverview(),
  ]);
  const role = (roleRow?.systemRole ?? "USER") as PlatformRole;
  if (!canBackoffice(role, "open")) redirect("/inicio");
  const canRetry = canBackoffice(role, "retry-jobs");

  return (
    <AppShell userName={user.name} workspaces={workspaceContext.workspaces} activeWorkspaceId={workspaceContext.selected?.id ?? null}>
      <PageHeader
        title="Backoffice"
        description="Fila de trabalhos. Não mostra movimentos, documentos nem dados pessoais."
      />
      <p className="mt-4 text-sm text-slate-500">Papel da plataforma: {role}. Suporte vê a fila; só um administrador repõe falhas.</p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Tentativas</th>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={5}>Nenhum trabalho na fila.</td></tr>
            ) : jobs.map((job) => (
              <tr key={job.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{job.kind}</td>
                <td className="px-4 py-3">{job.status}</td>
                <td className="px-4 py-3">{job.attempts}</td>
                <td className="px-4 py-3">{job.workspaceId ?? "—"}</td>
                <td className="px-4 py-3">
                  {canRetry && job.status === "FAILED" ? (
                    <form action={retryPlatformJobAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <button type="submit" className="text-sm font-semibold text-blue-600">Repor na fila</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Governação de ML</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Modelos, prompts, limites e kill switches por capacidade. As alterações ficam no ledger de auditoria.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Última avaliação: {ml.latestEvaluation?.status ?? "ainda não persistida"}
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {ML_CAPABILITIES.map((capability) => {
            const control = ml.controls.find((item) => item.capability === capability);
            const metric = ml.metrics.find((item) => item.capability === capability);
            const definition = ML_REGISTRY[capability];
            const status = control?.killSwitch ? "Corte de emergência" : control?.enabled === false ? "Desativada" : "Ativa";
            return (
              <article key={capability} className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{capability}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{definition.purpose}</p>
                    <p className="mt-1 text-xs">{definition.defaultModel} · prompt {definition.promptVersion} · limite {definition.maxLatencyMs / 1000}s · {status}</p>
                    {metric ? <p className="mt-1 text-xs">Cobertura recente: {Math.round(metric.coverage * 100)}% ({metric.sampleCount} execuções)</p> : null}
                    {metric ? <p className="mt-1 text-xs">Drift: {metric.drift.status}{metric.drift.reasons[0] ? ` · ${metric.drift.reasons[0]}` : ""}</p> : null}
                  </div>
                  {canRetry ? (
                    <form action={updateMlFeatureControlAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="capability" value={capability} />
                      <input name="reason" maxLength={240} placeholder="Motivo" className="h-9 rounded-lg border border-[var(--border)] bg-transparent px-2 text-xs" />
                      <button name="action" value="enable" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Ativar</button>
                      <button name="action" value="disable" className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Desativar</button>
                      <button name="action" value="kill" className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white">Kill switch</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4">
          <h3 className="text-sm font-semibold">Capacidades advisory (determinísticas)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Sem LLM; sujeitas a `pnpm ml:eval` e gate `isAdvisoryReleaseAllowed` em staging/prod.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {ML_ADVISORY_CAPABILITIES.map((cap) => {
              const def = ML_ADVISORY_REGISTRY[cap];
              return (
                <li key={cap}>
                  #{def.roadmapOrder} {cap} — {def.humanReviewRequired ? "revisão humana" : "read-only"}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/20">
          <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-100">Fora de âmbito (bloqueadas)</h3>
          <p className="mt-1 text-xs text-rose-800 dark:text-rose-200">{DEFERRED_HIGH_RISK_ML.join(", ")}</p>
        </div>
      </section>
      <Link href="/perfil" className="mt-6 inline-flex text-sm font-semibold text-blue-600">Voltar ao perfil</Link>
    </AppShell>
  );
}

export default function BackofficePage() {
  return <Suspense fallback={<p className="p-6 text-sm">A carregar o backoffice…</p>}><BackofficeContent /></Suspense>;
}
