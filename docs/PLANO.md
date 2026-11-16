# Plano por fases — SolicitaFlow

_Proposta de 16/11/2026. Nada além deste documento e de `docs/ESTADO.md` foi
alterado. Aguarda aprovação antes da Fase 0/1._

> Promessa: **«Sabe sempre o que falta em cada processo, quem tem de agir e
> desde quando.»** Cada fase abaixo diz como a serve.

---

## 1. Decisões que preciso que aprove

São as decisões difíceis de reverter ou que mudam fornecedor. Indico a minha
recomendação; respondam por número.

**D1 — Base de dados, ficheiros e autenticação: Supabase.**
Postgres com Row Level Security (isolamento imposto pela BD, critério 5),
Storage com políticas por escritório (isolamento dos anexos) e Auth com
papéis (Fase 5) no mesmo fornecedor. O README já apontava para lá e a
Vercel continua a servir a app. Alternativa: Postgres próprio + Auth.js +
S3 — mais peças para manter, sem ganho para equipas pequenas.
Recomendo **Supabase**, com projeto separado para desenvolvimento e
produção, região UE.

**D2 — Onde vivem as regras: no servidor Next.js, não no browser.**
Server Actions / Route Handlers chamam um módulo de domínio puro
(`src/server/domain`) que valida estados, permissões e idempotência. A BD
reforça com RLS, restrições `CHECK`, chaves únicas e um gatilho que impede
alterar ou apagar o histórico. O browser deixa de ter `useStore` com a
verdade dos dados.

**D3 — Isolamento por escritório desde a Fase 0, autenticação real só na
Fase 5 (como pedido).**
Todas as tabelas nascem com `organization_id` e políticas RLS. Cada pedido
ao servidor corre numa transação com
`set local role authenticated; set local request.jwt.claims = {...}` — o mesmo
mecanismo que o Supabase usa —, por isso as políticas escritas na Fase 0
servem sem alterações quando a autenticação real chegar. Até à Fase 5 a
sessão é uma **sessão de desenvolvimento** assinada no servidor (escolha de
perfil de demo), desativada por omissão em produção.
⚠️ Consequência: **até ao fim da Fase 5 a aplicação não pode receber dados
reais**. Se quiserem usar a app com clientes antes disso, a autenticação
tem de subir para a Fase 1.

**D4 — Estados antigos são substituídos, não convertidos.**
Os 9 estados atuais (Novo pedido, Submetido, Faturado…) dão lugar aos 8
pedidos. Como só há dados fictícios em memória, não há migração
destrutiva; os dados de demonstração são reescritos.

**D5 — Retirar da interface o que não serve a promessa.**
Proposta:
| Retirar | Porquê |
|---|---|
| Honorários e estado de pagamento | Faturação está fora de âmbito |
| Prioridade (Baixa…Urgente) | Substituída por «quem age e desde quando» e pelo Seguimento |
| Vista kanban | Duplica a lista; com 8 estados fica ilegível em tablet |
| `/importar` (CSV) | Não tem lógica; a entrada passa a ser a Triagem |
| «Processos parados» escritos à mão | Passa a ser derivado do estado e das datas |
| `/tarefas` como página separada | Absorvida pela vista Hoje (Fase 4). **Confirmar** — se usam tarefas fora dos processos, mantenho-a |
| `/documentos` («Documentos em falta») | Absorvida pela faixa da ficha e pela vista Hoje |

**D6 — Identidade do escritório nos dados de demo.**
`src/data/users.ts` tem «Dr. Barros & Marcy» com NIF, morada, telefone e
domínio. Se for um escritório real, proponho substituir por um escritório
fictício («Solicitadoria Exemplo, Lda», `example.pt`) e passar os dados
reais para a configuração do escritório (Fase 5), fora do código.
**É real?**

**D7 — Envio dos pedidos ao cliente (Fase 3).**
Proponho uma interface `EnvioDeEmail` com duas implementações: «registo»
(guarda a mensagem e permite simular falha — usada em testes e demo) e um
fornecedor SMTP/transacional a escolher depois. Não escolho fornecedor
agora. **Têm preferência?** (ex.: conta de email do escritório por SMTP.)

**D8 — Papéis.** `triagem`, `solicitador`, `administrador` (substituem
`assistente`, `solicitador`, `admin`). Proposta de permissões:
| Ação | triagem | solicitador | administrador |
|---|---|---|---|
| Carregar email/anexos, associar, mover, anular | ✔ | ✔ | ✔ |
| Conferir itens, editar Seguimento | ✔ | ✔ | ✔ |
| Preparar rascunho de pedido | ✔ | ✔ | ✔ |
| **Aprovar e enviar pedido** | ✘ | ✔ | ✔ |
| **Confirmar Prazo** | ✘ | ✔ | ✔ |
| Marcar Concluído / reabrir | ✘ | ✔ | ✔ |
| Utilizadores, listas documentais, exportar escritório | ✘ | ✘ | ✔ |

**D9 — Estado em falta?** A lista de 8 estados não tem «A aguardar entidade
externa» (conservatória, AT, notário), que hoje existe. Sem ele, um
processo nessa situação fica «Completo» ou «Concluído» sem dizer quem age.
Não o acrescento sem indicação vossa.

---

## 2. Arquitetura proposta

```
Browser (React, só apresentação + rascunhos)
   │  Server Actions / Route Handlers (validação com zod)
   ▼
src/server/domain      regras puras: máquina de estados, permissões,
                       «o que falta», «quem age», vista Hoje, idempotência
src/server/db          acesso SQL por escritório (withTenant)
   ▼
Postgres (Supabase)    RLS por organization_id, CHECKs, gatilho de
                       histórico só-acrescentar, chaves únicas
Storage (Supabase)     bucket privado, caminho <org_id>/<anexo_id>,
                       políticas por escritório, URLs assinadas curtas
```

### Modelo de dados (esboço)

| Tabela | Notas |
|---|---|
| `organizations` | `slug` (subdomínio), nome, configuração |
| `members` | utilizador ↔ escritório, papel |
| `clients` | |
| `matter_types`, `document_requirements` | listas documentais **por escritório**, editáveis; os exemplos atuais entram como dados iniciais, marcados como exemplo |
| `matters` | referência `AAAA/NNN` única por escritório, estado, responsável, `state_since`, `follow_up_on` (Seguimento) |
| `matter_items` | itens da lista documental do processo: `em_falta` / `recebido` / `conferido` / `rejeitado` |
| `inbox_messages` | email carregado à mão (remetente, assunto, corpo, data) |
| `attachments` | ficheiro, `sha256`, tamanho, tipo, `matter_id` (nulo = por triar), item a que corresponde |
| `client_requests` | pedido ao cliente; **`id` gerado no cliente ao abrir o rascunho = chave de idempotência**; estado, itens incluídos, aprovador, tentativas |
| `deadlines` | Prazo: data, `por_confirmar` / `confirmado`, quem confirmou |
| `events` | histórico imutável (autor, quando, tipo, dados antes/depois); `UPDATE`/`DELETE` bloqueados por gatilho |
| `user_positions` | último separador/posição por utilizador e processo (retoma) |

### Máquina de estados (proposta, validada no servidor)

| De | Para | Quem / quando |
|---|---|---|
| Por triar | Em conferência | ao associar o primeiro anexo ou manualmente |
| Em conferência | A aguardar aprovação | rascunho de pedido submetido |
| Em conferência | Completo | todos os itens obrigatórios conferidos |
| A aguardar aprovação | A aguardar cliente | aprovado **e** envio confirmado |
| A aguardar aprovação | Envio falhado | aprovado, envio falhou |
| A aguardar aprovação | Em conferência | aprovador devolve o rascunho |
| Envio falhado | A aguardar cliente | reenvio bem-sucedido (mesmo pedido) |
| Envio falhado | Em conferência | pedido abandonado |
| A aguardar cliente | Resposta por conferir | anexo/email do cliente associado ao processo |
| A aguardar cliente | Em conferência | registo manual (ex.: entregou ao balcão) |
| Resposta por conferir | Em conferência / Completo | após conferir |
| Completo | Concluído | solicitador ou administrador |
| Completo / Concluído | Em conferência | reabrir (solicitador ou administrador) |

Qualquer outra transição é recusada pelo servidor com mensagem em português
e não deixa rasto parcial.

### «Quem age» derivado do estado

| Estado | Aguarda |
|---|---|
| Por triar | Triagem |
| Em conferência, Resposta por conferir, Envio falhado | Responsável do processo |
| A aguardar aprovação | Solicitador (aprovador) |
| A aguardar cliente | Cliente (nome) |
| Completo | Responsável (para concluir) |
| Concluído | Ninguém |

«Desde» = data do evento que fez entrar no estado atual (`state_since`).

### Dependências a acrescentar (justificação)

| Pacote | Porquê | Fase |
|---|---|---|
| `postgres` | driver SQL simples para transações com RLS; sem ORM porque o esquema é pequeno e as políticas vivem em SQL | 0 |
| `zod` | validar tudo o que chega ao servidor | 0 |
| `vitest` (dev) | testes unitários e de integração | 0 |
| `@playwright/test` (dev) | percorrer fluxos no browser (critérios 1 e 5) | 0 |
| Supabase CLI (dev, via `npx`) | BD + Storage + Auth locais para testes, migrações versionadas em `supabase/migrations` | 0 |
| `@supabase/supabase-js`, `@supabase/ssr` | Storage e Auth | 2 e 5 |

Nenhuma troca de framework. Mantém-se Next.js 14, Tailwind e os componentes
existentes.

---

## 3. Fases

Cada fase termina com: testes, lint e build a passar; aplicação percorrida
no browser; `docs/ESTADO.md` atualizado; resumo curto do que mudou, falhou
e ficou por fazer. Commits pequenos, em português.

### Fase 0 — Fundações (pré-requisito, sem mudanças visíveis grandes)

- Vitest + Playwright + `npm test` + workflow de CI (lint, typecheck,
  testes, build).
- Supabase local; primeira migração com `organizations`, `members`,
  `clients`, `matters`, `matter_items`, `events`, RLS em todas.
- `withTenant()` e sessão de desenvolvimento assinada no servidor.
- Dados de demonstração gerados **relativamente à data de hoje**
  (script `seed`), com nomes portugueses fictícios e emails `example.pt`.
- Primeiro teste de isolamento: utilizador de A não lê linhas de B
  (embrião do critério 5).

### Fase 1 — Ficha do processo

- Faixa fixa: «Falta: N documentos · Aguarda: <quem> desde <data> ·
  Responsável: <nome>». Calculada no servidor; com texto, não só cor.
- Lista documental por tipo, itens recebido / em falta / conferido.
- Histórico imutável (gatilho na BD + teste que tenta `UPDATE`/`DELETE`).
- 8 estados e transições validadas no servidor (tabela acima), com testes
  de cada transição permitida e recusada.
- Retoma: reabrir o processo volta ao separador e item onde se estava.
- Estados vazio / carregamento / erro desenhados na ficha.
- **Critério 1** — teste: para processos-tipo, só com o texto da faixa
  extrai-se N em falta, quem age e desde quando; e2e que abre um processo
  nunca visto e lê a faixa.

### Fase 2 — Triagem

- Caixa de entrada: carregar email (assunto, remetente, corpo) e anexos à
  mão para o Storage (checksum SHA-256 guardado).
- Associar anexo a processo e a item da lista documental.
- Mover anexo para outro processo com «Anular» (sem diálogo de
  confirmação); histórico regista origem, destino e autor em ambos os
  processos.
- **Critério 2** — teste: fotografia completa dos dois processos (itens,
  anexos, estado, contagens) antes de mover; mover; anular; fotografias
  iguais. O histórico ganha os eventos «movido» e «anulado» — é a única
  diferença permitida e o teste di-lo explicitamente.

### Fase 3 — Pedido ao cliente

- Rascunho a partir de modelo, com itens em falta preenchidos;
  guardado automaticamente.
- Aprovação só por solicitador/administrador (validado no servidor).
- Envio pela interface `EnvioDeEmail`; falha leva a «Envio falhado».
- Idempotência: o `id` do pedido é a chave; reenviar reutiliza o mesmo
  pedido e regista tentativas; chave única na BD.
- **Critério 3** — teste: simular falha, reenviar 3 vezes (incluindo
  pedidos concorrentes), resultado: 1 pedido, N tentativas, ≤ 1 envio
  bem-sucedido.

### Fase 4 — Vista «Hoje» (substitui o Dashboard)

- Lista de ações, sem contadores-cartão. Linha tipo:
  «Conferir resposta de Rui Fonseca · 2026/041 · falta 1 de 3 · Márcia ·
  seguimento 23/11».
- Regras: aparece quando a bola está na equipa; desaparece em «A aguardar
  cliente»; regressa com a resposta ou quando chega a data de Seguimento.
- Seguimento (interno, editável por todos) e Prazo (fica «por confirmar»
  até um solicitador validar) são tipos distintos, em colunas e contadores
  distintos.
- Remove a saudação dependente da hora; título «Hoje».
- **Critério 4** — teste: prazo por confirmar não gera alerta nem entra
  em nenhum contador de prazos; depois de confirmado, entra.

### Fase 5 — Vários escritórios e autenticação real

- Supabase Auth (email + palavra-passe, recuperação); remove o login que
  aceita qualquer palavra-passe e a sessão de desenvolvimento em produção.
- Papéis triagem / solicitador / administrador aplicados no servidor e
  em RLS.
- Subdomínio por escritório resolvido em `middleware.ts`
  (`<slug>.dominio` → escritório); sessão de A num subdomínio de B é
  recusada.
- Novo escritório = linha em `organizations` + utilizador administrador
  (script/config), sem alterar código.
- Exportar todos os dados de um escritório (JSON + anexos em ZIP);
  exportar e restaurar um processo com anexos.
- **Critério 5** — testes por URL direto, pesquisa e ligação de anexo
  (URL assinada de B pedida por A), na BD, no Storage e no browser.
- **Critério 6** — exportar, apagar, restaurar; comparar número de anexos
  e SHA-256 um a um.
- **Critério 7** — teste que cria um segundo escritório só com dados de
  configuração e verifica login, isolamento e listas documentais próprias.

---

## 4. Qualidade transversal (aplicada em cada fase, não no fim)

- Português de Portugal: «Hoje», «Modelos», «Processo»; sem «Dashboard»,
  «Templates», «kanban».
- Um só botão «Novo processo» (na barra superior).
- `Label` passa a associar-se ao campo (`htmlFor`/`id`); foco visível;
  navegação por teclado; contraste AA verificado com axe nos testes e2e.
- «Anular» em vez de diálogos de confirmação; rascunhos guardados
  automaticamente.
- Testes em largura de tablet (768 px) e telemóvel (375 px).
- As listas documentais aparecem sempre como **exemplos configuráveis por
  escritório**, nunca como requisito legal confirmado.

## 5. O que não vou conseguir verificar sozinho

- Contraste e leitura com leitores de ecrã reais (só automático com axe).
- Entrega real de email (até haver fornecedor, D7).
- Comportamento com subdomínios reais e DNS (testo com cabeçalho `Host`).
- Se a Vercel/Supabase de produção estão na região UE — depende das
  contas de vocês.
- Que as listas documentais estão juridicamente corretas.
