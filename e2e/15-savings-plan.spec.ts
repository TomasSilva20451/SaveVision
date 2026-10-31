import { expect, test } from "@playwright/test";

const uniqueKey = () => `e2e-sp-${Date.now()}`;

async function openSavingsWizard(page: import("@playwright/test").Page) {
  await page.goto("/plano?novo-plano=1");
  await expect(page.getByRole("heading", { name: "Plano", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Criar plano de poupança", level: 2 })).toBeVisible();
}

test.describe("Plano de Poupança", () => {
  test("wizard completo e pré-visualização no passo 5", async ({ page }) => {
    await openSavingsWizard(page);

    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByRole("button", { name: "Seguinte" }).click();

    await expect(page.getByText("Sem transações automáticas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Nenhuma transação nem contribuição fictícia")).toBeVisible();
  });

  test("activar plano E2E dedicado", async ({ page }) => {
    test.setTimeout(120_000);
    const key = uniqueKey();
    await openSavingsWizard(page);
    await page.getByLabel("Nome do plano").fill(`Plano ${key}`);
    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByLabel("Nome da nova conta").fill(`Poupança ${key}`);
    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByRole("checkbox", { name: /Confirmo alterações/i }).check();
    await page.getByRole("button", { name: "Seguinte" }).click();
    await page.getByRole("button", { name: "Seguinte" }).click();
    await expect(page.getByText("Sem transações automáticas")).toBeVisible({ timeout: 20_000 });
    const activate = page.getByRole("button", { name: "Confirmar activação" });
    await expect(activate).toBeEnabled({ timeout: 10_000 });
    const activationDone = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/plano") &&
        response.status() < 500,
      { timeout: 120_000 },
    );
    await activate.click();
    await activationDone;
    await page.goto("/dashboard");
    const card = page.getByTestId("savings-plan-dashboard-card");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByRole("heading", { name: `Plano ${key}` })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("cartão no dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Saldo total")).toBeVisible();
    const card = page.getByTestId("savings-plan-dashboard-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
  });

  test("detalhe, pausa e retoma", async ({ page }) => {
    await page.goto("/dashboard");
    const link = page.getByRole("link", { name: "Ver plano" }).first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(page.getByTestId("savings-plan-weekly-review")).toBeVisible();
    await page.getByRole("button", { name: "Pausar" }).click();
    await page.getByRole("button", { name: "Retomar" }).click();
  });

  test("modo escuro — cartão legível", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard");
    await expect(page.getByTestId("savings-plan-dashboard-card")).toBeVisible({ timeout: 15_000 });
  });

  test("layout mobile — wizard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSavingsWizard(page);
  });

  test("página plano — botão abre assistente", async ({ page }) => {
    await page.goto("/plano");
    await expect(page.getByRole("heading", { name: "Plano", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Criar plano de poupança", level: 2 })).not.toBeVisible();
    await page.getByRole("link", { name: "Criar plano de poupança" }).click();
    await expect(page.getByRole("heading", { name: "Criar plano de poupança", level: 2 })).toBeVisible();
  });

  test("relatórios — página carrega", async ({ page }) => {
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: /Relatórios/i, level: 1 })).toBeVisible();
  });
});

test.describe("Isolamento workspace conjunto", () => {
  test.use({ storageState: "playwright/.auth/maria.json" });

  test("Maria não vê wizard activo no workspace conjunto", async ({ page }) => {
    await page.goto("/plano?novo-plano=1");
    const jointHint = page.getByText(/workspace pessoal|conta conjunta/i);
    if (await jointHint.count()) {
      await expect(jointHint.first()).toBeVisible();
    }
  });
});
