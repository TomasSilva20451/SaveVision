import { describe, expect, it } from "vitest";
import { parsePlatformJobPayload } from "@/lib/platform/job-payload";

describe("payloads da fila", () => {
  it("aceita um relatório mensal e recusa campos extra", () => {
    expect(parsePlatformJobPayload("REPORT_EXPORT", {
      workspaceId: "ws",
      format: "pdf",
      periodKey: "2026-10",
    })).toMatchObject({ format: "pdf" });
    expect(() => parsePlatformJobPayload("REPORT_EXPORT", {
      workspaceId: "ws",
      format: "pdf",
      periodKey: "2026-10",
      amount: "10",
    })).toThrow("PAYLOAD_INVALID");
  });

  it("aceita entrega de webhook", () => {
    expect(parsePlatformJobPayload("WEBHOOK_DELIVERY", {
      workspaceId: "ws",
      subscriptionId: "sub",
      deliveryId: "del",
      event: "reconciliation.matched",
      body: "{}",
      timestamp: "1700000000",
    })).toMatchObject({ deliveryId: "del" });
  });
});
