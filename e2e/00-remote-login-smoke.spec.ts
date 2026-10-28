import { expect, test } from "@playwright/test";
import { JOAO } from "./helpers/auth";

test("health remoto", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { status?: string; database?: string };
  expect(body.status).toBe("ok");
  expect(body.database).toBe("up");
});

test("página /login renderiza", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

test("credenciais inválidas permanecem em /login", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill(JOAO.email);
  await page.locator("#password").fill("errada");
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('form [role="alert"]')).toContainText(
    /inválid|Demasiadas tentativas/i,
  );
});
