import { expect, test } from "@playwright/test";
import { JOAO, loginAs, logoutFromShell } from "./helpers/auth";

test("A. login de João", async ({ page }) => {
  await loginAs(page, JOAO);
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
});

test("Q. logout", async ({ page }) => {
  await loginAs(page, JOAO);
  await logoutFromShell(page);
});

test("R. rotas protegidas após logout", async ({ page }) => {
  await loginAs(page, JOAO);
  await logoutFromShell(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("S. persistência após refresh", async ({ page }) => {
  await loginAs(page, JOAO);
  await page.reload();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("login inválido permanece em /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(JOAO.email);
  await page.getByLabel("Palavra-passe").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login/);
});
