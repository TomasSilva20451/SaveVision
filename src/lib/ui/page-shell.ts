import { cache } from "react";
import { getFlash } from "@/lib/ui/flash";

export const readPageFlash = cache(async function readPageFlash(currentPath?: string) {
  return getFlash(currentPath);
});
