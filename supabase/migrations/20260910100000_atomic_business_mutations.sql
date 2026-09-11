-- Fase 2: operaciones de negocio e historial dentro de una única transacción.

begin;

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
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
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
    for update;

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
      actor_name
    )
    returning id into saved_visit_id;

    activity_text := 'Agregó una visita';
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

    activity_text := 'Editó una visita' || coalesce(nullif(p_change_details, ''), ' sin cambios visibles');
  end if;

  insert into public.opportunity_contacts (opportunity_id, fecha, memo, resultado)
  values (
    target_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || activity_text,
    true
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
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
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
    for update;

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

    activity_text := 'Editó un encargo' || coalesce(nullif(p_change_details, ''), ' sin cambios visibles');
  end if;

  insert into public.opportunity_contacts (opportunity_id, fecha, memo, resultado)
  values (
    target_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': ' || activity_text,
    true
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
  actor_name text := coalesce(nullif(public.crm_current_name(), ''), 'Usuario');
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

  insert into public.opportunity_contacts (opportunity_id, fecha, memo, resultado)
  values (
    p_opportunity_id,
    current_date,
    '[HISTORIAL] ' || actor_name || ': Cambió fase de ' ||
      coalesce(previous_phase_name, 'Sin fase') || ' a ' || next_phase_name,
    true
  );
end
$$;

revoke all on function public.crm_save_visit_with_activity(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.crm_save_order_with_activity(bigint, bigint, jsonb, text) from public, anon;
revoke all on function public.crm_change_lead_phase_with_activity(bigint, bigint) from public, anon;

grant execute on function public.crm_save_visit_with_activity(bigint, bigint, jsonb, text) to authenticated, service_role;
grant execute on function public.crm_save_order_with_activity(bigint, bigint, jsonb, text) to authenticated, service_role;
grant execute on function public.crm_change_lead_phase_with_activity(bigint, bigint) to authenticated, service_role;

commit;
