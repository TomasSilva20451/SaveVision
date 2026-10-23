import { expect, test } from "@playwright/test";

test.describe("Transações — layout e filtros", () => {
  test("abre a página com indicadores e gráficos do período", async ({ page }) => {
    await page.goto("/transacoes");
    await expect(page.getByRole("heading", { name: "Transações", level: 1 })).toBeVisible();
    await expect(page.getByText("Entradas", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entradas e saídas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Despesas por categoria" })).toBeVisible();
  });

  test("pesquisa sem resultados e limpa filtros", async ({ page }) => {
    await page.goto("/transacoes");
    await page.getByPlaceholder("Pesquisar por descrição").fill("movimento-inexistente-e2e");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page.getByText("Nenhum movimento corresponde a estes filtros.")).toBeVisible();
    await page.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/transacoes$/);
  });

  test("nova transação abre transferência e permite cancelar", async ({ page }) => {
    await page.goto("/transacoes");
    await page.getByRole("button", { name: "Nova transação" }).click();
    await expect(page.getByRole("heading", { name: "Nova transação" })).toBeVisible();
    await expect(page.getByText("Categorização local")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sugerir novamente" })).toBeDisabled();
    await page.getByRole("button", { name: "Receita" }).click();
    await page.getByRole("button", { name: "Transferência" }).click();
    await expect(page.getByRole("button", { name: "Registar transferência" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("heading", { name: "Nova transação" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Nova transação" })).toBeFocused();
  });

  test("painel de revisão de categorização abre com review=1", async ({ page }) => {
    await page.goto("/transacoes?review=1");
    await expect(
      page.getByRole("heading", { name: "Sugestões pendentes de categorização" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar sugestões" })).toBeVisible();
  });

  test("filtros cabem na página e o drawer abre à direita", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/transacoes");
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    expect(await fits()).toBe(true);
    await expect(page.getByLabel("De", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Até", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Nova transação" }).click();
    const dialog = page.getByRole("dialog", { name: "Nova transação" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x).toBeGreaterThan(400);
    expect(box!.x + box!.width).toBeGreaterThan((viewport?.width ?? 0) - 8);
    expect(await fits()).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
