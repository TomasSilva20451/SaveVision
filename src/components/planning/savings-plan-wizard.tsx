"use client";

import { useMemo, useState } from "react";
import {
  activateSavingsPlanAction,
  previewSavingsPlanAction,
} from "@/lib/finance/savings-plan-actions";
import { CHALLENGE_300_EUR_TEMPLATE } from "@/lib/finance/savings-plan-template";
import type {
  SavingsPlanActivationPreview,
  SavingsPlanWizardInput,
} from "@/server/services/savings-plan";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";

type Props = {
  defaults: SavingsPlanWizardInput;
  savingsAccounts: { id: string; name: string }[];
  sourceAccounts: { id: string; name: string }[];
  isPersonalWorkspace: boolean;
};

function formDataFromWizard(form: SavingsPlanWizardInput, budgetJson: string): FormData {
  const fd = new FormData();
  fd.set("idempotencyKey", form.idempotencyKey);
  fd.set("budgetLinesJson", budgetJson);
  fd.set("confirmBudgetOverrides", form.confirmBudgetOverrides ? "on" : "");
  fd.set("name", form.name);
  fd.set("targetAmount", form.targetAmount);
  fd.set("targetDateIso", form.targetDateIso);
  fd.set("plannedWeeklyContribution", form.plannedWeeklyContribution);
  fd.set("contributionWeekday", String(form.contributionWeekday));
  fd.set("reviewWeekday", String(form.reviewWeekday));
  fd.set("alertThresholdPercent", String(form.alertThresholdPercent));
  fd.set("budgetStartMode", form.budgetStartMode);
  if (form.savingsAccountId) fd.set("savingsAccountId", form.savingsAccountId);
  if (form.sourceAccountId) fd.set("sourceAccountId", form.sourceAccountId);
  if (form.createSavingsAccountName) fd.set("createSavingsAccountName", form.createSavingsAccountName);
  return fd;
}

export function SavingsPlanWizard({
  defaults,
  savingsAccounts,
  sourceAccounts,
  isPersonalWorkspace,
}: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaults);
  const [preview, setPreview] = useState<SavingsPlanActivationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const budgetJson = useMemo(() => JSON.stringify(form.budgetLines), [form.budgetLines]);

  async function loadPreview() {
    setPreviewLoading(true);
    setPreviewError(null);
    const result = await previewSavingsPlanAction(formDataFromWizard(form, budgetJson));
    setPreviewLoading(false);
    if (result.ok) setPreview(result.preview);
    else {
      setPreview(null);
      setPreviewError(result.error);
    }
  }

  async function goNext() {
    if (step === 4) {
      await loadPreview();
    }
    setStep((s) => Math.min(5, s + 1));
  }

  if (!isPersonalWorkspace) {
    return (
      <p className="text-sm text-slate-500">
        Muda para o teu workspace pessoal para criar um plano de poupança. A conta conjunta serve
        apenas despesas partilhadas — a poupança fica isolada no espaço pessoal.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-semibold">Criar plano de poupança</h2>
      <p className="mt-1 text-sm text-slate-500">
        Modelo «{CHALLENGE_300_EUR_TEMPLATE.defaultName}» pré-preenchido — editável em cada passo.
      </p>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs font-medium" aria-label="Passos do assistente">
        {[1, 2, 3, 4, 5].map((n) => (
          <li
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
          >
            {n}
          </li>
        ))}
      </ol>

      <form className="mt-5 grid gap-4">
        <input type="hidden" name="idempotencyKey" value={form.idempotencyKey} />
        <input type="hidden" name="budgetLinesJson" value={budgetJson} />
        <input type="hidden" name="confirmBudgetOverrides" value={form.confirmBudgetOverrides ? "on" : ""} />
        <input type="hidden" name="name" value={form.name} />
        <input type="hidden" name="targetAmount" value={form.targetAmount} />
        <input type="hidden" name="targetDateIso" value={form.targetDateIso} />
        <input type="hidden" name="plannedWeeklyContribution" value={form.plannedWeeklyContribution} />
        <input type="hidden" name="contributionWeekday" value={form.contributionWeekday} />
        <input type="hidden" name="reviewWeekday" value={form.reviewWeekday} />
        <input type="hidden" name="alertThresholdPercent" value={form.alertThresholdPercent} />
        <input type="hidden" name="budgetStartMode" value={form.budgetStartMode} />
        {form.savingsAccountId ? (
          <input type="hidden" name="savingsAccountId" value={form.savingsAccountId} />
        ) : null}
        {form.createSavingsAccountName ? (
          <input type="hidden" name="createSavingsAccountName" value={form.createSavingsAccountName} />
        ) : null}
        {form.sourceAccountId ? (
          <input type="hidden" name="sourceAccountId" value={form.sourceAccountId} />
        ) : null}

        {step === 1 ? (
          <>
            <label className={labelClassName} htmlFor="savings-plan-name">
              Nome do plano
              <input
                id="savings-plan-name"
                className={inputClassName}
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    idempotencyKey:
                      form.idempotencyKey === defaults.idempotencyKey
                        ? `plan-${e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`
                        : form.idempotencyKey,
                  })
                }
                required
              />
            </label>
            <label className={labelClassName}>
              Montante-alvo (€)
              <input
                className={inputClassName}
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                required
              />
            </label>
            <label className={labelClassName}>
              Data-alvo
              <input
                type="date"
                className={inputClassName}
                value={form.targetDateIso}
                onChange={(e) => setForm({ ...form, targetDateIso: e.target.value })}
                required
              />
            </label>
            <label className={labelClassName}>
              Contribuição semanal (€)
              <input
                className={inputClassName}
                value={form.plannedWeeklyContribution}
                onChange={(e) => setForm({ ...form, plannedWeeklyContribution: e.target.value })}
                required
              />
            </label>
            <p className="text-xs text-slate-500">
              Contribuição e revisão ao domingo (dia {form.contributionWeekday} ISO).
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cada contribuição semanal cria uma transferência da conta de origem para a poupança.
              Saldo inicial da poupança: 0 €.
            </p>
            <label className={labelClassName}>
              Conta de origem (de onde sai o dinheiro)
              <select
                className={inputClassName}
                value={form.sourceAccountId ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sourceAccountId: e.target.value.length > 0 ? e.target.value : undefined,
                  })
                }
                required={sourceAccounts.length > 0}
              >
                <option value="">
                  {sourceAccounts.length > 0 ? "Escolher conta…" : "Nenhuma conta à ordem/caixa"}
                </option>
                {sourceAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Conta de poupança (destino)
              <select
                className={inputClassName}
                value={form.savingsAccountId ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    savingsAccountId: e.target.value || undefined,
                    createSavingsAccountName: e.target.value ? undefined : form.createSavingsAccountName,
                  })
                }
              >
                <option value="">Criar nova conta</option>
                {savingsAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {!form.savingsAccountId ? (
              <label className={labelClassName} htmlFor="savings-plan-account-name">
                Nome da nova conta
                <input
                  id="savings-plan-account-name"
                  className={inputClassName}
                  value={form.createSavingsAccountName ?? ""}
                  onChange={(e) => setForm({ ...form, createSavingsAccountName: e.target.value })}
                  required
                />
              </label>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Orçamentos mensais propostos</legend>
              <ul className="text-sm">
                {form.budgetLines.map((line) => (
                  <li key={line.categoryName} className="flex justify-between border-b py-2">
                    <span>{line.categoryName}</span>
                    <span>{line.monthlyLimit} €</span>
                  </li>
                ))}
              </ul>
            </fieldset>
            <label className={labelClassName}>
              Início dos orçamentos
              <select
                className={inputClassName}
                value={form.budgetStartMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    budgetStartMode: e.target.value as SavingsPlanWizardInput["budgetStartMode"],
                  })
                }
              >
                <option value="NEXT_MONTH">Mês seguinte</option>
                <option value="PROPORTIONAL_CURRENT">Limite proporcional neste mês</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="confirmBudgetOverridesUi"
                checked={form.confirmBudgetOverrides}
                onChange={(e) => setForm({ ...form, confirmBudgetOverrides: e.target.checked })}
              />
              Confirmo alterações a linhas de orçamento já existentes
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Categoria atinge {form.alertThresholdPercent}% do orçamento do plano</li>
            <li>Categoria excede o orçamento</li>
            <li>Contribuição semanal não confirmada até ao fim da semana</li>
            <li>Saída de dinheiro da conta de poupança</li>
            <li>Objetivo concluído</li>
          </ul>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-4 text-sm">
            {previewLoading ? <p>A gerar pré-visualização…</p> : null}
            {previewError ? <p className="text-rose-600">{previewError}</p> : null}
            {preview ? (
              <>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="font-semibold">Sem transações automáticas</p>
                  <p className="mt-1">
                    Nenhuma transação nem contribuição fictícia será criada. Conta com saldo inicial{" "}
                    {preview.initialAccountBalance} €.
                  </p>
                  <p className="mt-1">Workspace pessoal confirmado.</p>
                </div>
                <div>
                  <h3 className="font-semibold">Entidades</h3>
                  <ul className="mt-2 divide-y rounded-lg border border-[var(--border)]">
                    {preview.entities.map((entity, i) => (
                      <li key={i} className="flex justify-between gap-2 px-3 py-2">
                        <span>
                          {entity.kind === "create" ? "＋" : entity.kind === "reuse" ? "↺" : "!"}{" "}
                          {entity.label}
                        </span>
                        <span
                          className={
                            entity.kind === "conflict"
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-slate-500"
                          }
                        >
                          {entity.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold">Orçamentos por mês</h3>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {preview.budgetMonths.map((m) => (
                      <li key={`${m.year}-${m.month}`} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                        <strong>
                          {m.month}/{m.year}
                        </strong>
                        <ul className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {m.lines.map((line) => (
                            <li key={line.categoryName}>
                              {line.categoryName}: {line.limit} €
                              {line.conflict ? (
                                <span className="text-amber-700"> — conflito: {line.conflict}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
                  {preview.alertSummary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button type="button" className={secondaryButtonClassName} onClick={() => setStep(step - 1)}>
              Anterior
            </button>
          ) : null}
          {step < 5 ? (
            <button type="button" className={primaryButtonClassName} onClick={() => void goNext()}>
              Seguinte
            </button>
          ) : (
            <>
              <button
                formAction={activateSavingsPlanAction}
                className={primaryButtonClassName}
                type="submit"
                disabled={
                  previewLoading ||
                  Boolean(
                    preview?.entities.some((e) => e.kind === "conflict") ||
                      preview?.budgetMonths.some((m) =>
                        m.lines.some((l) => l.conflict && !form.confirmBudgetOverrides),
                      ),
                  )
                }
              >
                Confirmar activação
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
