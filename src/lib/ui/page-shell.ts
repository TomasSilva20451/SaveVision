import { getFlash } from "@/lib/ui/flash";

export async function readPageFlash(currentPath?: string) {
  return getFlash(currentPath);
}
