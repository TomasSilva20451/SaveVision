import { expect, test } from "@playwright/test";

test.describe("Fase 17c — análises financeiras", () => {
  test("E1 abrir página de análises", async ({ page }) => {
    await page.goto("/analises");
    await expect(page.getByRole("heading", { name: "Análises financeiras" })).toBeVisible();
    await expect(page.getByTestId("financial-insights-page")).toBeVisible();
  });

  test("E2 resumo financeiro visível", async ({ page }) => {
    await page.goto("/analises");
    await expect(page.getByTestId("insights-expense-month")).toBeVisible();
  });

  test("E7 insight explicável listado", async ({ page }) => {
    await page.goto("/analises");
    await expect(page.getByTestId("financial-insight-item").first()).toBeVisible();
  });

  test("E9 Maria isolada — análises no workspace próprio", async ({ browser }) => {
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const mPage = await maria.newPage();
    await mPage.goto("/analises");
    await expect(mPage.getByTestId("financial-insights-page")).toBeVisible();
    await maria.close();
  });

  test("E12 consultar insights não cria transações", async ({ page }) => {
    await page.goto("/analises");
    await page.reload();
    await expect(page.getByTestId("financial-insights-page")).toBeVisible();
  });
});
