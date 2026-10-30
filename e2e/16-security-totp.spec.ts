import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { MARIA, loginAs, logoutFromShell } from "./helpers/auth";
import { generateTotpCode } from "./helpers/totp";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe.configure({ mode: "serial" });

function resetMariaTotp() {
  const url =
    process.env.FINTWIN_E2E_DATABASE_URL ??
    "postgresql://fintwin:fintwin@localhost:5433/fintwin_e2e?schema=public";
  execSync(
    `psql "${url.split("?")[0]}" -c "DELETE FROM \\"RecoveryCode\\" WHERE \\"userId\\" IN (SELECT id FROM \\"User\\" WHERE email='${MARIA.email}'); DELETE FROM \\"UserTotpCredential\\" WHERE \\"userId\\" IN (SELECT id FROM \\"User\\" WHERE email='${MARIA.email}');"`,
    { stdio: "ignore" },
  );
}

test.describe("MFA TOTP", () => {
  test.afterAll(() => {
    resetMariaTotp();
  });

  test("activar TOTP, entrar com código e desactivar", async ({ page }) => {
    await loginAs(page, MARIA);
    await page.goto("/perfil/seguranca", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Gerar segredo" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirmar identidade" });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="password"]').fill(MARIA.password);
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    await expect(page.getByText("QR code para a app autenticadora")).toBeVisible({ timeout: 15_000 });
    const manualKey = page.locator("details").filter({ hasText: "Chave manual" });
    await manualKey.locator("summary").click();
    const secret = (await manualKey.locator("p.font-mono").textContent())?.trim();
    expect(secret && secret.length >= 16).toBeTruthy();

    await page.locator('input[name="code"]').fill(generateTotpCode(secret!));
    await page.getByRole("button", { name: "Activar", exact: true }).click();
    const activarStepUp = page.getByRole("dialog", { name: "Confirmar identidade" });
    if (await activarStepUp.isVisible()) {
      await activarStepUp.locator('input[name="password"]').fill(MARIA.password);
      await activarStepUp.getByRole("button", { name: "Confirmar" }).click();
      await expect(activarStepUp).toBeHidden({ timeout: 15_000 });
    }
    await expect(page.getByText("Guarda estes códigos de recuperação")).toBeVisible({ timeout: 15_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("TOTP activo.")).toBeVisible({ timeout: 15_000 });

    await logoutFromShell(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.locator("#totp").fill(generateTotpCode(secret!));
    await Promise.all([
      page.waitForURL(/\/inicio/, { timeout: 60_000 }),
      page.locator('form button[type="submit"]').click(),
    ]);
  });
});
