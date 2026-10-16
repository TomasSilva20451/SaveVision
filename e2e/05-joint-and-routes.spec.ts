import { expect, test } from "@playwright/test";

test("K. acesso ao workspace conjunto", async ({ page }) => {
  await page.goto("/conta-conjunta");
  await expect(page.getByRole("heading", { name: "Conta conjunta" })).toBeVisible();
  await expect(page.getByText("Casa João e Maria")).toBeVisible();
});

test("Maria vê workspace conjunto partilhado", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: "playwright/.auth/maria.json",
  });
  const page = await context.newPage();
  await page.goto("/conta-conjunta");
  await expect(page.getByText("Casa João e Maria")).toBeVisible();
  await context.close();
});

test("rotas principais carregam", async ({ page }) => {
  const routes = [
    "/previsoes",
    "/previsoes?horizon=7",
    "/analises",
    "/relatorios",
    "/planeamento",
    "/receitas",
    "/despesas",
    "/despesas-recorrentes",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
  }
});
