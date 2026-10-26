import { describe, expect, it } from "vitest";
import {
  kindsWithCapacity,
  recommendReplicas,
  rolloutDecision,
} from "@/lib/platform/job-policy";

describe("fila e capacidade", () => {
  it("reserva OCR a um worker e respeita o tecto global", () => {
    expect(kindsWithCapacity({ RECEIPT_OCR: 1, REPORT_EXPORT: 1 })).toEqual([
      "REPORT_EXPORT",
      "ML_CATEGORIZATION",
      "WEBHOOK_DELIVERY",
    ]);
    expect(kindsWithCapacity({ REPORT_EXPORT: 2, ML_CATEGORIZATION: 2 })).toEqual([]);
  });

  it("calcula réplicas dentro do intervalo", () => {
    expect(recommendReplicas({
      peakRequestsPerSecond: 40,
      requestsPerReplica: 15,
      minimum: 2,
      maximum: 6,
    })).toBe(3);
    expect(recommendReplicas({
      peakRequestsPerSecond: 1,
      requestsPerReplica: 15,
      minimum: 2,
      maximum: 6,
    })).toBe(2);
  });

  it("promove só com saúde verde", () => {
    expect(rolloutDecision(true)).toBe("promote");
    expect(rolloutDecision(false)).toBe("rollback");
  });
});
