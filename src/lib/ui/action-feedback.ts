"use server";

import { setFlash } from "@/lib/ui/flash";

export async function flashSuccess(text: string, targetPath?: string) {
  await setFlash({ type: "success", text, targetPath });
}

export async function flashError(text: string, targetPath?: string) {
  await setFlash({ type: "error", text, targetPath });
}
