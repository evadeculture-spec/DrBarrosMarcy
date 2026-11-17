-- Clientes pesquisáveis sem acentos, tarefas, pagamentos e bloqueios explícitos.
-- Alteração aditiva: os registos existentes continuam válidos.

-- Normalização para pesquisa: minúsculas e sem acentos (sem extensões).
create or replace function sf_normalizar(t text) returns text
language sql immutable parallel safe as $$
  select lower(translate(coalesce(t, ''),
    'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$$;

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------

alter table clients
  add column reference text,
  add column nif text,
  add column city text,
  add column address text,
  add column updated_at timestamptz not null default now();

-- Referência interna para os clientes já existentes (CLI-0001, …, por escritório).
with numerados as (
  select id, row_number() over (partition by organization_id order by created_at, id) as n
  from clients
)
update clients c set reference = 'CLI-' || lpad(numerados.n::text, 4, '0')
from numerados where numerados.id = c.id;

alter table clients alter column reference set not null;
create unique index clients_ref_unica on clients (organization_id, reference);
create unique index clients_nif_unico on clients (organization_id, nif) where nif is not null;

alter table clients add column pesquisa text generated always as (
  sf_normalizar(name || ' ' || coalesce(email, '') || ' ' || reference || ' ' ||
                coalesce(nif, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(city, ''))
) stored;
create index clients_ordem on clients (organization_id, name, id);

-- ---------------------------------------------------------------------------
-- Processos: valores, bloqueio explícito e próxima ação
-- ---------------------------------------------------------------------------

alter table matters
  add column valor_previsto numeric(12, 2) check (valor_previsto is null or valor_previsto >= 0),
  add column valor_pago numeric(12, 2) not null default 0 check (valor_pago >= 0),
  add column bloqueio_motivo text check (bloqueio_motivo in (
    'aguarda_entidade_externa', 'aguarda_pagamento', 'aguarda_revisao_interna',
    'aguarda_decisao_cliente', 'outro')),
  add column bloqueio_nota text,
  add column bloqueio_revisao date,
  add column proxima_acao text,
  add constraint bloqueio_completo check (
    bloqueio_motivo is null or bloqueio_revisao is not null);

-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid,
  kind text not null default 'manual' check (kind in ('manual', 'revisao_documentos')),
  title text not null check (length(title) between 1 and 300),
  assignee_id uuid not null,
  due_on date,
  status text not null default 'aberta' check (status in ('aberta', 'concluida')),
  created_by uuid,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (matter_id, organization_id) references matters(id, organization_id) on delete cascade,
  foreign key (assignee_id, organization_id) references users(id, organization_id),
  foreign key (created_by, organization_id) references users(id, organization_id),
  foreign key (completed_by, organization_id) references users(id, organization_id)
);
-- Uma única tarefa de revisão por processo (reaberta em vez de duplicada).
create unique index tasks_uma_revisao on tasks (matter_id) where kind = 'revisao_documentos';
create index tasks_assignee on tasks (organization_id, assignee_id, status);

alter table tasks enable row level security;
alter table tasks force row level security;
create policy tenant_isolation on tasks
  using (organization_id = app_org()) with check (organization_id = app_org());
grant select, insert, update, delete on tasks to {{APP_ROLE}};

-- ---------------------------------------------------------------------------
-- Receção: origem do documento; envio externo registado à mão
-- ---------------------------------------------------------------------------

alter table inbox_messages add column origem text not null default 'email'
  check (origem in ('email', 'entregue_em_mao', 'correio', 'outro'));

alter table outbound_messages add column via text not null default 'sistema'
  check (via in ('sistema', 'externo'));

-- ---------------------------------------------------------------------------
-- Histórico: permitir apagar um escritório de demonstração inteiro
-- (só na transação que o marca em app.purge_org).
-- ---------------------------------------------------------------------------

create or replace function events_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and (
       (old.matter_id is not null
        and current_setting('app.purge_matter', true) = old.matter_id::text)
    or current_setting('app.purge_org', true) = old.organization_id::text) then
    return old;
  end if;
  raise exception 'O histórico é imutável (%).', tg_op
    using errcode = 'insufficient_privilege';
end $$;

grant execute on function sf_normalizar(text) to {{APP_ROLE}};
