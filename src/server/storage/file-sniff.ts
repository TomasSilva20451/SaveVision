export function sanitizeOriginalFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "ficheiro";
  return base.replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, "_").slice(0, 255);
}

export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.byteLength >= 5) {
    const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    if (head === "%PDF-") return "application/pdf";
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.byteLength >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return null;
  }
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 512));
  if (/^[\x20-\x7E\r\n\t.,;:"'\-]+$/.test(sample)) {
    if (sample.includes(",") && sample.includes("\n")) return "text/csv";
    return "text/plain";
  }
  return null;
}

export function mimeMatchesSniff(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (declared === sniffed) return true;
  if (declared === "text/csv" && sniffed === "text/plain") return true;
  return false;
}
