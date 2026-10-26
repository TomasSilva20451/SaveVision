export type ApiRateLimitScope =
  | "reports-csv"
  | "reports-pdf"
  | "reports-accounting-csv"
  | "document-download"
  | "privacy-export"
  | "account-export"
  | "metrics";

export type ApiRateLimitRule = {
  limit: number;
  windowMs: number;
  message: string;
};

export const API_RATE_LIMIT_RULES: Record<ApiRateLimitScope, ApiRateLimitRule> = {
  "reports-csv": {
    limit: 20,
    windowMs: 15 * 60 * 1000,
    message: "Demasiadas exportações CSV. Aguarda antes de repetir.",
  },
  "reports-pdf": {
    limit: 15,
    windowMs: 15 * 60 * 1000,
    message: "Demasiadas exportações PDF. Aguarda antes de repetir.",
  },
  "reports-accounting-csv": {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    message: "Demasiadas exportações contabilísticas. Aguarda antes de repetir.",
  },
  "document-download": {
    limit: 60,
    windowMs: 15 * 60 * 1000,
    message: "Demasiados downloads de documentos. Aguarda antes de repetir.",
  },
  "privacy-export": {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: "Limite de exportações de privacidade atingido. Tenta mais tarde.",
  },
  "account-export": {
    limit: 10,
    windowMs: 60 * 60 * 1000,
    message: "Limite de exportação de conta atingido. Tenta mais tarde.",
  },
  metrics: {
    limit: 120,
    windowMs: 60 * 1000,
    message: "Demasiados pedidos às métricas.",
  },
};

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}
