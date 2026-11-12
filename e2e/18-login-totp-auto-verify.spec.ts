import { test, expect } from "@playwright/test";
import { MARIA } from "./helpers/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("TOTP auto-verificação", () => {
  test("sexto dígito dispara verificação e código inválido limpa caixas", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    const onMfa = await page.getByTestId("login-mfa-step").isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!onMfa, "Maria sem MFA activo neste ambiente.");

    const otp = page.getByTestId("login-totp-input");
    const verifyingVisible = page.getByTestId("login-totp-verifying");

    await otp.fill("000000");
    await expect(verifyingVisible).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("login-mfa-error")).toContainText("Código inválido ou expirado", {
      timeout: 10_000,
    });
    await expect(otp).toHaveValue("");

    await otp.fill("111111");
    await expect(verifyingVisible).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Verificar identidade" })).toBeEnabled();
  });
});
