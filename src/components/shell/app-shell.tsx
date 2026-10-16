import type { ReactNode } from "react";
import { LogoutButton } from "@/components/shell/logout-button";
import { MainNav } from "@/components/shell/main-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { FlashBanner } from "@/components/ui/flash-banner";
import type { FlashMessage } from "@/lib/ui/flash";
import { appConfig } from "@/lib/config";

type WorkspaceOption = {
  id: string;
  name: string;
  type: "PERSONAL" | "JOINT";
};

type AppShellProps = {
  userName: string;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  flash?: FlashMessage | null;
  unseenAlertsCount?: number;
  children: ReactNode;
};

export function AppShell({
  userName,
  workspaces,
  activeWorkspaceId,
  flash,
  unseenAlertsCount,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white p-4 md:block dark:border-zinc-800 dark:bg-zinc-950">
        <p className="px-2 text-sm font-semibold">{appConfig.name}</p>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
        <MainNav className="mt-6" unseenAlertsCount={unseenAlertsCount} />
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <MobileNav />
            <p className="hidden text-sm font-medium md:block">{appConfig.name}</p>
          </div>
          <p className="hidden text-sm text-zinc-500 lg:block">Sessão local · EUR · Lisboa</p>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <p className="max-w-[8rem] truncate text-sm font-medium sm:max-w-none">{userName}</p>
            <LogoutButton />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          {flash ? <FlashBanner type={flash.type} message={flash.text} /> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
