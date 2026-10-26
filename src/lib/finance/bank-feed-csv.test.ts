import { describe, expect, it } from "vitest";
import { parseBankFeedCsv } from "@/lib/finance/bank-feed-csv";

describe("parseBankFeedCsv", () => {
  it("ignora cabeçalho e normaliza montante", () => {
    const rows = parseBankFeedCsv(`data;montante;descricao
2026-10-01;-12,50;Supermercado`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe("-12.5000");
    expect(rows[0]!.description).toBe("Supermercado");
  });
});
