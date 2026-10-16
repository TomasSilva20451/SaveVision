import { selectWorkspaceAction } from "@/lib/auth/workspace-actions";

type WorkspaceOption = {
  id: string;
  name: string;
  type: "PERSONAL" | "JOINT";
};

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
};

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: WorkspaceSwitcherProps) {
  if (workspaces.length === 0) {
    return (
      <p className="px-2 text-sm text-zinc-500">
        Ainda não tens espaços. O seed da Fase 3 cria um workspace pessoal por
        utilizador.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-1" role="group" aria-label="Espaços">
      <p className="px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Espaço ativo
      </p>
      {workspaces.map((workspace) => {
        const current = workspace.id === activeWorkspaceId;

        return (
          <form key={workspace.id} action={selectWorkspaceAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <button
              type="submit"
              aria-current={current ? "true" : undefined}
              className={`w-full rounded-lg px-2 py-2 text-left text-sm ${
                current
                  ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {workspace.name}
              {workspace.type === "JOINT" ? (
                <span className="ml-1 text-xs opacity-70">· conjunto</span>
              ) : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}
