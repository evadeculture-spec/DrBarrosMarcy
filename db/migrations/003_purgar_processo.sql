-- Apagar definitivamente um processo (depois de exportado).
-- A aplicação não tem DELETE sobre o histórico; esta função, do dono do
-- esquema, é o único caminho. Continua sujeita a RLS (FORCE) e verifica na
-- própria BD que quem pede é administrador do escritório.
create or replace function purgar_processo(p_matter uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_ref text;
begin
  if app_org() is null then
    raise exception 'Escritório não definido.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from users where id = app_user() and role = 'administrador' and active) then
    raise exception 'Só um administrador pode apagar processos.' using errcode = 'insufficient_privilege';
  end if;
  select reference into v_ref from matters where id = p_matter for update;
  if v_ref is null then
    return null;
  end if;
  perform set_config('app.purge_matter', p_matter::text, true);
  delete from events where matter_id = p_matter;
  delete from matters where id = p_matter;
  perform set_config('app.purge_matter', '', true);
  return v_ref;
end $$;

revoke all on function purgar_processo(uuid) from public;
grant execute on function purgar_processo(uuid) to {{APP_ROLE}};
