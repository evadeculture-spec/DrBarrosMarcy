# Estado atual do SolicitaFlow

_Atualizado a 16/11/2026, no fim das fases 0 a 5. O levantamento inicial da
demo está no fim deste ficheiro._

## Resumo

- A aplicação tem servidor, base de dados PostgreSQL com isolamento por
  escritório (RLS), autenticação real e papéis. O login que aceitava qualquer
  palavra-passe foi removido.
- O percurso completo funciona: triagem → ficha → pedido ao cliente
  (aprovação, envio, reenvio) → Hoje → resposta → conclusão.
- Os 7 critérios de aceitação têm testes automáticos, todos a passar.

## Verificação (16/11/2026)

| Verificação | Resultado |
|---|---|
| `npm run lint` | sem avisos |
| `npm run typecheck` | sem erros |
| `npm test` (Vitest, Postgres 16 real) | 45/45 |
| `npm run build` | ok |
| `npm run test:e2e` (Chromium + axe) | 13/13, incluindo WCAG 2.1 AA em 8 ecrãs a 1280, 768 e 375 px, sem deslocamento horizontal |
| Percurso manual no browser | Hoje, ficha, triagem, processos, em desktop, tablet e telemóvel; sem erros na consola |

## O que existe, por fase

**Fase 0 — Fundações.** Esquema em `db/migrations` (RLS `FORCE` em todas as
tabelas, chaves compostas `(id, organization_id)` para impedir ligações entre
escritórios, papel da aplicação sem `BYPASSRLS`). Migrações, seed com datas
relativas a hoje e nomes fictícios (`example.pt`), Vitest, Playwright e CI.

**Fase 1 — Ficha.** Faixa fixa calculada no servidor
(`src/server/domain/faixa.ts`). Lista documental por tipo, editável por
processo. 8 estados com transições manuais e de sistema validadas no servidor
(`src/server/domain/estados.ts`). O histórico é imutável: a aplicação não tem
`UPDATE`/`DELETE` e um gatilho bloqueia até o dono do esquema. Retoma do
separador e «Continuar em …» na vista Hoje.

**Fase 2 — Triagem.** Carregar email (remetente, assunto, texto, anexos até
15 MB cada e 25 MB por envio). Sugestão de processo pelo email do cliente,
apenas como sugestão. Associar a um processo e a um documento da lista, mover
entre processos, «Anular» com fotografia antes/depois (recusa se algo mudou
entretanto), criar processo a partir de um email, arquivar.

**Fase 3 — Pedido ao cliente.** Rascunho a partir de modelo, com os
documentos em falta, guardado automaticamente. Só solicitador ou
administrador aprova. O envio é idempotente: o id do pedido é a chave,
bloqueado com `FOR UPDATE`, com no máximo uma mensagem saída por pedido
(chave única) e um pedido em curso por processo. Falha → «Envio falhado» →
Reenviar. Seguimento automático a 7 dias após o envio.

**Fase 4 — Hoje.** Substitui o Dashboard. Ações da equipa com a linha no
formato pedido. Seguimento e Prazo são tipos separados: o prazo fica «por
confirmar» até um solicitador o confirmar, sem alertas nem contadores.

**Fase 5 — Escritórios e autenticação.** Escritório resolvido pelo
subdomínio (`src/middleware.ts`). Sessões na BD (só o hash do token).
Palavras-passe com scrypt. Papéis triagem / solicitador / administrador.
Gestão de utilizadores com palavra-passe inicial mostrada uma vez. Novo
escritório por ficheiro de configuração (`npm run escritorio:ativar`).
Exportar o escritório; exportar, apagar (com «Anular» que restaura) e
restaurar um processo com verificação SHA-256.

## O que é fictício ou simulado

- **Envio de email: simulado.** O modo «registo» guarda a mensagem como
  enviada sem a fazer sair. Há um botão em Configurações para simular falhas.
  Falta escolher e ligar um fornecedor (SMTP ou API); a interface `Remetente`
  em `src/server/services/envio.ts` já recebe a chave de idempotência.
- Os dados de demonstração (escritórios «demo» e «norte») são fictícios.

## O que ficou por fazer ou tem limites conhecidos

- **Recuperar palavra-passe por email:** não existe (depende do envio real).
  Hoje, o administrador desativa o utilizador e cria-o de novo; cada pessoa
  pode mudar a sua palavra-passe em Configurações.
- **Limite de tentativas de login:** é em memória, por processo do servidor.
  Com várias instâncias, deve passar para a base de dados ou para um serviço
  partilhado.
- **Ficheiros na base de dados (`bytea`):** escolhido para que o isolamento
  dos anexos seja imposto pelas mesmas políticas RLS. Serve bem volumes
  moderados. Para volumes grandes, migrar para armazenamento de objetos com
  políticas por escritório (ex.: Supabase Storage).
- **Exportar o escritório:** gera um único JSON em memória. Para escritórios
  grandes, deve passar a ser gerado por partes (streaming ou ZIP).
- **Restauro de um processo:** os anexos e o seu conteúdo são idênticos
  (critério 6). As horas do histórico perdem os microssegundos na exportação
  e mantêm o milissegundo.
- **Página de clientes:** foi retirada. Os clientes são criados no «Novo
  processo» ou na triagem e encontram-se pela pesquisa. Ainda não é possível
  editar os dados de um cliente.
- **Estado «A aguardar entidade externa»:** não foi acrescentado (decisão
  D9 em aberto).
- **Não verificado:** leitores de ecrã reais (só verificação automática com
  axe), entrega real de email, DNS e certificados de subdomínios reais (o
  teste usa `*.localhost`), deploy (precisa de uma base de dados PostgreSQL de
  produção, que ainda não existe).

---

## Levantamento inicial (antes das fases)

O ponto de partida, a 16/11/2026 (commit `02f981f`), era uma demo só de
cliente: Next.js no browser, dados fictícios fixos em `src/data` com datas de
junho de 2026, React Context em memória, login que aceitava qualquer
palavra-passe e nenhum teste. Também tinha botões sem efeito («Importar»,
«Guardar» nas Configurações, edição de modelos), 9 estados diferentes dos
pedidos e a identidade de um escritório com NIF, morada e telefone, e emails
de clientes em domínios reais. Esse código foi substituído; o histórico git
guarda-o.
