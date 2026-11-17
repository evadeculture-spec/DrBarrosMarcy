-- Permissões do papel da aplicação ({{APP_ROLE}}).
-- O papel não é dono das tabelas e não tem BYPASSRLS: as políticas aplicam-se.
-- O histórico (events) só aceita leitura e inserção.

grant usage on schema public to {{APP_ROLE}};

grant select, update on organizations to {{APP_ROLE}};

grant select, insert, update, delete on
  users, sessions, clients, matter_types, document_requirements, matters,
  matter_items, inbox_messages, attachments, attachment_blobs,
  message_templates, client_requests, outbound_messages, send_attempts,
  deadlines, user_positions
to {{APP_ROLE}};

grant select, insert on events to {{APP_ROLE}};

grant execute on function app_org(), app_user(), org_by_slug(text) to {{APP_ROLE}};
