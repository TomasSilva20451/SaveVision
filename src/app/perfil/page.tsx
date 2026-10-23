import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { inputClassName, labelClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ProfileForm } from "@/components/auth/profile-form";
import { SecurityStepUpProvider } from "@/components/auth/security-step-up-context";
import { updatePasswordAction } from "@/lib/auth/profile-actions";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { hasStepUp } from "@/lib/auth/step-up";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { db } from "@/lib/db";
import { readPageFlash } from "@/lib/ui/page-shell";
import { countUnseenFinancialAlerts } from "@/server/services/financial-alerts";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function PerfilContent() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const [profile, workspaceContext, flash, totp, stepUp, pendingEmailRow] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true, birthDate: true, avatarUrl: true, createdAt: true },
    }),
    resolveWorkspaceContext(user.id),
    readPageFlash("/perfil"),
    db.userTotpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } }),
    hasStepUp(user.id),
    db.emailChallenge.findFirst({
      where: { userId: user.id, purpose: "VERIFY_EMAIL", consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { email: true },
    }),
  ]);
  if (!profile) redirect("/login");
  const birthDateIso = profile.birthDate ? formatCivilDateIso(civilDateFromInstant(profile.birthDate)) : "";

  const unseenAlertsCount = workspaceContext.selected
    ? await countUnseenFinancialAlerts(user.id, workspaceContext.selected.id)
    : 0;
  const initials = profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const avatarStyle = profile.avatarUrl ? { backgroundImage: `url(${JSON.stringify(profile.avatarUrl)})` } : undefined;

  return (
    <AppShell
      visualTheme="aurora"
      userName={profile.name}
      workspaces={workspaceContext.workspaces}
      activeWorkspaceId={workspaceContext.selected?.id ?? null}
      flash={flash}
      unseenAlertsCount={unseenAlertsCount}
      headerLeading={<div><h1 className="text-2xl font-bold tracking-tight">Conta e perfil</h1><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Gere os teus dados pessoais, imagem e segurança da conta.</p></div>}
    >
      <SecurityStepUpProvider initialStepUpActive={stepUp} totpEnabled={Boolean(totp?.enabledAt)}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <Card title="Dados pessoais">
          <ProfileForm
            profile={{
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              birthDate: birthDateIso,
              avatarUrl: profile.avatarUrl,
            }}
            pendingEmail={pendingEmailRow?.email ?? null}
          />
        </Card>

        <div className="space-y-5">
          <Card title="Imagem da conta">
            <div className="flex flex-col items-center text-center">
              <span className="user-session-avatar grid h-24 w-24 place-items-center rounded-3xl bg-cover bg-center text-2xl font-bold text-white" style={avatarStyle} aria-label={profile.avatarUrl ? `Imagem de ${profile.name}` : `Iniciais de ${profile.name}`}>{profile.avatarUrl ? <span className="sr-only">{initials}</span> : initials}</span>
              <p className="mt-4 font-semibold">{profile.name}</p>
              <p className="mt-1 text-sm text-slate-500">Conta criada em {new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeZone: "Europe/Lisbon" }).format(profile.createdAt)}</p>
            </div>
          </Card>

          <Card title="Privacidade">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Consentimentos, exportação RGPD, retenção e eliminação verificável.
            </p>
            <Link href="/perfil/privacidade" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:underline">
              Abrir centro de privacidade →
            </Link>
          </Card>

          <Card title="Segurança">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Sessões, MFA, passkeys, códigos de recuperação e confirmação reforçada.</p>
            <Link href="/perfil/seguranca" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:underline">Abrir centro de segurança →</Link>
          </Card>

          <Card title="IA local">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Ajuda contextual, assistente, categorização e recibos usam Ollama no teu computador quando activado.
            </p>
            <Link href="/perfil/ia" className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:underline">
              Abrir configuração de IA →
            </Link>
          </Card>
        </div>
      </div>
      </SecurityStepUpProvider>

      <Card title="Segurança" className="mt-5 max-w-2xl">
        <form action={updatePasswordAction} className="grid gap-4 sm:grid-cols-2">
          <label className={`${labelClassName} sm:col-span-2`}>Palavra-passe atual<input name="currentPassword" type="password" autoComplete="current-password" required className={inputClassName}/></label>
          <label className={labelClassName}>Nova palavra-passe<input name="newPassword" type="password" autoComplete="new-password" minLength={14} required className={inputClassName}/></label>
          <label className={labelClassName}>Confirmar nova palavra-passe<input name="confirmPassword" type="password" autoComplete="new-password" minLength={14} required className={inputClassName}/></label>
          <p className="text-xs text-slate-500 sm:col-span-2">Alterar a palavra-passe exige confirmação reforçada no centro de segurança (válida 10 minutos).</p>
          <div className="sm:col-span-2"><button type="submit" className={primaryButtonClassName}>Alterar palavra-passe</button></div>
        </form>
      </Card>
    </AppShell>
  );
}

export default function PerfilPage() {
  return <Suspense fallback={<p className="p-6 text-sm">A carregar perfil…</p>}><PerfilContent/></Suspense>;
}
