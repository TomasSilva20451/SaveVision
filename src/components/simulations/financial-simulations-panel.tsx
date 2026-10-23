"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { decimal, formatEUR } from "@/lib/finance/money";
import {
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/ui/form-styles";

type Props = { baseline: SimulationBaseline };
type SimulatorId = "savings" | "emergency" | "car" | "loan" | "cashflow" | "oneoff";
type IconKind = "target" | "shield" | "car" | "debt" | "chart" | "sliders" | "calendar" | "wallet" | "trend";

const SIMULATORS: ReadonlyArray<{
  id: SimulatorId;
  label: string;
  description: string;
  icon: IconKind;
  tone: string;
}> = [
  { id: "savings", label: "Poupança e objetivos", description: "Projetar capital e contribuições.", icon: "target", tone: "text-blue-600 bg-blue-50" },
  { id: "emergency", label: "Fundo de emergência", description: "Calcular cobertura e prazo.", icon: "shield", tone: "text-emerald-600 bg-emerald-50" },
  { id: "car", label: "Automóvel", description: "Estimar financiamento e custos.", icon: "car", tone: "text-orange-600 bg-orange-50" },
  { id: "loan", label: "Amortizar dívida", description: "Comparar prazo ou prestação.", icon: "debt", tone: "text-rose-600 bg-rose-50" },
  { id: "cashflow", label: "Rendimentos e despesas", description: "Testar alterações mensais.", icon: "chart", tone: "text-violet-600 bg-violet-50" },
  { id: "oneoff", label: "Cenário personalizado", description: "Sobrepor uma despesa ao forecast.", icon: "sliders", tone: "text-fuchsia-600 bg-fuchsia-50" },
];

function SimulationIcon({ kind, className = "h-5 w-5" }: { kind: IconKind; className?: string }) {
  const paths: Record<IconKind, ReactNode> = {
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m14.5 9.5 5-5M16 4.5h3.5V8"/></>,
    shield: <path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Zm-3 9 2 2 4-4"/>,
    car: <><path d="m5 10 1.5-4h11L19 10M4 10h16v7H4z"/><path d="M7 17v2m10-2v2M7 13h.01M17 13h.01"/></>,
    debt: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    chart: <><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></>,
    sliders: <><path d="M4 6h7m4 0h5M4 12h3m4 0h9M4 18h9m4 0h3"/><circle cx="13" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z"/></>,
    trend: <><path d="m4 16 5-5 4 4 7-8"/><path d="M15 7h5v5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[kind]}</svg>;
}

function Card({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={`min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] ${className}`}>{children}</section>;
}

function ResultMetric({ icon, label, value, tone }: { icon: IconKind; label: string; value: string; tone: string }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] p-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}><SimulationIcon kind={icon} className="h-4 w-4"/></span><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="text-base font-semibold tabular-nums">{value}</p></div></div>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">{children}</p>;
}

export function FinancialSimulationsPanel({ baseline }: Props) {
  const [simulator, setSimulator] = useState<SimulatorId>("savings");
  const [pending, startTransition] = useTransition();
  const [treasuryError, setTreasuryError] = useState<string | null>(null);
  const [savingsInitial, setSavingsInitial] = useState(baseline.savingsBalance);
  const [savingsMonthly, setSavingsMonthly] = useState("200");
  const [savingsMonths, setSavingsMonths] = useState(24);
  const [savingsRate, setSavingsRate] = useState("0");
  const [emergencyCurrent, setEmergencyCurrent] = useState(baseline.savingsBalance);
  const [emergencyEssential, setEmergencyEssential] = useState(baseline.monthlyEssential);
  const [emergencyTargetMonths, setEmergencyTargetMonths] = useState(String(baseline.emergencyTargetMonths));
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
  const [loanPolicy, setLoanPolicy] = useState<"REDUCE_TERM" | "REDUCE_PAYMENT">("REDUCE_TERM");
  const [incomeDelta, setIncomeDelta] = useState("200");
  const [expenseDelta, setExpenseDelta] = useState("0");
  const [cashflowMonths, setCashflowMonths] = useState(12);
  const [expenseBase, setExpenseBase] = useState(baseline.monthlyExpenseObserved);
  const [expenseReductionPct, setExpenseReductionPct] = useState("10");
  const [oneOffAmount, setOneOffAmount] = useState("2000");
  const [oneOffMonth, setOneOffMonth] = useState("1");
  const [oneOffDate, setOneOffDate] = useState(baseline.asOfInstant.slice(0, 10));
  const [treasurySim, setTreasurySim] = useState<{ minBase: string | null; minAdj: string | null; projectedBase: string; projectedAdj: string } | null>(null);

  const selectedLiability = baseline.liabilities.find((row) => row.id === loanId);
  const savingsResult = useMemo(() => { try { return simulateMonthlySavings({ initialBalance: savingsInitial, monthlyContribution: savingsMonthly, horizonMonths: savingsMonths, annualRatePercent: savingsRate || "0" }); } catch { return null; } }, [savingsInitial, savingsMonthly, savingsMonths, savingsRate]);
  const emergencyResult = useMemo(() => { try { return simulateEmergencyFund({ currentReserve: emergencyCurrent, monthlyEssentialExpenses: emergencyEssential, targetMonths: Number(emergencyTargetMonths), monthlyContribution: emergencyContribution }); } catch { return null; } }, [emergencyContribution, emergencyCurrent, emergencyEssential, emergencyTargetMonths]);
  const carResult = useMemo(() => { try { if (!carRate.trim()) return { error: "Indique a taxa anual (%) como pressuposto." as const }; return { data: simulateCarPurchase({ price: carPrice, downPayment: carDown, financedPrincipal: carFinanced, termMonths: Number(carTerm), annualInterestRatePercent: carRate, monthlyInsurance: carInsurance || undefined, monthlyMaintenance: carMaint || undefined, monthlyFuel: carFuel || undefined }) }; } catch { return { error: "Confirme os montantes, a taxa e o prazo." as const }; } }, [carDown, carFinanced, carFuel, carInsurance, carMaint, carPrice, carRate, carTerm]);
  const loanResult = useMemo(() => { try { if (!selectedLiability) return { error: "Sem passivos disponíveis neste workspace." as const }; if (!loanRate.trim() || !loanPayment.trim()) return { error: "Indique a taxa contratual e a prestação atual." as const }; return { data: simulateExtraLoanAmortization({ outstandingPrincipal: selectedLiability.outstandingBalance, annualInterestRatePercent: loanRate, remainingTermMonths: Number(loanTerm), currentMonthlyPayment: loanPayment, extraPrincipalPayment: loanExtra, extraPaymentFee: loanFee, policy: loanPolicy }) }; } catch { return { error: "Confirme os parâmetros da amortização." as const }; } }, [loanExtra, loanFee, loanPayment, loanPolicy, loanRate, loanTerm, selectedLiability]);
  const baseCashflow = useMemo(() => simulateCashflowDelta({ startingBalance: baseline.aggregateBalance, baseMonthlyIncome: baseline.monthlyIncomeObserved, baseMonthlyExpense: baseline.monthlyExpenseObserved, incomeDelta: "0", expenseDelta: "0", months: cashflowMonths }), [baseline.aggregateBalance, baseline.monthlyExpenseObserved, baseline.monthlyIncomeObserved, cashflowMonths]);
  const scenarioA = useMemo(() => { try { return simulateCashflowDelta({ startingBalance: baseline.aggregateBalance, baseMonthlyIncome: baseline.monthlyIncomeObserved, baseMonthlyExpense: baseline.monthlyExpenseObserved, incomeDelta, expenseDelta, months: cashflowMonths }); } catch { return null; } }, [baseline.aggregateBalance, baseline.monthlyExpenseObserved, baseline.monthlyIncomeObserved, cashflowMonths, expenseDelta, incomeDelta]);
  const expenseReduction = useMemo(() => { try { return simulateExpenseReduction({ currentMonthlyExpense: expenseBase, reductionPercent: Number(expenseReductionPct) }); } catch { return null; } }, [expenseBase, expenseReductionPct]);
  const scenarioB = useMemo(() => { if (!expenseReduction) return null; try { return simulateCashflowDelta({ startingBalance: baseline.aggregateBalance, baseMonthlyIncome: baseline.monthlyIncomeObserved, baseMonthlyExpense: baseline.monthlyExpenseObserved, incomeDelta: "0", expenseDelta: `-${expenseReduction.monthlySavings}`, months: cashflowMonths }); } catch { return null; } }, [baseline.aggregateBalance, baseline.monthlyExpenseObserved, baseline.monthlyIncomeObserved, cashflowMonths, expenseReduction]);
  const comparison = useMemo(() => scenarioA && scenarioB ? compareScenarioRows([{ label: "BASE", finalBalance: baseCashflow.finalBalance, minBalance: baseCashflow.minBalance, monthlyNet: baseCashflow.monthlyNet }, { label: "Cenário A", finalBalance: scenarioA.finalBalance, minBalance: scenarioA.minBalance, monthlyNet: scenarioA.monthlyNet }, { label: "Cenário B", finalBalance: scenarioB.finalBalance, minBalance: scenarioB.minBalance, monthlyNet: scenarioB.monthlyNet }]) : null, [baseCashflow, scenarioA, scenarioB]);
  const oneOffLocal = useMemo(() => { try { return simulateOneOffExpense({ startingBalance: baseline.aggregateBalance, expenseAmount: oneOffAmount, atMonthIndex: Number(oneOffMonth), horizonMonths: cashflowMonths }); } catch { return null; } }, [baseline.aggregateBalance, cashflowMonths, oneOffAmount, oneOffMonth]);
  const savingsChart = useMemo(() => {
    if (!savingsResult) return [];
    const initial = decimal(savingsInitial || "0");
    const monthly = decimal(savingsMonthly || "0");
    return savingsResult.monthlySeries.map((row) => {
      const contributions = initial.plus(monthly.times(row.monthIndex));
      return { month: row.monthIndex, contributions: Number(contributions.toFixed(2)), return: Number(decimal(row.balance).minus(contributions).toFixed(2)), total: Number(row.balance) };
    });
  }, [savingsInitial, savingsMonthly, savingsResult]);
  const scenarioChart = useMemo(() => baseCashflow.series.map((row, index) => ({ month: row.monthIndex, BASE: Number(row.balance), A: Number(scenarioA?.series[index]?.balance ?? row.balance), B: Number(scenarioB?.series[index]?.balance ?? row.balance) })), [baseCashflow.series, scenarioA, scenarioB]);
  const active = SIMULATORS.find((item) => item.id === simulator) ?? SIMULATORS[0]!;

  function selectSimulator(id: SimulatorId) {
    setSimulator(id);
    setTreasuryError(null);
  }

  function resetSavings() {
    setSavingsInitial(baseline.savingsBalance);
    setSavingsMonthly("200");
    setSavingsMonths(24);
    setSavingsRate("0");
  }

  function runTreasuryOneOff() {
    startTransition(async () => {
      setTreasuryError(null);
      const result = await simulateTreasuryOneOffAction({ amount: oneOffAmount, dueDateIso: oneOffDate });
      if (!result.ok) {
        setTreasuryError("Não foi possível aplicar esta hipótese à tesouraria conhecida.");
        setTreasurySim(null);
        return;
      }
      setTreasurySim({ minBase: result.minProjectedBase, minAdj: result.minProjectedAdjusted, projectedBase: result.projectedBalanceBase, projectedAdj: result.projectedBalanceAdjusted });
    });
  }

  return <div className="space-y-5" data-testid="financial-simulations-page">
    <div className="simulation-tabs grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="tablist" aria-label="Simuladores disponíveis">
      {SIMULATORS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={simulator === item.id} aria-controls="simulation-workbench" onClick={() => selectSimulator(item.id)} className={`simulation-tab flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${simulator === item.id ? "simulation-tab-active border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-200"}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.tone}`}><SimulationIcon kind={item.icon}/></span><span className="leading-tight">{item.label}</span></button>)}
    </div>

    <div id="simulation-workbench" className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(280px,0.92fr)_minmax(390px,1.25fr)_minmax(300px,0.9fr)]">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Simulação</p>
        <h2 className="mt-1 text-lg font-semibold">{active.label}</h2>
        <p className="mt-1 text-sm text-slate-500">{active.description} Os resultados são recalculados ao editar.</p>
        <div className="mt-5">{renderForm()}</div>
      </Card>
      <Card><h2 className="text-lg font-semibold">Resultado da simulação</h2><div className="mt-4">{renderResult()}</div></Card>
      <Card testId="sim-compare" className="xl:sticky xl:top-5">
        <h2 className="text-lg font-semibold">Comparar cenários</h2>
        <p className="mt-1 text-sm text-slate-500">BASE usa dados observados. A altera cashflow; B reduz despesas.</p>
        {scenarioA && scenarioB && comparison ? <>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-[var(--border)] text-left text-slate-500"><th className="pb-2">Cenário</th><th className="pb-2 text-right">Líquido/mês</th><th className="pb-2 text-right">Final</th></tr></thead><tbody className="divide-y divide-[var(--border)]">{[{ label: "BASE", row: baseCashflow }, { label: "A", row: scenarioA }, { label: "B", row: scenarioB }].map(({ label, row }) => <tr key={label} className={label === "BASE" ? "bg-blue-50/70" : ""}><td className="py-3 font-semibold">{label}</td><td className="whitespace-nowrap py-3 text-right tabular-nums">{formatEUR(row.monthlyNet)}</td><td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums">{formatEUR(row.finalBalance)}</td></tr>)}</tbody></table></div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">Δ A vs BASE</dt><dd className="mt-1 font-semibold">{formatEUR(comparison.deltas[0]?.finalDelta ?? "0")}</dd></div><div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">Δ B vs BASE</dt><dd className="mt-1 font-semibold">{formatEUR(comparison.deltas[1]?.finalDelta ?? "0")}</dd></div></dl>
          <button type="button" className={`${secondaryButtonClassName} mt-4 w-full`} onClick={() => { setIncomeDelta("200"); setExpenseDelta("0"); setExpenseBase(baseline.monthlyExpenseObserved); setExpenseReductionPct("10"); setCashflowMonths(12); }}>Repor comparação</button>
        </> : <Notice>Revê os parâmetros dos cenários A e B.</Notice>}
      </Card>
    </div>

    <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-3">
      <Card><h2 className="text-lg font-semibold">Outras simulações</h2><div className="mt-3 divide-y divide-[var(--border)]">{SIMULATORS.filter((item) => item.id !== simulator).slice(0, 4).map((item) => <button key={item.id} type="button" onClick={() => selectSimulator(item.id)} className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${item.tone}`}><SimulationIcon kind={item.icon}/></span><span className="min-w-0 flex-1"><strong className="block text-sm">{item.label}</strong><span className="block truncate text-xs text-slate-500">{item.description}</span></span><span aria-hidden="true" className="text-blue-600">›</span></button>)}</div></Card>
      <Card><h2 className="text-lg font-semibold">Simulação rápida: Fundo de emergência</h2><p className="mt-1 text-sm text-slate-500">Usa o mesmo motor da simulação principal.</p>{emergencyResult ? <div className="mt-4"><ResultMetric icon="shield" label="Montante necessário" value={formatEUR(emergencyResult.targetAmount)} tone="bg-orange-50 text-orange-600"/><p className="mt-4 text-sm">Com <strong>{formatEUR(emergencyContribution)}/mês</strong>, o prazo estimado é <strong>{emergencyResult.monthsToTarget == null ? "indeterminado" : `${emergencyResult.monthsToTarget} meses`}</strong>.</p><button type="button" className={`${primaryButtonClassName} mt-4 w-full`} onClick={() => selectSimulator("emergency")}>Ajustar pressupostos</button></div> : <Notice>Indica valores válidos para calcular a cobertura.</Notice>}</Card>
      <Card><h2 className="text-lg font-semibold">Impacto dos diferentes cenários</h2><p className="mt-1 text-sm text-slate-500">Saldo projetado a partir dos mesmos dados BASE.</p><ScenarioChart data={scenarioChart}/></Card>
    </div>

    <Card className="!p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Cenário BASE autorizado · {baseline.asOfCivil}</p><p className="mt-1 text-xs text-slate-500">{baseline.disclaimer}</p></div><dl className="flex flex-wrap gap-4 text-xs"><div><dt className="text-slate-500">Saldo real agregado</dt><dd className="font-semibold" data-testid="sim-baseline-balance">{formatEUR(baseline.aggregateBalance)}</dd></div><div><dt className="text-slate-500">Receitas observadas</dt><dd className="font-semibold" data-testid="sim-baseline-income">{formatEUR(baseline.monthlyIncomeObserved)}</dd></div><div><dt className="text-slate-500">Despesas observadas</dt><dd className="font-semibold" data-testid="sim-baseline-expense">{formatEUR(baseline.monthlyExpenseObserved)}</dd></div></dl></div><p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-slate-500">Ferramenta hipotética e read-only: não cria transações, pagamentos, investimentos nem alterações aos passivos.</p></Card>
  </div>;

  function renderForm() {
    if (simulator === "savings") return <div className="grid gap-4"><MoneyField label="Capital inicial" value={savingsInitial} onChange={setSavingsInitial}/><MoneyField label="Poupança mensal" value={savingsMonthly} onChange={setSavingsMonthly} testId="sim-savings-monthly"/><label className={labelClassName}>Prazo<select className={inputClassName} value={savingsMonths} onChange={(event) => setSavingsMonths(Number(event.target.value))}>{SIMULATION_SAVINGS_HORIZONS.map((month) => <option key={month} value={month}>{month} meses</option>)}</select></label><NumberField label="Rentabilidade anual assumida" value={savingsRate} onChange={setSavingsRate} suffix="% ao ano" max={100}/><p className="text-xs text-slate-500">Capitalização mensal; contribuições no fim do mês. Rentabilidade não garantida.</p><button type="button" className={secondaryButtonClassName} onClick={resetSavings}>Repor valores</button></div>;
    if (simulator === "emergency") return <div className="grid gap-4"><MoneyField label="Reserva atual" value={emergencyCurrent} onChange={setEmergencyCurrent}/><MoneyField label="Despesas essenciais mensais" value={emergencyEssential} onChange={setEmergencyEssential}/><NumberField label="Meses de cobertura" value={emergencyTargetMonths} onChange={setEmergencyTargetMonths} suffix="meses" min={1} max={36}/><MoneyField label="Poupança mensal" value={emergencyContribution} onChange={setEmergencyContribution} testId="sim-emergency-contribution"/></div>;
    if (simulator === "car") return <div className="grid gap-4"><MoneyField label="Preço" value={carPrice} onChange={setCarPrice}/><MoneyField label="Entrada" value={carDown} onChange={setCarDown}/><MoneyField label="Montante financiado" value={carFinanced} onChange={setCarFinanced}/><NumberField label="Prazo" value={carTerm} onChange={setCarTerm} suffix="meses" min={1} max={120}/><NumberField label="Taxa anual assumida" value={carRate} onChange={setCarRate} suffix="% ao ano" max={100} testId="sim-car-rate"/><details className="rounded-xl border border-[var(--border)] p-3"><summary className="cursor-pointer text-sm font-medium">Custos mensais opcionais</summary><div className="mt-3 grid gap-3"><MoneyField label="Seguro" value={carInsurance} onChange={setCarInsurance}/><MoneyField label="Manutenção" value={carMaint} onChange={setCarMaint}/><MoneyField label="Combustível" value={carFuel} onChange={setCarFuel}/></div></details></div>;
    if (simulator === "loan") return baseline.liabilities.length === 0 ? <Notice>Sem passivos registados neste workspace. Regista primeiro o contrato em Património.</Notice> : <div className="grid gap-4"><label className={labelClassName}>Passivo<select className={inputClassName} value={loanId} data-testid="sim-loan-select" onChange={(event) => { const id = event.target.value; setLoanId(id); const row = baseline.liabilities.find((item) => item.id === id); if (row) { setLoanPayment(row.monthlyPayment ?? ""); setLoanRate(row.manualRatePercent ?? ""); } }}>{baseline.liabilities.map((row) => <option key={row.id} value={row.id}>{row.title} · {formatEUR(row.outstandingBalance)}</option>)}</select></label><MoneyField label="Amortização extraordinária" value={loanExtra} onChange={setLoanExtra}/><NumberField label="Taxa anual contratual" value={loanRate} onChange={setLoanRate} suffix="% ao ano" max={100} testId="sim-loan-rate"/><MoneyField label="Prestação atual" value={loanPayment} onChange={setLoanPayment}/><NumberField label="Prazo remanescente" value={loanTerm} onChange={setLoanTerm} suffix="meses" min={1} max={600}/><MoneyField label="Comissão" value={loanFee} onChange={setLoanFee}/><label className={labelClassName}>Política simulada<select className={inputClassName} value={loanPolicy} onChange={(event) => setLoanPolicy(event.target.value as "REDUCE_TERM" | "REDUCE_PAYMENT")}><option value="REDUCE_TERM">Reduzir prazo</option><option value="REDUCE_PAYMENT">Reduzir prestação</option></select></label></div>;
    if (simulator === "cashflow") return <div className="grid gap-4"><MoneyField label="Alteração de receitas/mês" value={incomeDelta} onChange={setIncomeDelta} allowNegative testId="sim-income-delta"/><MoneyField label="Alteração de despesas/mês" value={expenseDelta} onChange={setExpenseDelta} allowNegative/><NumberField label="Horizonte" value={String(cashflowMonths)} onChange={(value) => setCashflowMonths(Number(value) || 1)} suffix="meses" min={1} max={120}/><hr className="border-[var(--border)]"/><MoneyField label="Despesa de referência do cenário B" value={expenseBase} onChange={setExpenseBase}/><NumberField label="Redução de despesas do cenário B" value={expenseReductionPct} onChange={setExpenseReductionPct} suffix="%" max={100} testId="sim-expense-reduction"/></div>;
    return <div className="grid gap-4"><MoneyField label="Despesa extraordinária" value={oneOffAmount} onChange={setOneOffAmount} testId="sim-oneoff-amount"/><NumberField label="Mês relativo" value={oneOffMonth} onChange={setOneOffMonth} suffix="mês" min={1} max={120}/><label className={labelClassName}>Data na projeção de tesouraria<input className={inputClassName} type="date" value={oneOffDate} onChange={(event) => setOneOffDate(event.target.value)}/></label><button type="button" className={primaryButtonClassName} disabled={pending || !baseline.treasury} onClick={runTreasuryOneOff} data-testid="sim-oneoff-treasury-run">{pending ? "A simular…" : "Simular na tesouraria"}</button>{!baseline.treasury ? <Notice>Sem contexto de tesouraria disponível.</Notice> : null}{treasuryError ? <Notice>{treasuryError}</Notice> : null}</div>;
  }

  function renderResult() {
    if (simulator === "savings") return savingsResult ? <><div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Projeção calculada com os pressupostos indicados.</strong><p className="mt-1">Não constitui garantia de rentabilidade.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultMetric icon="calendar" label="Prazo" value={`${savingsResult.months} meses`} tone="bg-blue-50 text-blue-600"/><ResultMetric icon="wallet" label="Contribuições" value={formatEUR(savingsResult.totalContributions)} tone="bg-violet-50 text-violet-600"/><ResultMetric icon="trend" label="Rendimento estimado" value={formatEUR(savingsResult.simulatedInterest)} tone="bg-emerald-50 text-emerald-600"/></div><p className="mt-4 text-sm">Capital final: <strong className="text-lg" data-testid="sim-savings-final">{formatEUR(savingsResult.finalBalance)}</strong></p><SavingsChart data={savingsChart}/></> : <Notice>Verifica os montantes e a taxa introduzidos.</Notice>;
    if (simulator === "emergency") return emergencyResult ? <div data-testid="sim-emergency-result"><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">A cobertura usa as despesas essenciais declaradas.</div><div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultMetric icon="shield" label="Objetivo" value={formatEUR(emergencyResult.targetAmount)} tone="bg-emerald-50 text-emerald-600"/><ResultMetric icon="wallet" label="Valor em falta" value={formatEUR(emergencyResult.gap)} tone="bg-orange-50 text-orange-600"/><ResultMetric icon="calendar" label="Prazo estimado" value={emergencyResult.monthsToTarget == null ? "N/D" : `${emergencyResult.monthsToTarget} meses`} tone="bg-blue-50 text-blue-600"/></div></div> : <Notice>Confirma que os valores são válidos e não negativos.</Notice>;
    if (simulator === "car") return "error" in carResult ? <Notice>{carResult.error}</Notice> : <div data-testid="sim-car-result"><div className="grid gap-3 sm:grid-cols-2"><ResultMetric icon="wallet" label="Entrada imediata" value={formatEUR(carResult.data.cashNeededAtPurchase)} tone="bg-blue-50 text-blue-600"/><ResultMetric icon="calendar" label="Prestação estimada" value={formatEUR(carResult.data.estimatedMonthlyPayment)} tone="bg-orange-50 text-orange-600"/><ResultMetric icon="trend" label="Juros estimados" value={formatEUR(carResult.data.totalInterestEstimated)} tone="bg-rose-50 text-rose-600"/><ResultMetric icon="car" label="Custo total estimado" value={formatEUR(carResult.data.totalCostEstimated)} tone="bg-violet-50 text-violet-600"/></div>{carResult.data.limitations.map((item) => <p key={item} className="mt-3 text-xs text-slate-500">{item}</p>)}</div>;
    if (simulator === "loan") return "error" in loanResult ? <Notice>{loanResult.error}</Notice> : <div data-testid="sim-loan-result"><div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-800">Hipótese read-only: não regista pagamento nem altera o passivo.</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><ResultMetric icon="trend" label="Juros estimados evitados" value={formatEUR(loanResult.data.interestSaved)} tone="bg-emerald-50 text-emerald-600"/><ResultMetric icon="wallet" label="Liquidez imediata usada" value={formatEUR(loanResult.data.liquidityImpactNow)} tone="bg-rose-50 text-rose-600"/><ResultMetric icon="calendar" label="Novo prazo estimado" value={loanResult.data.newTermMonths == null ? "N/D" : `${loanResult.data.newTermMonths} meses`} tone="bg-blue-50 text-blue-600"/><ResultMetric icon="debt" label="Nova prestação" value={loanResult.data.newMonthlyPayment ? formatEUR(loanResult.data.newMonthlyPayment) : "N/D"} tone="bg-violet-50 text-violet-600"/></div></div>;
    if (simulator === "cashflow") return scenarioA && scenarioB && expenseReduction ? <><div className="grid gap-3 sm:grid-cols-2" data-testid="sim-income-result"><ResultMetric icon="trend" label="Cenário A · líquido/mês" value={formatEUR(scenarioA.monthlyNet)} tone="bg-blue-50 text-blue-600"/><ResultMetric icon="wallet" label="Cenário A · saldo final" value={formatEUR(scenarioA.finalBalance)} tone="bg-emerald-50 text-emerald-600"/></div><p className="mt-4 text-sm" data-testid="sim-expense-result">O cenário B reduz despesas em <strong>{formatEUR(expenseReduction.monthlySavings)}/mês</strong> e termina em <strong>{formatEUR(scenarioB.finalBalance)}</strong>.</p><CashflowChart data={scenarioChart}/></> : <Notice>Revê as alterações e a percentagem de redução.</Notice>;
    return oneOffLocal ? <><div className="grid gap-3 sm:grid-cols-2"><ResultMetric icon="wallet" label="Saldo antes" value={formatEUR(oneOffLocal.balanceBefore)} tone="bg-blue-50 text-blue-600"/><ResultMetric icon="trend" label="Saldo depois" value={formatEUR(oneOffLocal.balanceAfter)} tone="bg-rose-50 text-rose-600"/></div>{treasurySim ? <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm" data-testid="sim-oneoff-treasury-result"><strong>Projeção com movimentos conhecidos</strong><p className="mt-1">Saldo final BASE {formatEUR(treasurySim.projectedBase)} → com cenário {formatEUR(treasurySim.projectedAdj)}.</p><p className="mt-1">Mínimo BASE {formatEUR(treasurySim.minBase ?? "0")} → com cenário {formatEUR(treasurySim.minAdj ?? "0")}.</p></div> : <p className="mt-4 text-sm text-slate-500">Executa a simulação na tesouraria para sobrepor a despesa aos eventos conhecidos.</p>}</> : <Notice>Indica um valor e mês válidos.</Notice>;
  }
}

function MoneyField({ label, value, onChange, testId, allowNegative = false }: { label: string; value: string; onChange: (value: string) => void; testId?: string; allowNegative?: boolean }) {
  return <label className={labelClassName}>{label}<span className="relative mt-1 block"><input className={`${inputClassName} !mt-0 pr-10`} type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} data-allow-negative={allowNegative || undefined}/><span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-slate-500">€</span></span></label>;
}

function NumberField({ label, value, onChange, suffix, min = 0, max, testId }: { label: string; value: string; onChange: (value: string) => void; suffix: string; min?: number; max?: number; testId?: string }) {
  return <label className={labelClassName}>{label}<span className="relative mt-1 block"><input className={`${inputClassName} !mt-0 pr-20`} type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} data-min={min} data-max={max}/><span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-slate-500">{suffix}</span></span></label>;
}

function SavingsChart({ data }: { data: Array<{ month: number; contributions: number; return: number; total: number }> }) {
  return <div className="mt-6"><div className="flex items-end justify-between gap-3"><div><h3 className="font-semibold">Evolução da simulação</h3><p className="text-xs text-slate-500">Capital e rendimento estimado por mês.</p></div>{data.length ? <strong className="text-sm text-blue-600">{formatEUR(String(data.at(-1)?.total ?? 0))}</strong> : null}</div><div className="mt-3 h-60" role="img" aria-label="Evolução mensal das contribuições e do rendimento estimado"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} width={55} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => formatEUR(String(value ?? 0))} labelFormatter={(label) => `Mês ${label}`}/><Legend wrapperStyle={{ fontSize: 11 }}/><Bar dataKey="contributions" name="Capital e contribuições" stackId="total" fill="#2f8df7" isAnimationActive={false}/><Bar dataKey="return" name="Rendimento estimado" stackId="total" fill="#24b99a" radius={[4, 4, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div></div>;
}

function ScenarioChart({ data }: { data: Array<{ month: number; BASE: number; A: number; B: number }> }) {
  return <div className="mt-3 h-56" role="img" aria-label="Comparação da evolução do saldo nos cenários BASE, A e B"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#e8eef6" vertical={false}/><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fontSize: 10 }} width={55} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => formatEUR(String(value ?? 0))} labelFormatter={(label) => `Mês ${label}`}/><Legend wrapperStyle={{ fontSize: 11 }}/><Line dataKey="BASE" stroke="#64748b" strokeWidth={2} dot={false} isAnimationActive={false}/><Line dataKey="A" stroke="#2f8df7" strokeWidth={2} dot={false} isAnimationActive={false}/><Line dataKey="B" stroke="#16a979" strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;
}

function CashflowChart({ data }: { data: Array<{ month: number; BASE: number; A: number; B: number }> }) {
  return <div className="mt-6"><h3 className="font-semibold">Evolução do saldo</h3><p className="text-xs text-slate-500">Comparação mensal, sem alterar movimentos reais.</p><ScenarioChart data={data}/></div>;
}
