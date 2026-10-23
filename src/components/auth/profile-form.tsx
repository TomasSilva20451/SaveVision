"use client";

import type { FormEvent } from "react";
import { useRef } from "react";
import { useSecurityStepUp } from "@/components/auth/security-step-up-context";
import { inputClassName, labelClassName, primaryButtonClassName } from "@/components/ui/form-styles";
import { PendingEmailVerification } from "@/components/auth/pending-email-verification";
import { updateProfileAction } from "@/lib/auth/profile-actions";

type ProfileFormProps = {
  profile: {
    name: string;
    email: string;
    phone: string | null;
    birthDate: string;
    avatarUrl: string | null;
  };
  pendingEmail: string | null;
};

export function ProfileForm({ profile, pendingEmail }: ProfileFormProps) {
  const { stepUpActive, requestStepUp } = useSecurityStepUp();
  const formRef = useRef<HTMLFormElement>(null);
  const initialEmail = profile.email;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const nextEmail = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
    const emailChanged = nextEmail !== initialEmail.trim().toLowerCase();
    if (emailChanged && !stepUpActive) {
      event.preventDefault();
      requestStepUp(() => formRef.current?.requestSubmit());
    }
  }

  return (
    <form ref={formRef} action={updateProfileAction} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className={`${labelClassName} sm:col-span-2`}>
        Nome completo
        <input name="name" required minLength={2} maxLength={80} defaultValue={profile.name} className={inputClassName} />
      </label>
      <div className="sm:col-span-2">
        <label className={labelClassName}>
          Email
          <input name="email" type="email" required defaultValue={profile.email} className={inputClassName} />
        </label>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          Alterar o email exige confirmação reforçada e um link de verificação. Até confirmares, o login continua com{" "}
          <strong>{profile.email}</strong>.
        </p>
        {pendingEmail && pendingEmail !== profile.email ? (
          <PendingEmailVerification currentEmail={profile.email} pendingEmail={pendingEmail} />
        ) : null}
      </div>
      <label className={labelClassName}>
        Telefone
        <input name="phone" type="tel" maxLength={30} defaultValue={profile.phone ?? ""} placeholder="Opcional" className={inputClassName} />
      </label>
      <label className={labelClassName}>
        Data de nascimento
        <input name="birthDate" type="date" defaultValue={profile.birthDate} className={inputClassName} />
      </label>
      <label className={labelClassName}>
        Endereço da imagem
        <input name="avatarUrl" type="text" inputMode="url" defaultValue={profile.avatarUrl ?? ""} placeholder="https://…" className={inputClassName} />
      </label>
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
        Usa o endereço directo de uma imagem HTTPS. Se deixares vazio, mantém-se as iniciais.
      </p>
      <div className="sm:col-span-2">
        <button type="submit" className={primaryButtonClassName}>
          Guardar perfil
        </button>
      </div>
    </form>
  );
}
