CREATE OR REPLACE FUNCTION public.crm_change_lead_phase_with_activity (
  p_opportunity_id bigint,
  p_phase_id       bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_change_lead_phase_with_activity"(bigint, bigint) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_change_lead_phase_with_activity"(bigint, bigint) FROM PUBLIC;
