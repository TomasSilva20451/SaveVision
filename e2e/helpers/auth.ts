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

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Palavra-passe").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/inicio/, { timeout: 30_000 });
}

export async function logoutFromShell(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}
