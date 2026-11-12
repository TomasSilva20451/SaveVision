#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.resolve("output/login-screenshots");

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const dPage = await desktop.newPage();
  const mPage = await mobile.newPage();

  await dPage.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await dPage.screenshot({ path: path.join(outDir, "login-desktop.png"), fullPage: true });
  await mPage.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await mPage.screenshot({ path: path.join(outDir, "login-mobile.png"), fullPage: true });

  await dPage.locator("#email").fill("user2@example.local");
  await dPage.locator("#password").fill("demo-maria-2026");
  await dPage.getByRole("button", { name: "Continuar" }).click();
  const mfaVisible = await dPage.getByTestId("login-mfa-step").isVisible({ timeout: 8_000 }).catch(() => false);
  if (mfaVisible) {
    await dPage.screenshot({ path: path.join(outDir, "totp-desktop.png"), fullPage: true });
    await mPage.locator("#email").fill("user2@example.local");
    await mPage.locator("#password").fill("demo-maria-2026");
    await mPage.getByRole("button", { name: "Continuar" }).click();
    await mPage.getByTestId("login-mfa-step").waitFor({ timeout: 8_000 }).catch(() => null);
    await mPage.screenshot({ path: path.join(outDir, "totp-mobile.png"), fullPage: true });

    await dPage.locator(".login-totp-accessible-input").fill("000000");
    await dPage.getByRole("button", { name: "Verificar identidade" }).click();
    await dPage.getByTestId("login-mfa-error").waitFor({ timeout: 8_000 }).catch(() => null);
    await dPage.screenshot({ path: path.join(outDir, "totp-error-desktop.png"), fullPage: true });

    await dPage.getByRole("button", { name: "Utilizar código de recuperação" }).click();
    await dPage.getByTestId("login-recovery-field").waitFor({ timeout: 5_000 }).catch(() => null);
    await dPage.screenshot({ path: path.join(outDir, "recovery-desktop.png"), fullPage: true });
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ baseURL, capturedAt: new Date().toISOString(), mfaStepCaptured: mfaVisible }, null, 2),
  );

  await browser.close();
  console.log(`Screenshots em ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
