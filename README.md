# SolicitaFlow

**Sabe sempre o que falta em cada processo, quem tem de agir e desde quando.**

Aplicação web para escritórios de solicitadoria, centrada num percurso:
receber documentos → conferir → pedir o que falta → retomar quando o cliente
responde.

- **Hoje** — lista de ações da equipa (não contadores). Um processo aparece
  quando a equipa tem de agir, desaparece quando a bola passa ao cliente e
  volta com a resposta ou na data de seguimento.
- **Ficha do processo** — faixa fixa «Falta: N documentos · Aguarda: quem
  desde quando · Responsável», lista documental, pedido ao cliente, prazos e
  histórico imutável.
- **Triagem** — emails e anexos carregados à mão, associados ao processo
  certo; mover entre processos com «Anular».
- **Pedido ao cliente** — rascunho a partir de modelo, aprovação por um
  solicitador, envio idempotente (reenviar nunca duplica).
- **Vários escritórios** — um por subdomínio, isolados na base de dados
  (Row Level Security), ativados só por configuração.

## Stack

Next.js 14 (App Router, Server Components e Server Actions) · TypeScript ·
Tailwind · PostgreSQL 15+ (qualquer fornecedor, incluindo Supabase) ·
`postgres` (driver SQL) · `zod` · Vitest · Playwright + axe.

## Correr localmente

Precisa de Node 22 e PostgreSQL 15 ou superior.

```bash
npm install
cp .env.example .env.local   # e preencha
```

Na base de dados, crie dois papéis — o dono do esquema (migrações) e o da
aplicação (sem `BYPASSRLS`, não dono das tabelas):

```sql
create role sf_owner login password '…';
create role sf_app   login password '…';
create database solicitaflow owner sf_owner;
```

Depois:

```bash
npm run db:seed     # APAGA e recria a BD local com dados de demonstração
npm run dev
```

Abra **http://demo.localhost:3000** (ou `http://localhost:3000`, que usa
`DEFAULT_ORG_SLUG`). Contas de demonstração: `ines@` (administradora),
`marcia@` (solicitadora) e `tiago@demo.example.pt` (triagem), com a
palavra-passe definida em `SEED_DEMO_PASSWORD`. O segundo escritório de
demonstração está em **http://norte.localhost:3000** (`paulo@norte.example.pt`).

Os dados de demonstração são fictícios e as datas são sempre relativas ao dia
em que corre o seed.

## Ativar um novo escritório

Sem alterar código:

```bash
npm run escritorio:ativar -- config/escritorios/exemplo.json
```

O ficheiro indica `slug` (subdomínio), nome, administrador e, opcionalmente,
tipos de processo e listas documentais (por omissão usa
`config/listas-documentais.exemplo.json`). A palavra-passe inicial vem de
`ESCRITORIO_ADMIN_PASSWORD` ou é gerada e mostrada uma vez.

> As listas documentais são **exemplos configuráveis por escritório**, não
> requisitos legais confirmados.

## Testes

```bash
npm run lint && npm run typecheck
npm test            # regras de negócio e critérios 1–7 contra Postgres real
npm run build
npm run test:e2e    # browser: critérios 1 e 5, fluxos, WCAG AA (axe) a 1280/768/375 px
```

`npm test` usa `.env.test.local` (base de dados com «test» no nome, recriada a
cada execução). `npm run test:e2e` usa `.env.e2e.local` (base de dados com «e2e»
no nome) e precisa de `npm run build` antes.

| Critério | Onde |
|---|---|
| 1. A faixa basta para saber o que falta e quem age | `test/c1-ficha.test.ts`, `e2e/criterios.spec.ts` |
| 2. Mover e anular repõe os dois processos | `test/c2-mover.test.ts`, `e2e/fluxo.spec.ts` |
| 3. Falha + 3 reenvios = 1 pedido | `test/c3-idempotencia.test.ts`, `e2e/fluxo.spec.ts` |
| 4. Prazo por confirmar sem alertas nem contadores | `test/c4-prazos.test.ts`, `test/dominio.test.ts` |
| 5. Isolamento entre escritórios | `test/c5-isolamento.test.ts`, `e2e/criterios.spec.ts` |
| 6. Exportar, apagar, restaurar (SHA-256) | `test/c6-exportar.test.ts` |
| 7. Novo escritório só por configuração | `test/c7-novo-escritorio.test.ts` |

## Arquitetura

```
src/server/domain     regras puras: estados, faixa, Hoje, papéis, datas (Lisboa)
src/server/services   casos de uso; tudo via withTenant() (RLS por escritório)
src/server/db.ts      ligação; define app.org_id/app.user_id por transação
db/migrations         esquema, RLS, histórico imutável, purga controlada
src/app               páginas (Server Components) e Server Actions finas
src/middleware.ts     resolve o escritório pelo subdomínio
```

Segurança: sessões com token aleatório (só o hash na BD), cookies `httpOnly`
e `SameSite=Lax`, palavras-passe com scrypt, isolamento imposto por RLS e
chaves estrangeiras compostas, anexos guardados na BD sob as mesmas políticas
e servidos com `Content-Disposition: attachment` e `nosniff`.

## Deploy

### Netlify (demonstração publicada)

https://solicitaflow-demo.netlify.app — usa o Netlify Database (Postgres). A
ligação do Netlify é a do dono da BD; com `DATABASE_SET_ROLE` cada transação
assume um papel restrito, sujeito a RLS. Variáveis do projeto: `AUTO_MIGRAR=1`
(aplica migrações no primeiro acesso), `DATABASE_SET_ROLE=sf_app`,
`DEFAULT_ORG_SLUG=demo`, `DEMO_SEED=1` + `SEED_DEMO_PASSWORD` (cria a
demonstração se a BD estiver vazia), `DEMO_MOSTRAR_CONTAS=1`.
O adaptador `@netlify/plugin-nextjs` está declarado em `netlify.toml`.

### Outros alojamentos

Funciona em qualquer alojamento Node (Vercel incluída) com um PostgreSQL
acessível. Variáveis: ver `.env.example`. Para subdomínios por escritório,
defina `APP_BASE_DOMAIN` (ex.: `solicitaflow.pt`) e um domínio curinga
(`*.solicitaflow.pt`). Corra `npm run db:migrar` a cada versão.
Nunca corra `db:seed` em produção (recusa com `NODE_ENV=production`).

Mais detalhe: `docs/ESTADO.md` (o que existe e o que falta) e `docs/PLANO.md`.
