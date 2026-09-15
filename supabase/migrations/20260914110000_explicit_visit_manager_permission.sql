-- Sustituye la excepción por nombre del visitador por un permiso explícito y
-- limita el acceso transversal de oportunidades a un DTO exclusivo de Visitas.

begin;

alter table public.profiles
  add column if not exists can_manage_visits boolean not null default false;

update public.profiles
set can_manage_visits = true
where lower(btrim(coalesce(rol, ''))) = 'comercial'
  and lower(btrim(coalesce(name, ''))) in ('gonza', 'gonzalo');

create or replace function public.crm_can_manage_visits()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_id = auth.uid()
      and coalesce(p.enabled, true)
      and lower(btrim(coalesce(p.rol, ''))) = 'comercial'
      and p.can_manage_visits
  )
$$;

-- Se conserva el helper anterior como alias temporal para no romper clientes
-- ya desplegados mientras el frontend pasa al permiso nuevo.
create or replace function public.crm_is_visitador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_can_manage_visits()
$$;

create or replace function public.crm_can_read_opportunity(target_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_id
      and o.deleted_at is null
      and (
        public.crm_current_role() in ('admin', 'coordinador')
        or (
          public.crm_current_role() = 'comercial'
          and not public.crm_can_manage_visits()
          and (
            (o.comercial_user_id is not null
              and o.comercial_user_id = public.crm_current_profile_id())
            or
            (o.comercial_user_id is null
              and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
                  lower(btrim(coalesce(public.crm_current_name(), ''))))
          )
        )
      )
  )
$$;

create or replace function public.crm_can_write_opportunity(target_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_id
      and o.deleted_at is null
      and (
        public.crm_current_role() in ('admin', 'coordinador')
        or (
          public.crm_current_role() = 'comercial'
          and not public.crm_can_manage_visits()
          and (
            (o.comercial_user_id is not null
              and o.comercial_user_id = public.crm_current_profile_id())
            or
            (o.comercial_user_id is null
              and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
                  lower(btrim(coalesce(public.crm_current_name(), ''))))
          )
        )
      )
  )
$$;

drop policy if exists opportunities_select_by_role on public.opportunities;
create policy opportunities_select_by_role
on public.opportunities for select to authenticated
using (public.crm_can_read_opportunity(id));

drop policy if exists visitas_select_by_role on public.visitas;
create policy visitas_select_by_role
on public.visitas for select to authenticated
using (
  public.crm_can_manage_visits()
  or public.crm_can_read_opportunity(opportunity_id)
);

drop policy if exists visitas_insert_by_role on public.visitas;
create policy visitas_insert_by_role
on public.visitas for insert to authenticated
with check (
  public.crm_can_manage_visits()
  or public.crm_can_write_opportunity(opportunity_id)
);

drop policy if exists visitas_update_by_role on public.visitas;
create policy visitas_update_by_role
on public.visitas for update to authenticated
using (
  public.crm_can_manage_visits()
  or public.crm_can_write_opportunity(opportunity_id)
)
with check (
  public.crm_can_manage_visits()
  or public.crm_can_write_opportunity(opportunity_id)
);

drop policy if exists visitas_delete_by_role on public.visitas;
create policy visitas_delete_by_role
on public.visitas for delete to authenticated
using (
  public.crm_can_manage_visits()
  or public.crm_can_write_opportunity(opportunity_id)
);

create or replace function public.crm_visit_property_options()
returns table (
  id bigint,
  propietario text,
  domicilio text,
  owner text,
  planner text,
  estado text,
  dominio text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.propietario,
    o.domicilio,
    coalesce(owner_profile.name, o.comercial_user_desc, 'Sin comercial') as owner,
    coalesce(planner_profile.name, o.contact_user_desc, 'Sin contacto') as planner,
    o.estado,
    o.dominio_desc as dominio
  from public.opportunities o
  join public.phases phase on phase.id = o.fase_id
  left join public.profiles owner_profile on owner_profile.id = o.comercial_user_id
  left join public.profiles planner_profile on planner_profile.id = o.contact_user_id
  where o.deleted_at is null
    and lower(btrim(phase.name)) = 'encargo'
    and (
      public.crm_can_manage_visits()
      or public.crm_can_read_opportunity(o.id)
    )
  order by o.propietario nulls last, o.id;
end
$$;

create or replace function public.crm_save_visit_with_activity(
  p_visit_id bigint,
  p_opportunity_id bigint,
  p_data jsonb,
  p_change_details text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_opportunity_id bigint;
  saved_visit_id bigint;
  activity_text text;
  activity_type text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos de la visita no son válidos' using errcode = '22023';
  end if;

  if p_visit_id is null then
    target_opportunity_id := p_opportunity_id;
    if target_opportunity_id is null then
      raise exception 'La oportunidad es obligatoria' using errcode = '23502';
    end if;

    perform 1
    from public.opportunities
    where id = target_opportunity_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
    end if;

    if not (
      public.crm_can_manage_visits()
      or public.crm_can_write_opportunity(target_opportunity_id)
    ) then
      raise exception 'No tienes permiso para crear esta visita' using errcode = '42501';
    end if;

    insert into public.visitas (
      opportunity_id,
      estado,
      dominio,
      planner,
      owner,
      fecha_visita,
      hora,
      buyer,
      nombre_apellido,
      telefono,
      dni,
      vende,
      observaciones_visita,
      created_by
    )
    values (
      target_opportunity_id,
      nullif(p_data ->> 'estado', ''),
      nullif(p_data ->> 'dominio', ''),
      nullif(p_data ->> 'planner', ''),
      nullif(p_data ->> 'owner', ''),
      nullif(p_data ->> 'fecha_visita', '')::date,
      nullif(p_data ->> 'hora', '')::time,
      nullif(p_data ->> 'buyer', ''),
      nullif(p_data ->> 'nombre_apellido', ''),
      nullif(p_data ->> 'telefono', ''),
      nullif(p_data ->> 'dni', ''),
      case
        when p_data ->> 'vende' in ('true', 'false') then (p_data ->> 'vende')::boolean
        else null
      end,
      nullif(p_data ->> 'observaciones_visita', ''),
      coalesce(nullif(public.crm_current_name(), ''), 'Usuario')
    )
    returning id into saved_visit_id;

    activity_text := 'Agregó una visita';
    activity_type := 'visit_created';
  else
    select opportunity_id
    into target_opportunity_id
    from public.visitas
    where id = p_visit_id
    for update;

    if not found then
      raise exception 'La visita no existe' using errcode = 'P0002';
    end if;

    if not (
      public.crm_can_manage_visits()
      or public.crm_can_write_opportunity(target_opportunity_id)
    ) then
      raise exception 'No tienes permiso para editar esta visita' using errcode = '42501';
    end if;

    update public.visitas
    set
      fecha_visita = nullif(p_data ->> 'fecha_visita', '')::date,
      hora = nullif(p_data ->> 'hora', '')::time,
      buyer = nullif(p_data ->> 'buyer', ''),
      nombre_apellido = nullif(p_data ->> 'nombre_apellido', ''),
      telefono = nullif(p_data ->> 'telefono', ''),
      dni = nullif(p_data ->> 'dni', ''),
      vende = case
        when p_data ->> 'vende' in ('true', 'false') then (p_data ->> 'vende')::boolean
        else null
      end,
      observaciones_visita = nullif(p_data ->> 'observaciones_visita', ''),
      updated_at = now()
    where id = p_visit_id
    returning id into saved_visit_id;

    activity_text := 'Editó una visita' ||
      coalesce(nullif(p_change_details, ''), ' sin cambios visibles');
    activity_type := 'visit_updated';
  end if;

  perform public.crm_record_system_activity(
    target_opportunity_id,
    activity_type,
    activity_text,
    jsonb_build_object(
      'visit_id', saved_visit_id,
      'change_details', p_change_details
    )
  );

  return saved_visit_id;
end
$$;

revoke all on function public.crm_can_manage_visits() from public, anon;
revoke all on function public.crm_visit_property_options() from public, anon;
grant execute on function public.crm_can_manage_visits() to authenticated, service_role;
grant execute on function public.crm_visit_property_options() to authenticated, service_role;

commit;
