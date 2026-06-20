# SolicitaFlow

**Gestão inteligente de processos para solicitadoria.**

SaaS para gestão de processos de um escritório de solicitadoria em Portugal.
MVP funcional, moderno e responsivo (otimizado para iPad), com dados de
demonstração realistas em português de Portugal.

Identidade visual branco/off-white + bordeaux. Construído para evoluir para
base de dados real (Supabase), autenticação e mais.

---

## 🧱 Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (paleta e tokens personalizados)
- Componentes reutilizáveis no estilo **shadcn/ui** (feitos à mão)
- **lucide-react** para ícones
- Estado em memória via React Context (preparado para Supabase)

---

## 🚀 Correr localmente

```bash
npm install
npm run dev
```

Abra **http://localhost:3000**.

- Na página inicial, clique em **Entrar no escritório**.
- No login, escolha um perfil (Márcia, João ou Carolina) — qualquer
  palavra-passe é aceite (login mock).
- Pode também ir diretamente a `/dashboard`.

Outros comandos:

```bash
npm run build   # build de produção
npm run start   # servir o build
npm run lint    # ESLint
```

---

## 🗺️ Páginas disponíveis

| Rota | Descrição |
|------|-----------|
| `/` | Landing page do produto |
| `/login` | Login mock (escolha de perfil) |
| `/dashboard` | "Hoje no escritório": estatísticas, prioridades e processos parados |
| `/processos` | Lista de processos com filtros, vista tabela e kanban |
| `/processos/[id]` | Processo individual com tabs (Resumo, Checklist, Tarefas, Documentos, Histórico, Comunicações) |
| `/clientes` | Lista de clientes |
| `/clientes/[id]` | Ficha do cliente |
| `/tarefas` | Tarefas com separadores (Hoje, Semana, Vencidas, Sem prazo, Concluídas) |
| `/documentos` | Documentos em falta + geração de email |
| `/templates` | Templates de email editáveis |
| `/importar` | Importação de processos por CSV (UI + validação) |
| `/configuracoes` | Utilizadores, tipos/estados, checklists, notificações, escritório |

**Pesquisa global:** `⌘K` / `Ctrl+K` em qualquer página.

---

## 🏗️ Arquitetura

```
src/
├─ app/                  # App Router (landing, login, grupo (app) autenticado)
│  └─ (app)/             # Shell com sidebar + topbar
├─ components/           # Componentes reutilizáveis
│  ├─ ui/                # Primitivos (button, card, badge, input, modal, tabs…)
│  └─ layout/            # Sidebar, Topbar, AppShell
├─ data/                 # Dados mock (users, clients, matters, tasks, documents, timeline, templates)
├─ hooks/                # useSession (auth mock), useStore (estado), useUI
├─ lib/                  # utils, constants, selectors, checklists, email, security
├─ types/                # Tipos de domínio TypeScript
└─ utils/                # Utilitários de data (pt-PT)
```

Componentes-chave: `StatCard`, `ProcessCard`, `ProcessTable`, `ProcessKanban`,
`StatusBadge`, `PriorityBadge`, `PageHeader`, `EmptyState`,
`QuickCreateProcessModal`, `ChecklistPanel`, `Timeline`, `DocumentList`,
`TaskList`, `EmailTemplatePreview`, `GlobalSearch`.

---

## ▲ Deploy na Vercel

1. Faça push do repositório para o GitHub.
2. Em [vercel.com](https://vercel.com), **New Project → Import** o repositório.
3. A Vercel deteta Next.js automaticamente — não é preciso configurar nada.
4. **Deploy**. Pronto.

Não há variáveis de ambiente necessárias no MVP (dados em memória).

---

## 🔌 Próximos passos: ligar a Supabase

A estrutura já está preparada para esta migração:

1. **Criar projeto Supabase** e definir variáveis em `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
2. **Schema**: criar tabelas a partir dos tipos em `src/types/index.ts`
   (`organizations`, `users`, `clients`, `matters`, `checklist_items`,
   `documents`, `tasks`, `timeline_events`, `email_templates`). Todas as
   entidades já têm `organizationId` para multi-tenant.
3. **Auth**: substituir `src/hooks/useSession.tsx` por Supabase Auth (ou Clerk).
4. **Dados**: substituir `src/hooks/useStore.tsx` por queries Supabase
   (idealmente com React Query). As ações do store mapeiam 1:1 para mutações.
5. **RLS (Row Level Security)**: ativar políticas de isolamento por
   organização — ver exemplos em `src/lib/security.ts`.
6. **Storage**: documentos em bucket privado, servidos por URL assinada.

Os pontos a reforçar para produção estão marcados no código com
`// SECURITY:` e documentados em `src/lib/security.ts`.

---

## 🔒 Segurança e RGPD (MVP)

Este MVP usa dados mock e proteção de rotas apenas no cliente. Antes de
produção com dados reais é obrigatório: autenticação real, validação no
servidor, RLS por organização, logs de auditoria e tratamento de dados
pessoais segundo o RGPD. Ver `src/lib/security.ts`.

---

## 🛣️ Evoluções futuras

Base de dados real · autenticação · portal do cliente · assistente de IA ·
integrações (AT, conservatórias) · faturação · upload real de documentos.
