import "server-only";

import {
  buildAccountRecoveryMessage,
  buildVerifyEmailMessage,
} from "@/lib/auth/email-templates";
import { isSmtpEmailDeliveryConfigured } from "@/lib/auth/email-delivery";
import { resolveEmailDeliveryProvider } from "@/server/providers/email/registry";
import { revokeEmailChallengeByToken } from "@/server/services/auth-protection";

export class EmailDeliveryFailedError extends Error {
  constructor(message = "Não foi possível enviar o email. Tenta mais tarde.") {
    super(message);
    this.name = "EmailDeliveryFailedError";
  }
}

export async function deliverEmailChallenge(input: {
  token: string;
  email: string;
  purpose: "VERIFY_EMAIL" | "RECOVER_ACCOUNT";
  /** VERIFY_EMAIL para endereço novo (alteração de perfil). */
  verifyContext?: "account" | "email_change";
}) {
  if (!isSmtpEmailDeliveryConfigured()) return { delivered: false as const };

  const provider = resolveEmailDeliveryProvider();
  if (!provider) return { delivered: false as const };

  const payload =
    input.purpose === "RECOVER_ACCOUNT"
      ? buildAccountRecoveryMessage({ toEmail: input.email, token: input.token })
      : buildVerifyEmailMessage({
          toEmail: input.email,
          token: input.token,
          isEmailChange: input.verifyContext === "email_change",
        });

  try {
    await provider.send({
      to: input.email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { delivered: true as const };
  } catch (error) {
    console.error("[fintwin] falha SMTP", {
      purpose: input.purpose,
      to: input.email,
      error: error instanceof Error ? error.message : String(error),
    });
    await revokeEmailChallengeByToken(input.token);
    throw new EmailDeliveryFailedError();
  }
}
