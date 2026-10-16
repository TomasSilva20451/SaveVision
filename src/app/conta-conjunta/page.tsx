import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import {
  acceptInviteAction,
  createJointWorkspaceAction,
  inviteJointMemberAction,
} from "@/lib/auth/joint-actions";
import { formatEUR } from "@/lib/finance/money";
import { sumContributions } from "@/lib/finance/goal-progress";
import {
  getJointWorkspaceSummary,
  listPendingInvitesForUser,
} from "@/server/services/joint-workspace";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function ContaConjuntaContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const pendingInvites = await listPendingInvitesForUser(user.id);
  const jointWorkspaces = workspaces.filter((w) => w.type === "JOINT");
  const summary =
    selected.type === "JOINT"
      ? await getJointWorkspaceSummary(user.id, selected.id)
      : null;

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Conta conjunta</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Workspace conjunto isolado dos espaços pessoais de cada membro.
      </p>

      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Criar workspace conjunto</h2>
        <form action={createJointWorkspaceAction} className="mt-3 flex max-w-md gap-2">
          <input name="name" placeholder="Nome do espaço" required className="flex-1 rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
          <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            Criar
          </button>
        </form>
      </section>

      {pendingInvites.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Convites pendentes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="rounded-lg border p-3 dark:border-zinc-800">
                {invite.workspace.name}
                <form action={acceptInviteAction} className="mt-2">
                  <input type="hidden" name="token" value={invite.token} />
                  <button type="submit" className="rounded-lg border px-2 py-1 text-sm dark:border-zinc-700">
                    Aceitar convite
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {jointWorkspaces.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Convidar membro</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Seleciona um workspace conjunto no menu lateral antes de convidar.
          </p>
          {selected.type === "JOINT" && membership.role === "OWNER" ? (
            <form action={inviteJointMemberAction} className="mt-3 grid max-w-md gap-2">
              <input type="hidden" name="workspaceId" value={selected.id} />
              <input name="email" type="email" placeholder="Email" required className="rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950" />
              <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
                Enviar convite
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm">Apenas o proprietário do workspace conjunto ativo pode convidar.</p>
          )}
        </section>
      ) : null}

      {summary ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Dashboard conjunto · {summary.name}</h2>
          <p className="mt-2 text-sm">Membros ativos: {summary.members.length}</p>
          <ul className="mt-2 text-sm">
            {summary.members.map((member) => (
              <li key={member.userId}>
                {member.user.name} ({member.role})
              </li>
            ))}
          </ul>
          <h3 className="mt-4 font-medium">Objetivos conjuntos</h3>
          <ul className="mt-2 text-sm">
            {summary.savingsGoals.map((goal) => {
              const total = sumContributions(
                goal.contributions.map((c) => c.amount.toString()),
              ).toString();
              return (
                <li key={goal.id}>
                  {goal.title}: {formatEUR(total)} / {formatEUR(goal.targetAmount.toString())}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

export default function ContaConjuntaPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar…</p>}>
      <ContaConjuntaContent />
    </Suspense>
  );
}
