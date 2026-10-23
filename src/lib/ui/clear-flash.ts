"use server";

import { cookies } from "next/headers";
import { FLASH_COOKIE } from "@/lib/ui/flash";

export async function clearFlashAction() {
  const cookieStore = await cookies();
  cookieStore.delete(FLASH_COOKIE);
}
