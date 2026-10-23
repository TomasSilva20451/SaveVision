import { sniffMimeFromBytes } from "@/server/storage/file-sniff";

const RECEIPT_IMAGE_MIME = new Set(["image/jpeg", "image/png"]);

/** Validação básica da imagem antes do Moondream (sem exposição pública). */
export function preprocessReceiptImage(bytes: Uint8Array): {
  bytes: Uint8Array;
  mimeType: string;
} {
  const sniffed = sniffMimeFromBytes(bytes);
  if (!sniffed || !RECEIPT_IMAGE_MIME.has(sniffed)) {
    throw new Error("UNSUPPORTED_IMAGE");
  }
  if (bytes.byteLength < 512) {
    throw new Error("IMAGE_TOO_SMALL");
  }
  return { bytes, mimeType: sniffed };
}

export function receiptImageToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
