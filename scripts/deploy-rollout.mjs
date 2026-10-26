#!/usr/bin/env node
const healthUrl = process.env.FINTWIN_ROLLOUT_HEALTH_URL?.trim();
const previousImage = process.env.FINTWIN_ROLLOUT_PREVIOUS_IMAGE?.trim() || "(imagem anterior)";
if (!healthUrl?.startsWith("https://")) {
  console.error("Define FINTWIN_ROLLOUT_HEALTH_URL com HTTPS do candidato.");
  process.exit(1);
}

const response = await fetch(healthUrl, { redirect: "manual" });
if (response.ok) {
  console.log("[rollout] promote — saúde do candidato OK");
  process.exit(0);
}

console.error(`[rollout] rollback — saúde ${response.status}. Republicar ${previousImage}.`);
process.exit(1);
