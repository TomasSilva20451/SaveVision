import { expect, test } from "@playwright/test";

test.describe("isolamento entre sessões", () => {
  test("B. sessão de Maria (storageState)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "playwright/.auth/maria.json",
    });
    const page = await context.newPage();
    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
    await context.close();
  });

  test("C. dashboards independentes", async ({ browser }) => {
    const joaoContext = await browser.newContext({
      storageState: "playwright/.auth/joao.json",
    });
    const mariaContext = await browser.newContext({
      storageState: "playwright/.auth/maria.json",
    });
    const joao = await joaoContext.newPage();
    const maria = await mariaContext.newPage();

    await joao.goto("/dashboard");
    await maria.goto("/dashboard");

    await expect(joao.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(maria.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await joaoContext.close();
    await mariaContext.close();
  });

  test("P. API CSV de João não usa sessão de Maria", async ({ browser }) => {
    const joaoContext = await browser.newContext({
      storageState: "playwright/.auth/joao.json",
    });
    const mariaContext = await browser.newContext({
      storageState: "playwright/.auth/maria.json",
    });
    await joaoContext.newPage();
    await mariaContext.newPage();

    const joaoCsv = await joaoContext.request.get("/api/reports/csv");
    expect(joaoCsv.ok()).toBeTruthy();

    await mariaContext.clearCookies();
    const unauth = await mariaContext.request.get("/api/reports/csv");
    expect(unauth.status()).toBe(401);

    await joaoContext.close();
    await mariaContext.close();
  });
});
