/** Caminho interno seguro enviado por formulários em drawers (campo `_returnTo`). */
export function readReturnTo(formData: FormData): string | null {
  const raw = String(formData.get("_returnTo") ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return null;
  if (raw.length > 200) return null;
  return raw;
}
