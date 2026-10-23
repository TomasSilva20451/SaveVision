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
    return <p className="px-2 text-xs text-slate-400">Sem workspaces ativos.</p>;
  }

  return (
    <div className="flex flex-col gap-1" role="group" aria-label="Espaços">
      {workspaces.map((workspace) => {
        const current = workspace.id === activeWorkspaceId;
        const initials = workspace.name
          .split(" ")
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase();

        return (
          <form key={workspace.id} action={selectWorkspaceAction}>
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <button
              type="submit"
              aria-current={current ? "true" : undefined}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm ${
                current ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/30 text-[11px] font-semibold">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{workspace.name}</span>
                <span className="block text-[11px] text-slate-400">
                  {workspace.type === "JOINT" ? "Workspace conjunto" : "Workspace pessoal"}
                </span>
              </span>
            </button>
          </form>
        );
      })}
    </div>
  );
}
