/**
 * k6 smoke — health, métricas (opcional) e página pública.
 * Uso: k6 run tests/load/smoke.js -e BASE_URL=https://staging...
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

const base = __ENV.BASE_URL ?? "http://127.0.0.1:3000";
const metricsToken = __ENV.FINTWIN_METRICS_TOKEN ?? "";

export default function smoke() {
  const health = http.get(`${base}/api/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health ok|degraded": (r) => {
      try {
        const j = r.json();
        return j.status === "ok" || j.status === "degraded";
      } catch {
        return false;
      }
    },
  });

  const loginPage = http.get(`${base}/login`);
  check(loginPage, { "login 200": (r) => r.status === 200 });

  if (metricsToken) {
    const metrics = http.get(`${base}/api/metrics`, {
      headers: { Authorization: `Bearer ${metricsToken}` },
    });
    check(metrics, { "metrics 200": (r) => r.status === 200 });
  }

  sleep(1);
}
