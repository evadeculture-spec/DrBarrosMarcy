import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

const NORTE = "http://norte.localhost:3100";

test("critério 1: quem nunca abriu o processo lê na faixa o que falta e quem age", async ({ page }) => {
  await entrar(page, "tiago@demo.example.pt");
  await page.getByRole("link", { name: /Rui Fonseca/ }).first().click();
  const faixa = page.getByTestId("faixa");
  await expect(faixa).toHaveText(
    /^Falta: 1 documento · Aguarda: Márcia Tavares desde \d{2}\/\d{2}\/\d{4} · Responsável: Márcia Tavares$/,
  );
  // A faixa continua visível depois de descer a página.
  await page.mouse.wheel(0, 2000);
  await expect(faixa).toBeInViewport();
});

test("critério 1: processo à espera do cliente diz que é o cliente quem age", async ({ page }) => {
  await entrar(page, "tiago@demo.example.pt");
  await page.goto("/processos?q=Joaquim");
  await page.getByRole("link", { name: /Joaquim Pires/ }).click();
  await expect(page.getByTestId("faixa")).toContainText("Aguarda: Joaquim Pires (cliente) desde");
});

test("critério 5: o escritório Norte não acede a nada do Demo", async ({ page, browser }) => {
  // Recolher ids reais do escritório Demo.
  await entrar(page, "ines@demo.example.pt");
  await page.getByRole("link", { name: /Rui Fonseca/ }).first().click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  const urlProcesso = new URL(page.url()).pathname;
  const hrefAnexo = await page.locator('a[href^="/api/anexos/"]').first().getAttribute("href");
  expect(hrefAnexo).toBeTruthy();
  const cookieDemo = (await page.context().cookies()).find((c) => c.name === "sf_sessao")!;

  const norte = await browser.newContext();
  const p2 = await norte.newPage();
  // A sessão do Demo não serve no Norte, mesmo copiando o cookie.
  await norte.addCookies([{ ...cookieDemo, domain: "norte.localhost" }]);
  await p2.goto(`${NORTE}/hoje`);
  await expect(p2).toHaveURL(/\/entrar$/);
  // As credenciais do Demo também não.
  await p2.getByLabel("Email").fill("ines@demo.example.pt");
  await p2.getByLabel("Palavra-passe").fill(process.env.SEED_DEMO_PASSWORD!);
  await p2.getByRole("button", { name: "Entrar" }).click();
  await expect(p2.getByText("Email ou palavra-passe incorretos.")).toBeVisible();

  await entrar(p2, "paulo@norte.example.pt", NORTE);
  // URL direto do processo
  await p2.goto(`${NORTE}${urlProcesso}`);
  await expect(p2.getByRole("heading", { name: "Não encontrado" })).toBeVisible();
  // Ligação de anexo
  const r = await p2.goto(`${NORTE}${hrefAnexo}`);
  expect(r?.status()).toBe(404);
  // Pesquisa
  await p2.goto(`${NORTE}/pesquisa?q=Rui`);
  await expect(p2.getByText("Sem resultados para «Rui».")).toBeVisible();
  // Exportação
  const exp = await p2.goto(`${NORTE}/api/exportar/processo/${urlProcesso.split("/").pop()}`);
  expect(exp?.status()).toBe(404);
  await norte.close();
});

test("sem sessão não se descarrega nenhum anexo", async ({ page, browser }) => {
  await entrar(page, "ines@demo.example.pt");
  await page.getByRole("link", { name: /Rui Fonseca/ }).first().click();
  const href = await page.locator('a[href^="/api/anexos/"]').first().getAttribute("href");
  const anonimo = await browser.newContext();
  const r = await (await anonimo.newPage()).goto(`http://demo.localhost:3100${href}`);
  expect(r?.status()).toBe(401);
  await anonimo.close();
});
