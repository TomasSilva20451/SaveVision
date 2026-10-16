"use client";

import { useMemo, useState, useTransition } from "react";
import type { SimulationBaseline } from "@/components/simulations/types";
import { simulateTreasuryOneOffAction } from "@/lib/finance/financial-simulation-actions";
import {
  compareScenarioRows,
  simulateCarPurchase,
  simulateCashflowDelta,
  simulateEmergencyFund,
  simulateExpenseReduction,
  simulateExtraLoanAmortization,
  simulateMonthlySavings,
  simulateOneOffExpense,
  SIMULATION_SAVINGS_HORIZONS,
} from "@/lib/finance/financial-simulator";
import { formatEUR } from "@/lib/finance/money";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";

type Props = {
  baseline: SimulationBaseline;
};

type SimulatorId =
  | "savings"
  | "emergency"
  | "car"
  | "loan"
  | "income"
  | "expense"
  | "oneoff"
  | "compare";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-rose-600">{message}</p>;
}

export function FinancialSimulationsPanel({ baseline }: Props) {
  const [simulator, setSimulator] = useState<SimulatorId>("savings");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [savingsInitial, setSavingsInitial] = useState(baseline.savingsBalance);
  const [savingsMonthly, setSavingsMonthly] = useState("200");
  const [savingsMonths, setSavingsMonths] = useState(24);
  const [savingsRate, setSavingsRate] = useState("0");

  const [emergencyCurrent, setEmergencyCurrent] = useState(baseline.savingsBalance);
  const [emergencyEssential, setEmergencyEssential] = useState(baseline.monthlyEssential);
  const [emergencyTargetMonths, setEmergencyTargetMonths] = useState(
    String(baseline.emergencyTargetMonths),
  );
  const [emergencyContribution, setEmergencyContribution] = useState("300");

  const [carPrice, setCarPrice] = useState("20000");
  const [carDown, setCarDown] = useState("5000");
  const [carFinanced, setCarFinanced] = useState("15000");
  const [carTerm, setCarTerm] = useState("60");
  const [carRate, setCarRate] = useState("");
  const [carInsurance, setCarInsurance] = useState("");
  const [carMaint, setCarMaint] = useState("");
  const [carFuel, setCarFuel] = useState("");

  const firstLiability = baseline.liabilities[0];
  const [loanId, setLoanId] = useState(firstLiability?.id ?? "");
  const [loanExtra, setLoanExtra] = useState("5000");
  const [loanTerm, setLoanTerm] = useState("240");
  const [loanRate, setLoanRate] = useState(firstLiability?.manualRatePercent ?? "");
  const [loanPayment, setLoanPayment] = useState(firstLiability?.monthlyPayment ?? "");
  const [loanFee, setLoanFee] = useState("0");
  const [loanPolicy, setLoanPolicy] = useState<"REDUCE_TERM" | "REDUCE_PAYMENT">(
    "REDUCE_TERM",
  );

  const [incomeDelta, setIncomeDelta] = useState("200");
  const [expenseDelta, setExpenseDelta] = useState("0");
  const [cashflowMonths, setCashflowMonths] = useState(12);

  const [expenseBase, setExpenseBase] = useState(baseline.monthlyExpenseObserved);
  const [expenseReductionPct, setExpenseReductionPct] = useState("10");

  const [oneOffAmount, setOneOffAmount] = useState("2000");
  const [oneOffMonth, setOneOffMonth] = useState("1");
  const [oneOffDate, setOneOffDate] = useState(baseline.asOfInstant.slice(0, 10));
  const [treasurySim, setTreasurySim] = useState<{
    minBase: string | null;
    minAdj: string | null;
    projectedBase: string;
    projectedAdj: string;
  } | null>(null);

  const selectedLiability = baseline.liabilities.find((l) => l.id === loanId);

  const savingsResult = useMemo(() => {
    try {
      return simulateMonthlySavings({
        initialBalance: savingsInitial,
        monthlyContribution: savingsMonthly,
        horizonMonths: savingsMonths,
        annualRatePercent: savingsRate || "0",
      });
    } catch {
      return null;
    }
  }, [savingsInitial, savingsMonthly, savingsMonths, savingsRate]);

  const emergencyResult = useMemo(() => {
    try {
      return simulateEmergencyFund({
        currentReserve: emergencyCurrent,
        monthlyEssentialExpenses: emergencyEssential,
        targetMonths: Number(emergencyTargetMonths) || 6,
        monthlyContribution: emergencyContribution,
      });
    } catch {
      return null;
    }
  }, [emergencyContribution, emergencyCurrent, emergencyEssential, emergencyTargetMonths]);

  const carResult = useMemo(() => {
    try {
      if (!carRate.trim()) return { error: "Indique a taxa anual (%) como pressuposto." as const };
      return {
        data: simulateCarPurchase({
          price: carPrice,
          downPayment: carDown,
          financedPrincipal: carFinanced,
          termMonths: Number(carTerm) || 60,
          annualInterestRatePercent: carRate,
          monthlyInsurance: carInsurance || undefined,
          monthlyMaintenance: carMaint || undefined,
          monthlyFuel: carFuel || undefined,
        }),
      };
    } catch {
      return { error: "Valores inválidos." as const };
    }
  }, [carDown, carFinanced, carFuel, carInsurance, carMaint, carPrice, carRate, carTerm]);

  const loanResult = useMemo(() => {
    try {
      if (!selectedLiability) {
        return { error: "Selecione um passivo ou registe um em Património." as const };
      }
      if (!loanRate.trim() || !loanPayment.trim()) {
        return {
          error:
            "Taxa anual e prestação mensual são necessárias (dados contratuais)." as const,
        };
      }
      return {
        data: simulateExtraLoanAmortization({
          outstandingPrincipal: selectedLiability.outstandingBalance,
          annualInterestRatePercent: loanRate,
          remainingTermMonths: Number(loanTerm) || 120,
          currentMonthlyPayment: loanPayment,
          extraPrincipalPayment: loanExtra,
          extraPaymentFee: loanFee,
          policy: loanPolicy,
        }),
      };
    } catch {
      return { error: "Parâmetros de empréstimo inválidos." as const };
    }
  }, [loanExtra, loanFee, loanPayment, loanPolicy, loanRate, loanTerm, selectedLiability]);

  const baseCashflow = useMemo(
    () =>
      simulateCashflowDelta({
        startingBalance: baseline.aggregateBalance,
        baseMonthlyIncome: baseline.monthlyIncomeObserved,
        baseMonthlyExpense: baseline.monthlyExpenseObserved,
        incomeDelta: "0",
        expenseDelta: "0",
        months: cashflowMonths,
      }),
    [baseline, cashflowMonths],
  );

  const scenarioA = useMemo(
    () =>
      simulateCashflowDelta({
        startingBalance: baseline.aggregateBalance,
        baseMonthlyIncome: baseline.monthlyIncomeObserved,
        baseMonthlyExpense: baseline.monthlyExpenseObserved,
        incomeDelta,
        expenseDelta,
        months: cashflowMonths,
      }),
    [baseline, cashflowMonths, expenseDelta, incomeDelta],
  );

  const scenarioB = useMemo(() => {
    try {
      const red = simulateExpenseReduction({
        currentMonthlyExpense: expenseBase,
        reductionPercent: Number(expenseReductionPct) || 0,
      });
      return simulateCashflowDelta({
        startingBalance: baseline.aggregateBalance,
        baseMonthlyIncome: baseline.monthlyIncomeObserved,
        baseMonthlyExpense: baseline.monthlyExpenseObserved,
        incomeDelta: "0",
        expenseDelta: `-${red.monthlySavings}`,
        months: cashflowMonths,
      });
    } catch {
      return null;
    }
  }, [baseline, cashflowMonths, expenseBase, expenseReductionPct]);

  const comparison = useMemo(() => {
    if (!scenarioB) return null;
    return compareScenarioRows([
      {
        label: "BASE",
        finalBalance: baseCashflow.finalBalance,
        minBalance: baseCashflow.minBalance,
        monthlyNet: baseCashflow.monthlyNet,
      },
      {
        label: "Cenário A",
        finalBalance: scenarioA.finalBalance,
        minBalance: scenarioA.minBalance,
        monthlyNet: scenarioA.monthlyNet,
      },
      {
        label: "Cenário B",
        finalBalance: scenarioB.finalBalance,
        minBalance: scenarioB.minBalance,
        monthlyNet: scenarioB.monthlyNet,
      },
    ]);
  }, [baseCashflow, scenarioA, scenarioB]);

  const oneOffLocal = useMemo(() => {
    try {
      return simulateOneOffExpense({
        startingBalance: baseline.aggregateBalance,
        expenseAmount: oneOffAmount,
        atMonthIndex: Number(oneOffMonth) || 1,
        horizonMonths: cashflowMonths,
      });
    } catch {
      return null;
    }
  }, [baseline.aggregateBalance, cashflowMonths, oneOffAmount, oneOffMonth]);

  const resetSavings = () => {
    setSavingsInitial(baseline.savingsBalance);
    setSavingsMonthly("200");
    setSavingsMonths(24);
    setSavingsRate("0");
  };

  const runTreasuryOneOff = () => {
    startTransition(async () => {
      setError(null);
      const res = await simulateTreasuryOneOffAction({
        amount: oneOffAmount,
        dueDateIso: oneOffDate,
      });
      if (!res.ok) {
        setError("Não foi possível simular na tesouraria conhecida.");
        setTreasurySim(null);
        return;
      }
      setTreasurySim({
        minBase: res.minProjectedBase,
        minAdj: res.minProjectedAdjusted,
        projectedBase: res.projectedBalanceBase,
        projectedAdj: res.projectedBalanceAdjusted,
      });
    });
  };

  return (
    <div className="space-y-8" data-testid="financial-simulations-page">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Cenário BASE (dados autorizados)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{baseline.disclaimer}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Saldo agregado (real)</dt>
            <dd className="font-medium" data-testid="sim-baseline-balance">
              {formatEUR(baseline.aggregateBalance)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Receitas mês observado</dt>
            <dd data-testid="sim-baseline-income">{formatEUR(baseline.monthlyIncomeObserved)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Despesas mês observado</dt>
            <dd data-testid="sim-baseline-expense">
              {formatEUR(baseline.monthlyExpenseObserved)}
            </dd>
          </div>
          {baseline.treasury ? (
            <>
              <div>
                <dt className="text-zinc-500">Tesouraria — eventos conhecidos (30d)</dt>
                <dd>{baseline.treasury.knownEventCount}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Saldo mín. projetado (30d)</dt>
                <dd data-testid="sim-treasury-min-base">
                  {baseline.treasury.minProjectedBalance30 != null
                    ? formatEUR(baseline.treasury.minProjectedBalance30)
                    : "—"}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Simuladores">
        {(
          [
            ["savings", "Poupança"],
            ["emergency", "Fundo emergência"],
            ["car", "Automóvel"],
            ["loan", "Amortização"],
            ["income", "Rendimentos"],
            ["expense", "Despesas"],
            ["oneoff", "Extraordinária"],
            ["compare", "Comparar A/B"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={simulator === id}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              simulator === id
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            onClick={() => setSimulator(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <FieldError message={error} />

      {simulator === "savings" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Poupança mensal</h3>
          <p className="text-xs text-zinc-500">
            Fórmula: saldo inicial + contribuições; juros mensais r = taxaAnual/12/100 (fim de mês).
          </p>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Saldo inicial (€)
              <input
                className={inputClassName}
                value={savingsInitial}
                onChange={(e) => setSavingsInitial(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Contribuição mensal (€)
              <input
                className={inputClassName}
                value={savingsMonthly}
                onChange={(e) => setSavingsMonthly(e.target.value)}
                data-testid="sim-savings-monthly"
              />
            </label>
            <label className={labelClassName}>
              Horizonte (meses)
              <select
                className={inputClassName}
                value={savingsMonths}
                onChange={(e) => setSavingsMonths(Number(e.target.value))}
              >
                {SIMULATION_SAVINGS_HORIZONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Taxa anual (%)
              <input
                className={inputClassName}
                value={savingsRate}
                onChange={(e) => setSavingsRate(e.target.value)}
              />
            </label>
            <button type="button" className={secondaryButtonClassName} onClick={resetSavings}>
              Repor valores
            </button>
          </div>
          {savingsResult ? (
            <p className="mt-4 text-sm">
              Saldo final simulado:{" "}
              <strong data-testid="sim-savings-final">{formatEUR(savingsResult.finalBalance)}</strong>
              {" · "}
              Juros simulados: {formatEUR(savingsResult.simulatedInterest)}
            </p>
          ) : (
            <p className="mt-4 text-sm text-rose-600">Verifique os montantes.</p>
          )}
        </section>
      ) : null}

      {simulator === "emergency" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Fundo de emergência</h3>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Reserva atual (€)
              <input
                className={inputClassName}
                value={emergencyCurrent}
                onChange={(e) => setEmergencyCurrent(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Despesas essenciais/mês (€)
              <input
                className={inputClassName}
                value={emergencyEssential}
                onChange={(e) => setEmergencyEssential(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Meses de cobertura
              <input
                className={inputClassName}
                value={emergencyTargetMonths}
                onChange={(e) => setEmergencyTargetMonths(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Poupança mensal (€)
              <input
                className={inputClassName}
                value={emergencyContribution}
                onChange={(e) => setEmergencyContribution(e.target.value)}
                data-testid="sim-emergency-contribution"
              />
            </label>
          </div>
          {emergencyResult ? (
            <p className="mt-4 text-sm" data-testid="sim-emergency-result">
              Objetivo {formatEUR(emergencyResult.targetAmount)} · Falta{" "}
              {formatEUR(emergencyResult.gap)} · Tempo estimado:{" "}
              {emergencyResult.monthsToTarget != null
                ? `${emergencyResult.monthsToTarget} meses`
                : "— (aumente a contribuição)"}
            </p>
          ) : null}
        </section>
      ) : null}

      {simulator === "car" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Compra de automóvel</h3>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Preço (€)
              <input className={inputClassName} value={carPrice} onChange={(e) => setCarPrice(e.target.value)} />
            </label>
            <label className={labelClassName}>
              Entrada (€)
              <input className={inputClassName} value={carDown} onChange={(e) => setCarDown(e.target.value)} />
            </label>
            <label className={labelClassName}>
              Financiado (€)
              <input
                className={inputClassName}
                value={carFinanced}
                onChange={(e) => setCarFinanced(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Prazo (meses)
              <input className={inputClassName} value={carTerm} onChange={(e) => setCarTerm(e.target.value)} />
            </label>
            <label className={labelClassName}>
              Taxa anual (%) — pressuposto obrigatório
              <input
                className={inputClassName}
                value={carRate}
                onChange={(e) => setCarRate(e.target.value)}
                data-testid="sim-car-rate"
                placeholder="ex.: 5.5"
              />
            </label>
            <label className={labelClassName}>
              Seguro/mês (€)
              <input
                className={inputClassName}
                value={carInsurance}
                onChange={(e) => setCarInsurance(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Manutenção/mês (€)
              <input className={inputClassName} value={carMaint} onChange={(e) => setCarMaint(e.target.value)} />
            </label>
            <label className={labelClassName}>
              Combustível/mês (€)
              <input className={inputClassName} value={carFuel} onChange={(e) => setCarFuel(e.target.value)} />
            </label>
          </div>
          {"error" in carResult && carResult.error ? (
            <p className="mt-4 text-sm text-amber-700">{carResult.error}</p>
          ) : carResult.data ? (
            <div className="mt-4 text-sm" data-testid="sim-car-result">
              <p>Prestação: {formatEUR(carResult.data.estimatedMonthlyPayment)}</p>
              <p>Caixa inicial: {formatEUR(carResult.data.cashNeededAtPurchase)}</p>
              <p>Custo mensal (tudo): {formatEUR(carResult.data.monthlyAllInEstimate)}</p>
              {carResult.data.limitations.map((l) => (
                <p key={l} className="text-xs text-zinc-500">
                  {l}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {simulator === "loan" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Amortização extraordinária</h3>
          {baseline.liabilities.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">
              Sem passivos registados. Use Património para criar um empréstimo ou introduza valores
              manualmente num simulador genérico via taxa e prestação.
            </p>
          ) : (
            <>
              <label className={`${labelClassName} mt-3 block max-w-lg`}>
                Passivo
                <select
                  className={inputClassName}
                  value={loanId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLoanId(id);
                    const row = baseline.liabilities.find((l) => l.id === id);
                    if (row) {
                      setLoanPayment(row.monthlyPayment ?? "");
                      setLoanRate(row.manualRatePercent ?? "");
                    }
                  }}
                  data-testid="sim-loan-select"
                >
                  {baseline.liabilities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} ({formatEUR(l.outstandingBalance)})
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 grid max-w-lg gap-3">
                <label className={labelClassName}>
                  Amortização extra (€)
                  <input
                    className={inputClassName}
                    value={loanExtra}
                    onChange={(e) => setLoanExtra(e.target.value)}
                  />
                </label>
                <label className={labelClassName}>
                  Taxa anual (%) — contrato
                  <input
                    className={inputClassName}
                    value={loanRate}
                    onChange={(e) => setLoanRate(e.target.value)}
                    data-testid="sim-loan-rate"
                  />
                </label>
                <label className={labelClassName}>
                  Prestação atual (€)
                  <input
                    className={inputClassName}
                    value={loanPayment}
                    onChange={(e) => setLoanPayment(e.target.value)}
                  />
                </label>
                <label className={labelClassName}>
                  Prazo remanescente (meses)
                  <input
                    className={inputClassName}
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                  />
                </label>
                <label className={labelClassName}>
                  Comissão amortização (€)
                  <input className={inputClassName} value={loanFee} onChange={(e) => setLoanFee(e.target.value)} />
                </label>
                <label className={labelClassName}>
                  Política simulada
                  <select
                    className={inputClassName}
                    value={loanPolicy}
                    onChange={(e) =>
                      setLoanPolicy(e.target.value as "REDUCE_TERM" | "REDUCE_PAYMENT")
                    }
                  >
                    <option value="REDUCE_TERM">Reduzir prazo</option>
                    <option value="REDUCE_PAYMENT">Reduzir prestação</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {"error" in loanResult && loanResult.error ? (
            <p className="mt-4 text-sm text-amber-700">{loanResult.error}</p>
          ) : loanResult.data ? (
            <div className="mt-4 text-sm" data-testid="sim-loan-result">
              <p>Juros poupança estimada: {formatEUR(loanResult.data.interestSaved)}</p>
              <p>Impacto liquidez imediata: {formatEUR(loanResult.data.liquidityImpactNow)}</p>
              {loanResult.data.newTermMonths != null ? (
                <p>Novo prazo estimado: {loanResult.data.newTermMonths} meses</p>
              ) : null}
              {loanResult.data.newMonthlyPayment ? (
                <p>Nova prestação: {formatEUR(loanResult.data.newMonthlyPayment)}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {simulator === "income" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Variação de rendimentos (Cenário A)</h3>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Δ receitas/mês (€)
              <input
                className={inputClassName}
                value={incomeDelta}
                onChange={(e) => setIncomeDelta(e.target.value)}
                data-testid="sim-income-delta"
              />
            </label>
            <label className={labelClassName}>
              Δ despesas/mês (€)
              <input
                className={inputClassName}
                value={expenseDelta}
                onChange={(e) => setExpenseDelta(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Horizonte (meses)
              <input
                className={inputClassName}
                value={cashflowMonths}
                onChange={(e) => setCashflowMonths(Number(e.target.value) || 12)}
              />
            </label>
          </div>
          <p className="mt-4 text-sm" data-testid="sim-income-result">
            Resultado líquido/mês: {formatEUR(scenarioA.monthlyNet)} · Saldo final:{" "}
            {formatEUR(scenarioA.finalBalance)} · Mínimo: {formatEUR(scenarioA.minBalance)}
          </p>
        </section>
      ) : null}

      {simulator === "expense" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Redução de despesas (Cenário B)</h3>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Despesa mensal de referência (€)
              <input
                className={inputClassName}
                value={expenseBase}
                onChange={(e) => setExpenseBase(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Redução (%)
              <input
                className={inputClassName}
                value={expenseReductionPct}
                onChange={(e) => setExpenseReductionPct(e.target.value)}
                data-testid="sim-expense-reduction"
              />
            </label>
          </div>
          {scenarioB ? (
            <p className="mt-4 text-sm" data-testid="sim-expense-result">
              Poupança mensal simulada:{" "}
              {formatEUR(
                simulateExpenseReduction({
                  currentMonthlyExpense: expenseBase,
                  reductionPercent: Number(expenseReductionPct) || 0,
                }).monthlySavings,
              )}{" "}
              · Saldo final: {formatEUR(scenarioB.finalBalance)}
            </p>
          ) : null}
        </section>
      ) : null}

      {simulator === "oneoff" ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800">
          <h3 className="font-medium">Despesa extraordinária</h3>
          <div className="mt-4 grid max-w-lg gap-3">
            <label className={labelClassName}>
              Valor (€)
              <input
                className={inputClassName}
                value={oneOffAmount}
                onChange={(e) => setOneOffAmount(e.target.value)}
                data-testid="sim-oneoff-amount"
              />
            </label>
            <label className={labelClassName}>
              Mês relativo (saldo agregado)
              <input
                className={inputClassName}
                value={oneOffMonth}
                onChange={(e) => setOneOffMonth(e.target.value)}
              />
            </label>
            <label className={labelClassName}>
              Data na tesouraria (ISO)
              <input
                className={inputClassName}
                type="date"
                value={oneOffDate}
                onChange={(e) => setOneOffDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={pending}
              onClick={runTreasuryOneOff}
              data-testid="sim-oneoff-treasury-run"
            >
              Simular na tesouraria conhecida
            </button>
          </div>
          {oneOffLocal ? (
            <p className="mt-4 text-sm">
              Saldo agregado antes/depois: {formatEUR(oneOffLocal.balanceBefore)} →{" "}
              {formatEUR(oneOffLocal.balanceAfter)}
            </p>
          ) : null}
          {treasurySim ? (
            <p className="mt-2 text-sm" data-testid="sim-oneoff-treasury-result">
              Projeção 30d — mín. BASE {formatEUR(treasurySim.minBase ?? "0")} → com despesa{" "}
              {formatEUR(treasurySim.minAdj ?? "0")}
            </p>
          ) : null}
        </section>
      ) : null}

      {simulator === "compare" && comparison ? (
        <section className="rounded-xl border p-4 dark:border-zinc-800" data-testid="sim-compare">
          <h3 className="font-medium">Comparação BASE / A / B</h3>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-1">Cenário</th>
                <th>Saldo final</th>
                <th>Saldo mín.</th>
                <th>Δ final vs BASE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{comparison.baseline?.label}</td>
                <td>{formatEUR(comparison.baseline?.finalBalance ?? "0")}</td>
                <td>{formatEUR(comparison.baseline?.minBalance ?? "0")}</td>
                <td>—</td>
              </tr>
              {comparison.deltas.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td colSpan={2} />
                  <td>{formatEUR(d.finalDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">
            A: alteração manual de rendimentos/despesas. B: redução percentual simulada.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-zinc-500">
        Simulação hipotética · sem escrita na base de dados · não altera transações, passivos ou
        objetivos reais.
      </p>
    </div>
  );
}
