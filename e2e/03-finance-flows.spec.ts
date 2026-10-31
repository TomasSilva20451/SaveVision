import { expect, test } from "@playwright/test";

test("D. navegação no dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Saldo total")).toBeVisible();
});

test("E. página de contas", async ({ page }) => {
  await page.goto("/contas");
  await expect(page.getByRole("heading", { name: "Contas", level: 1 })).toBeVisible();
});

test("F. registo de despesa", async ({ page }) => {
  const description = `E2E despesa ${Date.now()}`;
  await page.goto("/despesas");
  await page.getByRole("button", { name: "＋ Nova despesa" }).click();
  const drawer = page.getByRole("dialog", { name: "Nova despesa" });
  const accountSelect = drawer.locator('select[name="accountId"]');
  await expect(accountSelect).toBeVisible({ timeout: 10_000 });
  await accountSelect.selectOption({ index: 0 });
  await drawer.getByLabel("Descrição").fill(description);
  await drawer.getByLabel("Montante (€)").fill("12.34");
  await drawer.getByRole("button", { name: "Registar despesa" }).click();
  await expect(page.getByRole("row").filter({ hasText: description })).toBeVisible({ timeout: 15_000 });
});

test("G. receitas carregam formulários", async ({ page }) => {
  await page.goto("/receitas");
  await expect(page.getByRole("heading", { name: "Receitas", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "+ Nova receita" }).click();
  await expect(page.getByRole("dialog", { name: "Nova receita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registar receita" })).toBeVisible();
});

test("G2. confirmar receita familiar esperada (determinístico + idempotente)", async ({
  page,
}) => {
  const uniqueOrigin = `E2E Familiar ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await page.goto("/receitas");
  await page.getByRole("button", { name: "+ Nova receita" }).click();
  await page.getByText("Transferência familiar", { exact: true }).click();
  const familyForm = page.locator("form").filter({ has: page.locator('input[name="familyOrigin"]') });
  await familyForm.locator('select[name="accountId"]').selectOption({ index: 0 });
  await familyForm.locator('input[name="familyOrigin"]').fill(uniqueOrigin);
  await familyForm.locator('input[name="amount"]').fill("100");
  await familyForm.locator('input[name="nextDueAt"]').fill(today);
  await familyForm.getByRole("button", { name: "Criar série familiar" }).click();

  await page.goto("/contas");
  const balanceLocator = page
    .locator("tr")
    .filter({ has: page.locator('a[href^="/contas/"]') })
    .first()
    .getByTestId("account-balance");
  const balanceBefore = await balanceLocator.textContent();

  await page.goto("/receitas");
  const row = page.getByRole("row").filter({ hasText: uniqueOrigin }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("Prevista");

  await row.getByRole("button", { name: "Confirmar" }).click();
  await expect(row).toContainText("Confirmada", { timeout: 15_000 });

  await page.goto("/contas");
  const balanceAfterFirst = await balanceLocator.textContent();
  expect(balanceAfterFirst).not.toEqual(balanceBefore);

  await page.goto("/receitas");
  const rowAfter = page.getByRole("row").filter({ hasText: uniqueOrigin }).first();
  await expect(rowAfter).toContainText("Confirmada");
  await expect(rowAfter.getByRole("button", { name: "Confirmar" })).toHaveCount(0);

  await page.goto("/transacoes");
  await expect(page.getByRole("row").filter({ hasText: uniqueOrigin })).toHaveCount(1);

  await page.goto("/contas");
  await page.reload();
  const balanceAfterReload = await balanceLocator.textContent();
  expect(balanceAfterReload).toEqual(balanceAfterFirst);
});

test("I. transferências", async ({ page }) => {
  await page.goto("/transacoes");
  await expect(page.getByRole("heading", { name: "Transações", level: 1 })).toBeVisible();
});

test("J. objetivo de poupança", async ({ page }) => {
  const title = `E2E objetivo ${Date.now()}`;
  await page.goto("/plano");
  await page.getByText("＋ Novo objetivo", { exact: true }).click();
  await page.getByPlaceholder("Título").fill(title);
  await page.getByPlaceholder("Montante alvo").fill("500");
  await page.getByRole("button", { name: "Criar objetivo" }).click();
  await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible({
    timeout: 15_000,
  });
});

test("T. estado vazio amigável em investimentos sem posições novas", async ({ page }) => {
  await page.goto("/investimentos");
  await expect(page.getByRole("heading", { name: "Investimentos" })).toBeVisible();
});
