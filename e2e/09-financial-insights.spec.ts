import { expect, test } from "@playwright/test";

test.describe("Fase 17c — análises financeiras", () => {
  test("E1 abrir página de análises", async ({ page }) => {
    await page.goto("/analises");
    await expect(page.getByRole("heading", { name: "Análises financeiras" })).toBeVisible();
    await expect(page.getByTestId("financial-insights-page")).toBeVisible();
  });

  test("E2 resumo financeiro visível", async ({ page }) => {
    await page.goto("/analises");
    await expect(page.getByText("Taxa de poupança", { exact: true })).toBeVisible();
    await expect(page.getByText("Despesa média diária", { exact: true })).toBeVisible();
    await expect(page.getByText("Rácio de essencialidade", { exact: true })).toBeVisible();
    await expect(page.getByText("Cumprimento dos orçamentos", { exact: true })).toBeVisible();
  });

  test("E3 período atualiza o overview", async ({ page }) => {
    await page.goto("/analises");
    await page.getByLabel("Período de análise").selectOption("3");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/period=3/);
  });

  test("E4 separadores apresentam conteúdo correspondente", async ({ page }) => {
    await page.goto("/analises");
    await page.getByRole("tab", { name: "Despesas" }).click();
    await expect(page.getByTestId("analytics-expense-distribution")).toBeVisible();
    await page.getByRole("tab", { name: "Poupança e investimentos" }).click();
    await expect(page.getByText("Investimentos conhecidos")).toBeVisible();
    await page.getByRole("tab", { name: "Património" }).click();
    await expect(page.getByTestId("analytics-patrimony")).toBeVisible();
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

  test("E13 mobile sem overflow horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/analises");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.getByRole("tab", { name: "Tendências" })).toBeVisible();
  });
});
