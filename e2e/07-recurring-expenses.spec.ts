import { expect, test } from "@playwright/test";
import { E2E_RECURRING_PREFIX } from "./recurring-e2e-prefix";

async function createForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "+ Nova despesa recorrente" }).click();
  return page.getByRole("dialog").locator("form");
}

async function upcomingItem(page: import("@playwright/test").Page, name: string) {
  const row = page.getByRole("row").filter({ hasText: name }).first();
  await row.locator(`summary[aria-label="Ações de ${name}"]`).click();
  return row;
}

function recorrenciasSection(page: import("@playwright/test").Page) {
  return page.locator("section").filter({
    has: page.getByRole("navigation", { name: "Estado das recorrências" }),
  });
}

async function expectRecurringRow(page: import("@playwright/test").Page, name: string) {
  const row = recorrenciasSection(page).getByRole("row").filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

function parseBalance(text: string | null): number {
  if (!text) return NaN;
  const normalized = text.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number.parseFloat(normalized);
}

function e2eName(suffix: string, stamp: number) {
  return `${E2E_RECURRING_PREFIX}${suffix}-${stamp}`;
}

test.describe("Fase 17a — despesas recorrentes (João)", () => {
  test("E1 criar recorrência mensal e ver na lista", async ({ page }) => {
    const stamp = Date.now();
    const name = e2eName("rec", stamp);
    await page.goto("/despesas-recorrentes");
    await expect(page.getByRole("heading", { name: "Despesas recorrentes", level: 1, exact: true })).toBeVisible();

    const form = await createForm(page);
    await form.getByPlaceholder("Internet").fill(name);
    await form.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await form.locator('input[name="expectedAmount"]').fill("45");
    await form.locator('select[name="frequency"]').selectOption("MONTHLY");
    await form.getByRole("button", { name: "Criar recorrência" }).click();
    await expectRecurringRow(page, name);

    const listed = recorrenciasSection(page).getByText(name);
    await expect
      .poll(
        async () => {
          if ((await listed.count()) > 0) return 1;
          await page.reload({ waitUntil: "networkidle" });
          await expect(page.getByRole("navigation", { name: "Estado das recorrências" })).toBeVisible({
            timeout: 30_000,
          });
          return recorrenciasSection(page).getByText(name).count();
        },
        { timeout: 45_000, intervals: [500, 1000, 2000] },
      )
      .toBeGreaterThan(0);
  });

  test("E3–E5 confirmar pagamento e saldo (47 € efetivos)", async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const name = e2eName("pay", stamp);
    await page.goto("/despesas-recorrentes");
    const form = await createForm(page);
    await form.getByPlaceholder("Internet").fill(name);
    await form.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await form.locator('input[name="expectedAmount"]').fill("45");
    await form.locator('select[name="frequency"]').selectOption("MONTHLY");
    await form.getByRole("button", { name: "Criar recorrência" }).click();
    await expectRecurringRow(page, name);
    await page.reload();

    const row = await upcomingItem(page, name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    const accountSelect = row.locator('select[name="accountId"]');
    const accountId = await accountSelect.inputValue();

    await page.goto("/contas");
    const balanceBefore = parseBalance(
      await page
        .locator("tr")
        .filter({ has: page.locator(`a[href="/contas/${accountId}"]`) })
        .getByTestId("account-balance")
        .textContent(),
    );

    await page.goto("/despesas-recorrentes");
    const payRow = await upcomingItem(page, name);
    await payRow.locator('input[name="actualAmount"]').fill("47");
    await payRow.getByRole("button", { name: "Confirmar pagamento" }).click();
    await page.waitForTimeout(1500);

    await page.goto(`/contas/${accountId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    const balanceAfter = parseBalance(await page.locator("h1 + p.text-lg").textContent());
    expect(balanceAfter).toBeCloseTo(balanceBefore - 47, 2);

    await page.goto("/despesas-recorrentes");
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  });

  test("E6 adiar ocorrência persiste após refresh", async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const name = e2eName("post", stamp);
    await page.goto("/despesas-recorrentes");
    const form = await createForm(page);
    await form.getByPlaceholder("Internet").fill(name);
    await form.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await form.locator('input[name="expectedAmount"]').fill("12");
    await form.locator('select[name="frequency"]').selectOption("MONTHLY");
    await form.getByRole("button", { name: "Criar recorrência" }).click();
    await expectRecurringRow(page, name);
    await page.reload();

    const row = await upcomingItem(page, name);
    await expect(row).toBeVisible({ timeout: 15_000 });

    const civil = new Date();
    // Mantém a ocorrência adiada antes da mensalidade seguinte; caso contrário,
    // a tabela mostra corretamente a próxima ocorrência regular da série.
    civil.setDate(civil.getDate() + 5);
    const iso = `${civil.getFullYear()}-${String(civil.getMonth() + 1).padStart(2, "0")}-${String(civil.getDate()).padStart(2, "0")}`;

    await row.locator('input[name="newDueDate"]').fill(iso);
    await row.getByRole("button", { name: "Adiar" }).click();
    await expect(row).toContainText("adiada", { timeout: 20_000 });

    await page.reload();
    await expect(await upcomingItem(page, name)).toContainText("adiada", { timeout: 15_000 });
  });

  test("E10 Maria não vê recorrência pessoal de João", async ({ browser }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const name = e2eName("iso", stamp);
    const joao = await browser.newContext({ storageState: "playwright/.auth/joao.json" });
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const jPage = await joao.newPage();
    await jPage.goto("/despesas-recorrentes");
    await expect(jPage.getByRole("heading", { name: "Despesas recorrentes", level: 1, exact: true })).toBeVisible({
      timeout: 20_000,
    });
    const form = await createForm(jPage);
    await form.getByPlaceholder("Internet").fill(name);
    await form.locator('select[name="categoryId"]').selectOption({ index: 1 });
    await form.locator('input[name="expectedAmount"]').fill("10");
    await form.locator('select[name="frequency"]').selectOption("MONTHLY");
    await form.getByRole("button", { name: "Criar recorrência" }).click();
    await expectRecurringRow(jPage, name);

    const mPage = await maria.newPage();
    await mPage.goto("/despesas-recorrentes");
    await expect(recorrenciasSection(mPage).getByText(name)).toHaveCount(0);
    await joao.close();
    await maria.close();
  });
});
