import { expect, test } from "@playwright/test";
import { e2eSessionUser, JOAO, loginAs, logoutFromShell } from "./helpers/auth";

const sessionUser = e2eSessionUser();

test("A. login de João", async ({ page }) => {
  await loginAs(page, sessionUser);
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
});

test("Q. logout", async ({ page }) => {
  await loginAs(page, sessionUser);
  await logoutFromShell(page);
});

test("R. rotas protegidas após logout", async ({ page }) => {
  await loginAs(page, sessionUser);
  await logoutFromShell(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("S. persistência após refresh", async ({ page }) => {
  await loginAs(page, sessionUser);
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
