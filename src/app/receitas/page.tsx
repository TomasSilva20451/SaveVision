import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import {
  confirmOccurrenceAction,
  createEcommerceAction,
  createFamilyIncomeAction,
  createIncomeAction,
  createTennisAction,
} from "@/lib/finance/income-actions";
import { formatEUR } from "@/lib/finance/money";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { listAccountsWithBalances } from "@/server/services/accounts";
import { listIncomeOverview } from "@/server/services/income";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function ReceitasContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const accounts = (await listAccountsWithBalances(user.id, selected.id)) ?? [];
  const overview = await listIncomeOverview(user.id, selected.id);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <PageHeader
        title="Receitas"
        description="Esperado não altera saldo. Só receitas confirmadas ou registadas como recebidas entram no movimento."
      />

      <section className="mt-8">
        <h2 className="text-lg font-medium">Transferências familiares</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overview?.occurrences.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span>
                {item.title} · {item.status} ·{" "}
                {item.scheduledFor.toLocaleDateString("pt-PT")}
              </span>
              <span>{formatEUR(item.expectedAmount.toString())}</span>
              {item.status === "EXPECTED" ? (
                <form action={confirmOccurrenceAction}>
                  <input type="hidden" name="occurrenceId" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Confirmar receção
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {accounts.length > 0 ? (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <FormSection title="Receita pontual">
            <form action={createIncomeAction} className="grid gap-2">
              <AccountSelect accounts={accounts} />
              <input name="description" placeholder="Descrição" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="amount" placeholder="Montante" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="status" value="EXPECTED" />
                Apenas esperada (não entra no saldo)
              </label>
              <SubmitButton label="Registar receita" />
            </form>
          </FormSection>

          <FormSection title="Transferência familiar recorrente">
            <form action={createFamilyIncomeAction} className="grid gap-2">
              <AccountSelect accounts={accounts} />
              <input name="familyOrigin" placeholder="Familiar" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="amount" placeholder="Montante" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <select name="frequency" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
              <input name="nextDueAt" type="date" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <select name="certainty" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                <option value="HIGH">Certeza alta</option>
                <option value="MEDIUM">Certeza média</option>
                <option value="LOW">Certeza baixa</option>
              </select>
              <SubmitButton label="Criar série familiar" />
            </form>
          </FormSection>

          <FormSection title="Venda e-commerce">
            <form action={createEcommerceAction} className="grid gap-2">
              <AccountSelect accounts={accounts} />
              <input name="grossAmount" placeholder="Venda bruta" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="marketplaceFees" placeholder="Taxas marketplace" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="shippingCost" placeholder="Portes" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="taxReservePercentage" placeholder="Reserva fiscal de planeamento (%)" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recordPayout" defaultChecked />
                Registar receita líquida no saldo
              </label>
              <SubmitButton label="Registar venda" />
            </form>
          </FormSection>

          <FormSection title="Torneio de ténis">
            <form action={createTennisAction} className="grid gap-2">
              <AccountSelect accounts={accounts} />
              <input name="tournamentName" placeholder="Nome do torneio" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="tournamentDate" type="date" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="grossPrize" placeholder="Prémio bruto" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="registrationFee" placeholder="Inscrição" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="travelCost" placeholder="Viagem" className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recordPayout" defaultChecked />
                Registar prémio líquido no saldo
              </label>
              <SubmitButton label="Registar torneio" />
            </form>
          </FormSection>
        </div>
      ) : null}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium">E-commerce recente</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {overview?.sales.map((sale) => (
              <li key={sale.id} className="rounded-lg border px-3 py-2 dark:border-zinc-800">
                Bruto {formatEUR(sale.grossAmount.toString())} · Líquido{" "}
                {formatEUR(sale.netProceeds.toString())} · Reserva{" "}
                {formatEUR(sale.taxReserveAmount.toString())}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-medium">Ténis recente</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {overview?.tournaments.map((row) => (
              <li key={row.id} className="rounded-lg border px-3 py-2 dark:border-zinc-800">
                {row.tournamentName} · Líquido {formatEUR(row.netPrize.toString())}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}

function AccountSelect({
  accounts,
}: {
  accounts: { id: string; name: string }[];
}) {
  return (
    <select name="accountId" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="mt-1 w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
    >
      {label}
    </button>
  );
}

export default function ReceitasPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar receitas…</p>}>
      <ReceitasContent />
    </Suspense>
  );
}
