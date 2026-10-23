import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/shell/logout-button";
import { MainNav } from "@/components/shell/main-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ThemeToggleSlot } from "@/components/shell/theme-toggle-slot";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";
import { FlashBanner } from "@/components/ui/flash-banner";
import type { FlashMessage } from "@/lib/ui/flash";
import { ContextualHelpLauncher } from "@/components/help/contextual-help-launcher";
import { appConfig } from "@/lib/config";
import { requireAuthenticatedUser } from "@/lib/auth/auth";

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
  headerLeading?: ReactNode;
  headerActions?: ReactNode;
  visualTheme?: "default" | "aurora";
  children: ReactNode;
};

export async function AppShell({
  userName,
  workspaces,
  activeWorkspaceId,
  flash,
  unseenAlertsCount,
  headerLeading,
  headerActions,
  visualTheme = "aurora",
  children,
}: AppShellProps) {
  const account = await requireAuthenticatedUser();
  const avatarUrl = account?.avatarUrl ?? null;
  const avatarStyle = avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
    : undefined;
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`app-shell flex min-h-full w-full max-w-[100vw] bg-[var(--background)] ${visualTheme === "aurora" ? "aurora-shell" : ""}`}>
      <aside className="hidden w-[248px] shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="brand-mark grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            <span className="brand-mark-dot" aria-hidden />
            <span className="sr-only">{appConfig.name}</span>
          </span>
          <p className="text-base font-semibold tracking-tight">{appConfig.name}</p>
        </div>
        <MainNav className="flex-1 overflow-y-auto px-3" unseenAlertsCount={unseenAlertsCount} />
        <div className="border-t border-white/10 p-3">
          <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="app-header flex flex-wrap items-center gap-3 px-4 py-2.5 md:px-8">
          <MobileNav unseenAlertsCount={unseenAlertsCount} />
          {headerLeading ? (
            <div className="order-3 w-full min-w-0 md:order-none md:w-auto md:min-w-60 md:flex-1">{headerLeading}</div>
          ) : (
            <div className="flex-1" />
          )}
          {headerActions ? (
            <div className="order-4 flex w-full flex-wrap justify-end gap-2 md:order-none md:w-auto md:shrink-0">
              {headerActions}
            </div>
          ) : null}
          <div className="app-user-controls ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggleSlot />
            <div className="user-session-card flex min-w-0 items-center gap-1 rounded-2xl border px-1.5 py-1.5 sm:px-2">
              <Link href="/perfil" className="user-account-link flex min-w-0 items-center gap-2 rounded-xl px-0.5 pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" aria-label={`Abrir conta e perfil de ${userName}`}>
                <span className="user-session-avatar grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cover bg-center text-xs font-bold text-white" style={avatarStyle} aria-hidden>
                  {avatarUrl ? <span className="sr-only">{initials || "FT"}</span> : initials || "FT"}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-32 truncate text-sm font-semibold leading-tight">{userName}</span>
                  <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">Conta e perfil</span>
                </span>
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>
        <div className="app-content mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 pb-10 md:px-8">
          {flash ? <FlashBanner type={flash.type} message={flash.text} /> : null}
          {children}
        </div>
        <ContextualHelpLauncher />
      </div>
    </div>
  );
}
