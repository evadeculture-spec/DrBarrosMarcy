# Estado atual do SolicitaFlow

_Levantamento feito em 16/11/2026 sobre o commit `02f981f` (ramo `main`)._

## Resumo em três linhas

- É uma **demo só de cliente**: Next.js 14 a correr inteiramente no browser,
  sem servidor de aplicação, sem base de dados, sem autenticação e sem testes.
- Os dados vivem em memória (React Context) e **perdem-se ao recarregar a
  página**; os dados de partida estão fixos em ficheiros `src/data/*.ts`.
- `npm run lint` e `npm run build` passam (verificado nesta data). Não existe
  `npm test`.

## Stack e ferramentas

| Área | O que existe |
|---|---|
| Framework | Next.js 14.2 (App Router), React 18, TypeScript `strict` |
| Estilos | Tailwind CSS 3 com tokens próprios (bordeaux, ink, muted…) |
| Componentes | Primitivos feitos à mão em `src/components/ui` (estilo shadcn) |
| Ícones | `lucide-react` |
| Estado | `useStore` (React Context em memória), `useSession`, `useUI` |
| Lint | ESLint `next/core-web-vitals` |
| Testes | **Nenhum** (nem framework instalado) |
| Deploy | Vercel (`vercel.json` força o framework Next.js); sem variáveis de ambiente |
| CI | Nenhum workflow em `.github/` |

## Estrutura

```
src/
├─ app/                 páginas (landing, login, grupo (app) com shell)
├─ components/          componentes de domínio + ui/ + layout/
├─ data/                dados fictícios fixos (users, clients, matters, tasks,
│                       documents, timeline, templates)
├─ hooks/               useStore, useSession, useUI
├─ lib/                 constants, selectors, checklists, email, security, utils
├─ types/               tipos de domínio
└─ utils/date.ts        formatação de datas pt-PT
```

Não há `src/app/api`, nem `middleware.ts`, nem server actions: **todo o
código corre no browser**.

## Modelo de dados (apenas tipos TypeScript)

Definido em `src/types/index.ts`. Não existe esquema de base de dados.

- `Organization`, `User` (papéis `admin | solicitador | assistente`)
- `Client` (particular/empresa, NIF, morada)
- `Matter` (processo): tipo, estado, responsável, prioridade, próxima ação,
  `dueDate`, honorários, estado de pagamento, `stalledReason`, e a
  **checklist embebida** (`ChecklistItem[]`)
- `MatterDocument` (documento com estado; `fileUrl` sempre `null`)
- `Task`, `TimelineEvent`, `EmailTemplate`

Todas as entidades têm `organizationId`, mas está sempre fixo em
`CURRENT_ORG_ID = "org-dbm"` (`src/lib/security.ts`) e nunca é verificado.

Estados de processo atuais (9): Novo pedido, A aguardar documentos, Em
preparação, A aguardar assinatura, Submetido, A aguardar entidade externa,
Concluído, Faturado, Arquivado. **Nenhum coincide com os 8 estados pedidos.**

## Ecrã a ecrã: funciona, é fictício ou é só desenho

Legenda: **Funciona** = tem lógica e altera o estado (em memória) ·
**Fictício** = mostra dados fixos · **Só desenho** = botão/campo sem efeito.

| Ecrã | Funciona | Fictício / só desenho |
|---|---|---|
| `/` Landing | Ligações para login | Texto de marketing |
| `/login` | Escolher um dos 3 perfis grava o id em `localStorage` | **Qualquer palavra-passe é aceite**; o campo nem é lido |
| `/dashboard` | Contadores calculados a partir do store | Saudação fixa «Bom dia, … 👋» (erra à tarde); 7 contadores, incluindo pagamentos; «processos parados» depende de `stalledReason` escrito à mão |
| `/processos` | Filtros, vista tabela/kanban, criar processo | Prioridade e honorários fictícios |
| `/processos/[id]` | Mudar estado (qualquer → qualquer, sem validação), marcar itens da checklist, adicionar tarefa, adicionar nota | Não há faixa «o que falta / quem age»; o histórico só regista notas e a criação (mudar estado ou checklist **não deixa rasto**); separador Comunicações só pré-visualiza/copia texto |
| `/clientes`, `/clientes/[id]` | Listagem e ficha | Clientes criados só por email no «criar processo» |
| `/tarefas` | Separadores por prazo, mudar estado | — |
| `/documentos` | Lista de itens em falta, gerar texto de email | «Gerar email» só copia texto; nada é enviado nem registado |
| `/templates` | Escolher modelo e pré-visualizar | Edição não é guardada |
| `/importar` | Lê CSV e valida 2 colunas obrigatórias | **«Importar» só muda um booleano**: nenhum processo é criado |
| `/configuracoes` | Separadores | Tudo só de leitura ou sem efeito: «Guardar alterações» não faz nada, interruptores de notificações não persistem, listas documentais são as fixas de `src/lib/checklists.ts` |
| Pesquisa `⌘K` | Pesquisa em memória em processos/clientes | — |

Componentes de documentos (`DocumentList`): botão de descarregar sempre
desativado; não existe carregamento de ficheiros em lado nenhum.

## Regras de negócio que existem

- `src/lib/selectors.ts`: «em falta» = item obrigatório `pendente` ou
  `rejeitado`; contadores do dashboard; agrupamento por motivo de bloqueio.
- `src/lib/checklists.ts`: lista documental fixa por tipo de processo.
- `src/lib/email.ts`: substituição de variáveis `[NOME]`, `[DOCUMENTOS_EM_FALTA]`…
- `src/lib/security.ts`: `can()` meramente ilustrativo, não usado nas ações.

Tudo corre no cliente. **Não há nenhuma regra imposta no servidor.**

## Dados de demonstração — problemas

1. **Datas fixas em junho de 2026.** Hoje (16/11/2026) aparece «Vencido há
   ~150 dias» em quase tudo, que é exatamente o que o produto deve evitar.
2. **Identidade do escritório possivelmente real.** `src/data/users.ts` tem
   «Dr. Barros & Marcy — Solicitadoria» com NIF, morada em Castelo Branco,
   telefone e domínio `barrosmarcy.pt`; o nome coincide com o do repositório.
   Se for um escritório real, estes dados não devem estar no código (ver
   pergunta no plano).
3. **Clientes com nomes e emails não fictícios na forma.** Ex.:
   `k.jasinska@gmail.com`, `pierre.bodin@orange.fr`, domínios reais;
   nomes maioritariamente estrangeiros. O pedido é «nomes portugueses
   fictícios»; os emails devem usar domínios reservados (`example.pt`).
4. NIF e telefones com formato válido. Não verifiquei se pertencem a alguém;
   devem ser substituídos por valores claramente fictícios.

## Qualidade da interface — lacunas observadas

- Termos em inglês: «Dashboard», «Templates», «kanban».
- **Sete** pontos de entrada para criar processo (topbar ×2, dashboard,
  cabeçalho e estado vazio de Processos, landing…).
- `Label` não está associado aos campos (sem `htmlFor`/`id`): os leitores de
  ecrã não anunciam os rótulos.
- O estado da checklist é um `<select>` colorido: tem texto, mas o ícone
  redondo ao lado é só cor.
- Não há estados de carregamento nem de erro (não há pedidos à rede).
- Não há rascunhos, nem «Anular», nem retoma do ponto onde se estava.

## Segurança

- Proteção de rotas apenas no cliente (`AppShell` redireciona se não houver
  id no `localStorage`). Basta escrever um id para «entrar».
- Sem segredos no repositório (verificado: não há `.env` versionado).
- Sem isolamento entre escritórios.

## O que se aproveita

- Tokens visuais, primitivos de UI e o layout responsivo (sidebar/topbar).
- Os tipos de domínio como ponto de partida para o esquema.
- Formatação de datas pt-PT e a função de preenchimento de modelos.
- As listas documentais como **dados iniciais configuráveis**, não como regra.
