import { expect, test } from "@playwright/test";

test.describe("Fase 19 — simulações financeiras", () => {
  test("E1 abrir página de simulações", async ({ page }) => {
    await page.goto("/simulacoes");
    await expect(page.getByRole("heading", { name: "Simulações financeiras" })).toBeVisible();
    await expect(page.getByTestId("financial-simulations-page")).toBeVisible();
  });

  test("E2 simular poupança mensal com formulário", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Poupança" }).click();
    await page.getByTestId("sim-savings-monthly").fill("250");
    await expect(page.getByTestId("sim-savings-final")).toBeVisible();
  });

  test("E3 simular fundo de emergência", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Fundo emergência" }).click();
    await page.getByTestId("sim-emergency-contribution").fill("400");
    await expect(page.getByTestId("sim-emergency-result")).toBeVisible();
  });

  test("E4 simular compra de automóvel exige taxa", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Automóvel" }).click();
    await expect(page.getByTestId("sim-car-rate")).toBeVisible();
    await page.getByTestId("sim-car-rate").fill("4.5");
    await expect(page.getByTestId("sim-car-result")).toBeVisible();
  });

  test("E5 amortização — seletor passivo ou aviso", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Amortização" }).click();
    const select = page.getByTestId("sim-loan-select");
    if ((await select.count()) > 0) {
      await page.getByTestId("sim-loan-rate").fill("3");
      await expect(select).toBeVisible();
    } else {
      await expect(page.getByText(/sem passivos/i)).toBeVisible();
    }
  });

  test("E6 simular aumento de rendimento", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Rendimentos" }).click();
    await page.getByTestId("sim-income-delta").fill("300");
    await expect(page.getByTestId("sim-income-result")).toBeVisible();
  });

  test("E7 simular redução de despesas", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Despesas" }).click();
    await page.getByTestId("sim-expense-reduction").fill("15");
    await expect(page.getByTestId("sim-expense-result")).toBeVisible();
  });

  test("E8 despesa extraordinária", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Extraordinária" }).click();
    await page.getByTestId("sim-oneoff-amount").fill("1500");
    await page.getByTestId("sim-oneoff-treasury-run").click();
    await expect(page.getByTestId("sim-oneoff-treasury-result")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("E9 comparar BASE/A/B", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Comparar A/B" }).click();
    await expect(page.getByTestId("sim-compare")).toBeVisible();
  });

  test("E10 baseline reflete dados reais", async ({ page }) => {
    await page.goto("/simulacoes");
    const balance = await page.getByTestId("sim-baseline-balance").textContent();
    expect(balance).toMatch(/€/);
  });

  test("E11 saldo baseline estável após refresh", async ({ page }) => {
    await page.goto("/simulacoes");
    const before = await page.getByTestId("sim-baseline-balance").textContent();
    await page.reload();
    const after = await page.getByTestId("sim-baseline-balance").textContent();
    expect(after).toBe(before);
  });

  test("E13 Maria isolada — simulações no workspace próprio", async ({ browser }) => {
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const mPage = await maria.newPage();
    await mPage.goto("/simulacoes");
    await expect(mPage.getByTestId("financial-simulations-page")).toBeVisible();
    await maria.close();
  });

  test("E14 refresh mantém página funcional", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.reload();
    await expect(page.getByTestId("sim-baseline-balance")).toBeVisible();
  });

  test("E15 automóvel sem taxa mostra aviso", async ({ page }) => {
    await page.goto("/simulacoes");
    await page.getByRole("tab", { name: "Automóvel" }).click();
    await page.getByTestId("sim-car-rate").fill("");
    await expect(page.getByText("Indique a taxa anual (%) como pressuposto.")).toBeVisible();
  });
});
