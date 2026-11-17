import { expect, test } from "@playwright/test";
import { entrar } from "./ajuda";

test("triagem: associar um anexo com sugestão e anular", async ({ page }) => {
  await entrar(page, "carolina@demo.example.pt");
  await page.getByRole("link", { name: "Triagem" }).click();
  const cartao = page.locator("li", { hasText: "Cartao_cidadao_Joaquim_Pires.pdf" }).first();
  await expect(cartao.getByLabel("Processo")).toHaveValue(/.+/); // sugestão pré-selecionada
  await cartao.getByLabel("Documento").selectOption({ label: "Documento de identificação do mandante (em falta)" });
  await cartao.getByRole("button", { name: "Associar" }).click();
  await expect(page.getByText(/associado a 2026\/036|associado a \d{4}\/036/)).toBeVisible();
  await page.getByRole("button", { name: "Anular" }).click();
  await expect(page.getByText("Anulado.")).toBeVisible();
  await expect(cartao.getByRole("button", { name: "Associar" })).toBeVisible();
});

test("pedido: falha simulada, reenvio, a bola passa ao cliente e sai de Hoje", async ({ page }) => {
  await entrar(page, "joao@demo.example.pt");
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Simular falha no próximo envio" }).click();
  await expect(page.getByText("O próximo envio vai falhar.")).toBeVisible();

  await page.goto("/processos?q=Ana Sofia");
  await page.getByRole("link", { name: /Ana Sofia Lemos/ }).click();
  await page.getByRole("button", { name: "Preparar pedido ao cliente" }).click();
  await expect(page.getByLabel("Texto")).toContainText("Título aquisitivo");
  await page.getByRole("button", { name: "Aprovar e enviar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "O envio falhou" }).first()).toBeVisible();
  await expect(page.getByTestId("faixa")).toContainText("Aguarda: Márcia Raposo");

  await page.getByRole("button", { name: "Reenviar" }).click();
  await expect(page.getByTestId("faixa")).toContainText("Aguarda: Ana Sofia Lemos (cliente)");
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText(/^Pedido enviado para ana\.lemos@example\.pt/)).toHaveCount(1);

  await page.goto("/hoje");
  await expect(page.getByText("Conferir documentos de Ana Sofia Lemos")).toHaveCount(0);
});

test("retoma: reabrir o processo volta ao separador onde se estava", async ({ page }) => {
  await entrar(page, "marcia@demo.example.pt");
  await page.goto("/processos?q=Fernando");
  await page.getByRole("link", { name: /Fernando Batista/ }).click();
  await page.getByRole("tab", { name: "Prazos e seguimento" }).click();
  await expect(page.getByRole("tab", { name: "Prazos e seguimento" })).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(300);
  await page.goto("/hoje");
  await page.getByRole("link", { name: /Continuar em/ }).click();
  await expect(page.getByRole("tab", { name: "Prazos e seguimento" })).toHaveAttribute("aria-selected", "true");
});

test("teclado: saltar para o conteúdo e navegar nos separadores com setas", async ({ page }) => {
  await entrar(page, "marcia@demo.example.pt");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar para o conteúdo" })).toBeFocused();
  await page.goto("/processos?q=Rui");
  await page.getByRole("link", { name: /Rui Fonseca/ }).click();
  await page.getByRole("tab", { name: "Documentos" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Pedido ao cliente" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Pedido ao cliente" })).toHaveAttribute("aria-selected", "true");
});

test("entrada rápida da demonstração: um clique, sem palavra-passe", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: /João Barros/ }).click();
  await expect(page).toHaveURL(/\/hoje$/);
  await expect(page.getByText("João Barros")).toBeVisible();
  await expect(page.getByText(/Administrador ·/)).toBeVisible();
});

test("entrada rápida não existe fora do escritório de demonstração", async ({ page }) => {
  await page.goto("http://norte.localhost:3100/entrar");
  await expect(page.getByText("Entrada rápida")).toHaveCount(0);
});
