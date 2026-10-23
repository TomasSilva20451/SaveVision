#!/usr/bin/env node
/**
 * Captura screenshots reais (desktop + mobile) para auditoria visual.
 * Requer: pnpm dev:demo em http://localhost:3000
 */
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const baseURL = process.env.FINTWIN_AUDIT_URL ?? "http://localhost:3000";
const outDir = path.join(process.cwd(), "docs/visual-audit");
const routes = [
  "dashboard",
  "contas",
  "transacoes",
  "orcamentos",
  "despesas-recorrentes",
  "receitas",
  "patrimonio",
  "previsoes",
  "analises",
  "alertas",
  "simulacoes",
  "inicio",
  "despesas",
  "planeamento",
  "conta-conjunta",
  "relatorios",
  "investimentos",
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${baseURL}/login`);
await page.getByLabel("Email").fill("user1@example.local");
await page.getByLabel("Palavra-passe").fill("demo-joao-2026");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(/\/(inicio|dashboard)/, { timeout: 15_000 });

for (const route of routes) {
  await page.goto(`${baseURL}/${route}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(outDir, `${route}-desktop.png`),
    fullPage: true,
  });
}

const mobile = await browser.newContext({ ...devices["iPhone 13"] });
const mPage = await mobile.newPage();
await mPage.goto(`${baseURL}/login`);
await mPage.getByLabel("Email").fill("user1@example.local");
await mPage.getByLabel("Palavra-passe").fill("demo-joao-2026");
await mPage.getByRole("button", { name: "Entrar" }).click();
await mPage.waitForURL(/\/(inicio|dashboard)/, { timeout: 15_000 });
for (const route of routes) {
  await mPage.goto(`${baseURL}/${route}`);
  await mPage.waitForLoadState("networkidle");
  await mPage.screenshot({
    path: path.join(outDir, `${route}-mobile.png`),
    fullPage: true,
  });
}

await browser.close();
console.log(`Screenshots guardados em ${outDir}`);
