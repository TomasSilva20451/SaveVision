import { expect, test } from "@playwright/test";

test("L. exportação CSV autenticada", async ({ page, request }) => {
  await page.goto("/relatorios");
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const response = await request.get("/api/reports/csv", {
    headers: { Cookie: cookieHeader },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  expect(body).toContain("Saldo inicial");
});

test("M. exportação PDF autenticada", async ({ page, request }) => {
  await page.goto("/relatorios");
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const response = await request.get("/api/reports/pdf", {
    headers: { Cookie: cookieHeader },
  });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
});

test("N. upload de documento permitido (txt)", async ({ page }) => {
  const fileName = `nota-e2e-${Date.now()}.txt`;
  await page.goto("/relatorios");
  await page.setInputFiles('input[name="file"]', {
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from("FinTwin E2E documento"),
  });
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("link", { name: fileName })).toBeVisible({ timeout: 20_000 });
});

test("O. rejeição de ficheiro inválido", async ({ page }) => {
  await page.goto("/relatorios");
  await page.setInputFiles('input[name="file"]', {
    name: "fake.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("isto nao e pdf"),
  });
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("fake.pdf")).not.toBeVisible();
});
