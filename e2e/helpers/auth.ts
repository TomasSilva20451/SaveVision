import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const JOAO = {
  email: "user1@example.local",
  password: "demo-joao-2026",
};

export const MARIA = {
  email: "user2@example.local",
  password: "demo-maria-2026",
};

export async function loginAs(page: Page, user: typeof JOAO) {
  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await Promise.all([
    page.waitForURL(/\/inicio/, { timeout: 60_000 }),
    page.locator('form button[type="submit"]').click(),
  ]);
}

export async function logoutFromShell(page: Page) {
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/login/);
}
