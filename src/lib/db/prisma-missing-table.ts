import { Prisma } from "@/generated/prisma/client";

/** Ignora P2021 (tabela ainda não migrada) em ambientes de dev/E2E desactualizados. */
export function isPrismaMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}
