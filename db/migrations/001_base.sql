-- SolicitaFlow — esquema base
--
-- Isolamento por escritório imposto na base de dados:
--  * todas as tabelas têm organization_id e Row Level Security (FORCE);
--  * referências entre tabelas usam chaves compostas (id, organization_id),
--    pelo que é impossível ligar um registo a outro de outro escritório;
--  * a aplicação liga-se com um papel sem BYPASSRLS e define, em cada
--    transação, app.org_id (e app.user_id) com set_config(..., true).
--
-- O papel da aplicação é passado em :app_role pelo script de migração.

create or replace function app_org() returns uuid
language sql stable as $$
  select nullif(current_setting('app.org_id', true), '')::uuid
$$;

create or replace function app_user() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Escritórios e utilizadores
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name text not null check (length(name) between 1 and 200),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  name text not null check (length(name) between 1 and 120),
  role text not null check (role in ('triagem', 'solicitador', 'administrador')),
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, email),
  unique (id, organization_id)
);

create table sessions (
  token_hash text primary key,
  organization_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (user_id, organization_id)
    references users(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Clientes, tipos de processo e listas documentais (configuráveis)
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table matter_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  name text not null,
  position int not null default 0,
  unique (organization_id, key),
  unique (id, organization_id)
);

create table document_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_type_id uuid not null,
  label text not null check (length(label) between 1 and 200),
  required boolean not null default true,
  position int not null default 0,
  foreign key (matter_type_id, organization_id)
    references matter_types(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Processos
-- ---------------------------------------------------------------------------

create table matters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  year int not null,
  number int not null check (number > 0),
  reference text generated always as (year::text || '/' || lpad(number::text, 3, '0')) stored,
  client_id uuid not null,
  matter_type_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  state text not null check (state in (
    'por_triar', 'em_conferencia', 'a_aguardar_aprovacao', 'a_aguardar_cliente',
    'resposta_por_conferir', 'completo', 'concluido', 'envio_falhado')),
  state_since timestamptz not null default now(),
  responsible_id uuid not null,
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, year, number),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references clients(id, organization_id),
  foreign key (matter_type_id, organization_id) references matter_types(id, organization_id),
  foreign key (responsible_id, organization_id) references users(id, organization_id)
);

create table matter_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_id uuid not null,
  label text not null check (length(label) between 1 and 200),
  required boolean not null default true,
  position int not null default 0,
  status text not null default 'em_falta'
    check (status in ('em_falta', 'recebido', 'conferido', 'rejeitado')),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, matter_id),
  foreign key (matter_id, organization_id)
    references matters(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Triagem: emails carregados à mão e anexos
-- ---------------------------------------------------------------------------

create table inbox_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  from_name text,
  from_email text,
  subject text not null default '',
  body text not null default '',
  received_at timestamptz not null default now(),
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (created_by, organization_id) references users(id, organization_id)
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  inbox_message_id uuid,
  matter_id uuid,
  item_id uuid,
  filename text not null check (length(filename) between 1 and 255),
  mime_type text not null,
  size_bytes int not null check (size_bytes >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (inbox_message_id, organization_id)
    references inbox_messages(id, organization_id) on delete set null (inbox_message_id),
  foreign key (matter_id, organization_id)
    references matters(id, organization_id) on delete cascade,
  -- o item tem de pertencer ao mesmo processo do anexo
  foreign key (item_id, matter_id) references matter_items(id, matter_id) on delete set null (item_id),
  foreign key (created_by, organization_id) references users(id, organization_id),
  check (item_id is null or matter_id is not null)
);

-- Conteúdo dos ficheiros. Fica na base de dados para que o isolamento por
-- escritório seja imposto pelas mesmas políticas RLS que protegem os dados.
create table attachment_blobs (
  attachment_id uuid primary key,
  organization_id uuid not null,
  content bytea not null,
  foreign key (attachment_id, organization_id)
    references attachments(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Pedidos ao cliente (idempotentes)
-- ---------------------------------------------------------------------------

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  name text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

-- O id do pedido é a chave de idempotência: reenviar usa sempre o mesmo id.
create table client_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_id uuid not null,
  status text not null check (status in (
    'rascunho', 'a_aguardar_aprovacao', 'enviado', 'falhado', 'devolvido', 'cancelado')),
  to_email text not null default '',
  subject text not null default '',
  body text not null default '',
  item_ids uuid[] not null default '{}',
  created_by uuid not null,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (matter_id, organization_id)
    references matters(id, organization_id) on delete cascade,
  foreign key (created_by, organization_id) references users(id, organization_id),
  foreign key (approved_by, organization_id) references users(id, organization_id)
);

-- No máximo um pedido em curso por processo.
create unique index client_requests_one_open
  on client_requests (matter_id)
  where status in ('rascunho', 'a_aguardar_aprovacao', 'falhado');

-- Mensagens que efetivamente saíram. Uma por pedido, imposto pela BD.
create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null unique,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  foreign key (request_id, organization_id)
    references client_requests(id, organization_id) on delete cascade
);

create table send_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  attempted_at timestamptz not null default now(),
  ok boolean not null,
  error text,
  foreign key (request_id, organization_id)
    references client_requests(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Prazos (distintos do Seguimento, que vive em matters.follow_up_on)
-- ---------------------------------------------------------------------------

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  matter_id uuid not null,
  label text not null check (length(label) between 1 and 200),
  due_on date not null,
  status text not null default 'por_confirmar'
    check (status in ('por_confirmar', 'confirmado')),
  created_by uuid not null,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'confirmado') = (confirmed_by is not null)),
  foreign key (matter_id, organization_id)
    references matters(id, organization_id) on delete cascade,
  foreign key (created_by, organization_id) references users(id, organization_id),
  foreign key (confirmed_by, organization_id) references users(id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Histórico imutável
-- ---------------------------------------------------------------------------

create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  matter_id uuid,
  actor_id uuid,
  kind text not null,
  summary text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_matter_idx on events (matter_id, created_at desc);

-- Só é possível apagar eventos ao purgar um processo inteiro (exportado
-- antes), e só dentro da transação que o marca em app.purge_matter.
create or replace function events_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE'
     and old.matter_id is not null
     and current_setting('app.purge_matter', true) = old.matter_id::text then
    return old;
  end if;
  raise exception 'O histórico é imutável (%).', tg_op
    using errcode = 'insufficient_privilege';
end $$;

create trigger events_no_update before update on events
  for each row execute function events_immutable();
create trigger events_no_delete before delete on events
  for each row execute function events_immutable();
create trigger events_no_truncate before truncate on events
  for each statement execute function events_immutable();

-- ---------------------------------------------------------------------------
-- Retoma: onde cada utilizador ficou em cada processo
-- ---------------------------------------------------------------------------

create table user_positions (
  organization_id uuid not null,
  user_id uuid not null,
  matter_id uuid not null,
  tab text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, matter_id),
  foreign key (user_id, organization_id) references users(id, organization_id) on delete cascade,
  foreign key (matter_id, organization_id) references matters(id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
create policy org_self on organizations
  using (id = app_org()) with check (id = app_org());

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'sessions', 'clients', 'matter_types', 'document_requirements',
    'matters', 'matter_items', 'inbox_messages', 'attachments',
    'attachment_blobs', 'message_templates', 'client_requests',
    'outbound_messages', 'send_attempts', 'deadlines', 'events',
    'user_positions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (organization_id = app_org()) '
      'with check (organization_id = app_org())', t);
  end loop;
end $$;

-- Resolver o escritório pelo subdomínio, antes de haver sessão.
create or replace function org_by_slug(p_slug text)
returns table (id uuid, slug text, name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.slug, o.name from organizations o where o.slug = p_slug
$$;
