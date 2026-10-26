import { describe, expect, it } from "vitest";
import { API_RATE_LIMIT_RULES, clientIpFromRequest } from "@/lib/security/api-rate-limit-policy";

describe("api-rate-limit-policy", () => {
  it("define limites para exportações sensíveis", () => {
    expect(API_RATE_LIMIT_RULES["privacy-export"].limit).toBeLessThanOrEqual(
      API_RATE_LIMIT_RULES["reports-csv"].limit,
    );
    expect(API_RATE_LIMIT_RULES["reports-accounting-csv"].limit).toBeGreaterThan(0);
  });

  it("extrai IP do pedido", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(clientIpFromRequest(request)).toBe("203.0.113.1");
  });
});
