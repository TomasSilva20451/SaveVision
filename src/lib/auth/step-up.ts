import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "fintwin_step_up";
const TTL_MS = 10 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET ?? "fintwin-dev-auth-secret-32-characters";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function grantStepUp(userId: string) {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  const value = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function hasStepUp(userId: string): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const splitAt = raw.lastIndexOf(".");
  if (splitAt <= 0) return false;
  const payload = raw.slice(0, splitAt);
  const mac = raw.slice(splitAt + 1);
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const [id, exp] = payload.split(".");
  return id === userId && Number(exp) > Date.now();
}

export const STEP_UP_REQUIRED_MESSAGE =
  "Confirma novamente a palavra-passe para continuar. Esta confirmação é válida durante 10 minutos.";
