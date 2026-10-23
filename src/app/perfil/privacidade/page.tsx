import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PrivacyCenterPanel } from "@/components/privacy/privacy-center-panel";
import { SecurityStepUpProvider } from "@/components/auth/security-step-up-context";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { hasStepUp } from "@/lib/auth/step-up";
import { loadPrivacyCenterState } from "@/lib/privacy/privacy-actions";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { db } from "@/lib/db";

async function PrivacidadeContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const [profile, workspaceContext, flash, stepUp, privacyState, totp] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true } }),
    resolveWorkspaceContext(user.id),
    readPageFlash("/perfil/privacidade"),
    hasStepUp(user.id),
    loadPrivacyCenterState(user.id),
    db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } }),
  ]);
  if (!profile) redirect("/login");

  const unseenAlertsCount = workspaceContext.selected
    ? await countUnseenFinancialAlerts(user.id, workspaceContext.selected.id)
    : 0;

  return (
    <AppShell
      visualTheme="aurora"
      userName={profile.name}
      workspaces={workspaceContext.workspaces}
      activeWorkspaceId={workspaceContext.selected?.id ?? null}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={
        <div>
          <p className="text-sm">
            <Link href="/perfil" className="text-blue-600 hover:underline">
              ← Conta e perfil
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Centro de privacidade</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Inventário, consentimentos, exportação, retenção e eliminação verificável.
          </p>
        </div>
      }
    >
      <SecurityStepUpProvider initialStepUpActive={stepUp} totpEnabled={Boolean(totp?.enabledAt)}>
        <PrivacyCenterPanel state={privacyState} stepUpActive={stepUp} />
      </SecurityStepUpProvider>
    </AppShell>
  );
}

export default function PrivacidadePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar privacidade…</p>}>
      <PrivacidadeContent />
    </Suspense>
  );
}
