import { expect, test } from "@playwright/test";

test.describe("Fase 15 — orçamentos e património (João)", () => {

  test("criar limite de orçamento e ver resumo", async ({ page }) => {
    await page.goto("/orcamentos");
    await expect(page.getByRole("heading", { name: "Orçamentos", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Novo orçamento" }).click();

    const categorySelect = page.locator('form[action] select[name="categoryId"]').first();
    await expect(categorySelect).toHaveCount(1, { timeout: 10_000 });
    await categorySelect.selectOption({ index: 0 });
    await page.locator('input[name="limitAmount"]').first().fill("300");
    await page.getByRole("button", { name: "Guardar limite" }).click();
    const savedBudget = page.getByRole("row").filter({ hasText: "Alimentação" });
    await expect(savedBudget).toContainText("300,00 €", { timeout: 15_000 });
    await expect(page.getByText("Limite total")).toBeVisible();
  });

  test("despesa atualiza página de orçamentos após refresh", async ({ page }) => {
    const description = `E2E orçamento ${Date.now()}`;
    await page.goto("/despesas");
    await page.getByRole("button", { name: "＋ Nova despesa" }).click();
    const drawer = page.getByRole("dialog", { name: "Nova despesa" });
    const accountSelect = drawer.locator('select[name="accountId"]');
    await expect(accountSelect).toBeVisible({ timeout: 10_000 });
    await accountSelect.selectOption({ index: 0 });
    await drawer.getByLabel("Descrição").fill(description);
    await drawer.getByLabel("Montante (€)").fill("5");
    await drawer.getByRole("button", { name: "Registar despesa" }).click();
    await expect(page.getByRole("row").filter({ hasText: description })).toBeVisible({ timeout: 15_000 });
    await page.goto("/orcamentos");
    await page.reload();
    await expect(page.getByText("Despesas realizadas no mês")).toBeVisible();
  });

  test("consultar património e criar responsabilidade", async ({ page }) => {
    await page.goto("/patrimonio");
    await expect(page.getByRole("heading", { name: "Património", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Património líquido", level: 2, exact: true })).toBeVisible();
    await expect(page.getByText("Valor total dos ativos", { exact: true })).toBeVisible();
    await expect(page.getByText("Total de passivos", { exact: true })).toBeVisible();
    await expect(page.getByText("Rácio de endividamento", { exact: true }).first()).toBeVisible();

    const title = `E2E passivo ${Date.now()}`;
    await page.getByRole("button", { name: "+ Novo ativo ou passivo" }).click();
    await page.getByRole("button", { name: "Adicionar passivo" }).click();
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="outstandingBalance"]').fill("1000");
    await page.getByRole("button", { name: "Criar responsabilidade" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
  });
});

test("isolamento: Maria não vê orçamentos de João na UI", async ({ browser }) => {
  const joaoContext = await browser.newContext({
    storageState: "playwright/.auth/joao.json",
  });
  const joaoPage = await joaoContext.newPage();
  await joaoPage.goto("/orcamentos");
  await expect(joaoPage.getByRole("heading", { name: "Orçamentos", level: 1 })).toBeVisible();

  const mariaContext = await browser.newContext({
    storageState: "playwright/.auth/maria.json",
  });
  const mariaPage = await mariaContext.newPage();
  await mariaPage.goto("/orcamentos");
  await expect(mariaPage.getByRole("heading", { name: "Orçamentos", level: 1 })).toBeVisible();

  await joaoContext.close();
  await mariaContext.close();
});
