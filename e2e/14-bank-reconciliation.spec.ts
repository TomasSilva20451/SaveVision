import { expect, test, type Locator, type Page } from "@playwright/test";

async function finalKpiValue(page: Page, testId: string) {
  const value = await page
    .getByTestId(testId)
    .locator(".animated-financial-value")
    .getAttribute("aria-label");
  return Number(value?.replace(/[^\d]/g, "") || "0");
}

async function submitReconciliationAction(page: Page, button: Locator) {
  await page.waitForFunction(
    () => document.documentElement.dataset.appHydrated === "true",
    undefined,
    { timeout: 15_000 },
  );
  const actionCompleted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/reconciliacao",
    { timeout: 15_000 },
  );
  await button.click();
  await actionCompleted;
}

test.describe("Fase 28 — reconciliação bancária", () => {
  test("importa CSV e executa auto-match após despesa", async ({ page }) => {
    const amount = "33.21";
    const description = `E2E recon ${Date.now()}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });

    await page.goto("/despesas");
    await page.getByRole("button", { name: "＋ Nova despesa" }).click();
    const drawer = page.getByRole("dialog", { name: "Nova despesa" });
    await drawer.locator('select[name="accountId"]').selectOption({ label: "Conta à ordem" });
    await drawer.getByLabel("Descrição").fill(description);
    await drawer.getByLabel("Montante (€)").fill(amount);
    await drawer.locator('input[name="occurredAt"]').fill(today);
    await drawer.getByRole("button", { name: "Registar despesa" }).click();
    await expect(page.getByRole("row").filter({ hasText: description })).toBeVisible({ timeout: 15_000 });

    await page.goto("/reconciliacao");
    await expect(page.getByRole("heading", { name: "Reconciliação bancária" })).toBeVisible();
    await page.locator('select[name="accountId"]').selectOption({ label: "Conta à ordem" });

    const matchedBefore = await finalKpiValue(page, "recon-kpi-matched");

    const csv = `data,montante,descricao\n${today},-${amount},${description}`;
    await page.locator('textarea[name="csvText"]').fill(csv);
    await submitReconciliationAction(page, page.getByRole("button", { name: "Importar" }));
    await expect(page.getByRole("row").filter({ hasText: description })).toBeVisible({ timeout: 15_000 });

    await submitReconciliationAction(page, page.getByRole("button", { name: "Executar auto-match" }));

    await expect
      .poll(() => finalKpiValue(page, "recon-kpi-matched"), { timeout: 15_000 })
      .toBeGreaterThan(matchedBefore);
  });

  test("tesouraria empresarial mostra saldo e reconciliação", async ({ page }) => {
    await page.goto("/empresa/tesouraria");
    await expect(page.getByRole("heading", { name: "Tesouraria empresarial" })).toBeVisible();
    await expect(page.getByTestId("corp-treasury-real-balance")).toBeVisible();
    await expect(page.getByTestId("corp-treasury-recon-unmatched")).toBeVisible();
  });
});
