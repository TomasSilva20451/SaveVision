import { describe, expect, it } from "vitest";
import {
  mimeMatchesSniff,
  sanitizeOriginalFilename,
  sniffMimeFromBytes,
} from "@/server/storage/file-sniff";

describe("file-sniff", () => {
  it("deteta PDF", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 test");
    expect(sniffMimeFromBytes(bytes)).toBe("application/pdf");
  });

  it("sanitiza nomes perigosos", () => {
    expect(sanitizeOriginalFilename("../../etc/passwd")).toBe("passwd");
  });

  it("valida coerência MIME", () => {
    expect(mimeMatchesSniff("application/pdf", "application/pdf")).toBe(true);
    expect(mimeMatchesSniff("application/pdf", "text/plain")).toBe(false);
  });
});
