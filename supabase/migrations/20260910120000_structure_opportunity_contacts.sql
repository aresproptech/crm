-- Estructura los eventos de opportunity_contacts sin romper los memos históricos.

begin;

alter table public.opportunity_contacts
  add column if not exists event_type text,
  add column if not exists actor_profile_id bigint,
  add column if not exists effective_at timestamptz,
  add column if not exists metadata jsonb,
  add column if not exists parent_event_id bigint,
  add column if not exists updated_at timestamptz;

update public.opportunity_contacts
set
  event_type = case
    when btrim(coalesce(memo, '')) ilike '[VALORACION]%' then 'valuation'
    when btrim(coalesce(memo, '')) ilike '[R.G.]%' then 'rg'
    when btrim(coalesce(memo, '')) ilike '[NOTA]%' then 'note'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%editó una valoración%' then 'valuation_updated'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%editó una r.g.%' then 'rg_updated'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%agregó una visita%' then 'visit_created'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%editó una visita%' then 'visit_updated'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%agregó un encargo%' then 'order_created'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%editó un encargo%' then 'order_updated'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%cambió fase%' then 'phase_changed'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%llamó al lead%' then 'call'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%importó el lead%' then 'lead_imported'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%creó el lead%' then 'lead_created'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%'
      and lower(memo) like '%eliminó el lead%' then 'lead_deleted'
    when btrim(coalesce(memo, '')) ilike '[HISTORIAL]%' then 'activity'
    else 'legacy'
  end,
  effective_at = coalesce(
    effective_at,
    case
      when fecha is not null then fecha::timestamp at time zone 'Europe/Madrid'
      else created_at
    end
  ),
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.opportunity_contacts
  alter column event_type set default 'legacy',
  alter column event_type set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.opportunity_contacts
  drop constraint if exists opportunity_contacts_event_type_check,
  add constraint opportunity_contacts_event_type_check check (
    event_type = any (array[
      'legacy',
      'activity',
      'note',
      'call',
      'valuation',
      'valuation_updated',
      'rg',
      'rg_updated',
      'lead_created',
      'lead_imported',
      'lead_updated',
      'lead_deleted',
      'phase_changed',
      'visit_created',
      'visit_updated',
      'order_created',
      'order_updated'
    ]::text[])
  ),
  drop constraint if exists opportunity_contacts_actor_profile_id_fkey,
  add constraint opportunity_contacts_actor_profile_id_fkey
    foreign key (actor_profile_id) references public.profiles(id) on delete set null,
  drop constraint if exists opportunity_contacts_parent_event_id_fkey,
  add constraint opportunity_contacts_parent_event_id_fkey
    foreign key (parent_event_id) references public.opportunity_contacts(id) on delete set null;

create index if not exists idx_opportunity_contacts_event_type_fecha
  on public.opportunity_contacts (event_type, fecha desc);

create index if not exists idx_opportunity_contacts_opportunity_event_created
  on public.opportunity_contacts (opportunity_id, event_type, created_at desc);

create index if not exists idx_opportunity_contacts_actor_profile_id
  on public.opportunity_contacts (actor_profile_id)
  where actor_profile_id is not null;

create or replace function public.crm_prepare_opportunity_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_id bigint := public.crm_current_profile_id();
  current_actor_name text := public.crm_current_name();
begin
  if tg_op = 'UPDATE' then
    if new.opportunity_id is distinct from old.opportunity_id then
      raise exception 'No se puede mover una actividad a otro lead' using errcode = '22023';
    end if;

    if old.event_type not in ('legacy', 'valuation', 'rg') then
      raise exception 'Los eventos de auditoría son inmutables' using errcode = '22023';
    end if;

    if old.event_type <> 'legacy' and new.event_type is distinct from old.event_type then
      raise exception 'No se puede cambiar el tipo de una actividad' using errcode = '22023';
    end if;
  end if;

  if new.event_type is null or new.event_type = 'legacy' then
    new.event_type := case
      when btrim(coalesce(new.memo, '')) ilike '[VALORACION]%' then 'valuation'
      when btrim(coalesce(new.memo, '')) ilike '[R.G.]%' then 'rg'
      when btrim(coalesce(new.memo, '')) ilike '[NOTA]%' then 'note'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una valoración%' then 'valuation_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una r.g.%' then 'rg_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%agregó una visita%' then 'visit_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una visita%' then 'visit_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%agregó un encargo%' then 'order_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó un encargo%' then 'order_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%cambió fase%' then 'phase_changed'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%llamó al lead%' then 'call'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%importó el lead%' then 'lead_imported'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%creó el lead%' then 'lead_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%eliminó el lead%' then 'lead_deleted'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%' then 'activity'
      else 'legacy'
    end;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if current_actor_id is not null then
    new.actor_profile_id := current_actor_id;
  end if;

  if current_actor_name is not null then
    new.metadata := new.metadata || jsonb_build_object('actor_name', current_actor_name);
  end if;

  if
    tg_op = 'UPDATE'
    and new.fecha is distinct from old.fecha
    and new.effective_at is not distinct from old.effective_at
  then
    new.effective_at := case
      when new.fecha is not null then new.fecha::timestamp at time zone 'Europe/Madrid'
      else now()
    end;
  elsif new.effective_at is null then
    new.effective_at := case
      when new.fecha is not null then new.fecha::timestamp at time zone 'Europe/Madrid'
      else now()
    end;
  end if;

  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists crm_prepare_opportunity_contact_trigger
  on public.opportunity_contacts;

create trigger crm_prepare_opportunity_contact_trigger
before insert or update on public.opportunity_contacts
for each row execute function public.crm_prepare_opportunity_contact();

revoke all on function public.crm_prepare_opportunity_contact() from public, anon;
grant execute on function public.crm_prepare_opportunity_contact() to authenticated, service_role;

drop policy if exists contacts_insert_by_opportunity
  on public.opportunity_contacts;

create policy contacts_insert_by_opportunity
on public.opportunity_contacts for insert to authenticated
with check (public.crm_can_write_opportunity(opportunity_id));

create or replace function public.crm_add_contact_activity(
  p_opportunity_id bigint,
  p_event_type text,
  p_text text,
  p_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_event_id bigint;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  clean_text text := nullif(btrim(p_text), '');
  event_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_event_type is null or p_event_type not in (
    'activity',
    'note',
    'call',
    'lead_created',
    'lead_imported',
    'lead_updated'
  ) then
    raise exception 'Tipo de actividad no permitido' using errcode = '22023';
  end if;

  if clean_text is null then
    raise exception 'El texto de la actividad es obligatorio' using errcode = '22023';
  end if;

  if jsonb_typeof(event_metadata) <> 'object' then
    raise exception 'Los metadatos no son válidos' using errcode = '22023';
  end if;

  perform 1
  from public.opportunities
  where id = p_opportunity_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
  end if;

  if not public.crm_can_write_opportunity(p_opportunity_id) then
    raise exception 'No tienes permiso para registrar esta actividad' using errcode = '42501';
  end if;

  insert into public.opportunity_contacts (
    opportunity_id,
    fecha,
    memo,
    resultado,
    event_type,
    actor_profile_id,
    effective_at,
    metadata
  )
  values (
    p_opportunity_id,
    current_date,
    case
      when p_event_type = 'note' then '[NOTA] '
      else '[HISTORIAL] '
    end || actor_name || ': ' || clean_text,
    true,
    p_event_type,
    actor_id,
    now(),
    event_metadata || jsonb_build_object(
      'actor_name', actor_name,
      'text', clean_text
    )
  )
  returning id into saved_event_id;

  return saved_event_id;
end
$$;

create or replace function public.crm_save_valuation_with_activity(
  p_contact_id bigint,
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
  saved_contact_id bigint;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  event_date date;
  event_time time;
  effective_value timestamptz;
  event_metadata jsonb;
  summary_text text;
  previous_data jsonb;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos de la valoración no son válidos' using errcode = '22023';
  end if;

  event_date := nullif(p_data ->> 'fecha', '')::date;
  event_time := nullif(p_data ->> 'hora', '')::time;

  if event_date is null then
    raise exception 'La fecha de la valoración es obligatoria' using errcode = '23502';
  end if;

  effective_value := (
    event_date + coalesce(event_time, time '00:00')
  ) at time zone 'Europe/Madrid';
  event_metadata := jsonb_build_object(
    'actor_name', actor_name,
    'medio', nullif(p_data ->> 'medio', ''),
    'hora', nullif(p_data ->> 'hora', ''),
    'notes', nullif(p_data ->> 'notes', '')
  );
  summary_text := '[VALORACION] ' || actor_name || ': Medio: ' ||
    coalesce(nullif(p_data ->> 'medio', ''), '—') ||
    case
      when event_time is not null then ' | Hora: ' || to_char(event_time, 'HH24:MI')
      else ''
    end;

  if nullif(p_data ->> 'notes', '') is not null then
    summary_text := summary_text || E'\n' || btrim(p_data ->> 'notes');
  end if;

  if p_contact_id is null then
    target_opportunity_id := p_opportunity_id;

    perform 1
    from public.opportunities
    where id = target_opportunity_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
    end if;

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para crear esta valoración' using errcode = '42501';
    end if;

    insert into public.opportunity_contacts (
      opportunity_id,
      fecha,
      memo,
      resultado,
      event_type,
      actor_profile_id,
      effective_at,
      metadata
    )
    values (
      target_opportunity_id,
      event_date,
      summary_text,
      true,
      'valuation',
      actor_id,
      effective_value,
      event_metadata
    )
    returning id into saved_contact_id;
  else
    select
      opportunity_id,
      jsonb_build_object(
        'fecha', fecha,
        'effective_at', effective_at,
        'metadata', metadata,
        'memo', memo
      )
    into target_opportunity_id, previous_data
    from public.opportunity_contacts
    where id = p_contact_id
      and (
        event_type = 'valuation'
        or (event_type = 'legacy' and btrim(coalesce(memo, '')) ilike '[VALORACION]%')
      )
    for update;

    if not found then
      raise exception 'La valoración no existe' using errcode = 'P0002';
    end if;

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para editar esta valoración' using errcode = '42501';
    end if;

    update public.opportunity_contacts
    set
      fecha = event_date,
      memo = summary_text,
      resultado = true,
      event_type = 'valuation',
      actor_profile_id = actor_id,
      effective_at = effective_value,
      metadata = event_metadata
    where id = p_contact_id
    returning id into saved_contact_id;

    insert into public.opportunity_contacts (
      opportunity_id,
      fecha,
      memo,
      resultado,
      event_type,
      actor_profile_id,
      effective_at,
      metadata,
      parent_event_id
    )
    values (
      target_opportunity_id,
      current_date,
      '[HISTORIAL] ' || actor_name || ': Editó una valoración' ||
        coalesce(nullif(p_change_details, ''), ' sin cambios visibles'),
      true,
      'valuation_updated',
      actor_id,
      now(),
      jsonb_build_object(
        'actor_name', actor_name,
        'change_details', p_change_details,
        'before', previous_data,
        'after', jsonb_build_object(
          'fecha', event_date,
          'effective_at', effective_value,
          'metadata', event_metadata,
          'memo', summary_text
        )
      ),
      saved_contact_id
    );
  end if;

  return saved_contact_id;
end
$$;

create or replace function public.crm_save_rg_with_activity(
  p_contact_id bigint,
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
  saved_contact_id bigint;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  event_date date;
  event_time time;
  effective_value timestamptz;
  event_metadata jsonb;
  summary_text text;
  previous_data jsonb;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos de la R.G. no son válidos' using errcode = '22023';
  end if;

  event_date := nullif(p_data ->> 'fecha', '')::date;
  event_time := nullif(p_data ->> 'hora', '')::time;

  if event_date is null then
    raise exception 'La fecha de la R.G. es obligatoria' using errcode = '23502';
  end if;

  effective_value := (
    event_date + coalesce(event_time, time '00:00')
  ) at time zone 'Europe/Madrid';
  event_metadata := jsonb_build_object(
    'actor_name', actor_name,
    'medio', nullif(p_data ->> 'medio', ''),
    'resultado', nullif(p_data ->> 'resultado', ''),
    'hora', nullif(p_data ->> 'hora', ''),
    'notes', nullif(p_data ->> 'notes', '')
  );
  summary_text := '[R.G.] ' || actor_name || ': Medio: ' ||
    coalesce(nullif(p_data ->> 'medio', ''), '—') ||
    ' | Resultado: ' || coalesce(nullif(p_data ->> 'resultado', ''), '—') ||
    case
      when event_time is not null then ' | Hora: ' || to_char(event_time, 'HH24:MI')
      else ''
    end;

  if nullif(p_data ->> 'notes', '') is not null then
    summary_text := summary_text || E'\n' || btrim(p_data ->> 'notes');
  end if;

  if p_contact_id is null then
    target_opportunity_id := p_opportunity_id;

    perform 1
    from public.opportunities
    where id = target_opportunity_id
      and deleted_at is null
    for update;

    if not found then
      raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
    end if;

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para crear esta R.G.' using errcode = '42501';
    end if;

    insert into public.opportunity_contacts (
      opportunity_id,
      fecha,
      memo,
      resultado,
      event_type,
      actor_profile_id,
      effective_at,
      metadata
    )
    values (
      target_opportunity_id,
      event_date,
      summary_text,
      true,
      'rg',
      actor_id,
      effective_value,
      event_metadata
    )
    returning id into saved_contact_id;
  else
    select
      opportunity_id,
      jsonb_build_object(
        'fecha', fecha,
        'effective_at', effective_at,
        'metadata', metadata,
        'memo', memo
      )
    into target_opportunity_id, previous_data
    from public.opportunity_contacts
    where id = p_contact_id
      and (
        event_type = 'rg'
        or (event_type = 'legacy' and btrim(coalesce(memo, '')) ilike '[R.G.]%')
      )
    for update;

    if not found then
      raise exception 'La R.G. no existe' using errcode = 'P0002';
    end if;

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para editar esta R.G.' using errcode = '42501';
    end if;

    update public.opportunity_contacts
    set
      fecha = event_date,
      memo = summary_text,
      resultado = true,
      event_type = 'rg',
      actor_profile_id = actor_id,
      effective_at = effective_value,
      metadata = event_metadata
    where id = p_contact_id
    returning id into saved_contact_id;

    insert into public.opportunity_contacts (
      opportunity_id,
      fecha,
      memo,
      resultado,
      event_type,
      actor_profile_id,
      effective_at,
      metadata,
      parent_event_id
    )
    values (
      target_opportunity_id,
      current_date,
      '[HISTORIAL] ' || actor_name || ': Editó una R.G.' ||
        coalesce(nullif(p_change_details, ''), ' sin cambios visibles'),
      true,
      'rg_updated',
      actor_id,
      now(),
      jsonb_build_object(
        'actor_name', actor_name,
        'change_details', p_change_details,
        'before', previous_data,
        'after', jsonb_build_object(
          'fecha', event_date,
          'effective_at', effective_value,
          'metadata', event_metadata,
          'memo', summary_text
        )
      ),
      saved_contact_id
    );
  end if;

  return saved_contact_id;
end
$$;

create or replace function public.crm_record_system_activity(
  p_opportunity_id bigint,
  p_event_type text,
  p_text text,
  p_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_event_id bigint;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
begin
  insert into public.opportunity_contacts (
    opportunity_id,
    fecha,
    memo,
    resultado,
    event_type,
    actor_profile_id,
    effective_at,
    metadata
  )
  values (
    p_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || p_text,
    true,
    p_event_type,
    actor_id,
    now(),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'actor_name', actor_name,
      'text', p_text
    )
  )
  returning id into saved_event_id;

  return saved_event_id;
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
      public.crm_can_write_opportunity(target_opportunity_id)
      or (
        public.crm_is_visitador()
        and public.crm_can_read_opportunity(target_opportunity_id)
      )
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
      public.crm_can_write_opportunity(target_opportunity_id)
      or (
        public.crm_is_visitador()
        and public.crm_can_read_opportunity(target_opportunity_id)
      )
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

create or replace function public.crm_save_order_with_activity(
  p_order_id bigint,
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
  saved_order_id bigint;
  activity_text text;
  activity_type text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos del encargo no son válidos' using errcode = '22023';
  end if;

  if p_order_id is null then
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

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para crear este encargo' using errcode = '42501';
    end if;

    insert into public.opportunity_orders (
      opportunity_id,
      fecha_inicio,
      fecha_fin,
      pvp_inicial,
      pvp_actual,
      pvp_estimado,
      com_vendedor,
      com_comprador,
      memo,
      rebajas
    )
    values (
      target_opportunity_id,
      nullif(p_data ->> 'fecha_inicio', '')::date,
      nullif(p_data ->> 'fecha_fin', '')::date,
      nullif(p_data ->> 'pvp_inicial', '')::bigint,
      nullif(p_data ->> 'pvp_actual', '')::bigint,
      nullif(p_data ->> 'pvp_estimado', '')::bigint,
      nullif(p_data ->> 'com_vendedor', '')::real,
      nullif(p_data ->> 'com_comprador', '')::real,
      nullif(p_data ->> 'memo', ''),
      coalesce(nullif(p_data ->> 'rebajas', '')::integer, 0)
    )
    returning id into saved_order_id;

    activity_text := 'Agregó un encargo';
    activity_type := 'order_created';
  else
    select opportunity_id
    into target_opportunity_id
    from public.opportunity_orders
    where id = p_order_id
    for update;

    if not found then
      raise exception 'El encargo no existe' using errcode = 'P0002';
    end if;

    if not public.crm_can_write_opportunity(target_opportunity_id) then
      raise exception 'No tienes permiso para editar este encargo' using errcode = '42501';
    end if;

    update public.opportunity_orders
    set
      fecha_inicio = nullif(p_data ->> 'fecha_inicio', '')::date,
      fecha_fin = nullif(p_data ->> 'fecha_fin', '')::date,
      pvp_inicial = nullif(p_data ->> 'pvp_inicial', '')::bigint,
      pvp_actual = nullif(p_data ->> 'pvp_actual', '')::bigint,
      pvp_estimado = nullif(p_data ->> 'pvp_estimado', '')::bigint,
      com_vendedor = nullif(p_data ->> 'com_vendedor', '')::real,
      com_comprador = nullif(p_data ->> 'com_comprador', '')::real,
      memo = nullif(p_data ->> 'memo', ''),
      rebajas = coalesce(nullif(p_data ->> 'rebajas', '')::integer, 0)
    where id = p_order_id
    returning id into saved_order_id;

    activity_text := 'Editó un encargo' ||
      coalesce(nullif(p_change_details, ''), ' sin cambios visibles');
    activity_type := 'order_updated';
  end if;

  perform public.crm_record_system_activity(
    target_opportunity_id,
    activity_type,
    activity_text,
    jsonb_build_object(
      'order_id', saved_order_id,
      'change_details', p_change_details
    )
  );

  return saved_order_id;
end
$$;

create or replace function public.crm_change_lead_phase_with_activity(
  p_opportunity_id bigint,
  p_phase_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_phase_id bigint;
  previous_phase_name text;
  next_phase_name text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  select o.fase_id, p.name
  into previous_phase_id, previous_phase_name
  from public.opportunities o
  left join public.phases p on p.id = o.fase_id
  where o.id = p_opportunity_id
    and o.deleted_at is null
  for update of o;

  if not found then
    raise exception 'El lead no existe o está eliminado' using errcode = 'P0002';
  end if;

  if not public.crm_can_write_opportunity(p_opportunity_id) then
    raise exception 'No tienes permiso para cambiar la fase de este lead' using errcode = '42501';
  end if;

  select name
  into next_phase_name
  from public.phases
  where id = p_phase_id
    and coalesce(enabled, true);

  if not found then
    raise exception 'La fase de destino no existe o está deshabilitada' using errcode = '22023';
  end if;

  if previous_phase_id is not distinct from p_phase_id then
    return;
  end if;

  update public.opportunities
  set fase_id = p_phase_id
  where id = p_opportunity_id;

  perform public.crm_record_system_activity(
    p_opportunity_id,
    'phase_changed',
    'Cambió fase de ' || coalesce(previous_phase_name, 'Sin fase') ||
      ' a ' || next_phase_name,
    jsonb_build_object(
      'previous_phase_id', previous_phase_id,
      'previous_phase_name', previous_phase_name,
      'next_phase_id', p_phase_id,
      'next_phase_name', next_phase_name
    )
  );
end
$$;

create or replace function public.crm_soft_delete_leads(lead_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id bigint;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if lead_ids is null or cardinality(lead_ids) = 0 then
    return;
  end if;

  perform 1
  from public.opportunities
  where id = any(lead_ids)
    and deleted_at is null
  order by id
  for update;

  foreach target_id in array lead_ids loop
    if not public.crm_can_write_opportunity(target_id) then
      raise exception 'No tienes permiso para eliminar uno de los leads' using errcode = '42501';
    end if;
  end loop;

  update public.opportunities
  set deleted_at = now()
  where id = any(lead_ids);

  foreach target_id in array lead_ids loop
    perform public.crm_record_system_activity(
      target_id,
      'lead_deleted',
      'Eliminó el lead',
      jsonb_build_object('lead_id', target_id)
    );
  end loop;
end
$$;

revoke all on function public.crm_add_contact_activity(bigint, text, text, jsonb) from public, anon;
revoke all on function public.crm_save_valuation_with_activity(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.crm_save_rg_with_activity(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.crm_record_system_activity(bigint, text, text, jsonb) from public, anon, authenticated, service_role;

grant execute on function public.crm_add_contact_activity(bigint, text, text, jsonb) to authenticated, service_role;
grant execute on function public.crm_save_valuation_with_activity(bigint, bigint, jsonb, text) to authenticated, service_role;
grant execute on function public.crm_save_rg_with_activity(bigint, bigint, jsonb, text) to authenticated, service_role;

commit;
