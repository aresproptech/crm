-- Completa la atomicidad de las altas, importaciones y ediciones de leads.

begin;

create or replace function public.crm_create_lead_with_activity(
  p_data jsonb,
  p_event_type text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_opportunity_id bigint;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  activity_text text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos del lead no son válidos' using errcode = '22023';
  end if;

  if p_event_type is null or p_event_type not in ('lead_created', 'lead_imported') then
    raise exception 'Tipo de alta de lead no permitido' using errcode = '22023';
  end if;

  insert into public.opportunities (
    propietario,
    domicilio,
    telefono,
    tasacion,
    estado,
    fecha,
    fecha_contacto,
    fecha_valoracion,
    hora,
    source_desc,
    comercial_user_desc,
    contact_user_desc,
    dominio_desc,
    postal_id,
    fase_id,
    memo,
    en_venta,
    medio,
    source_id,
    comercial_user_id,
    contact_user_id,
    team_id,
    deleted_at
  )
  values (
    nullif(btrim(p_data ->> 'propietario'), ''),
    nullif(btrim(p_data ->> 'domicilio'), ''),
    nullif(btrim(p_data ->> 'telefono'), ''),
    nullif(btrim(p_data ->> 'tasacion'), ''),
    nullif(btrim(p_data ->> 'estado'), ''),
    nullif(btrim(p_data ->> 'fecha'), ''),
    nullif(p_data ->> 'fecha_contacto', '')::date,
    nullif(p_data ->> 'fecha_valoracion', '')::date,
    nullif(p_data ->> 'hora', '')::time,
    nullif(btrim(p_data ->> 'source_desc'), ''),
    nullif(btrim(p_data ->> 'comercial_user_desc'), ''),
    nullif(btrim(p_data ->> 'contact_user_desc'), ''),
    nullif(btrim(p_data ->> 'dominio_desc'), ''),
    nullif(p_data ->> 'postal_id', '')::bigint,
    nullif(p_data ->> 'fase_id', '')::bigint,
    nullif(btrim(p_data ->> 'memo'), ''),
    nullif(btrim(p_data ->> 'en_venta'), ''),
    nullif(btrim(p_data ->> 'medio'), ''),
    nullif(p_data ->> 'source_id', '')::bigint,
    nullif(p_data ->> 'comercial_user_id', '')::bigint,
    nullif(p_data ->> 'contact_user_id', '')::bigint,
    nullif(p_data ->> 'team_id', '')::bigint,
    null
  )
  returning id into saved_opportunity_id;

  activity_text := case p_event_type
    when 'lead_imported' then 'Importó el lead por CSV'
    else 'Creó el lead'
  end;

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
    saved_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || activity_text,
    true,
    p_event_type,
    actor_id,
    now(),
    jsonb_build_object(
      'actor_name', actor_name,
      'text', activity_text,
      'lead_id', saved_opportunity_id
    )
  );

  return saved_opportunity_id;
end
$$;

create or replace function public.crm_import_leads_with_activity(
  p_rows jsonb
)
returns bigint[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_data jsonb;
  saved_opportunity_id bigint;
  saved_ids bigint[] := '{}'::bigint[];
  row_count integer;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'La importación debe contener una lista de leads' using errcode = '22023';
  end if;

  row_count := jsonb_array_length(p_rows);

  if row_count = 0 then
    raise exception 'No hay leads para importar' using errcode = '22023';
  end if;

  if row_count > 5000 then
    raise exception 'La importación no puede superar 5000 leads por archivo' using errcode = '22023';
  end if;

  for row_data in
    select value
    from jsonb_array_elements(p_rows)
  loop
    saved_opportunity_id := public.crm_create_lead_with_activity(
      row_data,
      'lead_imported'
    );
    saved_ids := array_append(saved_ids, saved_opportunity_id);
  end loop;

  return saved_ids;
end
$$;

create or replace function public.crm_update_lead_with_activity(
  p_opportunity_id bigint,
  p_data jsonb,
  p_change_details text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_opportunity public.opportunities%rowtype;
  before_data jsonb;
  after_data jsonb;
  before_snapshot jsonb;
  after_snapshot jsonb;
  actor_id bigint := public.crm_current_profile_id();
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
  clean_change_details text := nullif(btrim(p_change_details), '');
  activity_text text;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_opportunity_id is null then
    raise exception 'El lead es obligatorio' using errcode = '23502';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Los datos del lead no son válidos' using errcode = '22023';
  end if;

  select to_jsonb(o)
  into before_data
  from public.opportunities o
  where o.id = p_opportunity_id
    and o.deleted_at is null
  for update of o;

  if not found then
    raise exception 'El lead no existe, está eliminado o no tenés permiso para editarlo' using errcode = 'P0002';
  end if;

  update public.opportunities
  set
    propietario = nullif(btrim(p_data ->> 'propietario'), ''),
    domicilio = nullif(btrim(p_data ->> 'domicilio'), ''),
    telefono = nullif(btrim(p_data ->> 'telefono'), ''),
    tasacion = nullif(btrim(p_data ->> 'tasacion'), ''),
    estado = nullif(btrim(p_data ->> 'estado'), ''),
    fecha = nullif(btrim(p_data ->> 'fecha'), ''),
    fecha_contacto = nullif(p_data ->> 'fecha_contacto', '')::date,
    fecha_valoracion = nullif(p_data ->> 'fecha_valoracion', '')::date,
    hora = nullif(p_data ->> 'hora', '')::time,
    source_desc = nullif(btrim(p_data ->> 'source_desc'), ''),
    comercial_user_desc = nullif(btrim(p_data ->> 'comercial_user_desc'), ''),
    contact_user_desc = nullif(btrim(p_data ->> 'contact_user_desc'), ''),
    dominio_desc = nullif(btrim(p_data ->> 'dominio_desc'), ''),
    postal_id = nullif(p_data ->> 'postal_id', '')::bigint,
    fase_id = nullif(p_data ->> 'fase_id', '')::bigint,
    memo = nullif(btrim(p_data ->> 'memo'), ''),
    en_venta = nullif(btrim(p_data ->> 'en_venta'), ''),
    medio = nullif(btrim(p_data ->> 'medio'), ''),
    source_id = nullif(p_data ->> 'source_id', '')::bigint,
    comercial_user_id = nullif(p_data ->> 'comercial_user_id', '')::bigint,
    contact_user_id = nullif(p_data ->> 'contact_user_id', '')::bigint
  where id = p_opportunity_id
  returning * into saved_opportunity;

  if not found then
    raise exception 'No se pudo actualizar el lead' using errcode = 'P0002';
  end if;

  after_data := to_jsonb(saved_opportunity);
  before_snapshot := before_data - array['id', 'created_at', 'deleted_at', 'is_favorite', 'contacto', 'team_id'];
  after_snapshot := after_data - array['id', 'created_at', 'deleted_at', 'is_favorite', 'contacto', 'team_id'];

  if before_snapshot is distinct from after_snapshot then
    activity_text := 'Actualizó el lead' || case
      when clean_change_details is not null then ': ' || clean_change_details
      else ''
    end;

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
      '[HISTORIAL] ' || actor_name || ': ' || activity_text,
      true,
      'lead_updated',
      actor_id,
      now(),
      jsonb_build_object(
        'actor_name', actor_name,
        'text', activity_text,
        'change_details', clean_change_details,
        'before', before_snapshot,
        'after', after_snapshot
      )
    );
  end if;

  return saved_opportunity.id;
end
$$;

revoke all on function public.crm_create_lead_with_activity(jsonb, text) from public, anon;
revoke all on function public.crm_import_leads_with_activity(jsonb) from public, anon;
revoke all on function public.crm_update_lead_with_activity(bigint, jsonb, text) from public, anon;

grant execute on function public.crm_create_lead_with_activity(jsonb, text) to authenticated, service_role;
grant execute on function public.crm_import_leads_with_activity(jsonb) to authenticated, service_role;
grant execute on function public.crm_update_lead_with_activity(bigint, jsonb, text) to authenticated, service_role;

commit;
