"use server";

import { setFlash } from "@/lib/ui/flash";

export async function flashSuccess(text: string) {
  await setFlash({ type: "success", text });
}

export async function flashError(text: string) {
  await setFlash({ type: "error", text });
}
