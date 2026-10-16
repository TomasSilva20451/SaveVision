import { test as setup } from "@playwright/test";
import { JOAO, MARIA, loginAs } from "./helpers/auth";

const joaoAuth = "playwright/.auth/joao.json";
const mariaAuth = "playwright/.auth/maria.json";

setup("authenticate João", async ({ page }) => {
  await loginAs(page, JOAO);
  await page.context().storageState({ path: joaoAuth });
});

setup("authenticate Maria", async ({ page }) => {
  await loginAs(page, MARIA);
  await page.context().storageState({ path: mariaAuth });
});
