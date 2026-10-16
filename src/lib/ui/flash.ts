import { cookies } from "next/headers";

export const FLASH_COOKIE = "fintwin_flash";

export type FlashMessage = {
  type: "success" | "error" | "info";
  text: string;
};

export async function setFlash(message: FlashMessage) {
  const cookieStore = await cookies();
  cookieStore.set(FLASH_COOKIE, JSON.stringify(message), {
    path: "/",
    maxAge: 30,
    httpOnly: true,
    sameSite: "lax",
  });
}

/** Lê a mensagem flash sem alterar cookies (permitido em Server Components). */
export async function getFlash(): Promise<FlashMessage | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (parsed?.text && parsed?.type) return parsed;
  } catch {
    return null;
  }
  return null;
}

/** @deprecated usar getFlash */
export const consumeFlash = getFlash;
