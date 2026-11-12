import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { MARIA } from "./helpers/auth";

const outDir = path.resolve("output/login-screenshots");

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Screenshots login duas etapas", () => {
  test("captura ecrãs desktop e mobile", async ({ page, browser }) => {
    await mkdir(outDir, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByTestId("login-credentials-step")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "login-desktop.png"), fullPage: true });

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mPage = await mobile.newPage();
    await mPage.goto("/login");
    await mPage.screenshot({ path: path.join(outDir, "login-mobile.png"), fullPage: true });

    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    const onMfa = await page.getByTestId("login-mfa-step").isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!onMfa, "Maria sem MFA — screenshots TOTP omitidos.");

    await page.screenshot({ path: path.join(outDir, "totp-desktop.png"), fullPage: true });
    await mPage.locator("#email").fill(MARIA.email);
    await mPage.locator("#password").fill(MARIA.password);
    await mPage.getByRole("button", { name: "Continuar" }).click();
    await mPage.getByTestId("login-mfa-step").waitFor({ timeout: 8_000 });
    await mPage.screenshot({ path: path.join(outDir, "totp-mobile.png"), fullPage: true });

    await page.locator(".login-totp-accessible-input").fill("000000");
    await page.getByRole("button", { name: "Verificar identidade" }).click();
    await expect(page.getByTestId("login-mfa-error")).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: path.join(outDir, "totp-error-desktop.png"), fullPage: true });

    await page.getByRole("button", { name: "Utilizar código de recuperação" }).click();
    await expect(page.getByTestId("login-recovery-field")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "recovery-desktop.png"), fullPage: true });

    await mobile.close();
  });
});
