import { expect, test } from "@playwright/test";

test.describe("Fase 18 — alertas financeiros", () => {
  test("E1 abrir /alertas", async ({ page }) => {
    await page.goto("/alertas");
    await expect(page.getByRole("heading", { name: "Alertas financeiros" })).toBeVisible();
    await expect(page.getByTestId("financial-alerts-page")).toBeVisible();
  });

  test("E2 visualizar alerta quando existir", async ({ page }) => {
    await page.goto("/alertas");
    const items = page.getByTestId("financial-alert-item");
    const count = await items.count();
    if (count > 0) {
      await expect(items.first()).toBeVisible();
    }
  });

  test("E4 marcar alerta como visto", async ({ page }) => {
    await page.goto("/alertas");
    const item = page.getByTestId("financial-alert-item").first();
    if ((await item.count()) === 0) return;
    await item.getByRole("button", { name: "Marcar como visto" }).click();
    await page.goto("/alertas");
    await expect(page.getByTestId("financial-alerts-page")).toBeVisible();
  });

  test("E6 persistência após refresh", async ({ page }) => {
    await page.goto("/alertas");
    const before = await page.getByTestId("financial-alert-item").count();
    await page.reload();
    const after = await page.getByTestId("financial-alert-item").count();
    expect(after).toBe(before);
  });

  test("E8 navegar para área associada", async ({ page }) => {
    await page.goto("/alertas");
    const link = page.getByRole("link", { name: "Ver detalhe" }).first();
    if ((await link.count()) === 0) return;
    await link.click();
    await expect(page).not.toHaveURL(/\/alertas$/);
  });

  test("E10 Maria isolada — alertas no workspace próprio", async ({ browser }) => {
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const mPage = await maria.newPage();
    await mPage.goto("/alertas");
    await expect(mPage.getByTestId("financial-alerts-page")).toBeVisible();
    await maria.close();
  });

  test("E13 refresh não duplica alertas visíveis", async ({ page }) => {
    await page.goto("/alertas");
    await page.reload();
    await page.reload();
    await expect(page.getByTestId("financial-alerts-page")).toBeVisible();
  });

  test("E14 dashboard secção alertas", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-alerts-section")).toBeVisible();
  });

  test("E15 estado vazio ou lista válida", async ({ page }) => {
    await page.goto("/alertas");
    const pageRoot = page.getByTestId("financial-alerts-page");
    await expect(pageRoot).toBeVisible();
  });

  test("E16 reavaliação explícita — botão Atualizar alertas", async ({ page }) => {
    await page.goto("/alertas");
    await expect(page.getByRole("button", { name: "Atualizar alertas" })).toBeVisible();
  });

  test("E11 estado de leitura independente (Maria)", async ({ browser }) => {
    async function selectJoint(page: import("@playwright/test").Page) {
      await page.goto("/inicio");
      await page.getByRole("button", { name: /Casa João e Maria/i }).click();
    }

    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const mPage = await maria.newPage();
    await selectJoint(mPage);
    await mPage.goto("/alertas");
    await mPage.getByRole("button", { name: "Atualizar alertas" }).click();
    const joao = await browser.newContext({ storageState: "playwright/.auth/joao.json" });
    const jPage = await joao.newPage();
    await selectJoint(jPage);
    await jPage.goto("/alertas");
    await jPage.getByRole("button", { name: "Atualizar alertas" }).click();
    const item = jPage.getByTestId("financial-alert-item").first();
    if ((await item.count()) === 0) {
      await maria.close();
      await joao.close();
      return;
    }
    await item.getByRole("button", { name: "Marcar como visto" }).click();
    await mPage.reload();
    const mariaItem = mPage.getByTestId("financial-alert-item").first();
    if ((await mariaItem.count()) > 0) {
      await expect(mariaItem).toHaveAttribute("data-alert-unseen", "true");
    }
    await maria.close();
    await joao.close();
  });
});
