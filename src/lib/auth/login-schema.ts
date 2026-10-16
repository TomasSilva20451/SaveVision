import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Indica um email válido."),
  password: z.string().min(1, "Indica a palavra-passe."),
});
