import { expect, test } from "@playwright/test";
import { JOAO, MARIA } from "./helpers/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login em duas etapas", () => {
  test("credenciais inválidas permanecem no primeiro ecrã", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nao-existe@example.local");
    await page.locator("#password").fill("errada");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByTestId("login-credentials-step")).toBeVisible();
    await expect(page.getByTestId("login-credentials-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("palavra-passe incorrecta não avança", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(JOAO.email);
    await page.locator("#password").fill("errada");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByTestId("login-credentials-step")).toBeVisible();
    await expect(page.getByTestId("login-mfa-step")).toHaveCount(0);
  });

  test("conta sem MFA entra após Continuar", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(JOAO.email);
    await page.locator("#password").fill(JOAO.password);
    await Promise.all([
      page.waitForURL(/\/inicio/, { timeout: 60_000 }),
      page.getByRole("button", { name: "Continuar" }).click(),
    ]);
  });

  test("acesso directo à etapa 2 sem desafio não é possível via DOM", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-credentials-step")).toBeVisible();
    await expect(page.getByTestId("login-mfa-step")).toHaveCount(0);
  });

  test("voltar ao login invalida o desafio", async ({ page, context }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    const onMfa = await page.getByTestId("login-mfa-step").isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!onMfa, "Maria sem MFA activo neste ambiente.");
    await page.getByTestId("login-back").click();
    await expect(page.getByTestId("login-credentials-step")).toBeVisible();
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name.includes("session-token"));
    expect(session).toBeFalsy();
  });

  test("cinco dígitos não disparam verificação automática", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    const onMfa = await page.getByTestId("login-mfa-step").isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!onMfa, "Maria sem MFA activo neste ambiente.");
    const otp = page.getByTestId("login-totp-input");
    await otp.focus();
    await page.keyboard.insertText("12345");
    await expect(otp).toHaveValue("12345");
    await expect(page.getByTestId("login-totp-verifying")).toHaveCount(0);
    await expect(page.getByTestId("login-mfa-submit")).toBeDisabled();
  });

  test("colar seis dígitos no TOTP", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(MARIA.email);
    await page.locator("#password").fill(MARIA.password);
    await page.getByRole("button", { name: "Continuar" }).click();
    const onMfa = await page.getByTestId("login-mfa-step").isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!onMfa, "Maria sem MFA activo neste ambiente.");
    const otp = page.getByTestId("login-totp-input");
    await otp.focus();
    await page.keyboard.insertText("123456");
    await expect(otp).toHaveValue("123456");
    const cells = page.locator(".login-totp-cell");
    await expect(cells.nth(5)).toHaveText("6");
  });

  test("ecrã mobile do login", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
    const box = await page.getByTestId("login-credentials-step").boundingBox();
    expect(box && box.width <= 390).toBeTruthy();
  });
});
