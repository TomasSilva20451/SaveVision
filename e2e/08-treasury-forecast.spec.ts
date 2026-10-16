import { expect, test } from "@playwright/test";

test.describe("Fase 17b — previsões de tesouraria", () => {
  test("João vê saldo real e projetado na página de previsões", async ({ page }) => {
    await page.goto("/previsoes?horizon=30");
    await expect(
      page.getByRole("heading", { name: "Projeção com movimentos conhecidos" }),
    ).toBeVisible();
    await expect(page.getByTestId("treasury-real-balance")).toBeVisible();
    await expect(page.getByTestId("treasury-projected-balance")).toBeVisible();
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect(page).toHaveURL(/horizon=30/);
  });

  test("Maria não acede aos dados de tesouraria de João via UI", async ({ browser }) => {
    const maria = await browser.newContext({ storageState: "playwright/.auth/maria.json" });
    const mPage = await maria.newPage();
    await mPage.goto("/previsoes?horizon=30");
    await expect(mPage.getByTestId("treasury-real-balance")).toBeVisible();
    await maria.close();
  });
});
