import { completeAccountRecoveryAction, requestAccountRecoveryAction } from "@/lib/auth/security-actions";
import { inputClassName, labelClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { readPageFlash } from "@/lib/ui/page-shell";

export async function RecoverAccountContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const flash = await readPageFlash("/recuperar-conta");
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Recuperar conta</h1>
      {flash ? <p className="text-sm">{flash.text}</p> : null}
      <form action={requestAccountRecoveryAction} className="grid gap-3">
        <label className={labelClassName}>Email<input name="email" type="email" required className={inputClassName} /></label>
        <button className={primaryButtonClassName} type="submit">Pedir link</button>
      </form>
      <form action={completeAccountRecoveryAction} className="grid gap-3">
        <input type="hidden" name="token" value={token ?? ""} />
        <label className={labelClassName}>Nova palavra-passe<input name="newPassword" type="password" minLength={14} required className={inputClassName} /></label>
        <label className={labelClassName}>Código TOTP<input name="totp" inputMode="numeric" className={inputClassName} /></label>
        <label className={labelClassName}>Ou código de recuperação<input name="recoveryCode" autoComplete="off" className={inputClassName} /></label>
        <button className={primaryButtonClassName} type="submit" disabled={!token}>Definir nova palavra-passe</button>
      </form>
      <a className="text-sm underline" href="/login">Voltar ao login</a>
    </main>
  );
}
