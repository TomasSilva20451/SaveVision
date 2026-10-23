import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const receipt = path.join(root, "docs/visual-audit/demo-recibo-sample.jpg");
const out = path.join(root, "docs/visual-audit/demo-recibo-passo3-revisao.png");
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${base}/login`);
await page.locator("#email").fill("telmo@fintwin.local");
await page.locator("#password").fill("Te8-kW3-nS7-pD5-yF1");
await page.getByRole("button", { name: "Entrar" }).click();
await page.waitForURL("**/inicio", { timeout: 15000 });

await page.goto(`${base}/despesas`);
await page.getByRole("button", { name: "Digitalizar recibo" }).click();
await page.getByRole("button", { name: "Escolher imagem" }).click();
const input = page.locator('input[type="file"][accept*="image"]').last();
await input.setInputFiles(receipt);

await page.getByLabel(/Total \(€\)/i).waitFor({ timeout: 180000 });
await page.screenshot({ path: out, fullPage: false });
console.log("Saved", out);

await browser.close();
