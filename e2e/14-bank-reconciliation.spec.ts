import { expect, test } from "@playwright/test";

test.describe("Fase 28 — reconciliação bancária", () => {
  test("importa CSV e executa auto-match após despesa", async ({ page }) => {
    const amount = "33.21";
    const description = `E2E recon ${Date.now()}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });

    await page.goto("/despesas");
    await page.getByRole("button", { name: "＋ Nova despesa" }).click();
    const drawer = page.getByRole("dialog", { name: "Nova despesa" });
    await drawer.locator('select[name="accountId"]').selectOption({ index: 0 });
    await drawer.getByLabel("Descrição").fill(description);
    await drawer.getByLabel("Montante (€)").fill(amount);
    await drawer.getByRole("button", { name: "Registar despesa" }).click();
    await expect(page.getByRole("row").filter({ hasText: description })).toBeVisible({ timeout: 15_000 });

    await page.goto("/reconciliacao");
    await expect(page.getByRole("heading", { name: "Reconciliação bancária" })).toBeVisible();

    const matchedBefore = Number((await page.getByTestId("recon-kpi-matched").textContent())?.replace(/\D/g, "") || "0");

    const csv = `data,montante,descricao\n${today},-${amount},${description}`;
    await page.locator('textarea[name="csvText"]').fill(csv);
    await page.getByRole("button", { name: "Importar" }).click();
    await page.getByRole("button", { name: "Executar auto-match" }).click();

    await expect
      .poll(async () => {
        const text = await page.getByTestId("recon-kpi-matched").textContent();
        const n = Number(text?.replace(/[^\d]/g, "") || "0");
        return n;
      })
      .toBeGreaterThan(matchedBefore);
  });

  test("tesouraria empresarial mostra saldo e reconciliação", async ({ page }) => {
    await page.goto("/empresa/tesouraria");
    await expect(page.getByRole("heading", { name: "Tesouraria empresarial" })).toBeVisible();
    await expect(page.getByTestId("corp-treasury-real-balance")).toBeVisible();
    await expect(page.getByTestId("corp-treasury-recon-unmatched")).toBeVisible();
  });
});
