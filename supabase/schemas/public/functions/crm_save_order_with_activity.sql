CREATE OR REPLACE FUNCTION public.crm_save_order_with_activity (
  p_order_id       bigint,
  p_opportunity_id bigint,
  p_data           jsonb,
  p_change_details text
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_save_order_with_activity"(bigint, bigint, jsonb, text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_save_order_with_activity"(bigint, bigint, jsonb, text) FROM PUBLIC;
