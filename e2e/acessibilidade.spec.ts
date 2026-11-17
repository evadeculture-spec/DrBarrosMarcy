import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

/** Verificação automática WCAG 2.1 A/AA (contraste, etiquetas, ARIA) nos ecrãs principais. */
const ECRAS = ["/hoje", "/triagem", "/processos", "/processos/novo", "/modelos", "/configuracoes", "/pesquisa?q=Rui"];

for (const largura of [1280, 768, 375]) {
  test(`sem violações WCAG AA a ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await entrar(page, "marcia@demo.example.pt");
    const urls = [...ECRAS];
    await page.goto("/processos?q=Rui");
    await page.getByRole("link", { name: /Rui Fonseca/ }).click();
    await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
    urls.push(new URL(page.url()).pathname);
    for (const url of urls) {
      await page.goto(url);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const resumo = r.violations.map((v) => `${url} · ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(resumo, resumo.join("\n")).toEqual([]);
      const largo = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(largo, `${url} tem deslocamento horizontal a ${largura}px`).toBe(false);
    }
  });
}

test("entrar: sem violações WCAG AA", async ({ page }) => {
  await page.goto("/entrar");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});
