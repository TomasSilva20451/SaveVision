import { createHash } from "node:crypto";
import { parseCivilDateIso, startOfCivilDay } from "@/lib/datetime/civil-date";
import { decimal } from "@/lib/finance/money";

export type ParsedBankFeedRow = {
  externalId: string;
  bookingDate: Date;
  amount: string;
  description: string;
  counterpartyHash: string | null;
};

function hashCounterparty(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * CSV mínimo: data (YYYY-MM-DD), montante, descrição.
 * Cabeçalho opcional; separador vírgula ou ponto e vírgula.
 */
export function parseBankFeedCsv(text: string): ParsedBankFeedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0]!.includes(";") ? ";" : ",";
  let start = 0;
  const firstCells = lines[0]!.split(sep).map((c) => c.trim().toLowerCase());
  if (firstCells[0]?.includes("data") || firstCells[0]?.includes("date")) start = 1;

  const rows: ParsedBankFeedRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    const cells = raw.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 2) continue;

    const dateIso = cells[0]!;
    const amountRaw = cells[1]!.replace(/\s/g, "").replace(",", ".");
    const description = (cells[2] ?? "").trim() || "Movimento importado";

    const civil = parseCivilDateIso(dateIso);
    const amount = decimal(amountRaw).toFixed(4);
    const externalId = createHash("sha256")
      .update(`${dateIso}|${amount}|${description}`)
      .digest("hex")
      .slice(0, 24);

    rows.push({
      externalId,
      bookingDate: startOfCivilDay(civil),
      amount,
      description,
      counterpartyHash: description ? hashCounterparty(description) : null,
    });
  }

  return rows;
}
