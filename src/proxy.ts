import { NextResponse, type NextRequest } from "next/server";
import {
  CSP_NONCE_HEADER,
  createCspNonce,
  securityHeadersForRequest,
} from "@/lib/security/security-headers";

function normalizeRoute(pathname: string) {
  return pathname
    .replace(/\/[0-9a-f-]{36}/gi, "/:id")
    .replace(/\/\d+/g, "/:id");
}

function requestProtocol(request: NextRequest): string {
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
}

export function proxy(request: NextRequest) {
  const started = performance.now();
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const nonce = createCspNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  const incomingTrace = request.headers.get("traceparent");
  const traceId = incomingTrace?.split("-")[1] ?? crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const spanId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  requestHeaders.set("traceparent", incomingTrace ?? `00-${traceId}-${spanId}-01`);

  const tlsRequired =
    process.env.FINTWIN_ENFORCE_TLS === "1" &&
    process.env.FINTWIN_STAGING_LOCAL !== "1" &&
    request.nextUrl.pathname !== "/api/health" &&
    requestProtocol(request) !== "https";
  if (tlsRequired) {
    const publicUrl = process.env.FINTWIN_PUBLIC_URL;
    if (!publicUrl?.startsWith("https://")) {
      return NextResponse.json({ error: "TLS obrigatório e origem segura não configurada." }, { status: 503 });
    }
    const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, publicUrl);
    return NextResponse.redirect(target, 308);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("traceparent", requestHeaders.get("traceparent")!);
  response.headers.set("x-trace-id", traceId);
  for (const [key, value] of Object.entries(securityHeadersForRequest(nonce))) {
    response.headers.set(key, value);
  }

  const route = normalizeRoute(request.nextUrl.pathname);
  if (!route.startsWith("/_next")) {
    const durationMs = performance.now() - started;
    response.headers.set("server-timing", `app;dur=${durationMs.toFixed(1)}`);
    response.headers.set("x-route-template", route);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      event: "http_access",
      msg: "edge_request",
      route,
      method: request.method,
      durationMs: Math.round(durationMs),
      requestId,
      traceId,
      service: process.env.APP_NAME ?? "FinTwin",
      env: process.env.FINTWIN_ENV ?? "development",
    }));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

