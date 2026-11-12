import { normalizeTotpDigits } from "@/lib/auth/totp-auto-submit";

/** Monta FormData do formulário MFA com o código TOTP explícito (evita corrida com o DOM). */
export function buildLoginMfaFormData(form: HTMLFormElement, totp: string): FormData {
  const fd = new FormData(form);
  fd.set("totp", normalizeTotpDigits(totp));
  return fd;
}
