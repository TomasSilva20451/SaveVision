import { z } from "zod";

export const createPlatformUserSchema = z.object({
  name: z.string().trim().min(2, "Indica um nome com pelo menos 2 caracteres.").max(80),
  email: z.email("Indica um email válido.").transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(14, "A palavra-passe inicial tem de ter pelo menos 14 caracteres.")
    .max(200),
});

export type CreatePlatformUserInput = z.infer<typeof createPlatformUserSchema>;
