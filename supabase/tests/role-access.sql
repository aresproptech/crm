-- Prueba con las identidades reales, sin revelar sus datos ni conservar escrituras.
begin;
do $$
declare p record; expected bigint; actual bigint; affected bigint; target_id bigint; foreign_id bigint; checked integer := 0; profile_options bigint; expected_profile_options bigint;
begin
  select count(*) into expected_profile_options
  from public.profiles
  where coalesce(enabled, true) and nullif(btrim(name), '') is not null;

  for p in select id, auth_id, name, lower(btrim(rol)) rol from public.profiles where enabled and auth_id is not null loop
    target_id := null;
    foreign_id := null;
    select count(*) into expected from public.opportunities o where deleted_at is null and
      (p.rol in ('admin','coordinador') or (p.rol='comercial' and
        (lower(btrim(p.name)) in ('gonza','gonzalo')
          or o.comercial_user_id=p.id
          or (o.comercial_user_id is null and lower(btrim(o.comercial_user_desc))=lower(btrim(p.name))))));
    if p.rol='comercial' then
      select o.id into foreign_id
      from public.opportunities o
      where o.deleted_at is null
        and not (
          o.comercial_user_id=p.id
          or (o.comercial_user_id is null and lower(btrim(o.comercial_user_desc))=lower(btrim(p.name)))
        )
      limit 1;
    end if;
    perform set_config('request.jwt.claim.sub', p.auth_id::text, true);
    set local role authenticated;
    select count(*) into actual from public.crm_leads_view;
    if actual <> expected then raise exception 'Vista: esperado %, obtenido % para rol %', expected, actual, p.rol; end if;
    select count(*) into profile_options from public.crm_profile_assignment_options();
    if profile_options <> expected_profile_options then
      raise exception 'Catalogo de perfiles incompleto para rol %', p.rol;
    end if;
    if p.rol='comercial' then
      update public.profiles set rol='Admin' where auth_id=p.auth_id;
      get diagnostics affected = row_count;
      if affected<>0 then raise exception 'Un comercial puede elevar su rol'; end if;
      update public.opportunities set memo=memo where id=foreign_id;
      get diagnostics affected = row_count;
      if affected<>0 then raise exception 'Un comercial puede editar leads ajenos'; end if;
    end if;
    select id into target_id from public.opportunities where public.crm_can_write_opportunity(id) limit 1;
    if target_id is not null then
      insert into public.opportunity_documentation_cases(opportunity_id,state) values (target_id,'{}')
        on conflict(opportunity_id) do update set updated_at=now();
      perform public.crm_soft_delete_leads(array[target_id]);
      if exists(select 1 from public.crm_leads_view where id=target_id) then
        raise exception 'El lead borrado sigue visible';
      end if;
    end if;
    reset role;
    checked := checked+1;
  end loop;
  if checked=0 then raise exception 'No se probaron usuarios'; end if;
end $$;
select 'PASS: vista por ID, catalogo minimo, aislamiento, bloqueo de escalada, escritura documental y borrado atomico; todo revertido' result;
rollback;
