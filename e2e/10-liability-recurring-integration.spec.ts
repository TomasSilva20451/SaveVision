import { expect, test } from "@playwright/test";
import { E2E_RECURRING_PREFIX } from "./recurring-e2e-prefix";

test.describe("Fase 17c.1 — passivos e recorrências", () => {
  test("E2 configurar dia de vencimento no património", async ({ page }) => {
    await page.goto("/patrimonio");
    await page.getByRole("button", { name: "+ Novo ativo ou passivo" }).click();
    await page.getByRole("button", { name: "Adicionar passivo" }).click();
    await expect(page.getByTestId("liability-due-day-create")).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    const firstForm = page.getByTestId("liability-due-day-form").first();
    if (await firstForm.count()) {
      await page.locator('summary[aria-label^="Ações de "]').first().click();
      await firstForm.locator('input[name="paymentDueDayOfMonth"]').fill("10");
      await firstForm.getByRole("button", { name: "Guardar vencimento" }).click();
    }
  });

  test("E4 criar recorrência com seletor de passivo", async ({ page }) => {
    const stamp = Date.now();
    const name = `${E2E_RECURRING_PREFIX}link-${stamp}`;
    await page.goto("/despesas-recorrentes");
    await page.getByRole("button", { name: "+ Nova despesa recorrente" }).click();
    const form = page.getByRole("dialog", { name: "Nova despesa recorrente" }).locator("form");
    await form.getByPlaceholder("Internet").fill(name);
    await form.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await form.locator('input[name="expectedAmount"]').fill("45");
    await form.locator('select[name="frequency"]').selectOption("MONTHLY");
    await expect(page.getByTestId("recurring-liability-link-create")).toBeVisible();
    await form.getByRole("button", { name: "Criar recorrência" }).click();
    const recurringTable = page.locator("section").filter({
      has: page.getByRole("navigation", { name: "Estado das recorrências" }),
    });
    await expect(recurringTable.getByRole("row").filter({ hasText: name }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("E5 consultar associação no formulário", async ({ page }) => {
    await page.goto("/despesas-recorrentes");
    await page.locator('summary[aria-label^="Ações de "]').first().click();
    await expect(page.getByTestId("recurring-liability-link-form").first()).toBeVisible();
  });

  test("E6 previsões mostram painel de configuração ou saldo projetado", async ({ page }) => {
    await page.goto("/previsoes?horizon=30");
    await expect(page.getByTestId("treasury-projected-balance")).toBeVisible();
  });
});
