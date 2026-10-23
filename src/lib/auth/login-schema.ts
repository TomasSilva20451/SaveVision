import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Indica um email válido."),
  password: z.string().min(1, "Indica a palavra-passe."),
  totp: z.string().trim().optional(),
  recoveryCode: z.string().trim().optional(),
  deviceId: z.string().trim().max(80).optional(),
});
