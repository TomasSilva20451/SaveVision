import { expect, test } from "@playwright/test";

test.describe("Fase 17b — previsões de tesouraria", () => {
  test("abre o painel com quatro KPI e projeção base", async ({ page }) => {
    await page.goto("/previsoes?horizon=30");
    await expect(page.getByRole("heading", { name: "Previsões", exact: true })).toBeVisible();
    await expect(page.getByText("Saldo projetado (30 dias)", { exact: true })).toBeVisible();
    await expect(page.getByText("Receitas projetadas", { exact: true })).toBeVisible();
    await expect(page.getByText("Saídas de caixa projetadas", { exact: true })).toBeVisible();
    await expect(page.getByText("Variação de tesouraria prevista", { exact: true })).toBeVisible();
    await expect(page.getByTestId("treasury-real-balance")).toBeAttached();
    await expect(page.getByTestId("treasury-projected-balance")).toBeVisible();
  });

  for (const horizon of [7, 30, 90, 365]) {
    test(`seleciona horizonte de ${horizon} dias`, async ({ page }) => {
      await page.goto("/previsoes?horizon=30");
      await page.getByLabel("Horizonte da previsão").selectOption(String(horizon));
      await page.getByRole("button", { name: "Aplicar" }).click();
      await expect(page).toHaveURL(new RegExp(`horizon=${horizon}`));
      await expect(page.getByText(`Saldo projetado (${horizon} dias)`, { exact: true })).toBeVisible();
    });
  }

  test("mostra gráfico, cenários, fluxos e pressupostos explícitos", async ({ page }) => {
    await page.goto("/previsoes?horizon=365");
    await expect(page.getByTestId("treasury-forecast-chart")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cenário base" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cenário otimista" })).toBeVisible();
    await expect(page.getByText(/Receitas previstas \+10%/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fluxos mensais projetados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Comparação de cenários" })).toBeVisible();
  });

  test("a ligação de nova simulação abre o módulo existente", async ({ page }) => {
    await page.goto("/previsoes?horizon=30");
    await page.getByRole("link", { name: /Nova simulação/ }).click();
    await expect(page).toHaveURL(/\/simulacoes/);
  });

  test("abrir e recarregar a previsão não altera o saldo real", async ({ page }) => {
    await page.goto("/previsoes?horizon=30");
    const before = await page.getByTestId("treasury-real-balance").textContent();
    await page.reload();
    await expect(page.getByTestId("treasury-real-balance")).toHaveText(before ?? "");
  });

  test("Maria permanece isolada no workspace próprio", async ({ browser }) => {
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const page = await maria.newPage();
    await page.goto("/previsoes?horizon=30");
    await expect(page.getByTestId("treasury-real-balance")).toBeAttached();
    await maria.close();
  });

  test("mobile não cria overflow horizontal na página", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/previsoes?horizon=365");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.getByRole("heading", { name: "Cenários de previsão" })).toBeVisible();
  });
});
