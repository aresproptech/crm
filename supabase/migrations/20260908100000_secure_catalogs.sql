begin;
-- Los catálogos son legibles por usuarios habilitados, editables por gestores.
do $$
declare t text; s text;
begin
  foreach t in array array['phases','sources','postal','domain','lookups'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy catalog_read on public.%I for select to authenticated using (public.crm_current_role() in (''admin'',''coordinador'',''comercial''))', t);
    execute format('create policy catalog_manage on public.%I for all to authenticated using (public.crm_current_role() in (''admin'',''coordinador'')) with check (public.crm_current_role() in (''admin'',''coordinador''))', t);
  end loop;
  -- No consumidor actual escribe en la tabla histórica antigua.
  revoke all on public.opportunity_history from public, anon, authenticated;
  grant select on public.opportunity_history to authenticated;
  create policy history_read on public.opportunity_history for select to authenticated
    using (public.crm_can_read_opportunity(oportunity_id));
  for s in select sequencename from pg_sequences where schemaname='public' loop
    execute format('revoke all on sequence public.%I from public, anon, authenticated', s);
    execute format('grant usage, select on sequence public.%I to authenticated', s);
  end loop;
end $$;
revoke all on function public.get_current_user_name() from public, anon, authenticated;
revoke all on function public.get_current_user_role() from public, anon, authenticated;
commit;
