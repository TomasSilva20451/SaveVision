import { createPlatformUserAction } from "@/lib/platform/backoffice-actions";
import type { PlatformUserSummary } from "@/server/services/platform-users";

const inputClassName =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";

type Props = {
  users: PlatformUserSummary[];
  canManage: boolean;
};

export function PlatformUsersPanel({ users, canManage }: Props) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Contas da plataforma</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Cria utilizadores com workspace pessoal vazio. Novas contas ficam com papel USER; Tomás e Telmo
        mantêm ADMIN via bootstrap.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{row.systemRole}</td>
                <td className="px-4 py-3">{row.disabledAt ? "Desactivada" : "Activa"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage ? (
        <form action={createPlatformUserAction} className="mt-6 grid max-w-md gap-3">
          <h3 className="text-sm font-semibold">Nova conta</h3>
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input name="name" required autoComplete="off" className={inputClassName} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" required autoComplete="off" className={inputClassName} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Palavra-passe inicial (mín. 14)
            <input
              name="password"
              type="password"
              required
              minLength={14}
              autoComplete="new-password"
              className={inputClassName}
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Criar conta
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Só administradores podem criar contas.</p>
      )}
    </section>
  );
}
