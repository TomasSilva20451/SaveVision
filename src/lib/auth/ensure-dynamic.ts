import { connection } from "next/server";

/** Marca a rota como dinâmica antes de auth/sessão (evita aviso crypto no prerender). */
export async function ensureRequestDynamic() {
  await connection();
}
