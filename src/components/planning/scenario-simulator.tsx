"use client";

import { useMemo, useState } from "react";
import { simulateBalanceScenario } from "@/lib/finance/scenario-simulator";
import { formatEUR } from "@/lib/finance/money";

type Props = {
  startingBalance: string;
};

export function ScenarioSimulator({ startingBalance }: Props) {
  const [incomeDelta, setIncomeDelta] = useState("0");
  const [expenseDelta, setExpenseDelta] = useState("0");
  const [months, setMonths] = useState(6);

  const series = useMemo(
    () =>
      simulateBalanceScenario({
        currentBalance: startingBalance,
        monthlyIncomeDelta: incomeDelta || "0",
        monthlyExpenseDelta: expenseDelta || "0",
        months,
      }),
    [startingBalance, incomeDelta, expenseDelta, months],
  );

  return (
    <section className="mt-10 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-medium">Simulador de cenários</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Variação mensal face ao padrão atual (determinístico, local no browser).
      </p>
      <div className="mt-4 grid max-w-md gap-2">
        <label className="text-sm">
          Δ receitas/mês (€)
          <input
            value={incomeDelta}
            onChange={(e) => setIncomeDelta(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          Δ despesas/mês (€)
          <input
            value={expenseDelta}
            onChange={(e) => setExpenseDelta(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm">
          Horizonte (meses)
          <input
            type="number"
            min={1}
            max={60}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <ul className="mt-4 text-sm">
        {series.map((point) => (
          <li key={point.monthIndex}>
            Mês {point.monthIndex}: {formatEUR(point.projectedBalance)}
          </li>
        ))}
      </ul>
    </section>
  );
}
