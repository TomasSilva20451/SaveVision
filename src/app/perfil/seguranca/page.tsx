import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MfaTotpPanel } from "@/components/auth/mfa-totp-panel";
import { RegisterPasskeyButton } from "@/components/auth/register-passkey-button";
import {
  SecurityStepUpProvider,
  StepUpExportLink,
  StepUpGatedForm,
} from "@/components/auth/security-step-up-context";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { inputClassName, labelClassName, primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import {
  changePasswordAction,
  deletePasskeyAction,
  disableAccountAction,
  globalLogoutAction,
  revokeSessionAction,
  sendEmailVerificationAction,
} from "@/lib/auth/security-actions";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { hasStepUp } from "@/lib/auth/step-up";
import { db } from "@/lib/db";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function SecurityContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  const [profile, sessions, events, passkeys, totp, recoveryLeft, stepUp, workspaceContext, flash] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true, disabledAt: true, name: true } }),
    db.authSession.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" }, take: 12 }),
    db.securityEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.passkeyCredential.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } }),
    db.recoveryCode.count({ where: { userId: user.id, usedAt: null } }),
    hasStepUp(user.id),
    resolveWorkspaceContext(user.id),
    readPageFlash("/perfil/seguranca"),
  ]);
  if (!profile) redirect("/login");
  const unseenAlertsCount = workspaceContext.selected ? await countUnseenFinancialAlerts(user.id, workspaceContext.selected.id) : 0;
  const totpEnabled = Boolean(totp?.enabledAt);

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
          <h1 className="text-2xl font-bold tracking-tight">Centro de segurança</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Sessões, dispositivos, MFA e eventos da conta.</p>
        </div>
      }
    >
      <SecurityStepUpProvider initialStepUpActive={stepUp} totpEnabled={totpEnabled}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Estado da conta">
            <ul className="space-y-2 text-sm">
              <li>Email: {profile.email} · {profile.emailVerifiedAt ? "verificado" : "por confirmar"}</li>
              <li>TOTP: {totpEnabled ? "activo" : "desactivado"}</li>
              <li>Códigos de recuperação por usar: {recoveryLeft}</li>
              <li>Passkeys: {passkeys.length}</li>
              <li>
                Confirmação reforçada:{" "}
                {stepUp ? (
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">activa (10 min)</span>
                ) : (
                  "pedida ao alterar segurança"
                )}
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <StepUpExportLink className={secondaryButtonClassName} />
              <Link className="text-sm font-semibold text-blue-600" href="/perfil">
                Voltar ao perfil
              </Link>
            </div>
          </Card>

          <Card title="Email e palavra-passe">
            <StepUpGatedForm action={sendEmailVerificationAction}>
              <button className={secondaryButtonClassName} type="submit">
                Reenviar verificação de email
              </button>
            </StepUpGatedForm>
            <StepUpGatedForm action={changePasswordAction} className="mt-4 grid gap-3">
              <label className={labelClassName}>
                Palavra-passe actual
                <input name="currentPassword" type="password" required className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Nova palavra-passe
                <input name="newPassword" type="password" minLength={14} required className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Confirmar
                <input name="confirmPassword" type="password" minLength={14} required className={inputClassName} />
              </label>
              <button className={primaryButtonClassName} type="submit">
                Alterar palavra-passe
              </button>
            </StepUpGatedForm>
          </Card>

          <Card title="MFA TOTP">
            <MfaTotpPanel totpActive={totpEnabled} recoveryLeft={recoveryLeft} />
          </Card>

          <Card title="Passkeys">
            <RegisterPasskeyButton />
            <ul className="mt-4 space-y-2 text-sm">
              {passkeys.map((passkey) => (
                <li key={passkey.id} className="flex items-center justify-between gap-3">
                  <span>{passkey.deviceLabel}</span>
                  <StepUpGatedForm action={deletePasskeyAction}>
                    <input type="hidden" name="passkeyId" value={passkey.id} />
                    <button className={secondaryButtonClassName} type="submit">
                      Remover
                    </button>
                  </StepUpGatedForm>
                </li>
              ))}
              {passkeys.length === 0 ? <li className="text-slate-500">Ainda sem passkeys.</li> : null}
            </ul>
          </Card>

          <Card title="Sessões e dispositivos">
            <StepUpGatedForm action={globalLogoutAction} className="mb-3">
              <button className={secondaryButtonClassName} type="submit">
                Terminar todas as sessões
              </button>
            </StepUpGatedForm>
            <ul className="space-y-3 text-sm">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-start justify-between gap-3">
                  <span>
                    {session.deviceLabel} · {session.revokedAt ? "revogada" : "activa"} · {session.createdAt.toLocaleString("pt-PT")}
                  </span>
                  {session.revokedAt ? null : (
                    <StepUpGatedForm action={revokeSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <button className={secondaryButtonClassName} type="submit">
                        Revogar
                      </button>
                    </StepUpGatedForm>
                  )}
                </li>
              ))}
              {sessions.length === 0 ? <li className="text-slate-500">As próximas entradas passam a aparecer aqui.</li> : null}
            </ul>
          </Card>

          <Card title="Eventos">
            <ul className="space-y-2 text-sm">
              {events.map((event) => (
                <li key={event.id}>
                  {event.createdAt.toLocaleString("pt-PT")} · {event.type}
                </li>
              ))}
              {events.length === 0 ? <li className="text-slate-500">Sem eventos registados.</li> : null}
            </ul>
          </Card>

          <Card title="Desactivar conta">
            <p className="mb-3 text-sm text-slate-600">Revoga as sessões e impede novo login. Os workspaces não são apagados automaticamente.</p>
            <StepUpGatedForm action={disableAccountAction} className="grid gap-3">
              <label className={labelClassName}>
                Palavra-passe
                <input name="password" type="password" required className={inputClassName} />
              </label>
              <label className={labelClassName}>
                Escreve DESACTIVAR
                <input name="confirm" required className={inputClassName} />
              </label>
              <button className={secondaryButtonClassName} type="submit">
                Desactivar conta
              </button>
            </StepUpGatedForm>
          </Card>
        </div>
      </SecurityStepUpProvider>
    </AppShell>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar segurança…</p>}>
      <SecurityContent />
    </Suspense>
  );
}
