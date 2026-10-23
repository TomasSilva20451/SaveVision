"use client";

import { useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { SideDrawer } from "@/components/ui/side-drawer";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { createEcommerceAction, createFamilyIncomeAction, createIncomeAction, createTennisAction } from "@/lib/finance/income-actions";

type Kind = "one-off" | "family" | "ecommerce" | "tennis";
type Account = { id: string; name: string };

const TYPES: { value: Kind; label: string; help: string }[] = [
  { value: "one-off", label: "Receita pontual", help: "Movimento recebido ou previsto" },
  { value: "family", label: "Transferência familiar", help: "Série recorrente com próxima data" },
  { value: "ecommerce", label: "Venda e-commerce", help: "Calcula o valor líquido da venda" },
  { value: "tennis", label: "Prémio de ténis", help: "Deduz custos ao prémio bruto" },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={primaryButtonClassName} disabled={pending} aria-busy={pending}>{pending ? "A guardar…" : label}</button>;
}

function AccountSelect({ accounts }: { accounts: Account[] }) {
  return <label className={labelClassName}>Conta<select name="accountId" required className={inputClassName}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>;
}

export function NewIncomeDrawer({ accounts, todayIso }: { accounts: Account[]; todayIso: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("one-off");
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  return <>
    <button ref={triggerRef} type="button" className={primaryButtonClassName} onClick={() => setOpen(true)} disabled={accounts.length === 0}>+ Nova receita</button>
    <SideDrawer open={open} onClose={close} titleId={titleId} returnFocusRef={triggerRef}>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div><h2 id={titleId} className="text-lg font-semibold">Nova receita</h2><p className="mt-1 text-sm text-slate-500">Escolhe a origem. O saldo só muda quando a receita é recebida.</p></div>
        <button type="button" className={secondaryButtonClassName} onClick={close}>Fechar</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <fieldset><legend className="text-sm font-medium text-slate-700">Tipo de receita</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{TYPES.map((type) => <label key={type.value} className={`cursor-pointer rounded-xl border p-3 ${kind === type.value ? "border-blue-500 bg-blue-50" : "border-[var(--border)]"}`}><input type="radio" name="income-kind" value={type.value} checked={kind === type.value} onChange={() => setKind(type.value)} className="sr-only"/><span className="block text-sm font-semibold">{type.label}</span><span className="mt-1 block text-xs text-slate-500">{type.help}</span></label>)}</div></fieldset>
        <div className="mt-6">
          {kind === "one-off" ? <form action={createIncomeAction} className="grid gap-4"><AccountSelect accounts={accounts}/><label className={labelClassName}>Descrição<input name="description" required className={inputClassName} placeholder="Ex.: salário, reembolso ou juros"/></label><label className={labelClassName}>Montante (EUR)<input name="amount" inputMode="decimal" required className={inputClassName}/></label><label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" name="status" value="EXPECTED" className="mt-0.5"/>Marcar como prevista (não entra no saldo)</label><div className="flex justify-end"><Submit label="Registar receita"/></div></form> : null}
          {kind === "family" ? <form action={createFamilyIncomeAction} className="grid gap-4"><AccountSelect accounts={accounts}/><label className={labelClassName}>Origem familiar<input name="familyOrigin" required className={inputClassName} placeholder="Ex.: João"/></label><label className={labelClassName}>Montante (EUR)<input name="amount" inputMode="decimal" required className={inputClassName}/></label><label className={labelClassName}>Frequência<select name="frequency" className={inputClassName} defaultValue="MONTHLY"><option value="WEEKLY">Semanal</option><option value="BIWEEKLY">Quinzenal</option><option value="MONTHLY">Mensal</option></select></label><label className={labelClassName}>Próxima receita<input name="nextDueAt" type="date" required defaultValue={todayIso} className={inputClassName}/></label><label className={labelClassName}>Grau de certeza<select name="certainty" className={inputClassName} defaultValue="HIGH"><option value="HIGH">Alta</option><option value="MEDIUM">Média</option><option value="LOW">Baixa</option></select></label><div className="flex justify-end"><Submit label="Criar série familiar"/></div></form> : null}
          {kind === "ecommerce" ? <form action={createEcommerceAction} className="grid gap-4"><AccountSelect accounts={accounts}/><label className={labelClassName}>Marketplace<input name="marketplace" className={inputClassName} placeholder="Opcional"/></label><label className={labelClassName}>Referência da encomenda<input name="orderReference" className={inputClassName} placeholder="Opcional"/></label><label className={labelClassName}>Venda bruta (EUR)<input name="grossAmount" inputMode="decimal" required className={inputClassName}/></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Taxas marketplace<input name="marketplaceFees" inputMode="decimal" className={inputClassName}/></label><label className={labelClassName}>Portes<input name="shippingCost" inputMode="decimal" className={inputClassName}/></label><label className={labelClassName}>Outros custos<input name="otherCosts" inputMode="decimal" className={inputClassName}/></label><label className={labelClassName}>Reserva fiscal (%)<input name="taxReservePercentage" inputMode="decimal" className={inputClassName}/></label></div><label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" name="recordPayout" defaultChecked className="mt-0.5"/>Registar a receita líquida no saldo</label><div className="flex justify-end"><Submit label="Registar venda"/></div></form> : null}
          {kind === "tennis" ? <form action={createTennisAction} className="grid gap-4"><AccountSelect accounts={accounts}/><label className={labelClassName}>Torneio<input name="tournamentName" required className={inputClassName}/></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Data<input name="tournamentDate" type="date" required defaultValue={todayIso} className={inputClassName}/></label><label className={labelClassName}>Local<input name="location" className={inputClassName}/></label></div><label className={labelClassName}>Prémio bruto (EUR)<input name="grossPrize" inputMode="decimal" required className={inputClassName}/></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Inscrição<input name="registrationFee" inputMode="decimal" className={inputClassName}/></label><label className={labelClassName}>Viagem<input name="travelCost" inputMode="decimal" className={inputClassName}/></label></div><label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" name="recordPayout" defaultChecked className="mt-0.5"/>Registar o prémio líquido no saldo</label><div className="flex justify-end"><Submit label="Registar torneio"/></div></form> : null}
        </div>
      </div>
    </SideDrawer>
  </>;
}
