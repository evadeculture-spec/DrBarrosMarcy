import { expect, test, type Page } from "@playwright/test";

/**
 * Percurso completo pela navegação normal, no escritório de demonstração
 * com 250 clientes: pesquisa → ficha do cliente → novo processo → três
 * anexos (um de outro processo) → correção com rasto → revisão única →
 * pedido sem envio → transferência para um colega → dashboard coerente.
 */

async function entrarRapido(page: Page, nome: string) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: new RegExp(nome) }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function valorCartao(page: Page, rotulo: string): Promise<number> {
  const texto = await page.locator(`[data-indicador="${rotulo}"]`).innerText();
  return Number(texto.match(/\d+/)![0]);
}

test("percurso principal com 250 clientes", async ({ page }) => {
  test.setTimeout(120_000);
  await entrarRapido(page, "Márcia Raposo");

  // Dashboard: sete cartões; cada um abre a lista com o mesmo número.
  for (const rotulo of ["Processos ativos", "Prazos hoje", "Prazos vencidos", "Documentos em falta", "Processos parados", "Pagamentos pendentes", "Tarefas atribuídas a mim"]) {
    await expect(page.locator(`[data-indicador="${rotulo}"]`)).toBeVisible();
  }
  const parados = await valorCartao(page, "Processos parados");
  await page.locator('[data-indicador="Processos parados"]').click();
  await expect(page.getByTestId("total")).toHaveText(`(${parados})`);
  if (parados > 0) await expect(page.getByTestId("lista-indicador").locator("li")).toHaveCount(parados);

  // 1. Pesquisa «ines» no topo: duas Inês Faria, distinguidas.
  await page.goto("/dashboard");
  await page.getByLabel("Pesquisar no escritório").fill("ines faria");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pesquisa\?q=ines/);
  const resultados = page.locator('section[aria-labelledby="r-cli"] li', { hasText: "Inês Faria" });
  await expect(resultados).toHaveCount(2);
  await expect(resultados.first()).toContainText("Homónimo");
  await resultados.filter({ hasText: "Castelo Branco" }).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Inês Faria" })).toBeVisible();
  await expect(page.getByText("ines.faria@example.pt")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Próxima ação" })).toBeVisible();
  await page.getByTestId("voltar-lista").click();
  await expect(page).toHaveURL(/\/pesquisa\?q=ines/);

  // Lista de clientes: pesquisa + página mantidas ao voltar da ficha.
  await page.goto("/clientes?pagina=3");
  await expect(page.getByText(/51–75 de 250 clientes/)).toBeVisible();
  await page.locator('ul[aria-label="Clientes"] a').first().click();
  await page.getByTestId("voltar-lista").click();
  await expect(page).toHaveURL(/\/clientes\?pagina=3$/);
  await page.getByLabel(/Procurar por nome/).fill("ines castelo");
  await page.getByRole("button", { name: "Procurar" }).click();
  await page.getByRole("link", { name: /Inês Faria/ }).click();

  // 2. Novo processo a partir da ficha: cliente pré-selecionado.
  await page.getByRole("link", { name: "Novo processo para este cliente" }).click();
  await expect(page.getByLabel("Cliente", { exact: true })).toHaveValue(/[0-9a-f-]{36}/);
  await expect(page.getByLabel("Cliente", { exact: true }).locator("option:checked")).toContainText("Inês Faria — CLI-0001");
  await page.getByLabel("Tipo de processo").selectOption({ label: "Habilitação de herdeiros" });
  await page.getByRole("button", { name: "Criar processo" }).click();
  await page.waitForURL(/\/processos\/[0-9a-f-]{36}/);
  const urlProcesso = new URL(page.url()).pathname;
  await expect(page.getByTestId("proxima-acao")).toContainText("Próxima ação");
  await expect(page.getByTestId("quem")).toHaveText("Márcia Raposo");
  const referencia = (await page.locator("header p.font-mono").first().innerText()).trim();

  // 3. Simular a receção de três anexos e tratá-los na Receção.
  await page.getByRole("button", { name: "Simular resposta do cliente (3 anexos)" }).click();
  await expect(page).toHaveURL(/\/documentos\?separador=rececao/);
  const cartao = page.locator("li[id^=email-]", { hasText: `Re: Processo ${referencia}` }).last();
  const anexos = cartao.locator("ul > li");
  await expect(anexos).toHaveCount(3);
  await expect(cartao.getByRole("link", { name: /Pré-visualizar/ }).first()).toHaveAttribute("href", /\?ver=1$/);
  // Ler as três sugestões antes de decidir (são só sugestões).
  const linhas: { ficheiro: string; sugestao: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const l = anexos.nth(i);
    linhas.push({
      ficheiro: (await l.locator("span.truncate").first().innerText()).trim(),
      sugestao: await l.locator("p", { hasText: "Sugestão" }).innerText(),
    });
  }
  const alheio = linhas.find((l) => !l.sugestao.includes(referencia));
  expect(alheio, JSON.stringify(linhas)).toBeTruthy();
  const deOutro: string | null = alheio!.sugestao.match(/\d{4}\/\d{3}/)![0];
  for (const l of linhas) {
    const linha = cartao.locator("ul > li", { hasText: l.ficheiro });
    if (l === alheio) {
      // O anexo de outro processo: associado por engano a este processo…
      const valor = await linha.getByLabel("Processo").locator("option", { hasText: `${referencia} —` }).first().getAttribute("value");
      await linha.getByLabel("Processo").selectOption(valor!);
      await linha.getByLabel("Documento").selectOption("");
    }
    await linha.getByRole("button", { name: "Associar" }).click();
    await expect(linha.getByText(/Associado a/)).toBeVisible();
  }
  expect(deOutro).not.toBeNull();

  // …e corrigir na ficha com «Mover», deixando rasto.
  await page.goto(urlProcesso);
  const solto = page.locator("li", { has: page.getByRole("button", { name: /^Mover/ }) }).filter({ hasNotText: "Inês" }).first();
  await solto.getByRole("button", { name: /^Mover/ }).click();
  const opcaoDestino = await page.getByLabel("Mover para o processo").locator("option", { hasText: deOutro! }).getAttribute("value");
  await page.getByLabel("Mover para o processo").selectOption(opcaoDestino!);
  await page.getByRole("button", { name: "Mover", exact: true }).click();
  await expect(page.getByText(/movido para/).first()).toBeVisible();
  await expect(page.getByTestId("ultima-decisao")).toContainText("movido para");
  await expect(page.getByTestId("faixa")).toContainText("Falta: 1 documento");

  // Uma única revisão; repetir a receção não a duplica.
  await page.getByRole("tab", { name: "Tarefas" }).click();
  await expect(page.locator("[data-tarefa^='Rever documentos recebidos']")).toHaveCount(1);
  await page.getByRole("tab", { name: "Documentos" }).click();
  await page.getByRole("button", { name: "Simular resposta do cliente (3 anexos)" }).click();
  await expect(page).toHaveURL(/separador=rececao/);
  await page.goto(urlProcesso + "?separador=tarefas");
  await expect(page.locator("[data-tarefa^='Rever documentos recebidos']")).toHaveCount(1);

  // 4. Preparar o pedido sem enviar: continua por enviar depois de recarregar.
  await page.getByRole("tab", { name: "Pedido ao cliente" }).click();
  await page.getByRole("button", { name: "Preparar pedido ao cliente" }).last().click();
  await expect(page.getByRole("heading", { name: /Pedido ao cliente — Rascunho/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar texto" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Pedido ao cliente" }).click();
  await expect(page.getByRole("heading", { name: /Pedido ao cliente — Rascunho/ })).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText(/Rascunho de pedido ao cliente criado/)).toBeVisible();
  await expect(page.getByText(/^Pedido enviado/)).toHaveCount(0);

  // 5. Transferir para um colega e recarregar: persiste.
  await page.getByLabel("Responsável").selectOption({ label: "Carolina Folgado" });
  await expect(page.getByText("Responsável alterado.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("quem")).toHaveText("Carolina Folgado");
  await expect(page.getByTestId("ultima-decisao")).toContainText("Responsável passou a ser Carolina Folgado");
});

for (const [nome, largura, altura] of [["ipad-horizontal", 1180, 820], ["desktop", 1440, 900], ["telemovel", 390, 844]] as const) {
  test(`dashboard em ${nome}: hierarquia e sem deslocamento horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await entrarRapido(page, "Márcia Raposo");
    await expect(page.getByRole("heading", { name: /Márcia$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prioridades de hoje" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Processos parados — porquê?" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (largura < 1024) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(page.getByRole("link", { name: "Documentos em falta", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/dashboard-${nome}.png`, fullPage: largura >= 1024 ? false : true });
  });
}
