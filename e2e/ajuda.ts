import { expect, type Page } from "@playwright/test";

export const PALAVRA_PASSE = process.env.SEED_DEMO_PASSWORD ?? "";

export async function entrar(page: Page, email: string, base = "") {
  await page.goto(`${base}/entrar`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(PALAVRA_PASSE);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/hoje$/);
}
