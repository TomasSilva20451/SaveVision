import { z } from "zod";

const loginFields = {
  email: z.email("Indica um email válido."),
  password: z.string(),
  totp: z.string().trim().optional(),
  recoveryCode: z.string().trim().optional(),
  deviceId: z.string().trim().max(80).optional(),
  mfaChallengeToken: z.string().trim().optional(),
  passkey: z.string().trim().optional(),
};

export const loginSchema = z
  .object(loginFields)
  .superRefine((data, ctx) => {
    if (!data.mfaChallengeToken?.length && data.password.length < 1) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Indica a palavra-passe." });
    }
  });

export const loginCredentialsSchema = z.object({
  email: loginFields.email,
  password: z.string().min(1, "Indica a palavra-passe."),
  deviceId: loginFields.deviceId,
});

export const loginMfaSchema = z.object({
  email: loginFields.email,
  mfaChallengeToken: z.string().min(16, "Sessão de verificação inválida."),
  totp: z.string().trim().optional(),
  recoveryCode: z.string().trim().optional(),
  deviceId: loginFields.deviceId,
  passkey: loginFields.passkey,
});
